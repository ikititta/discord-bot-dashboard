import { ChannelType, Events } from "discord.js";

/**
 * Keep one independent panel at the bottom of its own channel.
 * Only a new message in that exact channel moves it; panel messages are ignored.
 */
export function attachStickyPanel(client, {
  store,
  key,
  channelId,
  titles,
  buildPayload,
  logger = "sticky-panels",
}) {
  if (!store || typeof store.get !== "function" || typeof store.set !== "function") {
    throw new Error("Sticky panels require a persistent store.");
  }
  if (typeof key !== "string" || !Array.isArray(titles) || titles.length === 0 ||
      typeof buildPayload !== "function") {
    throw new Error("A sticky panel key, title, and payload builder are required.");
  }

  let currentMessage = null;
  let queue = Promise.resolve();
  const logFailure = (error) => console.error(`[${logger}] sticky panel ${key}: ${error.message}`);
  const enqueue = (task) => {
    queue = queue.then(task).catch(logFailure);
    return queue;
  };

  async function getChannel() {
    const channel = await client.channels.fetch(channelId);
    if (!channel || channel.type !== ChannelType.GuildText) {
      throw new Error(`Channel ${channelId} is not an accessible text channel.`);
    }
    return channel;
  }

  function isPanel(message) {
    return message.author?.id === client.user?.id &&
      message.embeds?.some((embed) => titles.includes(embed.title));
  }

  async function fetchSaved(channel) {
    const savedId = store.get(key);
    if (!savedId) return null;
    try {
      return await channel.messages.fetch(savedId);
    } catch (error) {
      if (error?.code === 10008 || error?.code === 10003) {
        store.set(key, null);
        return null;
      }
      throw error;
    }
  }

  async function findExisting(channel) {
    const recent = await channel.messages.fetch({ limit: 100 });
    const matches = [...recent.values()].filter(isPanel)
      .sort((a, b) => b.createdTimestamp - a.createdTimestamp);
    return matches[0] ?? null;
  }

  async function ensure() {
    const channel = await getChannel();
    let saved = await fetchSaved(channel);
    if (saved && !isPanel(saved)) saved = null;
    const recent = await findExisting(channel);
    let previous = saved;
    if (recent && (!previous || recent.createdTimestamp > previous.createdTimestamp)) {
      previous = recent;
    }

    // Preserve an existing panel exactly as it is on startup. It only moves
    // after a new message is posted in this channel.
    if (previous) {
      currentMessage = previous;
      if (store.get(key) !== previous.id) store.set(key, previous.id);
      return previous;
    }
    const message = await channel.send(buildPayload());
    currentMessage = message;
    store.set(key, message.id);
    return message;
  }

  async function moveAfter(triggerMessage) {
    const channel = await getChannel();
    let previous = currentMessage;
    if (!previous) previous = await fetchSaved(channel);
    if (!previous) previous = await findExisting(channel);
    if (!previous) {
      await ensure();
      return;
    }
    // Every non-bot message must put the panel after it. Do not rely only on
    // timestamps: Discord can deliver events close together or out of order.

    // Publish first, then retire the old message so a send failure never loses the panel.
    const next = await channel.send(buildPayload());
    currentMessage = next;
    store.set(key, next.id);
    await previous.delete().catch((error) => {
      if (error?.code !== 10008) logFailure(error);
    });
  }

  client.once(Events.ClientReady, () => {
    void enqueue(ensure);
  });

  client.on(Events.MessageCreate, (message) => {
    if (message.channelId !== channelId) return;
    // Ignore this sticky panel only. Any other message, including another
    // bot's post, is activity local to this channel.
    if (message.id === currentMessage?.id || message.id === store.get(key) || isPanel(message)) return;
    void enqueue(() => moveAfter(message));
  });

  client.on(Events.MessageDelete, (message) => {
    if (message.channelId !== channelId || message.id !== (currentMessage?.id ?? store.get(key))) return;
    currentMessage = null;
    store.set(key, null);
    void enqueue(ensure);
  });

  return { channelId, key };
}
