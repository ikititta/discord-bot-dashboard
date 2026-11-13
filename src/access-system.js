import { toRoyalBold } from "./embed-format.js";
import { NEW_ROLE_ID, MEMBER_ROLE_ID } from "./role-ids.js";
import { PRIVATE_CHAT_CATEGORY_ID, PRIVATE_CHAT_LOBBY_CHANNEL_ID } from "./private-chat-format.js";
import { attachRoleOnboarding, ensureSelfRolesChannel, startRoleOnboarding } from "./role-onboarding.js";

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  Events,
  PermissionFlagsBits,
} from "discord.js";

const PREFIX = "sugar-access:";
const ENTER_ID = `${PREFIX}enter`;
const COLOR = 0xffd9ff;
const START_CATEGORY_NAME = "start";
const ACCESS_CHANNEL_NAME = "✅｜୨୧•𝓰𝓮𝓽-𝓪𝓬𝓬𝓮𝓼𝓼";
const RULES_CHANNEL_NAME = "📃｜୨୧•𝓻𝓾𝓵𝓮𝓼";
const GUIDE_CHANNEL_NAME = "📖｜୨୧•𝓰𝓾𝓲𝓭𝓮";
const GUIDE_CHANNEL_REFRESH_IDS = ["1569551049977761853", "1569574031991119882"];
export const BOOSTER_ROLE_NAME = "୨୧ 𝓑𝓸𝓸𝓼𝓽𝓮𝓻";
export const BOOSTER_ROLE_COLOR = 0xff9ad5;

export function isServerBooster(member) {
  return member?.premiumSinceTimestamp != null || member?.premiumSince != null;
}

export async function ensureBoosterRole(guild) {
  const existing = findRoleByName(guild, BOOSTER_ROLE_NAME);
  if (existing) return existing;
  const botMember = guild.members.me;
  if (!botMember?.permissions?.has(PermissionFlagsBits.ManageRoles)) throw new Error("Sugar needs Manage Roles to create and assign the Booster role.");
  return guild.roles.create({ name: BOOSTER_ROLE_NAME, color: BOOSTER_ROLE_COLOR, hoist: false, mentionable: false, reason: "Create the automatic Kittisugar Server Booster role" });
}

export async function syncBoosterRole(member, boosterRole) {
  if (!member?.roles || !boosterRole?.id) return false;
  const hasRole = member.roles.cache.has(boosterRole.id);
  const shouldHaveRole = isServerBooster(member);
  if (shouldHaveRole && !hasRole) { await member.roles.add(boosterRole, "Automatically reward a Kittisugar server boost"); return true; }
  if (!shouldHaveRole && hasRole) { await member.roles.remove(boosterRole, "Automatically remove the Booster role when a server boost ends"); return true; }
  return false;
}
export const NEW_USER_VISIBLE_CATEGORY_ID = "1569548036055507055";

export function normalizeName(value) {
  return String(value ?? "").normalize("NFKD").toLowerCase().replace(/\p{M}/gu, "").replace(/[^a-z0-9]/g, "");
}

export function findNewRole(guild) {
  return guild.roles.cache.get(NEW_ROLE_ID) ?? null;
}

export function findMemberRole(guild) {
  return guild.roles.cache.get(MEMBER_ROLE_ID) ?? null;
}

export function findRoleByName(guild, name) {
  const expected = normalizeName(name);
  return guild.roles.cache.find((role) => normalizeName(role.name) === expected) ?? null;
}

export function canNewRoleViewChannel(channel) {
  const isSupport = normalizeName(channel.name) === "support";
  return isSupport || channel.id === NEW_USER_VISIBLE_CATEGORY_ID || channel.parentId === NEW_USER_VISIBLE_CATEGORY_ID;
}

export async function applyNewRoleVisibility(guild, newRole) {
  const visibleCategory = guild.channels.cache.get(NEW_USER_VISIBLE_CATEGORY_ID);
  if (!visibleCategory || visibleCategory.type !== ChannelType.GuildCategory) return false;

  for (const channel of guild.channels.cache.values()) {
    if (channel.isThread?.()) continue;
    // Synced children inherit the category overwrite. Editing them would
    // unnecessarily desynchronize their permissions from the parent.
    if (channel.parentId && channel.permissionsLocked === true) continue;

    await channel.permissionOverwrites.edit(
      newRole,
      { ViewChannel: canNewRoleViewChannel(channel) },
      "Restrict the New role to the designated Kittisugar entry category",
    );
  }
  return true;
}

export async function assignMemberAccess(member, { newRole, memberRole }) {
  if (!member?.roles || !newRole?.id || !memberRole?.id) {
    throw new Error("The New and Member roles are required.");
  }
  if (member.roles.cache.has(memberRole.id) && !member.roles.cache.has(newRole.id)) {
    return false;
  }
  if (!member.roles.cache.has(newRole.id)) {
    throw new Error("You do not have the New role.");
  }

  await member.roles.add(memberRole, "Member completed the Kittisugar access verification");
  try {
    await member.roles.remove(newRole, "Remove New after successful Kittisugar verification");
  } catch (error) {
    await member.roles.remove(memberRole, "Roll back Member role because New could not be removed").catch(() => {});
    throw error;
  }
  return true;
}

function buildEnterButton(guild) {
  const button = new ButtonBuilder()
    .setCustomId(ENTER_ID)
    .setLabel("Enter Server ♡")
    .setStyle(ButtonStyle.Primary);

  const pinkCheck = guild.emojis.cache.find((emoji) =>
    ["pinkcheck", "pinktick", "checkpink"].includes(normalizeName(emoji.name)),
  );
  if (pinkCheck) {
    button.setEmoji({ id: pinkCheck.id, name: pinkCheck.name, animated: pinkCheck.animated });
  }
  return button;
}

export function buildAccessPanelPayload(guild, { rulesChannel, guideChannel } = {}) {
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(`୨୧ ${toRoyalBold("Get Access!")} ♡`)
    .setDescription(
      `Welcome! Before entering the server, please read ${rulesChannel ? `<#${rulesChannel.id}>` : "**Rules**"} & ${guideChannel ? `<#${guideChannel.id}>` : "**Guide**"} in this category.\n\n` +
      "By pressing **Enter Server ♡**, you confirm that you have read & agree to follow all server rules and that you are **18 years of age or older**.\n\n" +
      "After confirmation, Sugar will guide you through your gender, age, sexuality, chat color, and NSFW visibility. Once you finish, Sugar will give you **Member** and remove **New** to unlock Kittisugar.",
    )
    .setFooter({ text: "Please make sure you meet both requirements before continuing ♡" });
  return {
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(buildEnterButton(guild))],
  };
}

export function buildRulesPayload(guild) {
  const promotionChannel = guild ? channelMention(guild, ["promotions", "promotion", "promos", "promo", "selling", "advertising", "advertise", "marketplace"]) : "**promotions / selling channel**";
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(`୨୧ ${toRoyalBold("Kittisugar Rules")} ♡`)
    .setDescription([
      `## ${toRoyalBold("01 · Respect")}
No harassment, hate, threats, bullying, spam, or sharing private information.`,
      `## ${toRoyalBold("02 · Content")}
Keep NSFW content in NSFW channels. VIP members may post it elsewhere. No illegal or non-consensual intimate content. Fun interaction commands run automatically for verified Member accounts; follow Kittisugar's server rules.`,
      `## ${toRoyalBold("03 · Promotions & Selling")}
VIP members may promote or sell in ${promotionChannel}. VIP is **$5 USD once, for life** and includes VIP access and a custom role. The Seller role is **optional** and is not required to use VIP benefits. VIP unlocks exclusive commands and features, including virtual-pet extras, anonymous reputation posts, and bulk deletion of your own messages. No unsolicited ads in chats, profiles, or DMs.`,
      `## ${toRoyalBold("04 · Warnings")}
Repeated rule-breaking may result in warnings, timeouts, or a ban from Kittisugar.`,
      `## ${toRoyalBold("05 · Support Kittisugar")}
Donations help cover Sugar’s monthly hosting costs. Server boosts also unlock a special role and benefits. Thank you for supporting Kittisugar ♡`,
    ].join("\n"))
    .setFooter({ text: "By staying, you agree to follow these rules ♡" });
  return { embeds: [embed] };
}

function channelMention(guild, names) {
  const wanted = new Set(names.map(normalizeName));
  const channel = guild?.channels?.cache?.find((item) =>
    item.type === ChannelType.GuildText && wanted.has(normalizeName(item.name)),
  );
  return channel ? `<#${channel.id}>` : `**${names[0]}**`;
}

export function buildGuidePayload(guild) {
  const dashboard = guild?.channels?.cache?.find((channel) =>
    channel.type === ChannelType.GuildText && normalizeName(channel.name) === "dashboard",
  );
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(`${toRoyalBold("Kittisugar Guide!")} 🎀`)
    .setDescription([
      "Welcome to Kittisugar! Tap any channel mention below to open it.",
      "",
      "When you join the server, you can always find this guide again in " + (dashboard ? `<#${dashboard.id}>` : "#dashboard") + ".",
      "",
      "`!commands` — explore all Sugar commands.",
      "`!quote` — reply to someone's message with `!quote` to save/share it as a quote.",
      "`!smile` — try a fun interaction command.",
      "",
      "You can also mention Sugar or address the bot directly to chat with her ♡",
    ].join("\n"))
    .setFooter({ text: "Kittisugar · Quick guide ♡" });
  return { embeds: [embed, ...buildServerMap(guild)] };
}
const CHANNEL_PURPOSES = {
  getaccess: "Start here: read the welcome panel and press Enter Server to begin verification.",
  welcomes: "See the welcome cards Sugar posts when new members join.",
  rules: "Read the community rules, age requirement, content boundaries, and promotion policy.",
  guide: "Read this guide to understand the server channels and how to use them.",
  confessions: "Submit an anonymous confession or create a poll using the buttons in the channel.",
  loveletters: "Send a sweet appreciation message or love letter to someone in the community.",
  suggestions: "Share suggestions and ideas to help improve Kittisugar.",
  suggestences: "Share suggestions and ideas to help improve Kittisugar.",
  reputation: "Give or receive reputation, leave feedback, and browse member reputation with !rep.",
  quotes: "Share and browse memorable, funny, or meaningful quotes from the community.",
  selfies: "Share your selfies with the community.",
  introductions: "Introduce yourself and tell everyone a little about you.",
  pets: "Open your personal virtual-pet room to adopt, care for, and play with your pet.",
  support: "Use the support panel to open a private ticket for help, purchases, applications, reports, appeals, or errors.",
  selfroles: "Choose or update your age, gender, sexuality, interests, and chat-color roles; manage NSFW visibility.",
  commands: "Use !commands to open Sugar's complete command guide.",
  moderation: "Staff-only moderation tools, reports, and moderation information.",
  dashboard: "Staff server-management panels and bot configuration information.",
  general: "Chat with the community and take part in everyday conversations.",
  media: "Share images, videos, and other media with the community.",
  nsfw: "Adult-only discussion and media. Follow the server's NSFW rules and channel restrictions.",
  memes: "Share memes and funny content with the community.",
  games: "Talk about games and find peopfunction isPrivateChatRoom(channel) {
  const name = normalizeName(channel.name);
  if (channel.id === PRIVATE_CHAT_LOBBY_CHANNEL_ID || name === "privatechatlobby" || name === "createprivatechat") return false;
  return channel.parentId === PRIVATE_CHAT_CATEGORY_ID ||
    name.startsWith("privateroom") ||
    name.startsWith("privatechatroom") ||
    String(channel.name ?? "").startsWith("👥");
}

function isExcludedGuideChannel(channel, categoryById) {
  const name = normalizeName(channel.name);
  const categoryName = normalizeName(categoryById.get(channel.parentId)?.name);
  const excludedTerms = ["ticket", "transcript", "admin", "staff", "moderation", "modlog", "auditlog"];
  if (excludedTerms.some((term) => name.includes(term) || categoryName.includes(term))) return true;
  // The support channel only launches private tickets, so it is not a public destination.
  if (["support", "tickets", "ticket", "ticketpanel"].includes(name)) return true;
  return false;
}

function describeChannel(channel) {
  if (channel.id === PRIVATE_CHAT_LOBBY_CHANNEL_ID ||
      ["privatechat", "privatechatlobby", "createprivatechat"].includes(normalizeName(channel.name))) {
    return "Create a private chat room here with the Create Private Chat button or /priv-chat create. Private rooms are not listed.";
  }
  const key = normalizeName(channel.name);
  if (CHANNEL_PURPOSES[key]) return CHANNEL_PURPOSES[key];
  const topic = String(channel.topic ?? "").replace(/\s+/g, " ").trim();
  if (topic && normalizeName(topic) !== key) return topic.slice(0, 220);
  if (channel.type === ChannelType.GuildVoice || channel.type === ChannelType.GuildStageVoice) {
    return "Join this voice channel to talk with other members in real time.";
  }
  if (channel.type === ChannelType.GuildForum) return "Create a post or join an existing discussion in this forum.";
  if (channel.type === ChannelType.GuildAnnouncement) return "Read important server announcements and updates.";
  const readable = String(channel.name ?? "this channel").replace(/[|｜]/g, " ").replace(/[_-]+/g, " ").trim();
  return `Use this channel for ${readable || "community"} discussions, posts, and related content.`;
}

function buildServerMap(guild) {
  if (!guild?.channels?.cache) return [];
  const all = [...guild.channels.cache.values()];
  const categories = all.filter((channel) => channel.type === ChannelType.GuildCategory)
    .sort((a, b) => (a.rawPosition ?? 0) - (b.rawPosition ?? 0));
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const visibleChannels = all.filter((channel) =>
    channel.type !== ChannelType.GuildCategory &&
    !channel.isThread?.() &&
    !isPrivateChatRoom(channel) &&
    !isExcludedGuideChannel(channel, categoryById),
  );

  // Keep each Discord category's channels together without exposing category names.
  const orderedGroups = categories.map((category) => ({
    channels: visibleChannels.filter((channel) => channel.parentId === category.id)
      .sort((a, b) => (a.rawPosition ?? 0) - (b.rawPosition ?? 0)),
  })).filter((group) => group.channels.length);
  const uncategorized = visibleChannels.filter((channel) => !categoryById.has(channel.parentId))
    .sort((a, b) => (a.rawPosition ?? 0) - (b.rawPosition ?? 0));
  if (uncategorized.length) orderedGroups.push({ channels: uncategorized });

  const lines = orderedGroups.flatMap((group) =>
    group.channels.map((channel) => `• <#${channel.id}> — ${describeChannel(channel)}`),
  );
  if (!lines.length) return [];

  const chunks = [];
  let current = [];
  let length = 0;
  for (const line of lines) {
    if (current.length && length + line.length + 1 > 3000 && chunks.length < 2) {
      chunks.push(current);
      current = [];
      length = 0;
    }
    current.push(line);
    length += line.length + 1;
  }
  if (current.length) chunks.push(current);

  const titles = ["Getting Started", "Community", "Explore"];
  return chunks.map((chunk, index) => new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(`${toRoyalBold(titles[index] ?? "Explore")} 🎀`)
    .setDescription(chunk.join("\n")));
}
ver channel directory needs ${embeds.length} embeds; Discord allows at most 9 directory embeds plus the guide intro.`);
  }
  return embeds;
}

const guideRefreshQueues = new Map();

function refreshGuildGuides(client, guild) {
  const previous = guideRefreshQueues.get(guild.id) ?? Promise.resolve();
  const current = previous
    .catch(() => {})
    .then(() => refreshGuildGuidesNow(client, guild));
  guideRefreshQueues.set(guild.id, current);
  return current.finally(() => {
    if (guideRefreshQueues.get(guild.id) === current) guideRefreshQueues.delete(guild.id);
  });
}

async function refreshGuildGuidesNow(client, guild) {
  const channelIds = new Set(GUIDE_CHANNEL_REFRESH_IDS);
  const dashboard = guild.channels.cache.find((channel) =>
    channel.type === ChannelType.GuildText && normalizeName(channel.name) === "dashboard",
  );
  if (dashboard) channelIds.add(dashboard.id);

  const payload = buildGuidePayload(guild);
  for (const channelId of channelIds) {
    const channel = guild.channels.cache.get(channelId) ??
      await guild.channels.fetch(channelId).catch(() => null);
    if (!channel || channel.type !== ChannelType.GuildText) continue;

    const recent = await channel.messages.fetch({ limit: 50 });
    const guides = [...recent.values()].filter((message) =>
      message.author?.id === client.user.id &&
      message.embeds.some((item) => normalizeName(item.title).includes("guide")),
    );
    if (guides.length) {
      for (const guide of guides) await guide.edit(payload);
    } else {
      const created = await channel.send(payload);
      if (normalizeName(channel.name) === "dashboard") await created.pin().catch(() => {});
    }
    if (normalizeName(channel.name) === "dashboard" && guides[0]) {
      await guides[0].pin().catch(() => {});
    }
  }
}

async function applyStartPermissions(channel, guild, newRole, botId) {
  await channel.permissionOverwrites.edit(guild.roles.everyone, {
    ViewChannel: false,
  });
  await channel.permissionOverwrites.edit(newRole, {
    ViewChannel: true,
    ReadMessageHistory: true,
    SendMessages: false,
  });
  await channel.permissionOverwrites.edit(botId, {
    ViewChannel: true,
    SendMessages: true,
    EmbedLinks: true,
    ReadMessageHistory: true,
    ManageChannels: true,
  });
}

function findTextChannel(guild, _category, expectedName) {
  const expected = normalizeName(expectedName);
  return guild.channels.cache.find((channel) =>
    channel.type === ChannelType.GuildText &&
    normalizeName(channel.name) === expected,
  ) ?? null;
}

async function ensureTextChannel(guild, category, name, newRole, botId) {
  const channel = findTextChannel(guild, category, name);
  if (!channel) {
    console.warn(`[access] existing #${name} channel was not found in guild ${guild.id}; no channel was created.`);
    return null;
  }
  // Keep the current name and category exactly as the server owner set them.
  await applyStartPermissions(channel, guild, newRole, botId);
  return channel;
}

export async function ensureStartChannels(guild, client) {
  const newRole = findNewRole(guild);
  if (!newRole) {
    console.warn(`[access] the New role was not found in guild ${guild.id}; start channels were not configured.`);
    return null;
  }

  const category = guild.channels.cache.find((channel) =>
    channel.type === ChannelType.GuildCategory && normalizeName(channel.name) === START_CATEGORY_NAME,
  );
  if (!category) {
    console.warn(`[access] existing start category was not found in guild ${guild.id}; no category or channels were created.`);
    return null;
  }

  await applyStartPermissions(category, guild, newRole, client.user.id);
  const access = await ensureTextChannel(guild, category, ACCESS_CHANNEL_NAME, newRole, client.user.id);
  const rules = await ensureTextChannel(guild, category, RULES_CHANNEL_NAME, newRole, client.user.id);
  const guide = await ensureTextChannel(guild, category, GUIDE_CHANNEL_NAME, newRole, client.user.id);

  if (access) {
    await upsertPanel(access, client, `୨୧ ${toRoyalBold("Get Access!")} ♡`, buildAccessPanelPayload(guild, { rulesChannel: rules, guideChannel: guide }));
  }

  await refreshGuildGuides(client, guild);
    console.info(`[access] start category checked for guild ${guild.id}; no channels were created or renamed.`);
  return { category, access, rules, guide };
}

async function replyEphemeral(interaction, content) {
  if (interaction.deferred || interaction.replied) return interaction.followUp({ content, ephemeral: true });
  return interaction.reply({ content, ephemeral: true });
}

async function handleEnterButton(interaction) {
  if (!interaction.inGuild()) return replyEphemeral(interaction, "This button only works inside Kittisugar.");
  return startRoleOnboarding(interaction);
}

async function setupBoosterRole(guild) {
  try {
    const role = await ensureBoosterRole(guild);
    const members = await guild.members.fetch();
    let synced = 0;
    for (const member of members.values()) {
      try { if (await syncBoosterRole(member, role)) synced += 1; }
      catch (error) { console.error("[boosters] could not sync member " + member.id + " in guild " + guild.id + ": " + error.message); }
    }
    console.info("[boosters] role ready for guild " + guild.id + "; synchronized " + synced + " member role change(s)");
  } catch (error) { console.error("[boosters] setup failed for guild " + guild.id + ": " + error.message); }
}
export function attachAccessSystem(client, { settings } = {}) {
  attachRoleOnboarding(client, { settings });
  client.once(Events.ClientReady, async () => {
    for (const guild of client.guilds.cache.values()) {
      await setupBoosterRole(guild);
      try {
        await ensureStartChannels(guild, client);
        await ensureSelfRolesChannel(guild, client);
        const newRole = findNewRole(guild);
        if (newRole && !(await applyNewRoleVisibility(guild, newRole))) {
          console.warn(`[access] visible category ${NEW_USER_VISIBLE_CATEGORY_ID} was not found in guild ${guild.id}; New-role visibility was not changed.`);
        }
      } catch (error) {
        console.error(`[access] setup failed for guild ${guild.id}: ${error.message}`);
      }
    }
  });

  client.on(Events.GuildMemberUpdate, async (_before, member) => {
    try { const role = findRoleByName(member.guild, BOOSTER_ROLE_NAME); if (role) await syncBoosterRole(member, role); }
    catch (error) { console.error("[boosters] could not update member " + member.id + " in guild " + member.guild.id + ": " + error.message); }
  });

  client.on(Events.GuildMemberAdd, async (member) => {
    try { const role = findRoleByName(member.guild, BOOSTER_ROLE_NAME); if (role) await syncBoosterRole(member, role); }
    catch (error) { console.error("[boosters] could not sync joining member " + member.id + " in guild " + member.guild.id + ": " + error.message); }
    const newRole = findNewRole(member.guild);
    const memberRole = findMemberRole(member.guild);
    if (!newRole) {
      console.error(`[access] New role ${NEW_ROLE_ID} was not found in guild ${member.guild.id}; cannot assign it to joining member ${member.id}.`);
      return;
    }
    if (memberRole && member.roles.cache.has(memberRole.id)) return;
    try {
      await member.roles.add(newRole, "Assign the New role before Kittisugar access verification");
      console.info(`[access] assigned New role ${NEW_ROLE_ID} to joining member ${member.id} in guild ${member.guild.id}`);
    } catch (error) {
      console.error(`[access] could not assign New role ${NEW_ROLE_ID} to member ${member.id}: ${error.message}`);
    }
  });

  client.on(Events.ChannelCreate, (channel) => {
    const newRole = findNewRole(channel.guild);
    if (!newRole) return;
    void applyNewRoleVisibility(channel.guild, newRole).catch((error) => {
      console.error(`[access] could not enforce New-role channel visibility in guild ${channel.guild.id}: ${error.message}`);
    });
  });  client.on(Events.ChannelCreate, (channel) => {
    if (channel.guild) void refreshGuildGuides(client, channel.guild).catch((error) => console.error(`[access] guide refresh failed: ${error.message}`));
  });
  client.on(Events.ChannelUpdate, (_before, channel) => {
    if (channel.guild) void refreshGuildGuides(client, channel.guild).catch((error) => console.error(`[access] guide refresh failed: ${error.message}`));
  });
  client.on(Events.ChannelDelete, (channel) => {
    if (channel.guild) void refreshGuildGuides(client, channel.guild).catch((error) => console.error(`[access] guide refresh failed: ${error.message}`));
  });

  client.on(Events.InteractionCreate, (interaction) => {
    if (!interaction.isButton() || interaction.customId !== ENTER_ID) return;
    void handleEnterButton(interaction).catch(async (error) => {
      console.error(`[access] enter button failed: ${error.message}`);
      await replyEphemeral(interaction, "Something went wrong while starting access verification. Please try again.").catch(() => {});
    });
  });
}
