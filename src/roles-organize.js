import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Events,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";

import { readFileSync } from "node:fs";

import { registerApplicationCommands } from "./command-registry.js";

export const ROLE_ORGANIZATION_CONFIG = JSON.parse(
  readFileSync(new URL("../config/roles.json", import.meta.url), "utf8"),
);

function validateRoleOrganizationConfig(config) {
  if (config.version !== 1 || !/^\d{17,20}$/.test(config.guildId)) {
    throw new Error("Invalid Kittisugar role configuration version or guild ID.");
  }
  if (!config.protectedRoles?.sugarAi || !config.protectedRoles?.serverBooster || !Array.isArray(config.groups) || !config.groups.length) {
    throw new Error("Kittisugar role configuration is missing protected roles or groups.");
  }
  const ids = config.groups.flatMap((group) => group.roles.map((role) => role.id));
  const dividers = config.groups.map((group) => group.divider);
  if (config.groups.some((group) => !group.key || !group.divider || !Array.isArray(group.roles) || !group.roles.length)) {
    throw new Error("Every Kittisugar role group must have a key, divider, and roles.");
  }
  if (ids.some((id) => !/^\d{17,20}$/.test(id)) || new Set(ids).size !== ids.length) {
    throw new Error("Kittisugar role configuration contains invalid or duplicate role IDs.");
  }
  if (dividers.some((name) => typeof name !== "string" || !name.trim()) || new Set(dividers).size !== dividers.length) {
    throw new Error("Kittisugar role configuration contains invalid or duplicate dividers.");
  }
  if (config.groups.some((group) => group.roles.some((role) => !role.name || typeof role.name !== "string"))) {
    throw new Error("Every configured Kittisugar role must have a display name.");
  }
}

validateRoleOrganizationConfig(ROLE_ORGANIZATION_CONFIG);

export const KITTISUGAR_GUILD_ID = ROLE_ORGANIZATION_CONFIG.guildId;
const COMMAND_NAME = "roles-organize";
const COLOR = 0xffd9ff;
const DIVIDERS = ROLE_ORGANIZATION_CONFIG.groups.map((group) => group.divider);
const ROLE_GROUPS = ROLE_ORGANIZATION_CONFIG.groups.map((group) => ({
  divider: group.divider,
  roles: group.roles.map(({ id, name }) => [id, name]),
}));
const EXPECTED_SPECIAL_ROLES = ROLE_ORGANIZATION_CONFIG.protectedRoles;

export function buildRoleOrganizationPlan(roles, guildId = KITTISUGAR_GUILD_ID) {
  if (guildId !== KITTISUGAR_GUILD_ID) throw new Error("This organizer is restricted to the Kittisugar server.");
  const byId = new Map(roles.map((role) => [role.id, role]));
  const missing = [];
  const ordered = [];
  const renames = [];

  const sugarAi = byId.get(EXPECTED_SPECIAL_ROLES.sugarAi);
  if (!sugarAi || !sugarAi.managed) missing.push("Sugar AI (managed role)");
  else ordered.push({ role: sugarAi, managed: true });

  for (const group of ROLE_GROUPS) {
    ordered.push({ dividerName: group.divider });
    for (const [id, name] of group.roles) {
      const role = byId.get(id);
      if (!role) {
        missing.push(id);
        continue;
      }
      if (role.managed || role.id === guildId) {
        missing.push(`${role.name} (unexpectedly managed or @everyone)`);
        continue;
      }
      ordered.push({ role });
      if (role.name !== name) renames.push({ role, name });
    }
  }

  const serverBooster = byId.get(EXPECTED_SPECIAL_ROLES.serverBooster);
  if (!serverBooster || !serverBooster.managed) missing.push("Server Booster (managed role)");
  // Discord owns this role. It is deliberately not renamed or moved.
  const everyone = byId.get(guildId);
  if (!everyone) missing.push("@everyone");
  if (missing.length) {
    const error = new Error("The live role inventory no longer matches the approved audit.");
    error.missing = missing;
    throw error;
  }

  return { ordered, renames, dividers: DIVIDERS, untouchedManaged: [sugarAi, serverBooster] };
}

export function buildRoleOrganizerCommand() {
  return new SlashCommandBuilder()
    .setName(COMMAND_NAME)
    .setDescription("Preview and safely organize Kittisugar roles")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles.toString())
    .toJSON();
}

async function registerForGuild({ token, applicationId }, guildId) {
  await registerApplicationCommands({
    token,
    applicationId,
    guildId,
    commands: [buildRoleOrganizerCommand()],
  });
}

export function attachRoleOrganizationSystem(client, { token, applicationId }) {
  let readyHandled = false;
  client.once(Events.ClientReady, () => {
    readyHandled = true;
    for (const guild of client.guilds.cache.values()) {
      void registerForGuild({ token, applicationId }, guild.id).catch((error) => {
        console.error(`[roles-organize] command registration failed in ${guild.id}: ${error.message}`);
      });
    }
  });
  client.on(Events.GuildCreate, (guild) => {
    if (!readyHandled) return;
    void registerForGuild({ token, applicationId }, guild.id).catch((error) => {
      console.error(`[roles-organize] command registration failed in ${guild.id}: ${error.message}`);
    });
  });
  client.on(Events.InteractionCreate, (interaction) => {
    if (!interaction.isChatInputCommand() || interaction.commandName !== COMMAND_NAME) return;
    void handleRoleOrganization(interaction).catch(async (error) => {
      console.error(`[roles-organize] failed in ${interaction.guildId ?? "unknown server"}: ${error.message}`);
      const content = "No pude preparar la organización. No se aplicaron cambios si el error ocurrió durante la revisión.";
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content, ephemeral: true }).catch(() => {});
      } else {
        await interaction.reply({ content, ephemeral: true }).catch(() => {});
      }
    });
  });
}

function hasManageRoles(interaction) {
  return Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles));
}

export async function handleRoleOrganization(interaction) {
  if (!interaction.inGuild()) {
    return interaction.reply({ content: "Este comando solo funciona dentro de Kittisugar.", ephemeral: true });
  }
  if (interaction.guildId !== KITTISUGAR_GUILD_ID) {
    return interaction.reply({ content: "Este comando está limitado al servidor Kittisugar.", ephemeral: true });
  }
  if (!hasManageRoles(interaction)) {
    return interaction.reply({ content: "Necesitas el permiso Manage Roles para usarlo.", ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });
  const guild = interaction.guild;
  await guild.roles.fetch();
  const plan = buildRoleOrganizationPlan([...guild.roles.cache.values()], guild.id);
  const me = await guild.members.fetchMe();
  if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return interaction.editReply({ content: "Sugar no tiene Manage Roles. No se modificó nada." });
  }

  const targetRoles = plan.ordered.filter((item) => item.role && !item.managed).map((item) => item.role);
  const notEditable = targetRoles.filter((role) => !role.editable);
  if (notEditable.length) {
    return interaction.editReply({
      content: `No haré cambios: Sugar no puede administrar estos roles por su jerarquía: ${notEditable.map((role) => role.name).join(", ")}.`,
    });
  }

  const dividerCollisions = DIVIDERS
    .map((name) => guild.roles.cache.find((role) => role.name === name))
    .filter(Boolean);
  const unsafeDividers = dividerCollisions.filter((role) =>
    role.managed || !role.editable || role.permissions.bitfield !== 0n || role.color !== 0,
  );
  if (unsafeDividers.length) {
    return interaction.editReply({
      content: `No haré cambios: ya existe un divisor con permisos, color o protección inesperados: ${unsafeDividers.map((role) => role.name).join(", ")}.`,
    });
  }

  const renameCount = plan.renames.length;
  const createCount = DIVIDERS.filter((name) => !dividerCollisions.some((role) => role.name === name)).length;
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle("୨୧ Organización de roles ♡")
    .setDescription(
      `Voy a organizar **${targetRoles.length} roles**, actualizar **${renameCount} nombres** y crear **${createCount} divisores**.\n\n` +
      "**Orden:** Administración → Colores → Comunidad (incluye Booster) → Edades → Identidad → Acceso.\n" +
      "Los colores quedarán por encima de los roles normales para que se vean en los nombres.\n\n" +
      "**No cambiaré** permisos, colores existentes, miembros asignados ni @everyone. Sugar AI y el rol administrado Server Booster quedarán intactos. Las edades no llevarán emojis.",
    )
    .setFooter({ text: "Vista previa privada · confirma solo si estás de acuerdo ♡" });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("roles-organize:confirm").setLabel("Aplicar organización").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("roles-organize:cancel").setLabel("Cancelar").setStyle(ButtonStyle.Secondary),
  );
  await interaction.editReply({ embeds: [embed], components: [row] });
  const message = await interaction.fetchReply();
  const collector = message.createMessageComponentCollector({ time: 90_000 });

  collector.on("collect", async (button) => {
    if (button.user.id !== interaction.user.id) {
      return button.reply({ content: "Solo quien inició esta vista previa puede confirmarla.", ephemeral: true });
    }
    if (button.customId === "roles-organize:cancel") {
      collector.stop("cancelled");
      return button.update({ content: "Organización cancelada. No se modificó nada.", embeds: [], components: [] });
    }
    if (button.customId !== "roles-organize:confirm") return;
    if (!button.memberPermissions?.has(PermissionFlagsBits.ManageRoles)) {
      return button.reply({ content: "Tu permiso Manage Roles ya no está disponible.", ephemeral: true });
    }
    collector.stop("confirmed");
    await button.update({ content: "Aplicando la organización de roles…", embeds: [], components: [] });
    try {
      const result = await applyRoleOrganization(guild, plan);
      await interaction.editReply({
        content: `Organización terminada: **${result.renamed} nombres**, **${result.created} divisores** y **${result.reordered} posiciones** actualizadas. No se tocaron permisos, colores ni miembros.${result.notes.length ? `\n\nOmitidos: ${result.notes.join("; ")}` : ""}`,
        embeds: [],
        components: [],
      });
    } catch (error) {
      console.error(`[roles-organize] apply failed in ${guild.id}: ${error.message}`);
      await interaction.editReply({
        content: `No pude completar la organización: ${error.message}. Revisa los roles en Discord antes de volver a intentarlo, porque un error de API durante la aplicación puede dejar cambios parciales.`,
        embeds: [],
        components: [],
      }).catch(() => {});
    }
  });

  collector.on("end", async (_collected, reason) => {
    if (reason === "time") {
      await interaction.editReply({ content: "La vista previa expiró. No se modificó nada.", embeds: [], components: [] }).catch(() => {});
    }
  });
}

export function buildSafeRolePositions(orderedRoles, botHighestPosition) {
  if (!Number.isInteger(botHighestPosition) || botHighestPosition < 2) {
    throw new Error("Sugar's highest role position is not valid for role organization.");
  }
  const roles = orderedRoles.filter(Boolean);
  const ids = new Set(roles.map((role) => role.id));
  if (ids.size !== roles.length) throw new Error("Duplicate role detected in the organization plan.");
  if (roles.some((role) => role.managed || !role.editable)) {
    throw new Error("A target role is managed or not editable by Sugar.");
  }

  // Reuse only the exact position slots already occupied by target roles.
  // This avoids guessed positions, collisions, and crossing managed roles.
  const slots = roles.map((role) => role.position).sort((a, b) => a - b);
  if (slots.some((position) => !Number.isInteger(position) || position < 1 || position >= botHighestPosition)) {
    throw new Error("The current role hierarchy has no safe position slot for every target role.");
  }

  return [...roles].reverse().map((role, index) => ({
    role,
    position: slots[index],
  }));
}

export async function applyRoleOrganization(guild, plan) {
  await guild.roles.fetch();
  const me = await guild.members.fetchMe();
  if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) throw new Error("Sugar no longer has Manage Roles.");

  const currentById = guild.roles.cache;
  const targetRoles = plan.ordered
    .filter((item) => item.role && !item.managed)
    .map((item) => currentById.get(item.role.id));
  if (targetRoles.some((role) => !role || role.managed || !role.editable)) {
    throw new Error("A target role is missing, managed, or above Sugar's highest role. No changes were made.");
  }

  let created = 0;
  const createdDividerIds = [];
  try {
    // Create only the missing neutral dividers. If the later position preflight
    // fails, remove only the dividers created by this attempt.
    for (const name of plan.dividers) {
      let divider = guild.roles.cache.find((role) => role.name === name);
      if (!divider) {
        divider = await guild.roles.create({
          name,
          color: 0,
          permissions: [],
          hoist: false,
          mentionable: false,
          reason: "Kittisugar approved role category divider",
        });
        created += 1;
        createdDividerIds.push(divider.id);
      }
    }

    const refreshed = await guild.roles.fetch();
    const orderedRoles = [];
    for (const item of plan.ordered) {
      if (item.dividerName) {
        const divider = refreshed.find((role) => role.name === item.dividerName);
        if (!divider) throw new Error(`Divider ${item.dividerName} could not be found after creation.`);
        orderedRoles.push(divider);
      } else if (item.role && !item.managed) {
        const role = refreshed.get(item.role.id);
        if (!role) throw new Error(`Role ${item.role.id} disappeared during organization.`);
        orderedRoles.push(role);
      }
    }

    const positions = buildSafeRolePositions(orderedRoles, me.roles.highest.position);
    await guild.roles.setPositions(positions);

    let renamed = 0;
    for (const { role, name } of plan.renames) {
      const current = (await guild.roles.fetch()).get(role.id);
      if (!current || current.managed || !current.editable) {
        throw new Error(`Role ${role.id} became unavailable for renaming after reordering.`);
      }
      if (current.name !== name) {
        await current.setName(name, "Kittisugar approved role organization");
        renamed += 1;
      }
    }

    const notes = [];
    notes.push("Sugar AI y Server Booster administrado por Discord quedaron intactos");
    return { renamed, created, reordered: positions.length, notes };
  } catch (error) {
    // Best-effort cleanup is limited to neutral dividers created by this run.
    for (const id of createdDividerIds.reverse()) {
      const divider = guild.roles.cache.get(id);
      if (divider?.editable) await divider.delete("Rollback of incomplete Kittisugar role organization").catch(() => {});
    }
    throw error;
  }
}
