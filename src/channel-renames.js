const originalSetName = new WeakMap();
const patchedChannels = new WeakSet();
const patchedManagers = new WeakSet();
const pendingCreations = new Map();

function protectChannel(channel, onBlocked = console.warn) {
  if (!channel || typeof channel.setName !== "function" || patchedChannels.has(channel)) return false;
  originalSetName.set(channel, channel.setName.bind(channel));
  Object.defineProperty(channel, "setName", {
    configurable: false,
    writable: false,
    value: async () => {
      onBlocked(`[bot] blocked automatic channel rename for ${channel.id}; only private-chat owners may rename their own chats`);
      return channel;
    },
  });
  patchedChannels.add(channel);
  return true;
}

function protectGuild(guild, onBlocked = console.warn) {
  let count = 0;
  for (const channel of guild.channels.cache.values()) {
    if (protectChannel(channel, onBlocked)) count += 1;
  }

  const manager = guild.channels;
  if (!patchedManagers.has(manager) && typeof manager.create === "function") {
    const create = manager.create.bind(manager);
    Object.defineProperty(manager, "create", {
      configurable: false,
      writable: false,
      value: async (options, ...args) => {
        const topic = typeof options?.topic === "string" ? options.topic : null;
        const existing = topic
          ? manager.cache.find((channel) => channel.topic === topic && (!options.type || channel.type === options.type))
          : null;
        if (existing) return existing;

        const key = topic ? `${guild.id}:${topic}` : null;
        if (key && pendingCreations.has(key)) return pendingCreations.get(key);

        const creation = create(options, ...args).then((channel) => {
          protectChannel(channel, onBlocked);
          return channel;
        });
        if (!key) return creation;

        pendingCreations.set(key, creation);
        try {
          return await creation;
        } finally {
          if (pendingCreations.get(key) === creation) pendingCreations.delete(key);
        }
      },
    });
    patchedManagers.add(manager);
  }
  return count;
}

export function protectChannelNames(guilds, onBlocked = console.warn) {
  let protectedCount = 0;
  for (const guild of guilds.values()) protectedCount += protectGuild(guild, onBlocked);
  return protectedCount;
}

export function protectNewChannel(channel, onBlocked = console.warn) {
  return protectChannel(channel, onBlocked);
}

/** The only approved rename path is the existing private-chat owner command. */
export async function renamePrivateChatChannel(channel, name, reason) {
  const original = originalSetName.get(channel);
  return original ? original(name, reason) : channel.setName(name, reason);
}

export async function renameMatchingChannels(guilds, oldName, newName, onError = console.warn) {
  let blocked = 0;
  for (const guild of guilds.values()) {
    for (const channel of guild.channels.cache.values()) {
      if (channel.name !== oldName || typeof channel.setName !== "function") continue;
      blocked += 1;
      onError(`[bot] blocked bulk rename attempt for channel ${channel.id}`);
    }
  }
  return blocked;
}
