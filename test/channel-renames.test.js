import test from "node:test";
import assert from "node:assert/strict";

import { renameMatchingChannels } from "../src/channel-renames.js";

test("renames only channels whose current name exactly matches", async () => {
  const renamed = [];
  const matching = { id: "1", name: "transcriptions", setName: async (name) => renamed.push(name) };
  const other = { id: "2", name: "transcription", setName: async () => assert.fail("must not rename") };
  const guilds = new Map([["guild", { channels: { cache: new Map([["1", matching], ["2", other]]) } }]]);

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
