import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, Events,
} from "discord.js";

export const COMMANDS_CATEGORY_ID = "1568179038625857576";
export const COMMANDS_CHANNEL_NAME = "📖｜୨୧・commands";
export const COMMANDS_CHANNEL_TOPIC = "Kittisugar interactive all-commands panel · Sugar sticky";
export const COMMANDS_PANEL_TITLE = "୨୧ 𝓚𝓲𝓽𝓽𝓲𝓼𝓾𝓰𝓪𝓻 · 𝓒𝓸𝓶𝓶𝓪𝓷𝓭𝓼 ♡";
export const MODERATION_COMMANDS_CHANNEL_ID = "1570277294868660264";
export const MODERATION_PANEL_TITLE = "୨୧ 𝓢𝓽𝓪𝓯𝓯 · 𝓣𝓸𝓸𝓵𝓼 ♡";
const COLOR = 0xffd9ff;
const PREFIX = "sugar-commands:";
const categories = {
  fun: {
    label: "Fun",
    emoji: "🎀",
    description:
      "**Two-person**\n`!slap @member` · `!bonk @member` · `!spank @member` · `!hug @member` · `!kiss @member` · `!cuddle @member` · `!pat @member` · `!poke @member` · `!bite @member` · `!kick @member` · `!kill @member` · `!highfive @member` · `!handhold @member`\n\n" +
      "**VIP-only**\n`!fuck @member`\n\n" +
      "**Solo**\n`!cry` · `!laugh` · `!dance` · `!sleep` · `!happy` · `!blush` · `!smug` · `!wave` · `!facepalm` · `!wink` · `!shrug` · `!smile` · `!pout`\n\n" +
      "**Relationships**\n`!couple @member` · `!propose @member` · `!marry @member` · `!breakup` · `!divorce`\n\n" +
      "**Stats & help**\n`!funhelp` · `/fun help` · `!stats` / `!fun stats` (VIP) · `!vip stats [@member]` (VIP)\n\nAll fun and relationship interactions require the Member role. `!fuck` is VIP-only.",
  },
  pets: {
    label: "Pets",
    emoji: "🐾",
    description:
      "**Adoption & profile**\n`!pet adopt` · `!pet` · `!pet stats` · `!pet select <number>`\nChoose a species in the adoption selector. Everyone gets a random design; VIP can customise before adopting. One pet per member by default; VIP can unlock up to three slots.\n\n" +
      "**Care & bonding**\n`!pet feed` · `!pet play` · `!pet cuddle` · `!pet talk` · `!pet story` · `!pet gif [happy|dance|sleep]`\nBonding unlocks special dialogue and reaction GIFs.\n\n" +
      "**Coins & items**\n`!pet daily` · `!pet shop` · `!pet buy <treat|toy|potion>` · `!pet use <item>` · `!pet inventory` · `!pet delete`\nTreats restore hunger, toys boost happiness and bond, and potions refill hunger completely.\n\n" +
      "**VIP customisation & extras**\n`!pet name <name>` · `!pet color <color>` · `!pet breed <breed>` · `!pet appearance <details>` · `!pet personality <traits>` · `!pet room` · `!pet outfit <name>` · `!pet slots` · `!pet minigame`",
  },
  community: {
    label: "Community",
    emoji: "💌",
    description:
      "**Confessions, polls, love letters & suggestions**\nUse the buttons in their respective channel panels to submit a confession, create a poll, send a love letter, reply in its publication thread, or submit a suggestion. Each confession, poll and love letter has one conversation thread. Polls allow one active vote per person; choosing another option changes your vote.\n\n" +
      "**Reputation**\n`!rep` · `!rep @member` · `!rep stats` · `!rep stats @member` · `!rep top` · `!rep comments [@member]`",
  },
  private: {
    label: "Private Chats",
    emoji: "🔒",
    description:
      "**Slash commands**\n`/priv-chat create name:<name>` — create a private chat and optionally invite up to five people.\n" +
      "`/priv-chat add user:<member>` · `/priv-chat remove user:<member>` · `/priv-chat rename name:<name>`\n" +
      "`/priv-chat leave` · `/priv-chat delete` · `/priv-chat commands`\n\n" +
      "The owner manages invites, renaming and deletion. Invited members can leave. The owner may rename their private chat at any time.",
  },
  staff: {
    label: "Staff Tools",
    emoji: "🛡️",
    description:
      "**Moderator command**\\n" +
      `\`/mod-delete amount:<1-100> [member:<member>]\` — delete up to 100 recent messages from this channel, optionally filtering by a member.\\n\\n` +
      "The command is documented in <#1570277294868660264>. Access is limited to members with an authorised moderator role.",
  },
  profile: {
    label: "Profiles & Tools",
    emoji: "🪞",
    description:
      "`!profile [@member]` — view a member profile, fun stats, reputation and pet summary.\n" +
      "`!quote` — reply to a message, then send `!quote` to create an image quote.\n" +
      "`!funhelp` or `/fun help` — fun-command help.\n" +
      "`!pet shop` — pet shop and item prices.\n" +
      "`!pet inventory` — items owned by your active pet.",
  },

};

export function buildCommandsCategoryEmbed(category) {
  const item = categories[category];
  if (!item) throw new Error("Unknown commands category.");
  return new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(item.emoji + " ୨୧ " + item.label + " Commands ♡")
    .setDescription(item.description)
    .setFooter({ text: "Kittisugar · Commands guide ♡" });
}

export function buildModerationCommandsEmbed() {
  return new EmbedBuilder()
    .setColor(COLOR)
    .setTitle("🛡️ ୨୧ Staff Tools ♡")
    .setDescription(
      "**/mod-delete amount:<1-100> [member:<member>]**\\n" +
      "Delete up to 100 recent messages in this channel. Add a member to target their messages; leave it empty to clean eligible messages from the channel.\\n\\n" +
      "This command is restricted to authorised moderators. Large deletions require confirmation."
    )
    .setFooter({ text: "Kittisugar · Staff tools ♡" });
}

export function buildModerationCommandsPanelPayload() {
  return { embeds: [buildModerationCommandsEmbed()] };
}

export async function ensureModerationCommandsPanel(guild, client) {
  const channel = await guild.channels.fetch(MODERATION_COMMANDS_CHANNEL_ID).catch(() => null);
  if (!channel || channel.type !== ChannelType.GuildText) {
    console.error("[commands] moderation channel " + MODERATION_COMMANDS_CHANNEL_ID + " was not found; no channel was created.");
    return null;
  }
  const recent = await channel.messages.fetch({ limit: 100 });
  const previous = [...recent.values()].filter((message) =>
    message.author?.id === client.user.id &&
    message.embeds.some((embed) => embed.title === MODERATION_PANEL_TITLE),
  );
  for (const message of previous) {
    await message.delete().catch((error) => {
      if (error?.code !== 10008) throw error;
    });
  }
  await channel.send(buildModerationCommandsPanelPayload());
  console.info("[commands] moderation guide ready in #" + channel.name);
  return channel;
}

export function buildCommandsPanelPayload() {
  const rows = [];
  const buttons = Object.entries(categories).map(([key, item]) =>
    new ButtonBuilder()
      .setCustomId(PREFIX + key)
      .setLabel(item.label)
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(item.emoji),
  );
  for (let i = 0; i < buttons.length; i += 5) {
    rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
  }
  return {
    embeds: [new EmbedBuilder()
      .setColor(COLOR)
      .setTitle(COMMANDS_PANEL_TITLE)
      .setDescription("All Sugar commands, neatly organised ♡\n\nChoose a category below to see its commands and how to use them.")
      .setFooter({ text: "This panel refreshes whenever a new message is sent in this channel · Not pinned ♡" })],
    components: rows,
  };
}

export async function ensureCommandsChannel(guild, client) {
  const category = guild.channels.cache.get(COMMANDS_CATEGORY_ID) ??
    await guild.channels.fetch(COMMANDS_CATEGORY_ID).catch(() => null);
  if (!category || category.type !== ChannelType.GuildCategory) {
    throw new Error("Fun category " + COMMANDS_CATEGORY_ID + " was not found; no channel was created.");
  }

  let channel = guild.channels.cache.find((item) =>
    item.type === ChannelType.GuildText && item.parentId === category.id &&
    (item.topic === COMMANDS_CHANNEL_TOPIC || item.name === COMMANDS_CHANNEL_NAME),
  );
  if (!channel) {
    channel = await guild.channels.create({
      name: COMMANDS_CHANNEL_NAME,
      type: ChannelType.GuildText,
      parent: category.id,
      topic: COMMANDS_CHANNEL_TOPIC,
      reason: "Create the interactive Kittisugar commands guide",
    });
  } else if (channel.topic !== COMMANDS_CHANNEL_TOPIC) {
    await channel.setTopic(COMMANDS_CHANNEL_TOPIC, "Mark the existing commands guide channel");
  }

  await channel.permissionOverwrites.edit(guild.roles.everyone, {
    ViewChannel: true,
    SendMessages: true,
    ReadMessageHistory: true,
    EmbedLinks: true,
    CreatePublicThreads: false,
    SendMessagesInThreads: false,
  }, "Allow members to trigger the commands sticky while keeping the guide channel tidy");
  await channel.permissionOverwrites.edit(client.user.id, {
    ViewChannel: true,
    SendMessages: true,
    ReadMessageHistory: true,
    EmbedLinks: true,
    ManageMessages: true,
  }, "Allow Sugar to refresh the commands sticky");

  await refreshCommandsSticky(channel, client);
  console.info("[commands] interactive guide ready in #" + channel.name);
  return channel;
}

async function refreshCommandsSticky(channel, client) {
  const recent = await channel.messages.fetch({ limit: 100 });
  const previous = [...recent.values()].filter((message) =>
    message.author?.id === client.user.id &&
    message.embeds.some((embed) => embed.title === COMMANDS_PANEL_TITLE),
  ).sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  for (const message of previous) {
    await message.delete().catch((error) => {
      if (error?.code !== 10008) throw error;
    });
  }
  return channel.send(buildCommandsPanelPayload());
}

const refreshQueues = new Map();
export function attachCommandsChannel(client) {
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton?.()) return;
    if (!interaction.customId.startsWith(PREFIX)) return;
    const category = interaction.customId.slice(PREFIX.length);
    if (!categories[category]) return;
    await interaction.reply({ embeds: [buildCommandsCategoryEmbed(category)], ephemeral: true }).catch((error) => {
      console.error("[commands] category response failed: " + error.message);
    });
  });

  const refreshForMessage = (message) => {
    if (!message.guild || message.author?.bot || message.webhookId ||
        message.channel?.type !== ChannelType.GuildText ||
        message.channel.parentId !== COMMANDS_CATEGORY_ID ||
        message.channel.topic !== COMMANDS_CHANNEL_TOPIC) return;
    const channel = message.channel;
    const previous = refreshQueues.get(channel.id) ?? Promise.resolve();
    const next = previous.catch(() => {}).then(() => refreshCommandsSticky(channel, client))
      .catch((error) => console.error("[commands] sticky refresh failed: " + error.message));
    refreshQueues.set(channel.id, next);
    void next.finally(() => {
      if (refreshQueues.get(channel.id) === next) refreshQueues.delete(channel.id);
    });
  };
  client.on(Events.MessageCreate, refreshForMessage);

  const setup = (guild) => ensureCommandsChannel(guild, client).catch((error) =>
    console.error("[commands] setup failed in " + guild.id + ": " + error.message),
  );
  const setupAll = (guild) => {
    void setup(guild);
    void ensureModerationCommandsPanel(guild, client).catch((error) =>
      console.error("[commands] moderation setup failed in " + guild.id + ": " + error.message),
    );
  };
  client.once(Events.ClientReady, () => {
    for (const guild of client.guilds.cache.values()) setupAll(guild);
  });
  client.on(Events.GuildCreate, setupAll);
}
