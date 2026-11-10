import { REPORTS_CHANNEL_ID } from "./community-system.js";
import {
  TICKET_PANEL_CHANNEL_ID,
  TICKET_CATEGORY_ID,
  TICKET_TRANSCRIPTS_CHANNEL_ID,
} from "./ticket-system.js";

export const AUTO_REACTIONS = ["😊", "😭", "😔", "💀", "💗"];

const EXCLUDED_CHANNEL_IDS = new Set([
  TICKET_PANEL_CHANNEL_ID,
  TICKET_TRANSCRIPTS_CHANNEL_ID,
  REPORTS_CHANNEL_ID,
]);

const EXCLUDED_CATEGORY_IDS = new Set([
  "1568680126294663330",
]);

const STICKY_PANEL_KEYS = ["confessions", "love-letters", "suggestions"];

export function shouldAutoReactToMessage(message, { stickyPanels } = {}) {
  if (!message?.guild || !message.author || message.author.bot || message.webhookId) return false;
  if (message.system || message.channel?.isTextBased?.() === false) return false;

  const channel = message.channel;
  if (!channel || EXCLUDED_CHANNEL_IDS.has(message.channelId)) return false;
  if (channel.parentId === TICKET_CATEGORY_ID || EXCLUDED_CATEGORY_IDS.has(channel.parentId)) return false;
  if (typeof channel.topic === "string" && channel.topic.startsWith("sugar-ticket:")) return false;
  if (/^ticket(?:-|$)/i.test(channel.name ?? "")) return false;

  if (stickyPanels && STICKY_PANEL_KEYS.some((key) => stickyPanels.get(key) === message.id)) {
    return false;
  }

  return true;
}

export async function addAutoReactions(message) {
  const results = await Promise.allSettled(AUTO_REACTIONS.map((emoji) => message.react(emoji)));
  const failures = results.filter((result) => result.status === "rejected");
  if (failures.length) {
    throw new Error(`Could not add ${failures.length} of ${AUTO_REACTIONS.length} automatic reactions.`);
  }
  return AUTO_REACTIONS.length;
}
