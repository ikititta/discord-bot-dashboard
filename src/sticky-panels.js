import { ChannelType, Events } from "discord.js";

/**
 * Keep one primary panel at the bottom of its channel.
 * New messages move the panel; deleting it causes it to be recreated.
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
    const selected = matches[0] ?? null;
    for (const duplicate of matches.slice(1)) {
      await duplicate.delete().catch((error) => logFailure(error));
    }
    return selected;
  }

  async function pin(message) {
    if (!message.pinned) {
      await message.pin().catch((error) => {
        console.error(`[${logger}] sticky panel ${key} could not be pinned: ${error.message}`);
      });
    }
  }

  async function ensure() {
    const channel = await getChannel();
    let message = await fetchSaved(channel);
    if (message && !isPanel(message)) message = null;
    if (!message) message = await findExisting(channel);
    if (message) {
      await message.edit(buildPayload());
    } else {
      message = await channel.send(buildPayload());
    }
    currentMessage = message;
    store.set(key, message.id);
    await pin(message);
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
    if (previous.createdTimestamp >= triggerMessage.createdTimestamp) {
      currentMessage = previous;
      return;
    }

    // Publish first, then retire the old message so a send failure never loses the panel.
    const next = await channel.send(buildPayload());
    currentMessage = next;
    store.set(key, next.id);
    await previous.delete().catch((error) => {
      if (error?.code !== 10008) logFailure(error);
    });
    await pin(next);
  }

  client.once(Events.ClientReady, () => {
    void enqueue(ensure);
  });

  client.on(Events.MessageCreate, (message) => {
    if (message.channelId !== channelId || message.author?.id === client.user?.id) return;
    void enqueue(() => moveAfter(message));
  });

  client.on(Events.MessageDelete, (message) => {
    if (message.channelId !== channelId || message.id !== (currentMessage?.id ?? store.get(key))) return;
    currentMessage = null;
    store.set(key, null);
    void enqueue(ensure);
  });
}
