import test from "node:test";
import assert from "node:assert/strict";

import { AUTO_REACTIONS, AUTO_REACTIONS_CHANNEL_ID, shouldAutoReactToMessage, addAutoReactions } from "../src/auto-reactions.js";
import {
  TICKET_PANEL_CHANNEL_ID,
  TICKET_CATEGORY_ID,
  TICKET_TRANSCRIPTS_CHANNEL_ID,
} from "../src/ticket-system.js";
import { REPORTS_CHANNEL_ID } from "../src/community-system.js";

const EXCLUDED_CATEGORY_ID = "1568680126294663330";

function message(overrides = {}) {
  return {
    id: "message-1",
    guild: { id: "guild-1" },
    author: { id: "member-1", bot: false },
    channelId: AUTO_REACTIONS_CHANNEL_ID,
    channel: { name: "general", parentId: null, topic: null, isTextBased: () => true },
    ...overrides,
  };
}

test("automatic reactions are the five requested emojis", () => {
  assert.deepEqual(AUTO_REACTIONS, ["😊", "😭", "😔", "💀", "💗"]);
});

test("ordinary member messages in the designated channel receive reactions", () => {
  assert.equal(shouldAutoReactToMessage(message()), true);
  assert.equal(shouldAutoReactToMessage(message({
    channel: { name: "chat-thread", parentId: AUTO_REACTIONS_CHANNEL_ID, topic: null, isTextBased: () => true },
  })), true);
});

test("automatic reactions are disabled in every channel except the designated channel", () => {
  assert.equal(shouldAutoReactToMessage(message({ channelId: "1569930648804925522" })), false);
  assert.equal(shouldAutoReactToMessage(message({ channelId: "another-channel" })), false);
  assert.equal(shouldAutoReactToMessage(message({ channelId: AUTO_REACTIONS_CHANNEL_ID })), true);
});

test("automatic reactions are disabled in the Comments thread", () => {
  const commentsThread = {
    name: "Comments", parentId: "community-channel", topic: null,
    isThread: () => true, isTextBased: () => true,
  };
  assert.equal(shouldAutoReactToMessage(message({ channel: commentsThread })), false);
});

test("bot, webhook, system, and DM messages are ignored", () => {
  assert.equal(shouldAutoReactToMessage(message({ author: { bot: true } })), false);
  assert.equal(shouldAutoReactToMessage(message({ webhookId: "webhook-1" })), false);
  assert.equal(shouldAutoReactToMessage(message({ system: true })), false);
  assert.equal(shouldAutoReactToMessage(message({ guild: null })), false);
});

test("support panel, ticket category, transcript, report, and configured category channels are excluded", () => {
  for (const channelId of [TICKET_PANEL_CHANNEL_ID, TICKET_TRANSCRIPTS_CHANNEL_ID, REPORTS_CHANNEL_ID]) {
    assert.equal(shouldAutoReactToMessage(message({ channelId })), false, channelId);
  }
  for (const parentId of [TICKET_CATEGORY_ID, EXCLUDED_CATEGORY_ID]) {
    assert.equal(shouldAutoReactToMessage(message({
      channel: { name: "category-child", parentId, topic: null, isTextBased: () => true },
    })), false, parentId);
  }
  assert.equal(shouldAutoReactToMessage(message({
    channel: {
      name: "games-post",
      parentId: "games-forum-channel",
      parent: { id: "games-forum-channel", parentId: EXCLUDED_CATEGORY_ID },
      topic: null,
      isTextBased: () => true,
    },
  })), false, "forum post threads inherit the excluded category from their parent forum");
  assert.equal(shouldAutoReactToMessage(message({
    channel: { name: "private-ticket", parentId: null, topic: "sugar-ticket:open:123:456", isTextBased: () => true },
  })), false);
  assert.equal(shouldAutoReactToMessage(message({
    channel: { name: "ticket-general", parentId: null, topic: null, isTextBased: () => true },
  })), false);
});

test("saved sticky panel messages are excluded", () => {
  const stickyPanels = { get: (key) => key === "confessions" ? "sticky-message" : null };
  assert.equal(shouldAutoReactToMessage(message({ id: "sticky-message" }), { stickyPanels }), false);
  assert.equal(shouldAutoReactToMessage(message({ id: "normal-message" }), { stickyPanels }), true);
});

test("five reactions are added to each eligible message", async () => {
  const added = [];
  const count = await addAutoReactions({ react: async (emoji) => added.push(emoji) });
  assert.equal(count, 5);
  assert.deepEqual(added, AUTO_REACTIONS);
});
