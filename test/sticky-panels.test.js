import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { Events } from "discord.js";

import { attachStickyPanel } from "../src/sticky-panels.js";

function makeHarness() {
  const client = new EventEmitter();
  client.user = { id: "123456789012345678" };
  const store = new Map();
  const messages = new Map();
  let sequence = 0;
  let timestamp = 1_000;
  const channel = {
    id: "223456789012345678",
    type: 0,
    messages: {
      fetch: async (input) => {
        if (typeof input === "string") {
          const message = messages.get(input);
          if (!message) {
            const error = new Error("Unknown message");
            error.code = 10008;
            throw error;
          }
          return message;
        }
        return new Map(messages);
      },
    },
    send: async (payload) => {
      sequence += 1;
      timestamp += 1_000;
      const message = {
        id: `${String(sequence).padStart(17, "0")}`,
        channelId: "223456789012345678",
        author: client.user,
        embeds: payload.embeds,
        createdTimestamp: timestamp,
        pinned: false,
        edit: async (next) => { message.embeds = next.embeds; return message; },
        pin: async () => { message.pinned = true; return message; },
        delete: async () => {
          messages.delete(message.id);
          client.emit(Events.MessageDelete, message);
        },
      };
      messages.set(message.id, message);
      return message;
    },
  };
  client.channels = { fetch: async () => channel };
  const stickyStore = {
    get: (key) => store.get(key) ?? null,
    set: (key, value) => {
      if (value === null) store.delete(key);
      else store.set(key, value);
    },
  };
  const payload = () => ({ embeds: [{ title: "Primary Panel" }], components: [{ type: "buttons" }] });
  return { client, channel, messages, stickyStore, payload, nextTimestamp: () => (timestamp += 1_000) };
}

async function settle() {
  await new Promise((resolve) => setImmediate(resolve));
}

test("sticky panel moves to the bottom after a new channel message", async () => {
  const h = makeHarness();
  attachStickyPanel(h.client, {
    store: h.stickyStore,
    key: "main-panel",
    channelId: h.channel.id,
    titles: ["Primary Panel"],
    buildPayload: h.payload,
  });
  h.client.emit(Events.ClientReady);
  await settle();
  const firstId = h.stickyStore.get("main-panel");
  assert.ok(firstId);
  assert.equal(h.messages.get(firstId).pinned, false);

  const userMessage = {
    id: "323456789012345678",
    channelId: h.channel.id,
    author: { id: "323456789012345678", bot: false },
    createdTimestamp: h.nextTimestamp(),
  };
  h.messages.set(userMessage.id, userMessage);
  h.client.emit(Events.MessageCreate, userMessage);
  await settle();

  const nextId = h.stickyStore.get("main-panel");
  assert.notEqual(nextId, firstId);
  assert.equal(h.messages.has(firstId), false);
  assert.equal(h.messages.get(nextId).pinned, false);
  assert.ok(h.messages.get(nextId).createdTimestamp > userMessage.createdTimestamp);
});

test("sticky panels can stay at the bottom without being pinned", async () => {
  const h = makeHarness();
  const panel = attachStickyPanel(h.client, {
    store: h.stickyStore,
    key: "love-letters",
    channelId: h.channel.id,
    titles: ["Primary Panel"],
    buildPayload: h.payload,
  });
  h.client.emit(Events.ClientReady);
  await settle();
  const firstId = h.stickyStore.get("love-letters");
  assert.equal(h.messages.get(firstId).pinned, false);

  const userMessage = {
    id: "323456789012345678",
    channelId: h.channel.id,
    author: { id: "323456789012345678", bot: false },
    createdTimestamp: h.nextTimestamp(),
  };
  h.messages.set(userMessage.id, userMessage);
  h.client.emit(Events.MessageCreate, userMessage);
  await settle();
  const nextId = h.stickyStore.get("love-letters");
  assert.notEqual(nextId, firstId);
  assert.equal(h.messages.get(nextId).pinned, false);
  assert.ok(h.messages.get(nextId).createdTimestamp > userMessage.createdTimestamp);

  const unchangedId = h.stickyStore.get("love-letters");
  assert.equal(unchangedId, nextId);
  assert.equal(h.messages.get(unchangedId).pinned, false);
});

test("sticky panel is recreated if a member deletes it", async () => {
  const h = makeHarness();
  attachStickyPanel(h.client, {
    store: h.stickyStore,
    key: "main-panel",
    channelId: h.channel.id,
    titles: ["Primary Panel"],
    buildPayload: h.payload,
  });
  h.client.emit(Events.ClientReady);
  await settle();
  const firstId = h.stickyStore.get("main-panel");
  const deleted = h.messages.get(firstId);
  h.messages.delete(firstId);
  h.client.emit(Events.MessageDelete, deleted);
  await settle();
  const replacementId = h.stickyStore.get("main-panel");
  assert.ok(replacementId);
  assert.notEqual(replacementId, firstId);
  assert.equal(h.messages.get(replacementId).pinned, false);
});

test("sticky panel setup restores the panel below messages posted while Sugar was offline", async () => {
  const h = makeHarness();
  const oldPanel = {
    id: "423456789012345678",
    channelId: h.channel.id,
    author: h.client.user,
    embeds: [{ title: "Primary Panel" }],
    createdTimestamp: 1_000,
    pinned: true,
    edit: async () => oldPanel,
    pin: async () => { oldPanel.pinned = true; },
    delete: async () => { h.messages.delete(oldPanel.id); },
  };
  const laterMessage = {
    id: "523456789012345678",
    channelId: h.channel.id,
    author: { id: "623456789012345678", bot: false },
    createdTimestamp: 1_500,
  };
  h.messages.set(oldPanel.id, oldPanel);
  h.messages.set(laterMessage.id, laterMessage);
  h.stickyStore.set("main-panel", oldPanel.id);
  attachStickyPanel(h.client, {
    store: h.stickyStore,
    key: "main-panel",
    channelId: h.channel.id,
    titles: ["Primary Panel"],
    buildPayload: h.payload,
  });
  h.client.emit(Events.ClientReady);
  await settle();
  const currentId = h.stickyStore.get("main-panel");
  assert.notEqual(currentId, oldPanel.id);
  assert.equal(h.messages.has(oldPanel.id), false);
  assert.ok(h.messages.get(currentId).createdTimestamp > laterMessage.createdTimestamp);
});


test("sticky panel exposes no cross-system refresh action", async () => {
  const h = makeHarness();
  const panel = attachStickyPanel(h.client, {
    store: h.stickyStore,
    key: "main-panel",
    channelId: h.channel.id,
    titles: ["Primary Panel"],
    buildPayload: h.payload,
  });
  h.client.emit(Events.ClientReady);
  await settle();
  assert.equal(panel.channelId, h.channel.id);
  assert.equal(panel.key, "main-panel");
  assert.equal(panel.refresh, undefined);
});

test("messages in other channels and bot-authored non-panel messages cannot cross-update panels", async () => {
  const h = makeHarness();
  attachStickyPanel(h.client, {
    store: h.stickyStore,
    key: "main-panel",
    channelId: h.channel.id,
    titles: ["Primary Panel"],
    buildPayload: h.payload,
  });
  h.client.emit(Events.ClientReady);
  await settle();
  const firstId = h.stickyStore.get("main-panel");

  h.client.emit(Events.MessageCreate, {
    id: "823456789012345678",
    channelId: "923456789012345678",
    author: { id: "323456789012345678", bot: false },
  });
  await settle();
  assert.equal(h.stickyStore.get("main-panel"), firstId);

  const otherBotMessage = {
    id: "823456789012345679",
    channelId: h.channel.id,
    author: { id: "423456789012345678", bot: true },
    createdTimestamp: h.nextTimestamp(),
  };
  h.messages.set(otherBotMessage.id, otherBotMessage);
  h.client.emit(Events.MessageCreate, otherBotMessage);
  await settle();
  assert.notEqual(h.stickyStore.get("main-panel"), firstId);
});

test("startup preserves the existing panel without refreshing its content", async () => {
  const h = makeHarness();
  const oldPanel = {
    id: "723456789012345678",
    channelId: h.channel.id,
    author: h.client.user,
    embeds: [{ title: "Primary Panel", description: "legacy" }],
    createdTimestamp: 2_000,
    pinned: true,
    edit: async () => oldPanel,
    pin: async () => { oldPanel.pinned = true; },
    delete: async () => { h.messages.delete(oldPanel.id); },
  };
  h.messages.set(oldPanel.id, oldPanel);
  h.stickyStore.set("main-panel", oldPanel.id);
  attachStickyPanel(h.client, {
    store: h.stickyStore,
    key: "main-panel",
    channelId: h.channel.id,
    titles: ["Primary Panel"],
    buildPayload: h.payload,
  });
  h.client.emit(Events.ClientReady);
  await settle();
  const currentId = h.stickyStore.get("main-panel");
  assert.equal(currentId, oldPanel.id);
  assert.equal(h.messages.has(oldPanel.id), true);
  assert.deepEqual(h.messages.get(currentId).embeds, [{ title: "Primary Panel", description: "legacy" }]);
});
