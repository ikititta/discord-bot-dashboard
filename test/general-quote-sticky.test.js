import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { Events, ChannelType } from "discord.js";

import { attachGeneralQuoteStickyTip } from "../src/general-quote-sticky.js";

function harness() {
  const client = new EventEmitter();
  client.user = { id: "123456789012345678" };
  const stored = new Map();
  const messages = new Map();
  let sequence = 0;
  let timestamp = 1_000;
  const channel = {
    id: "223456789012345678",
    name: "general",
    type: ChannelType.GuildText,
    messages: {
      fetch: async (input) => {
        if (typeof input === "string") {
          const message = messages.get(input);
          if (!message) { const error = new Error("Unknown message"); error.code = 10008; throw error; }
          return message;
        }
        return new Map(messages);
      },
    },
    send: async (payload) => {
      const message = {
        id: String(++sequence).padStart(17, "0"),
        channelId: channel.id,
        author: client.user,
        embeds: payload.embeds.map((embed) => ({ title: embed.data.title })),
        createdTimestamp: ++timestamp,
        pinned: false,
        edit: async (next) => { message.embeds = next.embeds.map((embed) => ({ title: embed.data.title })); return message; },
        delete: async () => { messages.delete(message.id); client.emit(Events.MessageDelete, message); },
      };
      messages.set(message.id, message);
      return message;
    },
  };
  client.guilds = { cache: new Map([["guild", { channels: { cache: new Map([[channel.id, channel]]) } }]]) };
  client.channels = { fetch: async () => channel };
  const store = {
    get: (key) => stored.get(key) ?? null,
    set: (key, value) => value === null ? stored.delete(key) : stored.set(key, value),
  };
  return { client, channel, messages, store };
}

async function settle() { await new Promise((resolve) => setImmediate(resolve)); }

test("general quote tip is reposted after member messages and is never pinned", async () => {
  const h = harness();
  attachGeneralQuoteStickyTip(h.client, { store: h.store });
  h.client.emit(Events.ClientReady);
  await settle();
  const key = `general-quote-tip:${h.channel.id}`;
  const firstId = h.store.get(key);
  assert.ok(firstId);
  assert.equal(h.messages.get(firstId).pinned, false);

  const memberMessage = {
    id: "323456789012345678",
    channelId: h.channel.id,
    guild: { id: "guild" },
    author: { id: "323456789012345678", bot: false },
    createdTimestamp: ++h.channel.messages.timestamp,
  };
  h.messages.set(memberMessage.id, memberMessage);
  h.client.emit(Events.MessageCreate, memberMessage);
  await settle();

  const nextId = h.store.get(key);
  assert.notEqual(nextId, firstId);
  assert.equal(h.messages.has(firstId), false);
  assert.equal(h.messages.get(nextId).pinned, false);
  assert.equal(h.messages.get(nextId).embeds[0].title, "୨୧ fun quote cards ♡");
});

test("messages from bots do not move the general quote tip", async () => {
  const h = harness();
  attachGeneralQuoteStickyTip(h.client, { store: h.store });
  h.client.emit(Events.ClientReady);
  await settle();
  const key = `general-quote-tip:${h.channel.id}`;
  const firstId = h.store.get(key);
  h.client.emit(Events.MessageCreate, {
    id: "423456789012345678",
    channelId: h.channel.id,
    guild: { id: "guild" },
    author: { id: "423456789012345678", bot: true },
  });
  await settle();
  assert.equal(h.store.get(key), firstId);
});
