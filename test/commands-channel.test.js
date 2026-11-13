import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCommandsPanelPayload,
  buildCommandsCategoryEmbed,
  buildModerationCommandsEmbed,
  MODERATION_COMMANDS_CHANNEL_ID,
  MODERATION_PANEL_TITLE,
  COMMANDS_CATEGORY_ID,
  COMMANDS_CHANNEL_NAME,
  COMMANDS_CHANNEL_TOPIC,
  REPUTATION_ONLY_CHANNEL_ID,
  COMMANDS_INFO_CHANNEL_ID,
  OBSOLETE_COMMANDS_CHANNEL_ID,
} from "../src/commands-channel.js";

test("commands guide is configured in the Kittisugar category", () => {
  assert.equal(COMMANDS_CATEGORY_ID, "1568179038625857576");
  assert.equal(COMMANDS_CHANNEL_NAME, "📖｜୨୧・commands");
  assert.ok(!COMMANDS_CHANNEL_TOPIC.includes("sticky"));
  assert.equal(COMMANDS_INFO_CHANNEL_ID, "1570257241511170150");
  assert.equal(OBSOLETE_COMMANDS_CHANNEL_ID, "1570839239396958218");
});

test("commands panel contains the same interactive category buttons for one-shot posts", () => {
  const payload = buildCommandsPanelPayload();
  assert.equal(payload.embeds.length, 1);
  assert.match(payload.embeds[0].data.title, /𝓒𝓸𝓶𝓶𝓪𝓷𝓭𝓼/);
  assert.match(payload.embeds[0].data.description, /Choose a category/);
  assert.match(payload.embeds[0].data.footer.text, /Select a category/);
  const ids = payload.components.flatMap((row) => row.components.map((button) => button.data.custom_id));
  assert.deepEqual(ids, [
    "sugar-commands:solo", "sugar-commands:couple", "sugar-commands:relationship",
    "sugar-commands:community", "sugar-commands:pets", "sugar-commands:functional",
  ]);
  assert.ok(!ids.some((id) => id.toLowerCase().includes("nsfw")));
});

test("each category exposes current command syntax and access requirements", () => {
  const cases = {
    solo: ["!cry", "!dance", "no solo NSFW actions"],
    couple: ["!hug @member", "!kiss @member", "!cuddle @member", "!shoot @member", "!fuck @member", "!masturbate @member", "!oral @member", "!anal @member", "VIP", "30-second timeout"],
    relationship: ["!couple @member", "!propose @member", "!divorce"],
    community: ["!rep", "Confessions, polls", "!rep comments"],
    pets: ["!pet adopt", "!pet select <number>", "!pet buy <treat|toy|potion>", "!pet gif", "!pet delete"],
    functional: ["/delete amount:", "/vip-delete", "/mod-delete", "!quote", "!profile", "/priv-chat create"],
  };
  for (const [category, phrases] of Object.entries(cases)) {
    const embed = buildCommandsCategoryEmbed(category);
    for (const phrase of phrases) assert.ok(embed.data.description.includes(phrase), category + " missing " + phrase);
  }
  assert.throws(() => buildCommandsCategoryEmbed("unknown"), /Unknown commands category/);
});

test("moderation is kept out of normal commands and only mod-delete is posted in its channel", () => {
  assert.equal(MODERATION_COMMANDS_CHANNEL_ID, "1570277294868660264");
  const payload = buildModerationCommandsPanelPayload();
  assert.equal(payload.embeds.length, 1);
  assert.equal(payload.components, undefined);
  assert.equal(payload.embeds[0].data.title, MODERATION_PANEL_TITLE);
  assert.match(payload.embeds[0].data.title, /Moderation/);
  const normalIds = buildCommandsPanelPayload().components.flatMap((row) => row.components.map((button) => button.data.custom_id));
  assert.ok(!normalIds.some((id) => id.includes("staff") || id.includes("moderation")));
  assert.equal(REPUTATION_ONLY_CHANNEL_ID, "1569930648804925522");
  for (const phrase of ["/mod-delete", "100 recent messages", "authorised moderators"]) {
    assert.ok(payload.embeds[0].data.description.toLowerCase().includes(phrase.toLowerCase()));
  }
  for (const excluded of ["/delete", "/vip-delete", "10-minute timeout", "Automatic protection"]) {
    assert.ok(!payload.embeds[0].data.description.includes(excluded));
  }
});
