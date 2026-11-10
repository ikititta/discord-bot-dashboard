/** Rename only exact-match channels, leaving all other channels untouched. */
export async function renameMatchingChannels(guilds, oldName, newName, onError = console.error) {
  for (const guild of guilds.values()) {
    for (const channel of guild.channels.cache.values()) {
      if (channel.name !== oldName || typeof channel.setName !== "function") continue;

      try {
        await channel.setName(newName);
      } catch (error) {
        onError(`[bot] could not rename channel ${channel.id}: ${error.message}`);
      }
    }
  }
}
