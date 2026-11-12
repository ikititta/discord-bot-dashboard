const PROTECTED_CHANNEL_IDS = new Set([
  "1569548753319362690",
  "1569573843469865071",
  "1569574031991119882",
]);

/**
 * Prevent every Sugar feature from renaming these server-managed channels.
 * Discord.js returns cached channel instances from the channel manager, so
 * guarding the instance method protects all bot modules that use setName().
 */
export function protectChannelNames(guilds, onBlocked = console.warn) {
  let protectedCount = 0;

  for (const guild of guilds.values()) {
    for (const channel of guild.channels.cache.values()) {
      if (!PROTECTED_CHANNEL_IDS.has(channel.id) || typeof channel.setName !== "function") continue;
      if (channel.__sugarChannelNameProtected) continue;

      Object.defineProperty(channel, "__sugarChannelNameProtected", {
        configurable: false,
        enumerable: false,
        value: true,
      });
      Object.defineProperty(channel, "setName", {
        configurable: false,
        writable: false,
        value: async () => {
          onBlocked(`[bot] blocked an automatic rename attempt for protected channel ${channel.id}`);
          return channel;
        },
      });
      protectedCount += 1;
    }
  }

  return protectedCount;
}

/** Rename only exact-match channels, leaving all other channels untouched. */
export async function renameMatchingChannels(guilds, oldName, newName, onError = console.error) {
  for (const guild of guilds.values()) {
    for (const channel of guild.channels.cache.values()) {
      if (PROTECTED_CHANNEL_IDS.has(channel.id)) continue;
      if (channel.name !== oldName || typeof channel.setName !== "function") continue;

      try {
        await channel.setName(newName);
      } catch (error) {
        onError(`[bot] could not rename channel ${channel.id}: ${error.message}`);
      }
    }
  }
}
