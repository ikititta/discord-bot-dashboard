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
const ACCESS_CHANNEL_NAME = "get-access";
const RULES_CHANNEL_NAME = "rules";
const GUIDE_CHANNEL_NAME = "guide";
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
    .setStyle(ButtonStyle.Success);

  const pinkCheck = guild.emojis.cache.find((emoji) =>
    ["pinkcheck", "pinktick", "checkpink"].includes(normalizeName(emoji.name)),
  );
  if (pinkCheck) {
    button.setEmoji({ id: pinkCheck.id, name: pinkCheck.name, animated: pinkCheck.animated });
  }
  return button;
}

export function buildAccessPanelPayload(guild) {
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle("୨୧ Welcome to Kittisugar ♡")
    .setDescription(
      "Welcome! Before entering the server, please read the **Rules** and **Guide** in this category.\n\n" +
      "By pressing **Enter Server ♡**, you confirm that you have read and agree to follow all server rules and that you are **18 years of age or older**.\n\n" +
      "Once confirmed, Sugar will give you the **Member** role and remove **New**, unlocking the rest of Kittisugar.",
    )
    .setFooter({ text: "Please make sure you meet both requirements before continuing ♡" });
  return {
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(buildEnterButton(guild))],
  };
}

export function buildRulesPayload() {
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle("୨୧ Kittisugar Rules ♡")
    .setDescription(
      "Kittisugar is an **18+ SFW community**. By entering, you agree to follow these rules:",
    )
    .addFields(
      { name: "01 · Be respectful", value: "Treat everyone with respect. Harassment, hate speech, threats, bullying, and targeted hostility are not allowed." },
      { name: "02 · Keep it SFW", value: "No nudity, sexual content, or suggestive images, videos, profile pictures, banners, or other content." },
      { name: "03 · No promotions", value: "Do not advertise or promote servers, accounts, products, or services in chats, profiles, or DMs." },
      { name: "04 · Protect privacy", value: "Do not share anyone's private information, personal messages, or screenshots without their permission." },
      { name: "05 · No spam or disruption", value: "Avoid spam, raids, excessive pings, flooding, and deliberately disrupting conversations." },
      { name: "06 · Use channels appropriately", value: "Keep conversations in their relevant spaces and follow each channel's purpose." },
      { name: "07 · Follow Discord rules", value: "You must follow Discord's Terms of Service and Community Guidelines." },
      { name: "08 · Listen to staff", value: "Follow moderator instructions. Use the support system to ask questions or appeal a moderation decision." },
    )
    .setFooter({ text: "Kittisugar is for adults aged 18+ · Keep the community safe and SFW ♡" });
  return { embeds: [embed] };
}

export function buildGuidePayload() {
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle("୨୧ Kittisugar Guide ♡")
    .setDescription(
      "A little map of the server and its features. Channel names are written as plain text so you can find them in the channel list.",
    )
    .addFields(
      { name: "START", value: "**get-access** — complete the entry confirmation.\n**rules** — read the community rules.\n**guide** — learn how the server works." },
      { name: "COMMUNITY", value: "**confessions** — share anonymous confessions and create polls.\n**love letters** — send a sweet message, anonymously or with your name.\n**suggestions** — share ideas and vote with reactions.\n**quotes** — a gallery of messages worth keeping." },
      { name: "SUPPORT", value: "**support** — open a private ticket for general help, reports, appeals, partnerships, staff applications, errors, or other requests." },
      { name: "PRIVATE CHATS", value: "Create a private space from the private-chat lobby. The owner can invite or remove people, rename the chat, or delete it." },
      {
        name: "SERVER COMMANDS",
        value:
          "`/delete amount:<number>` — delete up to 20 of your own recent messages.\n" +
          "`/vip-delete amount:<number>` — VIP members can delete up to 100 of their own recent messages.\n" +
          "`/mod-delete amount:<number> [member:<user>]` — moderators can delete up to 100 recent messages, from the channel or a selected member.\n" +
          "`!quote` — reply to a message and send `!quote` to publish it as a quote.",
      },
      {
        name: "PRIVATE CHAT COMMANDS",
        value:
          "`/priv-chat create name:<name>` — create a private chat and optionally invite up to five people.\n" +
          "`/priv-chat add user:<person>` — invite someone (owner only).\n" +
          "`/priv-chat remove user:<person>` — remove an invitee (owner only).\n" +
          "`/priv-chat rename name:<name>` — rename the chat (owner only).\n" +
          "`/priv-chat delete` — permanently delete the chat (owner confirmation required).\n" +
          "`/priv-chat leave` — leave a private chat.\n" +
          "`/priv-chat commands` — show the private-chat command guide.",
      },
      { name: "SUGAR AI", value: "Mention **Sugar** or address the bot directly to chat with the AI. Ordinary messages are not sent to the AI." },
    )
    .setFooter({ text: "Have fun, be kind, and enjoy your stay ♡" });
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

  await upsertPanel(access, client, "୨୧ Welcome to Kittisugar ♡", buildAccessPanelPayload(guild));
  await upsertPanel(rules, client, "୨୧ Kittisugar Rules ♡", buildRulesPayload());
  await upsertPanel(guide, client, "୨୧ Kittisugar Guide ♡", buildGuidePayload());

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
