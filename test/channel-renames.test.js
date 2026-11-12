import test from "node:test";
import assert from "node:assert/strict";

import { protectChannelNames, renameMatchingChannels } from "../src/channel-renames.js";

const PROTECTED_IDS = [
  "1569548753319362690",
  "1569573843469865071",
  "1569574031991119882",
];

test("blocks setName for the three protected channels and leaves other channels renameable", async () => {
  const renamed = [];
  const warnings = [];
  const channels = PROTECTED_IDS.map((id) => ({
    id,
    name: `channel-${id}`,
    setName: async (name) => {
      renamed.push({ id, name });
    },
  }));
  const ordinary = {
    id: "123",
    name: "transcriptions",
    setName: async (name) => {
      ordinary.name = name;
      renamed.push({ id: ordinary.id, name });
    },
  };
  const guilds = new Map([["guild", { channels: { cache: new Map([...channels, ordinary].map((channel) => [channel.id, channel])) } }]]);

  assert.equal(protectChannelNames(guilds, (message) => warnings.push(message)), 3);
  for (const channel of channels) await channel.setName("changed-name");
  await ordinary.setName("ordinary-renamed");

  assert.deepEqual(renamed, [{ id: "123", name: "ordinary-renamed" }]);
  assert.equal(warnings.length, 3);
  assert.ok(channels.every((channel) => channel.name !== "changed-name"));
});

test("protection is idempotent and does not alter unrelated channels", () => {
  const protectedChannel = { id: PROTECTED_IDS[0], name: "keep-me", setName: async () => {} };
  const ordinary = { id: "456", name: "ordinary", setName: async () => {} };
  const guilds = new Map([["guild", { channels: { cache: new Map([[protectedChannel.id, protectedChannel], [ordinary.id, ordinary]]) } }]]);

  assert.equal(protectChannelNames(guilds), 1);
  assert.equal(protectChannelNames(guilds), 0);
  assert.equal(protectedChannel.name, "keep-me");
  assert.equal(ordinary.name, "ordinary");
});

test("renames only channels whose current name exactly matches and skips protected IDs", async () => {
  const renamed = [];
  const matching = { id: "1", name: "transcriptions", setName: async (name) => renamed.push(name) };
  const protectedChannel = { id: PROTECTED_IDS[1], name: "transcriptions", setName: async () => assert.fail("must not rename") };
  const other = { id: "2", name: "transcription", setName: async () => assert.fail("must not rename") };
  const guilds = new Map([["guild", { channels: { cache: new Map([[matching.id, matching], [protectedChannel.id, protectedChannel], [other.id, other]]) } }]]);

  await renameMatchingChannels(guilds, "transcriptions", "📝｜୨୧•𝓽𝓻𝓪𝓷𝓼𝓬𝓻𝓲𝓹𝓽𝓲𝓸𝓷𝓼");

  assert.deepEqual(renamed, ["📝｜୨୧•𝓽𝓻𝓪𝓷𝓼𝓬𝓻𝓲𝓹𝓽𝓲𝓸𝓷𝓼"]);
});

test("does not stop other channel renames when Discord rejects one", async () => {
  const errors = [];
  const good = { id: "2", name: "transcriptions", setName: async () => {} };
  const bad = { id: "1", name: "transcriptions", setName: async () => { throw new Error("Missing Permissions"); } };
  const guilds = new Map([["guild", { channels: { cache: new Map([["1", bad], ["2", good]]) } }]]);

  await renameMatchingChannels(guilds, "transcriptions", "📝｜୨୧•𝓽𝓻𝓪𝓷𝓼𝓬𝓻𝓲𝓹𝓽𝓲𝓸𝓷𝓼", (message) => errors.push(message));

  assert.equal(errors.length, 1);
  assert.match(errors[0], /Missing Permissions/);
});
