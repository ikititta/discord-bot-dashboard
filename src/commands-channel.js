import {
  ChannelType,
  EmbedBuilder,
  Events,
} from "discord.js";

export const COMMANDS_CHANNEL_NAME = "💬｜୨୧•𝓬𝓸𝓶𝓶𝓪𝓷𝓭𝓼";
export const COMMANDS_THREAD_NAME = "💬 𝗰𝗼𝗺𝗺𝗮𝗻𝗱𝘀";
const PANEL_TITLE = "୨୧ 𝓒𝓸𝓶𝓶𝓪𝓷𝓭𝓼 ♡";
const COLOR = 0xffd9ff;

export function buildCommandsPanelPayload() {
  return {
    embeds: [new EmbedBuilder()
      .setColor(COLOR)
      .setTitle(PANEL_TITLE)
      .setDescription(
        "This is the Kittisugar command board ♡\n\n" +
        "Use the **💬 𝗰𝗼𝗺𝗺𝗮𝗻𝗱𝘀** thread below for all bot commands. Please keep command messages inside that thread instead of sending them in the channel.\n\n" +
        "**Quick guide**\n" +
        "`!funhelp` — see the fun commands.\n" +
        "`!rep` — check your reputation.\n" +
        "`!rep @member` — check another member's reputation.\n" +
        "`!rep top` — view the reputation ranking.\n" +
        "`!rep comments @member` — read a member's latest comments.\n" +
        "`!stats` — view your basic fun-command stats.\n" +
        "`!vip stats @member` — VIP stats for another member."
      )
      .setFooter({ text: "Commands belong in the thread below ♡" })],
  };
}

function normalize(value) {
  return String(value ?? "").normalize("NFKD").toLowerCase().replace(/\\p{M}/gu, "").replace(/[^a-z0-9]/g, "");
}

async function ensureCommandsChannel(guild, client) {
  let channel = guild.channels.cache.find((item) =>
    item.type === ChannelType.GuildText && normalize(item.name).includes("commands"),
  );
  if (!channel) {
    channel = await guild.channels.create({
      name: COMMANDS_CHANNEL_NAME,
      type: ChannelType.GuildText,
      reason: "Create the Kittisugar command board",
    });
  } else if (channel.name !== COMMANDS_CHANNEL_NAME) {
    await channel.setName(COMMANDS_CHANNEL_NAME, "Apply Kittisugar command-channel naming style");
  }

  await channel.permissionOverwrites.edit(guild.roles.everyone, {
    ViewChannel: true,
    SendMessages: false,
    AddReactions: false,
    CreatePublicThreads: false,
    SendMessagesInThreads: true,
    ReadMessageHistory: true,
  });
  await channel.permissionOverwrites.edit(client.user.id, {
    ViewChannel: true,
    SendMessages: true,
    EmbedLinks: true,
    ReadMessageHistory: true,
    ManageMessages: true,
    ManageThreads: true,
    CreatePublicThreads: true,
    SendMessagesInThreads: true,
  });

  let thread = null;
  const active = await channel.threads.fetchActive();
  thread = active.threads.find((item) => item.name === COMMANDS_THREAD_NAME) ?? null;
  if (!thread) {
    const archived = await channel.threads.fetchArchived({ type: "public", limit: 100 });
    thread = archived.threads.find((item) => item.name === COMMANDS_THREAD_NAME) ?? null;
    if (thread) await thread.setArchived(false, "Reopen the Kittisugar commands thread");
  }
  if (!thread) {
    thread = await channel.threads.create({
      name: COMMANDS_THREAD_NAME,
      autoArchiveDuration: 10080,
      type: ChannelType.PublicThread,
      reason: "Create the permanent Kittisugar commands thread",
    });
  }

  const recent = await channel.messages.fetch({ limit: 100 });
  const isPanel = (message) => message.author?.id === client.user.id &&
    message.embeds.some((embed) => embed.title === PANEL_TITLE);
  const panels = [...recent.values()].filter(isPanel).sort((a, b) => b.createdTimestamp - a.createdTimestamp);
  const previous = panels[0] ?? null;
  const activity = [...recent.values()].filter((message) => !isPanel(message))
    .sort((a, b) => b.createdTimestamp - a.createdTimestamp)[0] ?? null;
  let panel;
  if (previous && (!activity || activity.createdTimestamp <= previous.createdTimestamp)) {
    panel = await previous.edit(buildCommandsPanelPayload());
  } else {
    panel = await channel.send(buildCommandsPanelPayload());
    if (previous) await previous.delete().catch(() => {});
  }
  await panel.pin().catch((error) => console.error("[commands] could not pin command board: " + error.message));
  console.info(`[commands] channel ready in #${channel.name}; thread #${thread.name}`);
  return { channel, thread, panel };
}

export function isCommandsThread(message) {
  return Boolean(
    message?.guild &&
    message.channel?.isThread?.() &&
    message.channel.name === COMMANDS_THREAD_NAME &&
    normalize(message.channel.parent?.name).includes("commands"),
  );
}

export function attachCommandsChannel(client) {
  const queues = new Map();
  client.once(Events.ClientReady, () => {
    for (const guild of client.guilds.cache.values()) {
      void ensureCommandsChannel(guild, client).catch((error) =>
        console.error(`[commands] setup failed in ${guild.id}: ${error.message}`),
      );
    }
  });
  client.on(Events.GuildCreate, (guild) => {
    void ensureCommandsChannel(guild, client).catch((error) =>
      console.error(`[commands] setup failed in ${guild.id}: ${error.message}`),
    );
  });
  client.on(Events.MessageCreate, (message) => {
    if (!message.guild || message.author?.id === client.user?.id || message.channel?.isThread?.()) return;
    const state = queues.get(message.guild.id) ?? { running: Promise.resolve() };
    state.running = state.running.then(async () => {
      const channel = await client.channels.fetch(message.channelId).catch(() => null);
      if (!channel || channel.type !== ChannelType.GuildText ||
          normalize(channel.name).includes("commands") === false) return;
      const recent = await channel.messages.fetch({ limit: 20 });
      const previous = [...recent.values()].find((item) =>
        item.author?.id === client.user.id && item.embeds.some((embed) => embed.title === PANEL_TITLE),
      );
      const next = await channel.send(buildCommandsPanelPayload());
      await next.pin().catch(() => {});
      if (previous) await previous.delete().catch(() => {});
    }).catch((error) => console.error(`[commands] sticky panel failed: ${error.message}`));
    queues.set(message.guild.id, state);
  });
}
