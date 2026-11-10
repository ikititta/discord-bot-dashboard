import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

import { toRoyalBold } from "./embed-format.js";

function normalizeRoleName(value) {
  return String(value ?? "").normalize("NFKD").toLowerCase().replace(/\p{M}/gu, "").replace(/[^a-z0-9]/g, "");
}

function findRoleByName(guild, name) {
  const expected = normalizeRoleName(name);
  return guild.roles.cache.find((role) => normalizeRoleName(role.name) === expected) ?? null;
}

async function assignMemberAccess(member, { newRole, memberRole }) {
  if (!member.roles.cache.has(newRole.id)) {
    if (member.roles.cache.has(memberRole.id)) return false;
    throw new Error("You do not have the New role.");
  }
  await member.roles.add(memberRole, "Member completed Kittisugar role onboarding");
  try {
    await member.roles.remove(newRole, "Remove New after successful Kittisugar onboarding");
  } catch (error) {
    await member.roles.remove(memberRole, "Roll back Member because New could not be removed").catch(() => {});
    throw error;
  }
  return true;
}

const PREFIX = "sugar-onboard:";
const SELF_PREFIX = "sugar-selfroles:";
const COLOR = 0xffd9ff;
const SELF_ROLES_CHANNEL_NAME = "🎀｜୨୧•𝓼𝓮𝓵𝓯-𝓻𝓸𝓵𝓮𝓼";
const NSFW_HIDDEN_ROLE = "nsfw-hidden";

export const GENDER_OPTIONS = [
  ["female", "Female"],
  ["male", "Male"],
  ["trans", "Trans"],
  ["non-binary", "Non-binary"],
];
export const AGE_OPTIONS = Array.from({ length: 23 }, (_, index) => {
  const age = String(index + 18);
  return [age, age];
});
export const SEXUALITY_OPTIONS = [
  ["straight", "Straight"],
  ["gay-lesbian", "Gay/Lesbian"],
  ["bisexual", "Bisexual"],
  ["pansexual", "Pansexual"],
  ["asexual", "Asexual"],
  ["prefer-not-to-say", "Prefer not to say"],
];

const CATEGORY_OPTIONS = {
  gender: GENDER_OPTIONS,
  age: AGE_OPTIONS,
  sexuality: SEXUALITY_OPTIONS,
};

export function isValidHexColor(value) {
  return /^#?[0-9a-fA-F]{6}$/.test(String(value ?? "").trim());
}

export function normalizeHexColor(value) {
  if (!isValidHexColor(value)) throw new Error("Enter a valid HEX color, such as #FFD9FF.");
  return String(value).trim().replace(/^#/, "").toUpperCase();
}

export function roleNameForSelection(category, value) {
  if (!Object.hasOwn(CATEGORY_OPTIONS, category)) throw new Error("Unknown role category.");
  const allowed = CATEGORY_OPTIONS[category].some(([key]) => key === String(value));
  if (!allowed) throw new Error("That option is not available.");
  return `${category}-${String(value).toLowerCase()}`;
}

function makeEmbed(title, description) {
  return new EmbedBuilder().setColor(COLOR).setTitle(`୨୧ ${toRoyalBold(title)} ♡`).setDescription(description);
}

function selectStepPayload({ step, mode, userId }) {
  const prefix = mode === "onboard" ? `${PREFIX}${userId}:` : SELF_PREFIX;
  if (step === "color") {
    return {
      embeds: [makeEmbed("Chat Color", "Choose a custom color for your messages. Press the button and enter a HEX code, for example **#FFD9FF**.")],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`${prefix}color`).setLabel("Choose a color ♡").setStyle(ButtonStyle.Primary),
      )],
    };
  }

  const settings = {
    gender: { title: "Gender", description: "Select your gender.", options: GENDER_OPTIONS },
    age: { title: "Age", description: "Please select your age.", options: AGE_OPTIONS },
    sexuality: { title: "Sexuality", description: "Select the option that best describes you.", options: SEXUALITY_OPTIONS },
    nsfw: {
      title: "NSFW Channels",
      description: "Choose whether NSFW channels and forums should be visible to you. Discord's age restrictions will still apply.",
      options: [["show", "Show NSFW channels"], ["hide", "Hide NSFW channels"]],
    },
  }[step];
  if (!settings) throw new Error("Unknown onboarding step.");

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`${prefix}${step}`)
    .setPlaceholder(`Select ${settings.title.toLowerCase()}...`)
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(settings.options.map(([value, label]) => ({ label, value })));
  return {
    embeds: [makeEmbed(settings.title, settings.description)],
    components: [new ActionRowBuilder().addComponents(menu)],
  };
}

export function buildSelfRolesPanelPayload() {
  const rows = [
    ["gender", "Gender", GENDER_OPTIONS],
    ["age", "Age", AGE_OPTIONS],
    ["sexuality", "Sexuality", SEXUALITY_OPTIONS],
    ["nsfw", "NSFW visibility", [["show", "Show NSFW channels"], ["hide", "Hide NSFW channels"]]],
  ].map(([category, label, options]) => new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`${SELF_PREFIX}${category}`)
      .setPlaceholder(`Choose ${label.toLowerCase()}...`)
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(options.map(([value, optionLabel]) => ({ label: optionLabel, value }))),
  ));
  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`${SELF_PREFIX}color`).setLabel("Choose chat color ♡").setStyle(ButtonStyle.Primary),
  ));
  return {
    embeds: [makeEmbed("Self Roles", "Choose or update your roles at any time. Your previous role in the same category will be replaced automatically.\n\n**Gender · Age · Sexuality · Chat color · NSFW visibility**")],
    components: rows,
  };
}

async function getOrCreateRole(guild, name, color) {
  let role = findRoleByName(guild, name);
  if (role) return role;
  return guild.roles.create({
    name,
    ...(color ? { color } : {}),
    reason: "Create a Kittisugar self-role selection",
  });
}

async function replaceCategoryRole(member, category, selectedRole) {
  const prefix = `${category}-`;
  await member.roles.add(selectedRole, `Set Kittisugar ${category} self-role`);
  const oldRoles = member.roles.cache.filter((role) =>
    role.id !== selectedRole.id && normalizeRoleName(role.name).startsWith(normalizeRoleName(prefix)),
  );
  if (oldRoles.size) {
    await member.roles.remove([...oldRoles.values()], `Replace previous Kittisugar ${category} self-role`);
  }
}

async function applyChoice(member, category, value) {
  if (category === "nsfw") {
    const hiddenRole = await getOrCreateRole(member.guild, NSFW_HIDDEN_ROLE);
    if (value === "hide") {
      await member.roles.add(hiddenRole, "Member chose to hide NSFW channels");
    } else if (value === "show") {
      await member.roles.remove(hiddenRole, "Member chose to show NSFW channels");
    } else {
      throw new Error("Choose whether to show or hide NSFW channels.");
    }
    return;
  }

  if (category === "color") {
    const hex = normalizeHexColor(value);
    const name = `color-${hex.toLowerCase()}`;
    const role = await getOrCreateRole(member.guild, name, Number.parseInt(hex, 16));
    await replaceCategoryRole(member, "color", role);
    return;
  }

  const name = roleNameForSelection(category, value);
  const role = await getOrCreateRole(member.guild, name);
  await replaceCategoryRole(member, category, role);
}

function colorModal(mode, userId) {
  const prefix = mode === "onboard" ? `${PREFIX}${userId}:` : SELF_PREFIX;
  const input = new TextInputBuilder()
    .setCustomId("hex")
    .setLabel("HEX color")
    .setPlaceholder("#FFD9FF")
    .setStyle(TextInputStyle.Short)
    .setMinLength(6)
    .setMaxLength(7)
    .setRequired(true);
  return new ModalBuilder()
    .setCustomId(`${prefix}color-modal`)
    .setTitle("Choose your chat color")
    .addComponents(new ActionRowBuilder().addComponents(input));
}

export async function ensureNsfwHiddenVisibility(guild, role) {
  let changed = 0;
  for (const channel of guild.channels.cache.values()) {
    if (channel.isThread?.() || !channel.nsfw || !channel.permissionOverwrites?.edit) continue;
    await channel.permissionOverwrites.edit(
      role,
      { ViewChannel: false },
      "Keep NSFW channels hidden for members who opted out",
    );
    changed += 1;
  }
  return changed;
}

export async function ensureSelfRolesChannel(guild, client) {
  const botMember = guild.members.me;
  if (!botMember?.permissions?.has(PermissionFlagsBits.ManageChannels) ||
      !botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
    console.warn(`[self-roles] missing Manage Channels or Manage Roles in guild ${guild.id}`);
    return null;
  }

  let channel = guild.channels.cache.find((item) =>
    item.type === ChannelType.GuildText && normalizeRoleName(item.name) === "selfroles",
  );
  if (!channel) {
    channel = await guild.channels.create({
      name: SELF_ROLES_CHANNEL_NAME,
      type: ChannelType.GuildText,
      reason: "Create the Kittisugar self-roles panel",
    });
  } else if (channel.name !== SELF_ROLES_CHANNEL_NAME) {
    await channel.setName(SELF_ROLES_CHANNEL_NAME, "Apply Kittisugar self-roles channel naming style");
  }

  await channel.permissionOverwrites.edit(guild.roles.everyone, {
    ViewChannel: true,
    SendMessages: false,
    AddReactions: false,
  });
  await channel.permissionOverwrites.edit(client.user.id, {
    ViewChannel: true,
    SendMessages: true,
    EmbedLinks: true,
    ReadMessageHistory: true,
    ManageMessages: true,
  });

  const recent = await channel.messages.fetch({ limit: 50 });
  const title = `୨୧ ${toRoyalBold("Self Roles")} ♡`;
  const existing = recent.find((message) =>
    message.author?.id === client.user.id && message.embeds.some((embed) => embed.title === title),
  );
  const payload = buildSelfRolesPanelPayload();
  if (existing) await existing.edit(payload);
  else await channel.send(payload);

  const hiddenRole = await getOrCreateRole(guild, NSFW_HIDDEN_ROLE);
  await ensureNsfwHiddenVisibility(guild, hiddenRole);
  console.info(`[self-roles] panel ready in #${channel.name} for guild ${guild.id}`);
  return channel;
}

function parseCustomId(customId) {
  if (customId.startsWith(PREFIX)) {
    const [, userId, category] = customId.split(":");
    return { mode: "onboard", userId, category };
  }
  if (customId.startsWith(SELF_PREFIX)) {
    return { mode: "self", userId: null, category: customId.slice(SELF_PREFIX.length) };
  }
  return null;
}

function nextOnboardingStep(category) {
  return ({ gender: "age", age: "sexuality", sexuality: "color", color: "nsfw" })[category] ?? null;
}

async function completeOnboarding(interaction) {
  const newRole = findRoleByName(interaction.guild, "new");
  const memberRole = findRoleByName(interaction.guild, "member");
  if (!newRole || !memberRole) throw new Error("Sugar couldn't find the New or Member role. Please contact a moderator.");
  const member = await interaction.guild.members.fetch(interaction.user.id);
  const changed = await assignMemberAccess(member, { newRole, memberRole });
  return changed
    ? "You're all set! Welcome to Kittisugar ♡ Your Member access is ready."
    : "Your roles are saved and you already have Member access ♡";
}

export async function startRoleOnboarding(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const newRole = findRoleByName(interaction.guild, "new");
  const memberRole = findRoleByName(interaction.guild, "member");
  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  if (!member || !newRole || !memberRole) {
    return interaction.editReply("Sugar couldn't verify your server access. Please contact a moderator.");
  }
  if (member.roles.cache.has(memberRole.id) && !member.roles.cache.has(newRole.id)) {
    return interaction.editReply("You're already verified and have access to Kittisugar ♡");
  }
  if (!member.roles.cache.has(newRole.id)) {
    return interaction.editReply("You need the New role to start this access verification. Please contact a moderator.");
  }
  return interaction.editReply(selectStepPayload({ step: "gender", mode: "onboard", userId: interaction.user.id }));
}

export function attachRoleOnboarding(client) {
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton() && !interaction.isStringSelectMenu() && !interaction.isModalSubmit()) return;
    const parsed = parseCustomId(interaction.customId);
    if (!parsed) return;

    try {
      if (!interaction.inGuild()) {
        const response = { content: "This panel only works inside Kittisugar.", ephemeral: true };
        return interaction.reply(response);
      }
      if (parsed.mode === "onboard" && parsed.userId !== interaction.user.id) {
        return interaction.reply({ content: "This onboarding belongs to another member.", ephemeral: true });
      }

      if (interaction.isButton() && parsed.category === "color") {
        return interaction.showModal(colorModal(parsed.mode, parsed.userId));
      }

      if (interaction.isModalSubmit() && parsed.category === "color-modal") {
        const hex = interaction.fields.getTextInputValue("hex");
        const member = await interaction.guild.members.fetch(interaction.user.id);
        await applyChoice(member, "color", hex);
        if (parsed.mode === "onboard") {
          return interaction.reply({
            ...selectStepPayload({ step: "nsfw", mode: "onboard", userId: interaction.user.id }),
            ephemeral: true,
          });
        }
        return interaction.reply({ content: `Your chat color is now **#${normalizeHexColor(hex)}** ♡`, ephemeral: true });
      }

      if (!interaction.isStringSelectMenu()) return;
      const category = parsed.category;
      const value = interaction.values[0];
      const member = await interaction.guild.members.fetch(interaction.user.id);
      await applyChoice(member, category, value);

      if (parsed.mode === "self") {
        return interaction.reply({
          content: category === "nsfw"
            ? (value === "hide" ? "NSFW channels and forums are now hidden for you ♡" : "NSFW channels and forums are now visible when Discord allows access ♡")
            : `Your ${category} role has been updated ♡`,
          ephemeral: true,
        });
      }

      if (category === "nsfw") {
        const message = await completeOnboarding(interaction);
        return interaction.update({ content: message, embeds: [], components: [] });
      }

      const next = nextOnboardingStep(category);
      return interaction.update(selectStepPayload({ step: next, mode: "onboard", userId: interaction.user.id }));
    } catch (error) {
      console.error(`[self-roles] interaction failed for ${interaction.user?.id}: ${error.message}`);
      const message = "I couldn't update that selection. Please try again or contact a moderator.";
      if (interaction.deferred || interaction.replied) {
        return interaction.followUp({ content: message, ephemeral: true }).catch(() => {});
      }
      return interaction.reply({ content: message, ephemeral: true }).catch(() => {});
    }
  });

  client.on("channelCreate", (channel) => {
    if (!channel.guild || !channel.nsfw || !channel.permissionOverwrites?.edit) return;
    const role = findRoleByName(channel.guild, NSFW_HIDDEN_ROLE);
    if (!role) return;
    void channel.permissionOverwrites.edit(role, { ViewChannel: false }, "Apply NSFW opt-out visibility")
      .catch((error) => console.error(`[self-roles] could not secure NSFW channel ${channel.id}: ${error.message}`));
  });
}
