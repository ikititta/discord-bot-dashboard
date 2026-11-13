import test from "node:test";
import assert from "node:assert/strict";

import {
  FUN_ROLE_IDS,
  FUN_VIP_ROLE_ID,
  buildFunActionText,
  buildFunStatsEmbed,
  fetchAnimeGif,
  removeGifPreferencesChannel,
  fetchPurrbotSfwGif,
  fetchNsfwGif,
  fetchPurrbotNsfwGif,
  resolveOralNsfwGifCategory,
  getFunCommandDefinition,
  isVerifiedAdult,
  isVip,
  isVipOnlyFunCommand,
  normalizeFunRole,
  normalizeFunDominance,
  resolveDominancePair,
  resolveGifPairing,
  resolveNsfwGifCategory,
  resolveNsfwGifSearchTags,
  resolveMasturbateGifPairing,
  selectMasturbateGif,
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
  assert.equal(isVipOnlyFunCommand("masturbate"), true);
  assert.equal(isVipOnlyFunCommand("oral"), true);
  assert.equal(resolveOralNsfwGifCategory("female"), "pussylick");
  assert.equal(resolveOralNsfwGifCategory("male"), "blowjob");
  assert.equal(resolveOralNsfwGifCategory("trans"), null);
  assert.equal(resolveOralNsfwGifCategory("neutral"), null);
  assert.equal(isVipOnlyFunCommand("anal"), true);
  assert.equal(isVipOnlyFunCommand("tease"), true);
  assert.equal(isVipOnlyFunCommand("seduce"), true);
  assert.equal(isVipOnlyFunCommand("spank"), false);
  assert.equal(resolveGifPairing("female", "female"), "ff");
  assert.equal(resolveGifPairing("male", "male"), "mm");
  assert.equal(resolveGifPairing("female", "male"), "fm");
  assert.equal(resolveGifPairing("male", "female"), "mf");
  assert.equal(resolveGifPairing("trans", "male"), null);
  assert.equal(resolveGifPairing("non-binary", "female"), null);
  assert.equal(resolveGifPairing("male", "female", -2, 2), "mf");
  assert.equal(resolveGifPairing("male", "female", 2, -2), "mf");
  assert.equal(getFunCommandDefinition("smirk").gif, "smug");
  assert.equal(normalizeFunDominance({ roles: { cache: { values: () => [{ name: "꒰ 𝓢𝓾𝓫𝓶𝓲𝓼𝓼𝓲𝓿𝓮 ! ꒱" }] } } }), -2);
  assert.equal(normalizeFunDominance({ roles: { cache: { values: () => [{ name: "꒰ 𝓜𝓸𝓼𝓽𝓵𝔂 𝓓𝓸𝓶𝓲𝓷𝓪𝓷𝓽 ! ꒱" }] } } }), 1);
});

test("dominance pairing resolves top and bottom independently of gender and command author", () => {
  const cases = [
    [2, -2, "actor", "target"],
    [2, -1, "actor", "target"],
    [1, -2, "actor", "target"],
    [1, -1, "actor", "target"],
    [-2, 2, "target", "actor"],
    [-1, 1, "target", "actor"],
    [0, 2, "target", "actor"],
    [0, 1, "target", "actor"],
    [0, -2, "actor", "target"],
    [0, -1, "actor", "target"],
    [2, 0, "actor", "target"],
    [-2, 0, "target", "actor"],
  ];
  for (const [actor, target, dominant, submissive] of cases) {
    assert.deepEqual(resolveDominancePair(actor, target), { mode: "directional", dominant, submissive });
  }
  for (const [actor, target] of [[2, 1], [1, 2], [-2, -1], [-1, -2], [0, 0], [null, 2], [2, null]]) {
    assert.deepEqual(resolveDominancePair(actor, target), { mode: "neutral", dominant: null, submissive: null });
  }
});

test("VIP access recognizes the live VIP role name if its configured ID changed", () => {
  const member = { roles: { cache: {
    has: () => false,
    some: (predicate) => [{ id: "999999999999999999", name: "ＶＩＰ" }].some(predicate),
  } } };
  assert.equal(isVip(member), true);
  assert.equal(isVip(memberWithRoles([])), false);
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
  assert.equal(buildFunActionText("111", "222", { text: "has masturbated" }), "<@111> has masturbated <@222>!");
});

test("paired and solo commands enforce the correct mention mode", () => {
  assert.equal(getFunCommandDefinition("slap").needsTarget, true);
  for (const name of ["choke", "spit", "comfort", "noseboop"]) assert.equal(getFunCommandDefinition(name).needsTarget, true);
  for (const name of ["scream", "sing", "think"]) assert.equal(getFunCommandDefinition(name).needsTarget, false);
  assert.equal(isVipOnlyFunCommand("choke"), true);
  assert.equal(isVipOnlyFunCommand("spit"), true);
  assert.equal(getFunCommandDefinition("spank").needsTarget, true);
  assert.equal(getFunCommandDefinition("spank").gif, "spank");
  assert.equal(getFunCommandDefinition("cry").needsTarget, false);
  assert.equal(getFunCommandDefinition("laugh").needsTarget, false);
  assert.equal(getFunCommandDefinition("kill").needsTarget, true);
  assert.equal(getFunCommandDefinition("kill").gif, "kick");
  assert.equal(getFunCommandDefinition("bite").needsTarget, true);
  assert.equal(getFunCommandDefinition("lick").needsTarget, true);
  assert.equal(getFunCommandDefinition("lick").gif, "lick");
  assert.equal(getFunCommandDefinition("shoot").needsTarget, true);
  assert.equal(getFunCommandDefinition("shoot").gif, "shoot");
  assert.equal(getFunCommandDefinition("feet").needsTarget, true);
  assert.equal(getFunCommandDefinition("rape"), null);
  assert.equal(getFunCommandDefinition("fuck").needsTarget, true);
  assert.equal(getFunCommandDefinition("masturbate").needsTarget, true);
  assert.equal(getFunCommandDefinition("oral").needsTarget, true);
  assert.equal(getFunCommandDefinition("oral").nsfwGif, "blowjob");
  assert.equal(getFunCommandDefinition("anal").needsTarget, true);
  assert.equal(getFunCommandDefinition("tease").needsTarget, true);
  assert.equal(getFunCommandDefinition("seduce").needsTarget, true);
  assert.equal(getFunCommandDefinition("masturbate").gif, null);
  assert.equal(getFunCommandDefinition("oral").gif, null);
  assert.equal(getFunCommandDefinition("anal").gif, null);
  assert.equal(getFunCommandDefinition("tease").gif, "wink");
  assert.equal(getFunCommandDefinition("seduce").gif, "wink");
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

test("!shoot retrieves a dedicated shooting reaction GIF", async () => {
  const gif = await fetchAnimeGif("shoot", {
    fetchImpl: async (url) => {
      assert.equal(url, "https://nekos.best/api/v2/shoot");
      return {
        ok: true,
        json: async () => ({ results: [{ url: "https://nekos.best/api/v2/shoot/example.gif", anime_name: "Example" }] }),
      };
    },
  });
  assert.equal(gif.url, "https://nekos.best/api/v2/shoot/example.gif");
  assert.equal(gif.source, "Nekos.best");
});

test("!lick can retrieve a dedicated SFW GIF from PurrBot", async () => {
  const gif = await fetchPurrbotSfwGif("lick", {
    fetchImpl: async (url) => {
      assert.equal(url, "https://api.purrbot.site/v2/img/sfw/lick/gif");
      return { ok: true, json: async () => ({ link: "https://cdn.purrbot.site/sfw/lick/gif/lick_001.gif", error: false }) };
    },
  });
  assert.equal(gif.source, "PurrBot SFW");
  assert.match(gif.url, /lick_001\\.gif$/);
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

test("!masturbate selects the exact actor-to-target curated pairing", () => {
  assert.deepEqual(["female:female","female:male","male:female","male:male"].map((pair) => resolveMasturbateGifPairing(...pair.split(":"))), ["ff","fm","mf","mm"]);
  assert.equal(resolveMasturbateGifPairing("trans", "female"), null);
  const catalog = { ff:["https://assets.example/ff.gif"], fm:["https://assets.example/fm.gif"], mf:["https://assets.example/mf.gif"], mm:["https://assets.example/mm.gif"] };
  for (const [actor,target,expected] of [["female","female","ff"],["female","male","fm"],["male","female","mf"],["male","male","mm"]]) {
    const gif=selectMasturbateGif(actor,target,{catalog,random:()=>0}); assert.equal(gif.pairing,expected); assert.equal(gif.url,"https://assets.example/"+expected+".gif");
  }
  assert.equal(selectMasturbateGif("female","male",{catalog:{fm:[]}}),null);
  assert.equal(selectMasturbateGif("female","male",{catalog:{fm:["http://assets.example/no.gif"]}}),null);
  assert.equal(selectMasturbateGif("female","male",{catalog:{fm:["https://assets.example/no.png"]}}),null);
});
test("!fuck selects NSFW GIF categories from both members' gender roles", async () => {
  assert.equal(resolveNsfwGifCategory("female", "female"), "yuri");
  assert.equal(resolveNsfwGifCategory("male", "male"), "yaoi");
  assert.equal(resolveNsfwGifCategory("female", "male"), "fuck");
  assert.equal(resolveNsfwGifCategory("female", "male", 2, -2), "fuck"); // dominant woman: provider has no pose-specific category
  assert.equal(resolveNsfwGifCategory("male", "female", 2, -2), "fuck"); // dominant man: generic mixed-gender category
  assert.equal(resolveNsfwGifCategory("male", "female", -2, 2), "fuck");
  assert.equal(resolveNsfwGifCategory("male", "male", -2, 2), "yaoi");
  assert.equal(resolveNsfwGifCategory("female", "male", 2, -2), "fuck");
  assert.equal(resolveNsfwGifCategory("trans", "female"), "fuck");
  const gif = await fetchNsfwGif({
    actorRole: "female",
    targetRole: "female",
    fetchImpl: async (url) => {
      assert.equal(url, "https://api.purrbot.site/v2/img/nsfw/yuri/gif");
      return {
        ok: true,
        json: async () => ({ link: "https://cdn.purrbot.site/nsfw/yaoi/gif/yaoi_001.gif", error: false }),
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

test("dominance chooses pose-specific GIF tags regardless of command actor", () => {
  assert.deepEqual(resolveNsfwGifSearchTags("female", "male", 2, -2), [["animated", "cowgirl"], ["animated", "reverse_cowgirl"]]);
  assert.deepEqual(resolveNsfwGifSearchTags("male", "female", 2, -2), [["animated", "doggy_style"], ["animated", "missionary"]]);
  assert.deepEqual(resolveNsfwGifSearchTags("male", "female", -2, 2), [["animated", "cowgirl"], ["animated", "reverse_cowgirl"]]);
  assert.deepEqual(resolveNsfwGifSearchTags("female", "male", 0, 2), [["animated", "doggystyle"], ["animated", "missionary"]]);
  assert.deepEqual(resolveNsfwGifSearchTags("female", "female", 2, -2), []); // PurrBot yuri category
  assert.deepEqual(resolveNsfwGifSearchTags("male", "male", -2, 2), []); // PurrBot yaoi category
  assert.deepEqual(resolveNsfwGifSearchTags("female", "male", 0, 0), [["animated", "hetero"]]);
});

test("!fuck uses a tagged GIF result for a dominant woman", async () => {
  const gif = await fetchNsfwGif({
    actorRole: "female", targetRole: "male", actorDominance: 2, targetDominance: -2,
    fetchImpl: async (rawUrl) => {
      const url = new URL(rawUrl);
      assert.equal(url.hostname, "api.rule34.xxx");
      assert.equal(url.searchParams.get("tags"), "animated cowgirl");
      return { ok: true, json: async () => [{ file_url: "https://us.rule34.xxx/images/123/example.gif", tags: "animated cowgirl" }] };
    },
  });
  assert.equal(gif.url, "https://us.rule34.xxx/images/123/example.gif");
  assert.equal(gif.pairing, "cowgirl");
  assert.equal(gif.source, "Rule34 tagged GIF search");
});

test("!fuck never falls back to a generic GIF that can depict the dominant woman as submissive", async () => {
  let calls = 0;
  await assert.rejects(fetchNsfwGif({
    actorRole: "female", targetRole: "male", actorDominance: 2, targetDominance: -2,
    fetchImpl: async () => { calls += 1; return { ok: true, json: async () => [] }; },
  }), /No GIF matching the dominant member/);
  assert.equal(calls, 2);
});

test("!fuck rejects SFW or wrong-gender GIF results instead of falling back", async () => {
  await assert.rejects(fetchNsfwGif({
    actorRole: "female",
    targetRole: "female",
    fetchImpl: async () => ({ ok: true, json: async () => ({ link: "https://cdn.purrbot.site/nsfw/yuri/gif/yuri_001.gif", error: false }) }),
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


test("VIP NSFW commands use their matching PurrBot categories", async () => {
  for (const category of ["solo", "solo_male", "blowjob", "pussylick", "anal", "yaoi", "yuri"]) {
    const gif = await fetchPurrbotNsfwGif(category, {
      fetchImpl: async (url) => {
        assert.equal(url, "https://api.purrbot.site/v2/img/nsfw/" + category + "/gif");
        return { ok: true, json: async () => ({ link: "https://cdn.purrbot.site/nsfw/" + category + "/gif/" + category + "_001.gif", error: false }) };
      },
    });
    assert.equal(gif.pairing, category);
    assert.equal(gif.source, "PurrBot NSFW");
  }
  await assert.rejects(fetchPurrbotNsfwGif("kiss"), /Invalid PurrBot NSFW GIF category/);
});


test("retired GIF preferences channel is deleted instead of recreated", async () => {
  let deletedId = null;
  const result = await removeGifPreferencesChannel({
    channels: {
      fetch: async (id) => ({
        id,
        delete: async () => { deletedId = id; },
      }),
    },
  });
  assert.equal(result, true);
  assert.equal(deletedId, "1570873475038711973");
});

test("missing retired GIF preferences channel is treated as already removed", async () => {
  const result = await removeGifPreferencesChannel({
    channels: { fetch: async () => { throw Object.assign(new Error("Unknown Channel"), { code: 10003 }); } },
  });
  assert.equal(result, false);
});
