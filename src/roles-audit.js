import {
  AttachmentBuilder,
  EmbedBuilder,
  Events,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";

import { registerApplicationCommands } from "./command-registry.js";

const COMMAND_NAME = "roles-audit";
const COLOR = 0xffd9ff;

export function buildRolesAuditCommand() {
  return new SlashCommandBuilder()
    .setName(COMMAND_NAME)
    .setDescription("Export the server role inventory for a safe organization review")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles.toString())
    .toJSON();
}

export function buildRolesAuditData(guild, roles) {
  if (!guild?.id || !Array.isArray(roles)) {
    throw new Error("A server and a role list are required.");
  }

  const sortedRoles = [...roles].sort((a, b) =>
    b.position - a.position || String(a.name).localeCompare(String(b.name)),
  );

  return {
    schemaVersion: 1,
    guild: {
      id: guild.id,
      name: guild.name,
    },
    generatedAt: new Date().toISOString(),
    roleCount: sortedRoles.length,
    roles: sortedRoles.map((role) => ({
      id: role.id,
      name: role.name,
      color: role.hexColor,
      colorValue: role.color,
      position: role.position,
      permissions: role.permissions.toArray(),
      managed: Boolean(role.managed),
      hoist: Boolean(role.hoist),
      mentionable: Boolean(role.mentionable),
      everyone: Boolean(role.id === guild.id),
      editableByBot: Boolean(role.editable),
    })),
  };
}

async function registerForGuild({ token, applicationId }, guildId) {
  await registerApplicationCommands({
    token,
    applicationId,
    guildId,
    commands: [buildRolesAuditCommand()],
  });
}

export function attachRolesAuditSystem(client, { token, applicationId }) {
  let readyHandled = false;

  client.once(Events.ClientReady, () => {
    readyHandled = true;
    for (const guild of client.guilds.cache.values()) {
      void registerForGuild({ token, applicationId }, guild.id).catch((error) => {
        console.error(`[roles-audit] command registration failed in ${guild.id}: ${error.message}`);
      });
    }
  });

  client.on(Events.GuildCreate, (guild) => {
    if (!readyHandled) return;
    void registerForGuild({ token, applicationId }, guild.id).catch((error) => {
      console.error(`[roles-audit] command registration failed in ${guild.id}: ${error.message}`);
    });
  });

  client.on(Events.InteractionCreate, (interaction) => {
    if (!interaction.isChatInputCommand() || interaction.commandName !== COMMAND_NAME) return;
    void handleRolesAudit(interaction).catch(async (error) => {
      console.error(`[roles-audit] export failed in ${interaction.guildId ?? "unknown server"}: ${error.message}`);
      const message = "Sugar couldn't export the role inventory. Please try again or check the bot's server access.";
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: message, ephemeral: true }).catch(() => {});
      } else {
        await interaction.reply({ content: message, ephemeral: true }).catch(() => {});
      }
    });
  });
}

export async function handleRolesAudit(interaction) {
  if (!interaction.inGuild()) {
    return interaction.reply({ content: "This command only works inside a server.", ephemeral: true });
  }

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles)) {
    return interaction.reply({ content: "You need Manage Roles permission to use this command.", ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });
  const roles = await interaction.guild.roles.fetch();
  const audit = buildRolesAuditData(interaction.guild, [...roles.values()]);
  const json = JSON.stringify(audit, null, 2);
  const attachment = new AttachmentBuilder(Buffer.from(json, "utf8"), {
    name: "kittisugar-roles-audit.json",
    description: "Read-only inventory of server roles, colors, hierarchy, and permissions",
  });
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle("୨୧ Roles Audit ♡")
    .setDescription(
      `Sugar found **${audit.roleCount} roles** in **${interaction.guild.name}**. The complete inventory is attached as JSON.\n\nThis is a **read-only audit**: no roles, colors, permissions, or positions have been changed.`,
    )
    .setFooter({ text: "Only you can see this report ♡" });

  return interaction.editReply({ embeds: [embed], files: [attachment] });
}
