import { toRoyalBold } from "./embed-format.js";
import { NEW_ROLE_ID, MEMBER_ROLE_ID } from "./role-ids.js";
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

function guideSectionTitle(title) {
  return toRoyalBold(title);
}

export function buildGuidePayload(guild) {
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(`୨୧ ${toRoyalBold("Kittisugar Guide!")} ♡`)
    .setDescription(
      "A little guide of Kittisugar ♡ Tap any channel mention to open it.\n" +
      `## ୨୧ ${guideSectionTitle("Start")}\n\n` +
      `• ${channelMention(guild, ["getaccess", "get-access"])}\nRead the welcome message and press Enter Server when you are ready to access the community.\n` +
      `• ${channelMention(guild, ["welcomes"])}\nSee the coquette welcome cards for new members.\n` +
      `• ${channelMention(guild, ["rules"])}\nCheck the server rules before chatting. They explain our 18+, SFW, safety, and promotion policies.\n` +
      `• ${channelMention(guild, ["guide"])}\nFind what each channel is for and how to use the server.\n` +
      `## ୨୧ ${guideSectionTitle("Community")}\n\n` +
      `• ${channelMention(guild, ["confessions"])}\nShare an anonymous confession or create a poll with the channel buttons.\n` +
      `• ${channelMention(guild, ["loveletters", "love-letters"])}\nLeave a sweet message or appreciation for someone in the community.\n` +
      `• ${channelMention(guild, ["suggestions"])}\nShare ideas and suggestions to help make Kittisugar better.\n` +
      `• ${channelMention(guild, ["reputation"])}\nLeave kind comments, check member reputation, read feedback, and see the top members with !rep commands. VIP members can choose anonymous publishing when leaving a reputation comment.\n` +
      `• ${channelMention(guild, ["quotes"])}\nPost memorable, funny, or meaningful quotes from the community.\n` +
      `• ${channelMention(guild, ["selfies", "selfie"])}\nShare your selfies with the community.\n` +
      `• ${channelMention(guild, ["introductions", "introduction", "introduce-yourself", "introduceyourself"])}\nIntroduce yourself and let everyone get to know you.\n` +
      `• ${channelMention(guild, ["pets"])}\nOpen your private pet room from the channel embed to adopt, care for, and play with your virtual pet.\n` +
      `## ୨୧ ${guideSectionTitle("Help")}\n\n` +
      `• ${channelMention(guild, ["support"])}\nOpen a private ticket for General, Buy VIP, Partnership, Apply, Report, Appeal, Error, or Other requests. Use Get Verified to complete server verification.\n` +
      `• ${channelMention(guild, ["privatechat", "privatechats", "private-chat"])}\nCreate and manage private chat rooms. Use /priv-chat commands to see the available options.\n` +
      `• ${channelMention(guild, ["selfroles", "self-roles"])}\nChoose or update your age, gender, sexuality, and chat color. You can also show or hide channels marked NSFW.\n` +
      `## ୨୧ ${guideSectionTitle("Commands")}\n\n` +
      "`/delete amount:` — delete your own recent messages.\n" +
      "`/vip-delete amount:` — VIP message cleanup. `/mod-delete amount: [member:]` — moderator cleanup.\n" +
      "`!quote` — reply to a message with !quote to create an image quote.\n" +
      "`/priv-chat create|add|remove|rename|leave|delete|commands` — manage your private chat.\n" +
      "`!profile [@member]` — view a complete member profile and saved stats.\n" +
      "`!rep [@member]` · `!rep stats [@member]` · `!rep top` · `!rep comments [@member]` — reputation tools.\n" +
      "`!pet adopt` — open the interactive species selector. One pet per member; VIP can unlock up to three slots and customise companions.\n" +
      "`!pet stats` · `!pet feed` · `!pet play` · `!pet cuddle` · `!pet talk` · `!pet story` · `!pet gif [happy|dance|sleep]` — care, bond and unlock reactions.\n" +
      "`!pet daily` · `!pet shop` · `!pet buy <treat|toy|potion>` · `!pet use <item>` · `!pet inventory` · `!pet select <number>` — shared coins and items. Potions refill hunger completely.\n" +
      "VIP pet customisation: `!pet name`, `!pet color`, `!pet breed`, `!pet appearance`, `!pet personality`. VIP extras: `!pet room`, `!pet outfit`, `!pet rare`, `!pet slots`, `!pet minigame`.\n" +
      "`!funhelp` / `/fun help` — fun guide. `!stats` and `!vip stats [@member]` — VIP statistics. `!fuck @member` — VIP-only fun command.\n" +
      "`!couple @member` · `!propose @member` · `!marry @member` · `!breakup` · `!divorce` — relationships.\n" +
      `## ୨୧ ${guideSectionTitle("Sugar AI")}\n\n` +
      "Mention Sugar or address the bot directly to start a conversation ♡" + buildServerMap(guild)
    )
    .setFooter({ text: "Kittisugar · Quick guide ♡" });
  return { embeds: [embed] };
}

function buildServerMap(guild) {
  if (!guild?.channels?.cache) return "";
  const categories = [...guild.channels.cache.values()].filter((channel) => channel.type === ChannelType.GuildCategory).sort((a, b) => a.rawPosition - b.rawPosition);
  const sections = categories.map((category) => {
    const children = [...guild.channels.cache.values()].filter((channel) => channel.parentId === category.id && !channel.isThread?.()).sort((a, b) => a.rawPosition - b.rawPosition);
    if (!children.length) return null;
    return `**${category.name}**\n${children.slice(0, 14).map((channel) => `<#${channel.id}>`).join(" · ")}`;
  }).filter(Boolean);
  const uncategorized = [...guild.channels.cache.values()].filter((channel) => !channel.parentId && channel.type !== ChannelType.GuildCategory && !channel.isThread?.()).sort((a, b) => a.rawPosition - b.rawPosition);
  if (uncategorized.length) sections.push(`**Other channels**\n${uncategorized.slice(0, 12).map((channel) => `<#${channel.id}>`).join(" · ")}`);
  const map = sections.join("\n");
  return map ? `\n## ୨୧ ${guideSectionTitle("Channels & Categories")}\n\n${map}`.slice(0, 1350) : "";
}

async function refreshDashboardGuide(client, guild) {
  const dashboard = guild.channels.cache.find((channel) => channel.type === ChannelType.GuildText && normalizeName(channel.name) === "dashboard");
  if (!dashboard) return;
  const guide = await upsertPanel(dashboard, client, "୨୧ Kittisugar Guide ♡", buildGuidePayload(guild));
  await guide.pin().catch(() => {});
}
async function upsertPanel(channel, client, title, payload) {
  const recent = await channel.messages.fetch({ limit: 50 });
  const existing = recent.find((message) =>
    message.author?.id === client.user.id && message.embeds.some((embed) => normalizeName(embed.title) === normalizeName(title)),
  );
  if (existing) return existing.edit(payload);
  return channel.send(payload);
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

  // Refresh an existing Guide embed in place; never repost it or make it sticky.
  if (guide) {
    const recentGuideMessages = await guide.messages.fetch({ limit: 50 });
    const existingGuide = recentGuideMessages.find((message) =>
      message.author?.id === client.user.id &&
      message.embeds.some((embed) => normalizeName(embed.title).includes("guide")),
    );
    if (existingGuide) await existingGuide.edit(buildGuidePayload(guild));
  }
  const dashboard = guild.channels.cache.find((channel) =>
    channel.type === ChannelType.GuildText && normalizeName(channel.name) === "dashboard",
  );
  if (dashboard) {
    const dashboardGuide = await upsertPanel(dashboard, client, "୨୧ Kittisugar Guide ♡", buildGuidePayload(guild));
    await dashboardGuide.pin().catch((error) => {
      console.error(`[access] could not pin the dashboard guide in guild ${guild.id}: ${error.message}`);
    });
  }

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
    if (channel.guild) void refreshDashboardGuide(client, channel.guild).catch((error) => console.error(`[access] guide refresh failed: ${error.message}`));
  });
  client.on(Events.ChannelUpdate, (_before, channel) => {
    if (channel.guild) void refreshDashboardGuide(client, channel.guild).catch((error) => console.error(`[access] guide refresh failed: ${error.message}`));
  });
  client.on(Events.ChannelDelete, (channel) => {
    if (channel.guild) void refreshDashboardGuide(client, channel.guild).catch((error) => console.error(`[access] guide refresh failed: ${error.message}`));
  });

  client.on(Events.InteractionCreate, (interaction) => {
    if (!interaction.isButton() || interaction.customId !== ENTER_ID) return;
    void handleEnterButton(interaction).catch(async (error) => {
      console.error(`[access] enter button failed: ${error.message}`);
      await replyEphemeral(interaction, "Something went wrong while starting access verification. Please try again.").catch(() => {});
    });
  });
}
