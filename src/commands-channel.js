import { ChannelType, EmbedBuilder, Events } from "discord.js";

export const COMMANDS_CHANNEL_ID = "1570221195222057150";
export const COMMANDS_CHANNEL_NAME = "reputation";
export const COMMANDS_THREAD_NAME = "💬 𝗰𝗼𝗺𝗺𝗮𝗻𝗱𝘀";
const PANEL_TITLE = "୨୧ 𝓒𝓸𝓶𝓶𝓪𝓷𝓭𝓼 ♡";
const COLOR = 0xffd9ff;

export const COMMANDS_GUIDE_TITLE = "୨୧ 𝓡𝓮𝓹𝓾𝓽𝓪𝓽𝓲𝓸𝓷 Commands ♡";

export function buildCommandsThreadGuidePayload() {
  return {
    embeds: [new EmbedBuilder()
      .setColor(COLOR)
      .setTitle(COMMANDS_GUIDE_TITLE)
      .setDescription(
        "**Reputation commands**\n\n" +
        "`!rep` — view your reputation, positive and negative votes, and comments.\n" +
        "`!rep @member` — view another member's reputation, positive and negative votes, and comments.\n" +
        "`!rep top` — see the positive and negative reputation rankings.\n\n" +
        "♡ You can use these commands in any Kittisugar channel."
      )
      .setFooter({ text: "Kittisugar · Reputation help ♡" })],
  };
}

export async function refreshCommandsThreadSticky(thread, client) {
  const recent = await thread.messages.fetch({ limit: 100 });
  const oldGuides = [...recent.values()].filter((message) =>
    message.author?.id === client.user.id &&
    message.embeds.some((embed) => embed.title === COMMANDS_GUIDE_TITLE),
  );
  const freshGuide = await thread.send(buildCommandsThreadGuidePayload());
  for (const old of oldGuides) {
    await old.delete().catch((error) => {
      if (error?.code !== 10008) console.error("[commands] old sticky guide could not be removed: " + error.message);
    });
  }
  return freshGuide;
}

export function buildCommandsPanelPayload() {
  return {
    embeds: [new EmbedBuilder()
      .setColor(COLOR)
      .setTitle(PANEL_TITLE)
      .setDescription(
        "**Reputation commands**\n\n" +
        "`!rep` — your reputation, positive and negative votes, and comments.\n" +
        "`!rep @member` — another member's reputation, positive and negative votes, and comments.\n" +
        "`!rep top` — positive and negative rankings.\n\n" +
        "**Fun commands**\n`!funhelp` — view the available fun interaction commands."
      )
      .setFooter({ text: "Kittisugar commands ♡" })],
  };
}

function normalize(value) {
  return String(value ?? "").normalize("NFKD").toLowerCase().replace(/\p{M}/gu, "").replace(/[^a-z0-9]/g, "");
}

export async function ensureCommandsBoard(guild, client) {
  let channel = guild.channels.cache.find((item) =>
    item.type === ChannelType.GuildText && item.id === COMMANDS_CHANNEL_ID,
  );
  if (!channel) throw new Error("Configured reputation channel " + COMMANDS_CHANNEL_ID + " was not found; no channel was created.");

  const recent = await channel.messages.fetch({ limit: 100 });
  let panel = [...recent.values()].find((message) =>
    message.author?.id === client.user.id && message.embeds.some((embed) => embed.title === PANEL_TITLE),
  );
  let thread = null;
  const active = await channel.threads.fetchActive();
  thread = active.threads.find((item) => item.name === COMMANDS_THREAD_NAME && item.parentId === channel.id) ?? null;
  if (!thread) {
    const archived = await channel.threads.fetchArchived({ type: "public", limit: 100 });
    thread = archived.threads.find((item) => item.name === COMMANDS_THREAD_NAME && item.parentId === channel.id) ?? null;
  }

  if (!panel) { panel = await channel.send(buildCommandsPanelPayload()); } else {
    await panel.edit(buildCommandsPanelPayload());
    if (!thread) thread = await channel.threads.fetch(panel.id).catch(() => null);
    if (!thread) {
      thread = await panel.startThread({
        name: COMMANDS_THREAD_NAME,
        autoArchiveDuration: 10080,
        reason: "Create the Kittisugar commands thread from its board embed",
      });
    } else if (thread.archived) {
      await thread.setArchived(false, "Reopen the Kittisugar commands thread");
    }
  }
  await refreshCommandsThreadSticky(thread, client);

  await channel.permissionOverwrites.edit(guild.roles.everyone, {
    ViewChannel: true, SendMessages: false, SendMessagesInThreads: true,
    CreatePublicThreads: false, ReadMessageHistory: true,
  }, "Keep the reputation and commands board read-only while allowing thread commands");
  await channel.permissionOverwrites.edit(client.user.id, {
    ViewChannel: true, SendMessages: true, EmbedLinks: true, ReadMessageHistory: true,
    ManageMessages: true, ManageThreads: true, CreatePublicThreads: true, SendMessagesInThreads: true,
  }, "Allow Sugar to maintain the commands board and its thread");
  console.info(`[commands] board and thread ready in #${channel.name}`);
  return { channel, panel, thread };
}

export function isCommandsThread(message) {
  const channel = message?.channel;
  if (!message?.guild || !channel?.isThread?.()) return false;
  return normalize(channel.name).includes("commands") &&
    channel.parentId === COMMANDS_CHANNEL_ID;
}

export function attachCommandsChannel(client) {
  const setup = (guild) => ensureCommandsBoard(guild, client).catch((error) =>
    console.error(`[commands] setup failed in ${guild.id}: ${error.message}`),
  );
  client.once(Events.ClientReady, () => {
    for (const guild of client.guilds.cache.values()) void setup(guild);
  });
  client.on(Events.GuildCreate, (guild) => void setup(guild));
}
