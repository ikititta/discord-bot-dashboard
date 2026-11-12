import test from "node:test";
import assert from "node:assert/strict";

import {
  FUN_ROLE_IDS,
  FUN_VIP_ROLE_ID,
  KILL_TIMEOUT_MS,
  buildFunActionText,
  buildFunHelpEmbed,
  buildFunStatsEmbed,
  isFunHelpCommand,
  fetchAnimeGif,
  fetchNsfwGif,
  getFunCommandDefinition,
  isVerifiedAdult,
  isVip,
  isVipOnlyFunCommand,
  normalizeFunRole,
  resolveGifPairing,
  resolveNsfwGifCategory,
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
  assert.equal(isVip(memberWithRoles([FUN_VIP_ROLE_ID])), true);
  assert.equal(isVip(memberWithRoles([])), false);
  assert.equal(isVip(memberWithRoles(["1568188534836428812"])), false);
  assert.equal(isVipOnlyFunCommand("fuck"), true);
  assert.equal(isVipOnlyFunCommand("kill"), true);
  assert.equal(KILL_TIMEOUT_MS, 30_000);
  assert.equal(isVipOnlyFunCommand("spank"), false);
  assert.equal(resolveGifPairing("female", "female"), "ff");
  assert.equal(resolveGifPairing("male", "male"), "mm");
  assert.equal(resolveGifPairing("female", "male"), "fm");
  assert.equal(resolveGifPairing("male", "female"), "mf");
  assert.equal(resolveGifPairing("trans", "male"), null);
  assert.equal(resolveGifPairing("non-binary", "female"), null);
});

test("fun commands recognize the live Member role even if its role ID changes", () => {
  const member = { roles: { cache: {
    has: () => false,
    some: (predicate) => [{ id: "999999999999999999", name: "Member" }].some(predicate),
  } } };
  assert.equal(isVerifiedAdult(member), true);
  assert.equal(isVerifiedAdult(memberWithRoles([])), false);
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
  assert.match(fields, /VIP unlocks !fuck, !kill \(30-second timeout\), complete statistics/);
  assert.doesNotMatch(fields, /Everyone can view their own basic stats/);
  assert.match(fields, /Two-person commands/);
  assert.match(fields, /Solo commands/);
  assert.doesNotMatch(embed.data.footer.text, /consent/i);
  assert.match(fields, /!fuck @member/);
  assert.doesNotMatch(fields, /NSFW preferences|!nsfw-on|!nsfw-off|approval/i);
});

test("paired and solo commands enforce the correct mention mode", () => {
  assert.equal(getFunCommandDefinition("slap").needsTarget, true);
  assert.equal(getFunCommandDefinition("spank").needsTarget, true);
  assert.equal(getFunCommandDefinition("cry").needsTarget, false);
  assert.equal(getFunCommandDefinition("laugh").needsTarget, false);
  assert.equal(getFunCommandDefinition("kill").needsTarget, true);
  assert.equal(getFunCommandDefinition("rape"), null);
  assert.equal(getFunCommandDefinition("fuck").needsTarget, true);
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

test("!fuck selects NSFW GIF categories from both members' gender roles", async () => {
  assert.equal(resolveNsfwGifCategory("female", "female"), "yuri");
  assert.equal(resolveNsfwGifCategory("male", "male"), "yaoi");
  assert.equal(resolveNsfwGifCategory("female", "male"), "fuck");
  assert.equal(resolveNsfwGifCategory("trans", "female"), "fuck");
  const gif = await fetchNsfwGif({
    actorRole: "female",
    targetRole: "female",
    fetchImpl: async (url) => {
      assert.equal(url, "https://api.purrbot.site/v2/img/nsfw/yuri/gif");
      return {
        ok: true,
        json: async () => ({ link: "https://cdn.purrbot.site/nsfw/yuri/gif/yuri_001.gif", error: false }),
      };
    },
  });
  assert.deepEqual(gif, {
    url: "https://cdn.purrbot.site/nsfw/yuri/gif/yuri_001.gif",
    anime: "",
    pairing: "yuri",
    source: "PurrBot NSFW",
  });
});

test("!fuck rejects SFW or wrong-gender GIF results instead of falling back", async () => {
  await assert.rejects(fetchNsfwGif({
    actorRole: "female",
    targetRole: "female",
    fetchImpl: async () => ({ ok: true, json: async () => ({ link: "https://cdn.purrbot.site/nsfw/fuck/gif/fuck_001.gif", error: false }) }),
  }), /outside the selected yuri category/);
  await assert.rejects(fetchNsfwGif({
    fetchImpl: async () => ({ ok: true, json: async () => ({ link: "https://cdn.gifukai.com/kiss/test.gif", error: false }) }),
  }), /invalid GIF URL/);
  await assert.rejects(fetchNsfwGif({
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ link: "https://cdn.purrbot.site/nsfw/fuck/gif/image.png", error: false }),
    }),
  }), /invalid GIF URL/);
  await assert.rejects(fetchNsfwGif({
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ link: "https://cdn.purrbot.site/sfw/kiss/gif/kiss_001.gif", error: false }),
    }),
  }), /outside the selected fuck category/);
});


test("fun help works with both documented prefix syntaxes", () => {
  assert.equal(isFunHelpCommand("funhelp"), true);
  assert.equal(isFunHelpCommand("fun", "help"), true);
  assert.equal(isFunHelpCommand("fun", "stats"), false);
  assert.equal(isFunHelpCommand("smile"), false);
});
