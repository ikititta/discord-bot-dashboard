import { ChannelType, EmbedBuilder, Events } from "discord.js";
import { toRoyalBold } from "./embed-format.js";

const CHANNEL_ID = "1567093021298794658";
const PANEL_TITLE = `୨୧ ${toRoyalBold("Fun Quote Cards")}`;
const COLOR = 0xffd9ff;
const KEY_PREFIX = "general-quote-tip:";

export function buildGeneralQuoteTipPayload() {
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(PANEL_TITLE)
    .setDescription("Try `!quote` when replying to a message to turn it into a fun image and share it! ♡");
  return { embeds: [embed] };
}

/**
 * Keep a single, unpinned quote tip at the bottom of the configured channel.
 * Each channel has its own persisted message ID and serialized update queue.
 */
export function attachGeneralQuoteStickyTip(client, { store, logger = "general-sticky" } = {}) {
  if (!store || typeof store.get !== "function" || typeof store.set !== "function") {
    throw new Error("The general quote sticky tip requires a persistent store.");
  }

  const channels = new Map();

  function attach(channel) {
    if (!channel || channel.type !== ChannelType.GuildText || channel.id !== CHANNEL_ID) return;
    if (channels.has(channel.id)) return;

    const key = `${KEY_PREFIX}${channel.id}`;
    let currentMessage = null;
    let queue = Promise.resolve();
    const enqueue = (task) => {
      queue = queue.then(task).catch((error) => {
        console.error(`[${logger}] could not update quote tip (${channel.id}): ${error.message}`);
      });
      return queue;
    };
    const isPanel = (message) => Boolean(message) && message.author?.id === client.user?.id &&
      message.embeds?.some((embed) => embed.title === PANEL_TITLE);

    async function fetchSaved() {
      const id = store.get(key);
      if (!id) return null;
      try { return await channel.messages.fetch(id); }
      catch (error) {
        if (error?.code === 10008 || error?.code === 10003) {
          store.set(key, null);
          return null;
        }
        throw error;
      }
    }

    async function ensure() {
      const recent = await channel.messages.fetch({ limit: 100 });
      const panels = [...recent.values()].filter(isPanel)
        .sort((a, b) => b.createdTimestamp - a.createdTimestamp);
      let previous = await fetchSaved();
      if (!isPanel(previous)) previous = null;
      const newest = panels[0];
      if (newest && (!previous || newest.createdTimestamp > previous.createdTimestamp)) previous = newest;
      const activity = [...recent.values()].filter((message) => !isPanel(message))
        .sort((a, b) => b.createdTimestamp - a.createdTimestamp)[0];
      if (previous && (!activity || activity.createdTimestamp <= previous.createdTimestamp)) {
        await previous.edit(buildGeneralQuoteTipPayload());
        currentMessage = previous;
        if (store.get(key) !== previous.id) store.set(key, previous.id);
      } else {
        const next = await channel.send(buildGeneralQuoteTipPayload());
        currentMessage = next;
        store.set(key, next.id);
        if (previous) await previous.delete().catch(() => {});
      }
      for (const duplicate of panels) {
        if (duplicate.id !== currentMessage.id) await duplicate.delete().catch(() => {});
      }
      console.info(`[${logger}] quote tip ready in configured channel (${channel.id})`);
    }

    async function moveAfterMessage() {
      let previous = currentMessage ?? await fetchSaved();
      if (!previous) {
        const recent = await channel.messages.fetch({ limit: 100 });
        previous = [...recent.values()].filter(isPanel)
          .sort((a, b) => b.createdTimestamp - a.createdTimestamp)[0] ?? null;
      }
      const next = await channel.send(buildGeneralQuoteTipPayload());
      currentMessage = next;
      store.set(key, next.id);
      if (previous && previous.id !== next.id) {
        await previous.delete().catch((error) => {
          if (error?.code !== 10008) console.error(`[${logger}] could not remove old quote tip: ${error.message}`);
        });
      }
    }

    channels.set(channel.id, { enqueue, ensure, moveAfterMessage, key });
    return channels.get(channel.id);
  }

  client.once(Events.ClientReady, () => {
    for (const guild of client.guilds.cache.values()) {
      for (const channel of guild.channels.cache.values()) {
        const state = attach(channel);
        if (state) void state.enqueue(state.ensure);
      }
    }
  });

  client.on(Events.ChannelCreate, (channel) => {
    const state = attach(channel);
    if (state) void state.enqueue(state.ensure);
  });

  client.on(Events.MessageCreate, (message) => {
    if (!message.guild || message.author?.bot || message.webhookId) return;
    const state = channels.get(message.channelId);
    if (state) void state.enqueue(state.moveAfterMessage);
  });

  client.on(Events.MessageDelete, (message) => {
    const state = channels.get(message.channelId);
    if (!state || message.id !== store.get(state.key)) return;
    store.set(state.key, null);
    void state.enqueue(state.ensure);
  });

  return { channelId: CHANNEL_ID, title: PANEL_TITLE };
}
