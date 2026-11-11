import test from "node:test";
import assert from "node:assert/strict";

import {
  FUN_ROLE_IDS,
  FUN_VIP_ROLE_ID,
  buildFunStatsEmbed,
  fetchAnimeGif,
  getFunCommandDefinition,
  normalizeFunRole,
} from "../src/fun-commands.js";

function memberWithRoles(ids) {
  const roles = new Set(ids);
  return { roles: { cache: { has: (id) => roles.has(id) } } };
}

test("fun commands use the existing Kittisugar gender role IDs only", () => {
  assert.equal(normalizeFunRole(memberWithRoles([FUN_ROLE_IDS.female])), "female");
  assert.equal(normalizeFunRole(memberWithRoles([FUN_ROLE_IDS.male])), "male");
  assert.equal(normalizeFunRole(memberWithRoles([FUN_ROLE_IDS.trans])), "trans");
  assert.equal(normalizeFunRole(memberWithRoles([FUN_ROLE_IDS["non-binary"]])), "non-binary");
  assert.equal(normalizeFunRole(memberWithRoles([])), "neutral");
  assert.equal(normalizeFunRole(memberWithRoles([FUN_ROLE_IDS.female, FUN_ROLE_IDS.male])), "neutral");
  assert.equal(FUN_VIP_ROLE_ID, "1568188640113463437");
});

test("paired and solo commands enforce the correct mention mode", () => {
  assert.equal(getFunCommandDefinition("slap").needsTarget, true);
  assert.equal(getFunCommandDefinition("spank").needsTarget, true);
  assert.equal(getFunCommandDefinition("cry").needsTarget, false);
  assert.equal(getFunCommandDefinition("laugh").needsTarget, false);
  assert.equal(getFunCommandDefinition("kill").needsTarget, true);
  assert.equal(getFunCommandDefinition("rape"), null);
  assert.equal(getFunCommandDefinition("fuck"), null);
  assert.equal(getFunCommandDefinition("unknown"), null);
});

test("anime GIF lookup accepts only direct Nekos.best GIF URLs", async () => {
  const gif = await fetchAnimeGif("hug", {
    fetchImpl: async (url, options) => {
      assert.equal(url, "https://nekos.best/api/v2/hug");
      assert.match(options.headers["User-Agent"], /^SugarDiscordBot/);
      return {
        ok: true,
        json: async () => ({ results: [{ url: "https://nekos.best/api/v2/hug/test.gif", anime_name: "Example" }] }),
      };
    },
  });
  assert.deepEqual(gif, { url: "https://nekos.best/api/v2/hug/test.gif", anime: "Example" });
});

test("anime GIF lookup rejects non-GIF and off-site URLs", async () => {
  await assert.rejects(fetchAnimeGif("hug", {
    fetchImpl: async () => ({ ok: true, json: async () => ({ results: [{ url: "https://example.com/file.gif" }] }) }),
  }), /invalid GIF URL/);
  await assert.rejects(fetchAnimeGif("hug", {
    fetchImpl: async () => ({ ok: true, json: async () => ({ results: [{ url: "https://nekos.best/image.png" }] }) }),
  }), /invalid GIF URL/);
});

test("fun stats embed contains personal usage and received counts", () => {
  const embed = buildFunStatsEmbed({
    user: { username: "Kitti" },
    stats: { total: 5, receivedTotal: 2, commands: { hug: 3, cry: 2 }, received: { pat: 2 }, partners: { "11111111111111111": 3 } },
  });
  assert.match(embed.data.title, /Kitti's Fun Commands Stats/);
  assert.match(embed.data.description, /Used:\*\* 5/);
  assert.match(embed.data.description, /Received:\*\* 2/);
});
