import test from "node:test";
import assert from "node:assert/strict";

import {
  FUN_ROLE_IDS,
  FUN_VIP_ROLE_ID,
  buildFunActionText,
  buildFunHelpEmbed,
  buildFunStatsEmbed,
  fetchAnimeGif,
  getFunCommandDefinition,
  normalizeFunRole,
  resolveGifPairing,
} from "../src/fun-commands.js";

function memberWithRoles(ids) {
  const roles = new Set(ids);
  return { roles: { cache: { has: (id) => roles.has(id) } } };
}

test("fun commands use the existing Kittisugar gender role IDs only", () => {
  assert.deepEqual(FUN_ROLE_IDS, {
    female: "1569638102949953567",
    male: "1569807000278269983",
    trans: "1569807011217145948",
    "non-binary": "1569807020809396455",
  });
  assert.equal(normalizeFunRole(memberWithRoles([FUN_ROLE_IDS.female])), "female");
  assert.equal(normalizeFunRole(memberWithRoles([FUN_ROLE_IDS.male])), "male");
  assert.equal(normalizeFunRole(memberWithRoles([FUN_ROLE_IDS.trans])), "trans");
  assert.equal(normalizeFunRole(memberWithRoles([FUN_ROLE_IDS["non-binary"]])), "non-binary");
  assert.equal(normalizeFunRole(memberWithRoles([])), "neutral");
  assert.equal(normalizeFunRole(memberWithRoles([FUN_ROLE_IDS.female, FUN_ROLE_IDS.male])), "neutral");
  assert.equal(FUN_VIP_ROLE_ID, "1568188640113463437");
  assert.equal(resolveGifPairing("female", "female"), "ff");
  assert.equal(resolveGifPairing("male", "male"), "mm");
  assert.equal(resolveGifPairing("female", "male"), "fm");
  assert.equal(resolveGifPairing("male", "female"), "mf");
  assert.equal(resolveGifPairing("trans", "male"), null);
  assert.equal(resolveGifPairing("non-binary", "female"), null);
});

test("fun action messages mention the actor and target with clear past-tense wording", () => {
  assert.equal(buildFunActionText("111", "222", { text: "has hugged" }), "<@111> has hugged <@222>!");
  assert.equal(buildFunActionText("111", null, { text: "has cried" }), "<@111> has cried!");
});

test("fun help explains command types, stats, and VIP access", () => {
  const embed = buildFunHelpEmbed();
  assert.match(embed.data.title, /Fun Commands Guide/);
  const fields = embed.data.fields.map((field) => field.name + " " + field.value).join("\\n");
  assert.match(fields, /!stats/);
  assert.match(fields, /!vip stats @member/);
  assert.match(fields, /Two-person commands/);
  assert.match(fields, /Solo commands/);
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

test("anime GIF lookup sends female and male pairings to Gifukai", async () => {
  const gif = await fetchAnimeGif("hug", {
    actorRole: "male",
    targetRole: "male",
    fetchImpl: async (url) => {
      assert.equal(url.toString(), "https://api.gifukai.com/v1/hug?pairing=mm");
      return {
        ok: true,
        json: async () => ({ url: "https://cdn.gifukai.com/hug/test.gif", anime: "Example" }),
      };
    },
  });
  assert.deepEqual(gif, {
    url: "https://cdn.gifukai.com/hug/test.gif",
    anime: "Example",
    pairing: "mm",
    source: "Gifukai",
  });
});

test("trans and non-binary roles use an unfiltered GIF instead of being misclassified", async () => {
  await fetchAnimeGif("hug", {
    actorRole: "trans",
    targetRole: "non-binary",
    fetchImpl: async (url) => {
      assert.equal(url.toString(), "https://api.gifukai.com/v1/hug");
      return {
        ok: true,
        json: async () => ({ url: "https://cdn.gifukai.com/hug/neutral.gif", anime: "Example" }),
      };
    },
  });
});

test("unsupported pairing categories fall back to Nekos.best GIFs", async () => {
  const gif = await fetchAnimeGif("slap", {
    actorRole: "female",
    targetRole: "male",
    fetchImpl: async (url) => {
      assert.equal(url, "https://nekos.best/api/v2/slap");
      return {
        ok: true,
        json: async () => ({ results: [{ url: "https://nekos.best/api/v2/slap/test.gif", anime_name: "Example" }] }),
      };
    },
  });
  assert.equal(gif.source, "Nekos.best");
});

test("anime GIF lookup rejects non-GIF and off-site URLs", async () => {
  await assert.rejects(fetchAnimeGif("hug", {
    fetchImpl: async () => ({ ok: true, json: async () => ({ url: "https://example.com/file.gif" }) }),
  }), /invalid GIF URL/);
  await assert.rejects(fetchAnimeGif("hug", {
    fetchImpl: async () => ({ ok: true, json: async () => ({ url: "https://cdn.gifukai.com/image.png" }) }),
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
