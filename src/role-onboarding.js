import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
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
export const NSFW_HIDDEN_ROLE_ID = "1569885841180856361";
const AGE_REVIEW_ROLE_NAME = "age-review";
const AGE_REVIEW_PREFIX = "sugar-age-review:";
const SUPPORT_CHANNEL_ID = "1568492748732895313";
const TICKET_CATEGORY_ID = "1569529041017503784";


async function findOrCreateAgeReviewRole(guild) {
  return findRoleByName(guild, AGE_REVIEW_ROLE_NAME) ??
    guild.roles.create({ name: AGE_REVIEW_ROLE_NAME, reason: "Restrict members awaiting manual age verification" });
}

function findSupportChannel(guild) {
  return guild.channels.cache.get(SUPPORT_CHANNEL_ID) ??
    guild.channels.cache.find((channel) => channel.type === ChannelType.GuildText && normalizeRoleName(channel.name) === "support") ??
    null;
}

async function ensureAgeReviewVisibility(guild, role) {
  let support = findSupportChannel(guild);
  if (!support) {
    support = await guild.channels.create({
      name: "💗｜୨୧•𝓼𝓾𝓹𝓹𝓸𝓻𝓽",
      type: ChannelType.GuildText,
      reason: "Create the required Kittisugar support channel for manual age verification",
    });
    await support.permissionOverwrites.edit(guild.roles.everyone, {
      ViewChannel: true, SendMessages: false, ReadMessageHistory: true,
    });
  }
  for (const channel of guild.channels.cache.values()) {
    if (channel.isThread?.() || !channel.permissionOverwrites?.edit) continue;
    await channel.permissionOverwrites.edit(role, {
      ViewChannel: channel.id === support.id,
      ...(channel.id === support.id ? { ReadMessageHistory: true, SendMessages: false } : {}),
    }, "Restrict age-review members to the Support channel");
  }
  const newRole = findRoleByName(guild, "new");
  if (newRole) await support.permissionOverwrites.edit(newRole, {
    ViewChannel: true, ReadMessageHistory: true, SendMessages: false,
  }, "Allow New members to reach Support");
  return support;
}

async function createAgeReviewTicket(interaction, member) {
  const guild = interaction.guild;
  const client = interaction.client;
  const ageRole = await findOrCreateAgeReviewRole(guild);
  const support = await ensureAgeReviewVisibility(guild, ageRole);
  let category = guild.channels.cache.get(TICKET_CATEGORY_ID);
  if (!category || category.type !== ChannelType.GuildCategory) {
    category = guild.channels.cache.find((channel) =>
      channel.type === ChannelType.GuildCategory && normalizeRoleName(channel.name).includes("tickets"),
    ) ?? await guild.channels.create({
      name: "support tickets",
      type: ChannelType.GuildCategory,
      reason: "Create the shared Kittisugar support ticket category",
    });
  }

  const topic = `sugar-ticket:open:${member.id}:${guild.id}`;
  let ticket = guild.channels.cache.find((channel) =>
    channel.type === ChannelType.GuildText && channel.topic === topic && channel.name.includes("age-verification"),
  );
  if (!ticket) {
    const safeName = normalizeRoleName(member.user.username).slice(0, 35) || "member";
    const staffRoles = guild.roles.cache.filter((role) =>
      role.permissions.has(PermissionFlagsBits.ManageChannels) ||
      role.permissions.has(PermissionFlagsBits.ManageMessages) ||
      /staff|moderator/i.test(role.name),
    );
    const overwrites = [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.EmbedLinks] },
      { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageMessages] },
      ...[...staffRoles.values()].map((role) => ({
        id: role.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ManageMessages],
      })),
    ];
    ticket = await guild.channels.create({
      name: `ticket-age-verification-${safeName}`.slice(0, 90),
      type: ChannelType.GuildText,
      parent: category.id,
      topic,
      permissionOverwrites: overwrites,
      reason: `Manual age verification requested by ${member.id}`,
    });
    const embed = new EmbedBuilder().setColor(COLOR)
      .setTitle("୨୧ Manual Age Verification ♡")
      .setDescription(
        `<@${member.id}> selected **18-** during onboarding. A staff member must manually verify that this person is 18 or older before granting Member access.\n\n` +
        "**Important:** Do not post identity documents in public channels or send copies for storage. Ask staff to guide you through a private, live check. Staff must not retain copies of identity documents.\n\n" +
        "Only staff may approve access after completing the age check. The Verified role is a separate anti-catfish check and does not confirm age."
      );
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(AGE_REVIEW_PREFIX + "approve:" + member.id)
        .setLabel("Approve 18+").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("sugar-ticket:close")
        .setLabel("Close Ticket ♡").setStyle(ButtonStyle.Danger),
    );
    await ticket.send({
      content: `<@${member.id}> — manual age verification is required. ${[...staffRoles.keys()].map((id) => `<@&${id}>`).join(" ")}`,
      embeds: [embed],
      components: [row],
      allowedMentions: { parse: [], users: [member.id], roles: [...staffRoles.keys()] },
    });
  }

  await member.roles.add(ageRole, "Member selected 18- and requires manual age verification");
  await ensureAgeReviewVisibility(guild, ageRole);
  await ticket.permissionOverwrites.edit(member.id, {
    ViewChannel: true, SendMessages: true, ReadMessageHistory: true, EmbedLinks: true,
  }, "Allow the age-review member to access their private verification ticket");

  const dm = new EmbedBuilder().setColor(COLOR)
    .setTitle("୨୧ Age Verification Required ♡")
    .setDescription(
      `You selected **18-** in Kittisugar. Your access is now restricted to <#${support.id}> and your private age-verification ticket: ${ticket.url}.\n\n` +
      "A staff member must manually confirm that you are 18 or older before Member access can be granted. The Verified role checks identity/catfish concerns only; it does not verify age. Please do not send identity-document copies for storage."
    );
  await member.send({ embeds: [dm], allowedMentions: { parse: [] } }).catch(() => {});
  return { ticket, support };
}

function isAgeReviewStaff(interaction) {
  if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
      interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles) ||
      interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) return true;
  return interaction.member?.roles?.cache?.some((role) => /staff|moderator|admin/i.test(role.name)) === true;
}

async function handleAgeReviewApproval(interaction) {
  if (!interaction.inGuild()) return interaction.reply({ content: "This only works inside Kittisugar.", ephemeral: true });
  if (!isAgeReviewStaff(interaction)) return interaction.reply({ content: "Only staff can approve age verification.", ephemeral: true });
  const userId = interaction.customId.slice((AGE_REVIEW_PREFIX + "approve:").length);
  const member = await interaction.guild.members.fetch(userId).catch(() => null);
  const ageRole = findRoleByName(interaction.guild, AGE_REVIEW_ROLE_NAME);
  const newRole = findRoleByName(interaction.guild, "new");
  const memberRole = findRoleByName(interaction.guild, "member");
  if (!member || !ageRole || !newRole || !memberRole || !member.roles.cache.has(ageRole.id)) {
    return interaction.reply({ content: "This member is no longer awaiting age verification.", ephemeral: true });
  }
  await member.roles.add(memberRole, "Staff approved the member's manual 18+ age verification");
  await member.roles.remove([newRole, ageRole], "Remove New and age-review after staff approval");
  await interaction.update({
    content: `18+ age verification approved by <@${interaction.user.id}>. Member access has been granted to <@${member.id}>.`,
    embeds: [], components: [],
    allowedMentions: { parse: [], users: [member.id, interaction.user.id] },
  });
  const approved = new EmbedBuilder().setColor(0x4ade80)
    .setTitle("୨୧ Age Verification Approved ♡")
    .setDescription("A staff member has confirmed your 18+ status. Your Kittisugar Member access is now active.");
  await member.send({ embeds: [approved] }).catch(() => {});
}

export function findNsfwHiddenRole(guild) {
  return guild.roles.cache.get(NSFW_HIDDEN_ROLE_ID) ?? null;
}

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
  ["prefer-not-to-say", "Prefer not to say"],
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

async function getOrCreateRole(guild, name, color) {
  let role = findRoleByName(guild, name);
  if (role) return role;
  return guild.roles.create({
    name,
    ...(color !== undefined ? { color } : {}),
    reason: "Create a Kittisugar self-role selection",
  });
}

async function replaceCategoryRole(member, category, selectedRole) {
  const prefix = `${category}-`;
  await member.roles.add(selectedRole, `Set Kittisugar ${category} self-role`);
  const oldRoles = member.roles.cache.filter((role) =>
    role.id !== selectedRole.id && String(role.name).toLowerCase().startsWith(prefix),
  );
  if (oldRoles.size) {
    await member.roles.remove([...oldRoles.values()], `Replace previous Kittisugar ${category} self-role`);
  }
}

async function applyChoice(member, category, value) {
  if (category === "nsfw") {
    const hiddenRole = findNsfwHiddenRole(member.guild);
    if (!hiddenRole) throw new Error(`The NSFW visibility role ${NSFW_HIDDEN_ROLE_ID} was not found.`);
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
    const selected = COLOR_OPTIONS.find(([key]) => key === String(value));
    if (!selected) throw new Error("That color is not available.");
    const [key, , discordColor] = selected;
    const role = await getOrCreateRole(member.guild, `color-${key}`, discordColor);
    await replaceCategoryRole(member, "color", role);
    return;
  }

  const name = roleNameForSelection(category, value);
  const role = await getOrCreateRole(member.guild, name);
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
  const panelPayloads = buildSelfRolesPanelPayload();
  const legacyPanelTitle = `୨୧ ${toRoyalBold("Self Roles")} ♡`;
  const legacyPanel = recent.find((message) =>
    message.author?.id === client.user.id && message.embeds.some((embed) => embed.title === legacyPanelTitle),
  );
  if (legacyPanel) await legacyPanel.delete();
  for (const payload of panelPayloads) {
    const title = payload.embeds[0].data.title;
    const existing = recent.find((message) =>
      message.author?.id === client.user.id && message.embeds.some((embed) => embed.title === title),
    );
    if (existing) await existing.edit(payload);
    else await channel.send(payload);
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
  if (ageReviewRole && member.roles.cache.has(ageReviewRole.id)) throw new Error("Manual age verification is still pending.");
  const newRole = findRoleByName(interaction.guild, "new");
  const memberRole = findRoleByName(interaction.guild, "member");
  if (!newRole || !memberRole) throw new Error("Sugar couldn't find the New or Member role. Please contact a moderator.");
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
  const ageReviewRole = findRoleByName(interaction.guild, AGE_REVIEW_ROLE_NAME);
  if (ageReviewRole && member.roles.cache.has(ageReviewRole.id)) {
    return interaction.editReply("Your manual age verification is pending in your private Support ticket. Please wait for staff approval ♡");
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
    if (interaction.isButton() && interaction.customId.startsWith(AGE_REVIEW_PREFIX + "approve:")) {
      try { return await handleAgeReviewApproval(interaction); }
      catch (error) { console.error(`[age-review] approval failed: ${error.message}`); return interaction.reply({ content: "Age approval failed. Please contact an administrator.", ephemeral: true }).catch(() => {}); }
    }
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
      if (parsed.mode === "onboard" && category === "age" && value === "18-") {
        const { ticket, support } = await createAgeReviewTicket(interaction, member);
        return interaction.update({ content: `You selected 18-. Your access is restricted until staff manually confirms you are 18 or older. Check your DM and your private ticket: <#${ticket.id}>.`, embeds: [], components: [] });
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
