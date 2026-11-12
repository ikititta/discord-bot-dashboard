import test from "node:test";
import assert from "node:assert/strict";

import {
  protectChannelNames,
  protectNewChannel,
  renameMatchingChannels,
  renamePrivateChatChannel,
} from "../src/channel-renames.js";

function makeGuild(channels = []) {
  const cache = new Map(channels.map((channel) => [channel.id, channel]));
  const manager = {
    cache: {
      values: () => cache.values(),
      find: (predicate) => [...cache.values()].find(predicate),
      get: (id) => cache.get(id),
    },
    edit: async (id, options) => { const channel = cache.get(id); if (channel && options?.name) channel.name = options.name; return channel; },
    create: async (options) => {
      const channel = {
        id: String(cache.size + 1),
        name: options.name,
        topic: options.topic,
        type: options.type,
        setName: async (name) => { channel.name = name; return channel; },
      };
      cache.set(channel.id, channel);
      return channel;
    },
  };
  return { id: "guild-1", channels: manager };
}

test("blocks Sugar renaming every existing channel, including the three previously protected IDs", async () => {
  const renamed = [];
  const warnings = [];
  const channels = [
    "1569548753319362690",
    "1569573843469865071",
    "1569574031991119882",
    "ordinary-channel",
  ].map((id) => ({
    id,
    name: `channel-${id}`,
    setName: async (name) => { renamed.push({ id, name }); },
  }));
  const guild = makeGuild(channels);
  assert.equal(protectChannelNames(new Map([[guild.id, guild]]), (message) => warnings.push(message)), 4);

  for (const channel of channels) await channel.setName("changed-name");
  assert.deepEqual(renamed, []);
  assert.equal(warnings.length, 4);
});

test("protection is idempotent and applies to channels created after startup", async () => {
  const existing = { id: "1", name: "existing", setName: async () => {} };
  const guild = makeGuild([existing]);
  assert.equal(protectChannelNames(new Map([[guild.id, guild]])), 1);
  assert.equal(protectChannelNames(new Map([[guild.id, guild]])), 0);

  const created = { id: "2", name: "new", setName: async () => assert.fail("new channel must be protected") };
  assert.equal(protectNewChannel(created), true);
  await created.setName("not-allowed");
  assert.equal(created.name, "new");
});

test("only the private-chat owner rename helper can use the original rename method", async () => {
  const channel = { id: "private", name: "old", setName: async (name) => { channel.name = name; return channel; } };
  const guild = makeGuild([channel]);
  protectChannelNames(new Map([[guild.id, guild]]));
  await channel.setName("blocked");
  assert.equal(channel.name, "old");

  await renamePrivateChatChannel(channel, "owner-renamed", "Private chat owner renamed the channel");
  assert.equal(channel.name, "owner-renamed");
});


test("blocks edit({ name }) but the approved private-chat rename uses the original edit method", async () => {
  const channel = {
    id: "private-edit",
    name: "before",
    edit: async (options) => { if (options.name) channel.name = options.name; return channel; },
    setName: async (name, reason) => channel.edit({ name }, reason),
  };
  const guild = makeGuild([channel]);
  protectChannelNames(new Map([[guild.id, guild]]));

  await channel.edit({ name: "blocked" });
  assert.equal(channel.name, "before");
  await renamePrivateChatChannel(channel, "owner-name", "owner action");
  assert.equal(channel.name, "owner-name");
});

test("legacy bulk rename helper refuses all automated renames", async () => {
  const warnings = [];
  const channel = { id: "1", name: "transcriptions", setName: async () => assert.fail("must not rename") };
  const guild = makeGuild([channel]);
  const blocked = await renameMatchingChannels(new Map([[guild.id, guild]]), "transcriptions", "new-name", (message) => warnings.push(message));
  assert.equal(blocked, 1);
  assert.equal(channel.name, "transcriptions");
  assert.equal(warnings.length, 1);
});

test("channel creation with a stable topic reuses an existing channel and serializes concurrent creation", async () => {
  let creates = 0;
  const cache = new Map();
  const manager = {
    cache: {
      values: () => cache.values(),
      find: (predicate) => [...cache.values()].find(predicate),
    },
    create: async (options) => {
      creates += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      const channel = {
        id: String(creates),
        name: options.name,
        topic: options.topic,
        type: options.type,
        setName: async () => channel,
      };
      cache.set(channel.id, channel);
      return channel;
    },
  };
  const guild = { id: "dedupe-guild", channels: manager };
  protectChannelNames(new Map([[guild.id, guild]]));

  const options = { name: "one-room", topic: "stable:room:123", type: 0 };
  const [first, second] = await Promise.all([manager.create(options), manager.create(options)]);
  assert.equal(creates, 1);
  assert.equal(first.id, second.id);
  assert.equal((await manager.create(options)).id, first.id);
  assert.equal(creates, 1);
});


test("blocks channel renames routed through the guild channel manager", async () => {
  const channel = { id: "manager-edit", name: "protected", setName: async () => {} };
  const guild = makeGuild([channel]);
  protectChannelNames(new Map([[guild.id, guild]]));
  const result = await guild.channels.edit(channel.id, { name: "renamed" });
  assert.equal(result, channel);
  assert.equal(channel.name, "protected");
});
