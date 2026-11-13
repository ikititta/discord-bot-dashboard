import {
  ActionRowBuilder,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
} from "discord.js";

import { toRoyalBold } from "./embed-format.js";
import { NEW_ROLE_ID, MEMBER_ROLE_ID } from "./role-ids.js";

function normalizeRoleName(value) {
  const plain = [...String(value ?? "")].map((character) => {
    const point = character.codePointAt(0);
    if (point >= 0x1d4d0 && point <= 0x1d4e9) return String.fromCharCode(65 + point - 0x1d4d0);
    if (point >= 0x1d4ea && point <= 0x1d503) return String.fromCharCode(97 + point - 0x1d4ea);
    return character;
  }).join("");
  return plain.normalize("NFKD").toLowerCase().replace(/\p{M}/gu, "").replace(/[^a-z0-9]/g, "");
}

function roleDisplayName(label) {
  const value = String(label ?? "");
  const fancy = [...value].map((character) => {
    const point = character.codePointAt(0);
    if (point >= 0x41 && point <= 0x5a) return String.fromCodePoint(0x1d4d0 + point - 0x41);
    if (point >= 0x61 && point <= 0x7a) return String.fromCodePoint(0x1d4ea + point - 0x61);
    return character;
  }).join("");
  return `꒰ ${fancy} ! ꒱`;
}

function findDisplayRole(guild, label) {
  const expected = normalizeRoleName(label);
  const cache = guild.roles.cache;
  if (typeof cache.find === "function") return cache.find((role) => normalizeRoleName(role.name) === expected) ?? null;
  if (typeof cache.values === "function") return [...cache.values()].find((role) => normalizeRoleName(role.name) === expected) ?? null;
  return null;
}

function findNewRole(guild) {
  return guild.roles.cache.get(NEW_ROLE_ID) ?? null;
}

function findMemberRole(guild) {
  return guild.roles.cache.get(MEMBER_ROLE_ID) ?? null;
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
export const NSFW_HIDDEN_ROLE_ID = "1569885841180856361";
const AGE_REVIEW_ROLE_NAME = "age-review";
const SUPPORT_CHANNEL_ID = "1568492748732895313";


async function findOrCreateAgeReviewRole(guild) {
  return getOrCreateRole(guild, AGE_REVIEW_ROLE_NAME, undefined, "Member selected 18-; restrict access to Support");
}

function findSupportChannel(guild) {
  const channel = guild.channels.cache.get(SUPPORT_CHANNEL_ID);
  return channel?.type === ChannelType.GuildText ? channel : null;
}

/**
 * Give the restricted role access to Support before applying its deny to every
 * other channel. Removing the role restores the member's normal channel access;
 * no existing @everyone, Member, or staff overwrites are rewritten.
 */
async function ensureAgeReviewVisibility(guild, role) {
  const support = findSupportChannel(guild);
  if (!support) {
    throw new Error(`The existing Support channel ${SUPPORT_CHANNEL_ID} could not be found; no access restriction was applied.`);
  }

  await support.permissionOverwrites.edit(role, {
    ViewChannel: true,
    ReadMessageHistory: true,
    SendMessages: false,
  }, "Allow age-restricted members to access Support");

  const newRole = findNewRole(guild);
  if (newRole) await support.permissionOverwrites.edit(newRole, {
    ViewChannel: true, ReadMessageHistory: true, SendMessages: false,
  }, "Allow New members to reach Support");

  for (const channel of guild.channels.cache.values()) {
    if (channel.id === support.id || channel.isThread?.() || !channel.permissionOverwrites?.edit) continue;
    await channel.permissionOverwrites.edit(role, {
      ViewChannel: false,
    }, "Restrict members who selected 18- to Support only");
  }
  return support;
}

export async function restrictUnderageMember(guild, member) {
  const support = findSupportChannel(guild);
  if (!support) {
    throw new Error(`The existing Support channel ${SUPPORT_CHANNEL_ID} could not be found; no access restriction was applied.`);
  }

  const ageRole = await findOrCreateAgeReviewRole(guild);
  // Install Support access and all channel restrictions before assigning the role.
  // The moment the role is added, the member can see Support and nothing else.
  await ensureAgeReviewVisibility(guild, ageRole);

  if (!member.roles.cache.has(ageRole.id)) {
    await member.roles.add(ageRole, "Member self-declared an age under 18");
  }
  const memberRole = findMemberRole(guild);
  if (memberRole && member.roles.cache.has(memberRole.id)) {
    await member.roles.remove(memberRole, "Member selected 18-; remove full server access");
  }

  const notice = new EmbedBuilder().setColor(COLOR)
    .setTitle("୨୧ Access Restricted ♡")
    .setDescription(
      `You selected **18-**. Your access to Kittisugar is now limited to <#${support.id}>. If you need assistance, please open a Support ticket there. Your age selection is self-declared; staff will not ask you to submit identity documents.`
    );
  await member.send({ embeds: [notice], allowedMentions: { parse: [] } }).catch(() => {});
  return support;
}

export function findNsfwHiddenRole(guild) {
  return findDisplayRole(guild, "SFW") ?? guild.roles.cache.get(NSFW_HIDDEN_ROLE_ID) ?? null;
}

export function findNsfwVisibleRole(guild) {
  return findDisplayRole(guild, "NSFW");
}

export const GENDER_ROLE_IDS = Object.freeze({
  female: "1569638102949953567",
  male: "1569807000278269983",
  trans: "1569807011217145948",
  "non-binary": "1569807020809396455",
});

export const GENDER_OPTIONS = [
  ["female", "Female"],
  ["male", "Male"],
  ["trans", "Trans"],
  ["non-binary", "Non-binary"],
];
export const AGE_OPTIONS = [
  ["18-", "18-"],
  ...Array.from({ length: 23 }, (_, index) => {
    const age = String(index + 18);
    return [age, age];
  }),
];
export const SEXUALITY_OPTIONS = [
  ["straight", "Straight"],
  ["gay-lesbian", "Gay/Lesbian"],
  ["bisexual", "Bisexual"],
  ["pansexual", "Pansexual"],
  ["asexual", "Asexual"],
  ["queer", "Queer"],
  ["prefer-not-to-say", "Prefer not to say"],
];

export const DOMINANCE_OPTIONS = [
  ["submissive", "Submissive"],
  ["mostly-submissive", "Mostly Submissive"],
  ["switch", "Switch"],
  ["mostly-dominant", "Mostly Dominant"],
  ["dominant", "Dominant"],
];

export const COLOR_OPTIONS = [
  ["red", "Red", 0xe74c3c],
  ["orange", "Orange", 0xe67e22],
  ["yellow", "Yellow", 0xf1c40f],
  ["green", "Green", 0x2ecc71],
  ["cyan", "Cyan", 0x1abc9c],
  ["blue", "Blue", 0x3498db],
  ["purple", "Purple", 0x9b59b6],
  ["pink", "Pink", 0xff69b4],
  ["white", "White", 0xffffff],
  ["gray", "Gray", 0x95a5a6],
  ["brown", "Brown", 0x8b5a2b],
  ["black", "Black", 0x23272a],
];

const CATEGORY_OPTIONS = {
  gender: GENDER_OPTIONS,
  age: AGE_OPTIONS,
  sexuality: SEXUALITY_OPTIONS,
  dominance: DOMINANCE_OPTIONS,
};

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
  const settings = {
    gender: { title: "Gender", description: "Select your gender.", options: GENDER_OPTIONS },
    age: { title: "Age", description: "Please select your age.", options: AGE_OPTIONS },
    sexuality: { title: "Sexuality", description: "Select the option that best describes you.", options: SEXUALITY_OPTIONS },
    color: { title: "Chat color", description: "Choose one of the basic colors for your name.", options: COLOR_OPTIONS.map(([value, label]) => [value, label]) },
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
  const categories = [
    ["gender", "Gender", "Choose your gender.", GENDER_OPTIONS],
    ["age", "Age", "Please select your age.", AGE_OPTIONS],
    ["sexuality", "Sexuality", "Select the option that best describes you.", SEXUALITY_OPTIONS],
    ["dominance", "Interaction preference", "Choose how you usually prefer to interact. This helps Sugar match anime GIF pairings.", DOMINANCE_OPTIONS],
    ["color", "Chat color", "Choose one of the basic colors for your name.", COLOR_OPTIONS.map(([value, label]) => [value, label])],
    ["nsfw", "NSFW visibility", "Choose whether NSFW channels and forums should be visible to you.", [["show", "Show NSFW channels"], ["hide", "Hide NSFW channels"]]],
  ];
  return categories.map(([category, title, description, options]) => ({
    embeds: [makeEmbed(title, `${description} Your previous role in this category will be replaced automatically.`)],
    components: [new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`${SELF_PREFIX}${category}`)
        .setPlaceholder(`Choose ${title.toLowerCase()}...`)
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(options.map(([value, label]) => ({ label, value }))),
    )],
  }));
}

const pendingRoleCreations = new Map();

function findSelfRoleByName(guild, name) {
  const expected = normalizeRoleName(name);
  const cache = guild.roles.cache;
  if (typeof cache.values === "function") {
    const roles = [...cache.values()];
    return roles.find((role) => normalizeRoleName(role.name) === expected) ??
      roles.find((role) => normalizeRoleName(role.name).replace(/\d+$/u, "") === expected) ??
      null;
  }
  if (typeof cache.find === "function") {
    return cache.find((role) => normalizeRoleName(role.name) === expected) ??
      cache.find((role) => normalizeRoleName(role.name).replace(/\d+$/u, "") === expected) ??
      null;
  }
  return null;
}

/**
 * Reuse the canonical self-role, even if Discord's cache is stale or two
 * members choose the same option at nearly the same time. A trailing numeric
 * suffix is treated as a legacy duplicate (for example, color-red 1).
 */
export async function getOrCreateRole(guild, name, color, reason = "Create a Kittisugar self-role selection") {
  const existing = findSelfRoleByName(guild, name);
  if (existing) return existing;

  const key = `${guild.id}:${normalizeRoleName(name)}`;
  const pending = pendingRoleCreations.get(key);
  if (pending) return pending;

  const creation = (async () => {
    // Refresh Discord's role cache before creating anything. If refresh fails,
    // fail closed rather than risk creating a duplicate role.
    if (typeof guild.roles.fetch === "function") await guild.roles.fetch();
    const refreshed = findSelfRoleByName(guild, name);
    if (refreshed) return refreshed;
    return guild.roles.create({
      name,
      ...(color !== undefined ? { color } : {}),
      reason,
    });
  })();

  pendingRoleCreations.set(key, creation);
  try {
    return await creation;
  } finally {
    if (pendingRoleCreations.get(key) === creation) pendingRoleCreations.delete(key);
  }
}

async function replaceCategoryRole(member, category, selectedRole, managedRoleIds = []) {
  const options = category === "color" ? COLOR_OPTIONS : CATEGORY_OPTIONS[category] ?? [];
  const knownNames = new Set(options.map(([, label]) => normalizeRoleName(label)));
  await member.roles.add(selectedRole, `Set Kittisugar ${category} self-role`);
  const oldRoles = member.roles.cache.filter((role) =>
    role.id !== selectedRole.id && (
      managedRoleIds.includes(role.id) ||
      knownNames.has(normalizeRoleName(role.name)) ||
      normalizeRoleName(role.name).startsWith(`${category}`)
    ),
  );
  if (oldRoles.size) {
    await member.roles.remove([...oldRoles.values()], `Replace previous Kittisugar ${category} self-role`);
  }
}

async function applyChoice(member, category, value) {
  if (category === "gender") {
    const roleId = GENDER_ROLE_IDS[String(value)];
    const role = (roleId ? member.guild.roles.cache.get(roleId) : null) ??
      findSelfRoleByName(member.guild, `gender-${String(value).toLowerCase()}`) ??
      findSelfRoleByName(member.guild, String(value).toLowerCase());
    if (!role) throw new Error(`The configured gender role ${roleId ?? value} was not found. Sugar will not create a replacement automatically.`);
    await replaceCategoryRole(member, "gender", role, Object.values(GENDER_ROLE_IDS));
    return;
  }

  if (category === "nsfw") {
    const hiddenRole = findNsfwHiddenRole(member.guild);
    const visibleRole = findNsfwVisibleRole(member.guild);
    if (!hiddenRole || !visibleRole) {
      throw new Error("The formatted SFW and NSFW visibility roles were not both found.");
    }
    if (value === "hide") {
      await member.roles.add(hiddenRole, "Member chose to hide NSFW channels");
      if (member.roles.cache.has(visibleRole.id)) await member.roles.remove(visibleRole, "Remove NSFW visibility when opting out");
    } else if (value === "show") {
      await member.roles.add(visibleRole, "Member chose to show NSFW channels");
      if (member.roles.cache.has(hiddenRole.id)) await member.roles.remove(hiddenRole, "Remove SFW visibility restriction when opting in");
    } else {
      throw new Error("Choose whether to show or hide NSFW channels.");
    }
    return;
  }

  if (category === "color") {
    const selected = COLOR_OPTIONS.find(([key]) => key === String(value));
    if (!selected) throw new Error("That color is not available.");
    const [key, , discordColor] = selected;
    const role = await getOrCreateRole(member.guild, roleDisplayName(selected[1]), discordColor);
    await replaceCategoryRole(member, "color", role);
    return;
  }

  const option = CATEGORY_OPTIONS[category].find(([key]) => key === String(value));
  const name = roleDisplayName(option?.[1] ?? value);
  const role = findDisplayRole(member.guild, option?.[1] ?? value) ?? await getOrCreateRole(member.guild, name);
  await replaceCategoryRole(member, category, role);
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

  const channel = guild.channels.cache.find((item) =>
    item.type === ChannelType.GuildText && normalizeRoleName(item.name) === "selfroles",
  );
  if (!channel) {
    console.warn(`[self-roles] existing self-roles channel was not found in guild ${guild.id}; no channel was created.`);
    return null;
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
  const panelPayloads = buildSelfRolesPanelPayload();
  const legacyPanelTitle = `୨୧ ${toRoyalBold("Self Roles")} ♡`;
  const legacyPanels = [...recent.values()].filter((message) =>
    message.author?.id === client.user.id && message.embeds.some((embed) => embed.title === legacyPanelTitle),
  );
  for (const legacy of legacyPanels) await legacy.delete().catch(() => {});
  for (const payload of panelPayloads) {
    const title = payload.embeds[0].data.title;
    const matches = [...recent.values()].filter((message) =>
      message.author?.id === client.user.id && message.embeds.some((embed) => embed.title === title),
    ).sort((a, b) => b.createdTimestamp - a.createdTimestamp);
    const existing = matches.shift();
    if (existing) await existing.edit(payload);
    else await channel.send(payload);
    for (const duplicate of matches) await duplicate.delete().catch(() => {});
  }

  const hiddenRole = findNsfwHiddenRole(guild);
  if (hiddenRole) {
    await ensureNsfwHiddenVisibility(guild, hiddenRole);
  } else {
    console.warn(`[self-roles] NSFW visibility role ${NSFW_HIDDEN_ROLE_ID} was not found in guild ${guild.id}; channel overwrites were not changed.`);
  }
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
  const member = await interaction.guild.members.fetch(interaction.user.id);
  const ageReviewRole = findRoleByName(interaction.guild, AGE_REVIEW_ROLE_NAME);
  if (ageReviewRole && member.roles.cache.has(ageReviewRole.id)) throw new Error("Your access is restricted to Support because you selected 18-.");
  const newRole = findNewRole(interaction.guild);
  const memberRole = findMemberRole(interaction.guild);
  if (!newRole || !memberRole) throw new Error("Sugar couldn't find the New or Member role. Please contact a moderator.");
  const changed = await assignMemberAccess(member, { newRole, memberRole });
  return changed
    ? "You're all set! Welcome to Kittisugar ♡ Your Member access is ready."
    : "Your roles are saved and you already have Member access ♡";
}

export async function startRoleOnboarding(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const newRole = findNewRole(interaction.guild);
  const memberRole = findMemberRole(interaction.guild);
  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  if (!member || !newRole || !memberRole) {
    return interaction.editReply("Sugar couldn't verify your server access. Please contact a moderator.");
  }
  const ageReviewRole = findRoleByName(interaction.guild, AGE_REVIEW_ROLE_NAME);
  if (ageReviewRole && member.roles.cache.has(ageReviewRole.id)) {
    return interaction.editReply("Your access is restricted to Support because you selected 18-. If you need assistance, open a Support ticket there ♡");
  }
  if (member.roles.cache.has(memberRole.id) && !member.roles.cache.has(newRole.id)) {
    return interaction.editReply("You're already verified and have access to Kittisugar ♡");
  }
  if (!member.roles.cache.has(newRole.id)) {
    return interaction.editReply("You need the New role to start this access verification. Please contact a moderator.");
  }
  return interaction.editReply(selectStepPayload({ step: "gender", mode: "onboard", userId: interaction.user.id }));
}

export function attachRoleOnboarding(client, { settings } = {}) {
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isStringSelectMenu()) return;
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

      const category = parsed.category;
      const value = interaction.values[0];
      const member = await interaction.guild.members.fetch(interaction.user.id);
      if (category === "age" && value === "18-") {
        const support = await restrictUnderageMember(interaction.guild, member);
        const response = `You selected 18-. Your access is now limited to <#${support.id}>. If you need assistance, open a Support ticket there ♡`;
        if (parsed.mode === "onboard") return interaction.update({ content: response, embeds: [], components: [] });
        return interaction.reply({ content: response, ephemeral: true });
      }
      await applyChoice(member, category, value);

      if (parsed.mode === "self") {
        return interaction.reply({
          content: category === "nsfw"
            ? (value === "hide" ? "NSFW channels and forums are now hidden for you ♡" : "NSFW channels and forums are now visible when Discord allows access ♡")
            : category === "color" ? "Your chat color role has been updated ♡" : `Your ${category} role has been updated ♡`,
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

  client.once("ready", () => {
    for (const guild of client.guilds.cache.values()) {
      const role = findRoleByName(guild, AGE_REVIEW_ROLE_NAME);
      if (role) void ensureAgeReviewVisibility(guild, role).catch((error) => console.error(`[age-review] visibility sync failed: ${error.message}`));
    }
  });
  const syncAgeReviewChannel = (channel) => {
    if (!channel.guild || !channel.permissionOverwrites?.edit) return;
    const role = findRoleByName(channel.guild, AGE_REVIEW_ROLE_NAME);
    if (!role || channel.isThread?.()) return;
    const support = findSupportChannel(channel.guild);
    void channel.permissionOverwrites.edit(role, { ViewChannel: channel.id === support?.id }, "Keep age-review members restricted to Support and their private ticket")
      .catch((error) => console.error(`[age-review] channel restriction failed: ${error.message}`));
  };
  client.on("channelCreate", syncAgeReviewChannel);
  client.on("channelUpdate", (_before, after) => syncAgeReviewChannel(after));

  const syncNsfwChannel = (channel) => {
    if (!channel.guild || !channel.permissionOverwrites?.edit) return;
    const role = findNsfwHiddenRole(channel.guild);
    if (!role) return;
    const update = channel.nsfw
      ? channel.permissionOverwrites.edit(role, { ViewChannel: false }, "Apply NSFW opt-out visibility")
      : channel.permissionOverwrites.delete(role, "Remove NSFW opt-out override from a channel that is no longer NSFW");
    void update.catch((error) => console.error(`[self-roles] could not update NSFW visibility for channel ${channel.id}: ${error.message}`));
  };
  client.on("channelCreate", syncNsfwChannel);
  client.on("channelUpdate", (_before, after) => syncNsfwChannel(after));
}
