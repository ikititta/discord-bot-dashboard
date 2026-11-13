import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, Events,
} from "discord.js";

export const COMMANDS_CATEGORY_ID = "1568179038625857576";
export const COMMANDS_CHANNEL_NAME = "📖｜୨୧・commands";
export const COMMANDS_CHANNEL_TOPIC = "Kittisugar interactive all-commands guide";
export const COMMANDS_INFO_CHANNEL_ID = "1570257241511170150";
export const COMMANDS_PANEL_TITLE = "୨୧ 𝓚𝓲𝓽𝓽𝓲𝓼𝓾𝓰𝓪𝓻 · 𝓒𝓸𝓶𝓶𝓪𝓷𝓭𝓼 ♡";
export const MODERATION_COMMANDS_CHANNEL_ID = "1570277294868660264";
export const MODERATION_PANEL_TITLE = "୨୧ 𝓜𝓸𝓭𝓮𝓻𝓪𝓽𝓲𝓸𝓷 · 𝓒𝓸𝓶𝓶𝓪𝓷𝓭𝓼 ♡";
export const REPUTATION_ONLY_CHANNEL_ID = "1569930648804925522";
const COLOR = 0xffd9ff;
const PREFIX = "sugar-commands:";
const categories = {
  solo: { label: "Solo · SFW", emoji: "🌷", description: "**Solo · no sexual**\n`!cry` · `!laugh` · `!dance` · `!sleep` · `!happy` · `!blush` · `!smug` · `!wave` · `!facepalm` · `!wink` · `!shrug` · `!smile` · `!pout`\n\nSolo actions; no member mention needed." },
  soloNsfw: { label: "Solo · NSFW", emoji: "🔞", description: "**Solo · VIP · NSFW**\nNo solo NSFW action is currently enabled. `!masturbate @member` is a two-person interaction and appears in Couple · NSFW." },
  relationship: { label: "Relationships", emoji: "💍", description: "`!couple @member` · `!propose @member` · `!marry @member` · `!breakup` · `!divorce`\n\nThe other member must accept a proposal. Both people need the Member role." },
  affection: { label: "Romance & Affection", emoji: "💕", description: "`!hug @member` · `!kiss @member` · `!cuddle @member` · `!pat @member` · `!handhold @member` · `!highfive @member`\n\nTwo-person interactions with anime GIFs." },
  interactions: { label: "Interactions", emoji: "🎀", description: "`!slap @member` · `!bonk @member` · `!spank @member` · `!poke @member` · `!bite @member` · `!lick @member` · `!feet @member` · `!kick @member` · `!shoot @member` · `!kill @member` · `!tease @member` · `!seduce @member`\n\n`!shoot @member` is a playful two-person interaction with an anime GIF. `!kill @member` defeats the mentioned member and applies a 30-second timeout. `!tease` and `!seduce` are VIP-only and include anime GIFs." },
  nsfw: { label: "Couple · NSFW", emoji: "🔞", description: "**VIP interactions · NSFW**\n`!fuck @member` · `!masturbate @member` · `!oral @member` · `!anal @member`\n\nFor `!masturbate @member`, the person running the command performs the action toward the mentioned member. VIP is required from either participant." },
  community: { label: "Community", emoji: "💌", description: "**Confessions, polls, love letters & suggestions**\nUse the buttons in their channel panels to submit a confession, create a poll, send a love letter, or submit a suggestion.\n\n**Reputation**\n`!rep` · `!rep @member` · `!rep stats` · `!rep stats @member` · `!rep top` · `!rep comments [@member]`" },
  pets: { label: "Pets", emoji: "🐾", description: "**Adoption & profile**\n`!pet adopt` · `!pet` · `!pet status` · `!pet stats` · `!pet select <number>` · `!pet redraw`\n\n**Care & bonding**\n`!pet feed` · `!pet play` · `!pet cuddle` · `!pet talk` · `!pet story` · `!pet gif [happy|dance|sleep]`\n\n**Coins & items**\n`!pet daily` · `!pet shop` · `!pet buy <treat|toy|potion>` · `!pet use <item>` · `!pet inventory` · `!pet delete`\n\n**VIP extras**\n`!pet name <name>` · `!pet color <color>` · `!pet breed <breed>` · `!pet appearance <details>` · `!pet personality <traits>` · `!pet room` · `!pet outfit <name>` · `!pet slots` · `!pet minigame`" },
  functional: { label: "Functional", emoji: "🛠️", description: "**Messages**\n`/delete amount:<1-20>` — delete your own recent messages\n`/vip-delete amount:<1-100>` — VIP message deletion\n`/mod-delete amount:<1-100> [member]` — moderator-only cleanup\n`!quote` — reply to a message, then use `!quote` to create an image quote\n\n**Profiles & stats**\n`!profile [@member]` · `/stats` · `/vip stats [member]`\n\n**Private chats**\n`/priv-chat create` · `/priv-chat add` · `/priv-chat remove` · `/priv-chat rename` · `/priv-chat leave` · `/priv-chat delete` · `/priv-chat commands`" },
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
    .setTitle("🛡️ ୨୧ Moderation ♡")
    .setDescription(
      "**/mod-delete amount:<1-100> [member:<member>]**\n" +
      "Delete up to 100 recent messages in this channel. Add a member to target their messages; leave it empty to clean eligible messages from the channel.\n\n" +
      "This command is restricted to authorised moderators. Large deletions require confirmation."
    )
    .setFooter({ text: "Kittisugar · Moderation ♡" });
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
    (message.embeds.some((embed) =>
      [MODERATION_PANEL_TITLE, "୨୧ 𝓢𝓽𝓪𝓯𝓯 · 𝓣𝓸𝓸𝓵𝓼 ♡"].includes(embed.title)) ||
      message.components.some((row) => row.components.some((component) => component.customId === "sugar-moderation-commands"))),
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
      .setDescription("All Sugar commands, neatly organised ♡\n\nChoose a category below to see its commands and how to use them. Fun and relationship interactions require the Member role; VIP-only commands are marked.")
      .setFooter({ text: "Select a category to browse commands · Not pinned ♡" })],
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
  }, "Allow members to use the commands guide");
  await channel.permissionOverwrites.edit(client.user.id, {
    ViewChannel: true,
    SendMessages: true,
    ReadMessageHistory: true,
    EmbedLinks: true,
    ManageMessages: true,
  }, "Allow Sugar to update the commands guide");

  await upsertCommandsPanel(channel, client);
  console.info("[commands] interactive guide ready in #" + channel.name);
  return channel;
}

async function upsertCommandsPanel(channel, client) {
  const recent = await channel.messages.fetch({ limit: 100 });
  const matches = [...recent.values()].filter((message) =>
    message.author?.id === client.user.id &&
    message.embeds.some((embed) => embed.title === COMMANDS_PANEL_TITLE),
  ).sort((a, b) => b.createdTimestamp - a.createdTimestamp);
  const existing = matches.shift();
  const panel = existing
    ? await existing.edit(buildCommandsPanelPayload())
    : await channel.send(buildCommandsPanelPayload());
  for (const duplicate of matches) {
    await duplicate.delete().catch((error) => {
      if (error?.code !== 10008) throw error;
    });
  }
  return panel;
}

export async function ensureCommandsInfoPanel(guild, client) {
  const channel = await guild.channels.fetch(COMMANDS_INFO_CHANNEL_ID).catch(() => null);
  if (!channel || channel.type !== ChannelType.GuildText) {
    console.warn("[commands] additional commands channel " + COMMANDS_INFO_CHANNEL_ID + " was not found; no channel was created.");
    return null;
  }
  await upsertCommandsPanel(channel, client);
  console.info("[commands] additional commands guide updated in #" + channel.name);
  return channel;
}

export function attachCommandsChannel(client) {
  client.on(Events.MessageCreate, async (message) => {
    if (!message.guild || message.author?.bot || message.webhookId ||
        message.channelId === REPUTATION_ONLY_CHANNEL_ID ||
        !/^!commands$/i.test(String(message.content ?? "").trim())) return;
    await message.reply({
      ...buildCommandsPanelPayload(),
      allowedMentions: { parse: [], repliedUser: false },
    }).catch((error) => console.error("[commands] !commands response failed: " + error.message));
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton?.()) return;
    if (!interaction.customId.startsWith(PREFIX)) return;
    const category = interaction.customId.slice(PREFIX.length);
    if (!categories[category]) return;
    await interaction.reply({ embeds: [buildCommandsCategoryEmbed(category)], ephemeral: true }).catch((error) => {
      console.error("[commands] category response failed: " + error.message);
    });
  });

  const setup = (guild) => ensureCommandsChannel(guild, client).catch((error) =>
    console.error("[commands] setup failed in " + guild.id + ": " + error.message),
  );
  const setupAll = (guild) => {
    void setup(guild);
    void ensureCommandsInfoPanel(guild, client).catch((error) =>
      console.error("[commands] additional guide setup failed in " + guild.id + ": " + error.message),
    );
    void ensureModerationCommandsPanel(guild, client).catch((error) =>
      console.error("[commands] moderation setup failed in " + guild.id + ": " + error.message),
    );
  };
  client.once(Events.ClientReady, () => {
    for (const guild of client.guilds.cache.values()) setupAll(guild);
  });
  client.on(Events.GuildCreate, setupAll);
}
