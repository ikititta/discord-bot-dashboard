import { toRoyalBold } from "./embed-format.js";

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
const ACCESS_CHANNEL_NAME = "🔑｜୨୧•𝓰𝓮𝓽-𝓪𝓬𝓬𝓮𝓼𝓼";
const RULES_CHANNEL_NAME = "📜｜୨୧•𝓻𝓾𝓵𝓮𝓼";
const GUIDE_CHANNEL_NAME = "🧭｜୨୧•𝓰𝓾𝓲𝓭𝓮";
const NEW_ROLE_NAME = "new";
const MEMBER_ROLE_NAME = "member";

export function normalizeName(value) {
  return String(value ?? "").normalize("NFKD").toLowerCase().replace(/\p{M}/gu, "").replace(/[^a-z0-9]/g, "");
}

export function findRoleByName(guild, name) {
  const expected = normalizeName(name);
  return guild.roles.cache.find((role) => normalizeName(role.name) === expected) ?? null;
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
    .setTitle("୨୧ Welcome to Kittisugar ♡")
    .setDescription(
      `Welcome! Before entering the server, please read ${rulesChannel ? `<#${rulesChannel.id}>` : "**Rules**"} & ${guideChannel ? `<#${guideChannel.id}>` : "**Guide**"} in this category.\n\n` +
      "By pressing **Enter Server ♡**, you confirm that you have read & agree to follow all server rules and that you are **18 years of age or older**.\n\n" +
      "Once confirmed, Sugar will give you the **Member** role and remove **New**, unlocking the rest of Kittisugar.",
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
Keep NSFW content in NSFW channels. VIP members may post it elsewhere. No illegal or non-consensual intimate content.`,
      `## ${toRoyalBold("03 · Promotions & Selling")}
Only VIP members may promote or sell in ${promotionChannel}. VIP is **$5 USD once, for life** and includes **VIP, Seller, and a custom role**. No unsolicited ads in chats, profiles, or DMs.`,
      `## ${toRoyalBold("04 · Warnings")}
Repeated rule-breaking may result in warnings, timeouts, or removal from Kittisugar.`,
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
      "A little guide of Kittisugar ♡ Tap any channel mention to open it.\n\n" +
      `## ୨୧ ${guideSectionTitle("Start")}\n\n` +
      `• ${channelMention(guild, ["getaccess", "get-access"])}\nRead the welcome message and press Enter Server when you are ready to access the community.\n` +
      `• ${channelMention(guild, ["rules"])}\nCheck the server rules before chatting. They explain our 18+, SFW, safety, and promotion policies.\n` +
      `• ${channelMention(guild, ["guide"])}\nFind what each channel is for and how to use the server.\n\n` +
      `## ୨୧ ${guideSectionTitle("Community")}\n\n` +
      `• ${channelMention(guild, ["confessions"])}\nShare an anonymous confession or create a poll with the channel buttons.\n` +
      `• ${channelMention(guild, ["loveletters", "love-letters"])}\nLeave a sweet message or appreciation for someone in the community.\n` +
      `• ${channelMention(guild, ["suggestions"])}\nShare ideas and suggestions to help make Kittisugar better.\n` +
      `• ${channelMention(guild, ["quotes"])}\nPost memorable, funny, or meaningful quotes from the community.\n\n` +
      `## ୨୧ ${guideSectionTitle("Help")}\n\n` +
      `• ${channelMention(guild, ["support"])}\nOpen a private support ticket when you need help from the team.\n` +
      `• ${channelMention(guild, ["privatechat", "privatechats", "private-chat"])}\nCreate and manage private chat rooms. Use /priv-chat commands to see the available options.\n` +
      `• ${channelMention(guild, ["selfroles", "self-roles"])}\nChoose or update your age, gender, sexuality, interests, and color roles. These roles also let you show or hide channels.\n\n` +
      `୨୧ ${guideSectionTitle("Commands")}\n\n` +
      "`/delete amount:` — delete your own recent messages.\n" +
      "`/vip-delete amount:` — VIP message cleanup.\n" +
      "`/mod-delete amount: [member:]` — moderator cleanup.\n" +
      "`!quote` — reply to a message and quote it.\n" +
      "`/priv-chat commands` — see private chat commands.\n\n" +
      `୨୧ ${guideSectionTitle("Sugar AI")}\n\n` +
      "Mention Sugar or address the bot directly to start a conversation ♡"
    )
    .setFooter({ text: "This guide is also pinned in dashboard and will always be available there ♡" });
  return { embeds: [embed] };
}

async function upsertPanel(channel, client, title, payload) {
  const recent = await channel.messages.fetch({ limit: 50 });
  const existing = recent.find((message) =>
    message.author?.id === client.user.id && message.embeds.some((embed) => embed.title === title),
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

function findTextChannel(guild, category, expectedName) {
  const expected = normalizeName(expectedName);
  return guild.channels.cache.find((channel) =>
    channel.type === ChannelType.GuildText &&
    channel.parentId === category.id &&
    normalizeName(channel.name) === expected,
  ) ?? null;
}

async function ensureTextChannel(guild, category, name, newRole, botId) {
  let channel = findTextChannel(guild, category, name);
  if (!channel) {
    channel = await guild.channels.create({
      name,
      type: ChannelType.GuildText,
      parent: category.id,
      reason: "Set up the Kittisugar New-member access flow",
    });
  }
  if (channel.name !== name) await channel.setName(name, "Apply Kittisugar start-channel naming style");
  await applyStartPermissions(channel, guild, newRole, botId);
  return channel;
}

export async function ensureStartChannels(guild, client) {
  const newRole = findRoleByName(guild, NEW_ROLE_NAME);
  if (!newRole) {
    console.warn(`[access] the New role was not found in guild ${guild.id}; start channels were not configured.`);
    return null;
  }

  let category = guild.channels.cache.find((channel) =>
    channel.type === ChannelType.GuildCategory && normalizeName(channel.name) === START_CATEGORY_NAME,
  );
  if (!category) {
    category = await guild.channels.create({
      name: START_CATEGORY_NAME,
      type: ChannelType.GuildCategory,
      reason: "Create the Kittisugar entry category",
    });
  }

  await applyStartPermissions(category, guild, newRole, client.user.id);
  const access = await ensureTextChannel(guild, category, ACCESS_CHANNEL_NAME, newRole, client.user.id);
  const rules = await ensureTextChannel(guild, category, RULES_CHANNEL_NAME, newRole, client.user.id);
  const guide = await ensureTextChannel(guild, category, GUIDE_CHANNEL_NAME, newRole, client.user.id);

  await upsertPanel(access, client, "୨୧ Welcome to Kittisugar ♡", buildAccessPanelPayload(guild, { rulesChannel: rules, guideChannel: guide }));
  await upsertPanel(rules, client, "୨୧ Kittisugar Rules ♡", buildRulesPayload(guild));
  const dashboard = guild.channels.cache.find((channel) =>
    channel.type === ChannelType.GuildText && normalizeName(channel.name) === "dashboard",
  );
  if (dashboard) {
    const dashboardGuide = await upsertPanel(dashboard, client, "୨୧ Kittisugar Guide ♡", buildGuidePayload(guild));
    await dashboardGuide.pin().catch((error) => {
      console.error(`[access] could not pin the dashboard guide in guild ${guild.id}: ${error.message}`);
    });
  }
  await upsertPanel(guide, client, "୨୧ Kittisugar Guide ♡", buildGuidePayload(guild));

  console.info(`[access] start category ready for guild ${guild.id}`);
  return { category, access, rules, guide };
}

async function replyEphemeral(interaction, content) {
  if (interaction.deferred || interaction.replied) return interaction.followUp({ content, ephemeral: true });
  return interaction.reply({ content, ephemeral: true });
}

async function handleEnterButton(interaction) {
  if (!interaction.inGuild()) return replyEphemeral(interaction, "This button only works inside Kittisugar.");
  await interaction.deferReply({ ephemeral: true });

  const newRole = findRoleByName(interaction.guild, NEW_ROLE_NAME);
  const memberRole = findRoleByName(interaction.guild, MEMBER_ROLE_NAME);
  if (!newRole || !memberRole) {
    return interaction.editReply("Sugar couldn't find the New or Member role. Please contact a moderator.");
  }

  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  if (!member) return interaction.editReply("I couldn't verify your server membership. Please try again.");
  try {
    const changed = await assignMemberAccess(member, { newRole, memberRole });
    return interaction.editReply(changed
      ? "Welcome to Kittisugar! You now have Member access. Enjoy your stay ♡"
      : "You're already verified and have access to the server ♡");
  } catch (error) {
    console.error(`[access] verification failed for member ${interaction.user.id}: ${error.message}`);
    return interaction.editReply(error.message === "You do not have the New role."
      ? "You don't have the New role, so this access button isn't available to you."
      : "I couldn't update your roles. Please contact a moderator.");
  }
}

export function attachAccessSystem(client) {
  client.once(Events.ClientReady, async () => {
    for (const guild of client.guilds.cache.values()) {
      try {
        await ensureStartChannels(guild, client);
      } catch (error) {
        console.error(`[access] setup failed for guild ${guild.id}: ${error.message}`);
      }
    }
  });

  client.on(Events.GuildMemberAdd, async (member) => {
    const newRole = findRoleByName(member.guild, NEW_ROLE_NAME);
    const memberRole = findRoleByName(member.guild, MEMBER_ROLE_NAME);
    if (!newRole || (memberRole && member.roles.cache.has(memberRole.id))) return;
    await member.roles.add(newRole, "Assign the New role before Kittisugar access verification").catch((error) => {
      console.error(`[access] could not assign New role to member ${member.id}: ${error.message}`);
    });
  });

  client.on(Events.InteractionCreate, (interaction) => {
    if (!interaction.isButton() || interaction.customId !== ENTER_ID) return;
    void handleEnterButton(interaction).catch(async (error) => {
      console.error(`[access] enter button failed: ${error.message}`);
      await replyEphemeral(interaction, "Something went wrong while verifying your access. Please try again.").catch(() => {});
    });
  });
}
