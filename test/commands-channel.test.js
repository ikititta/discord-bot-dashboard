import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCommandsPanelPayload,
  buildCommandsCategoryEmbed,
  COMMANDS_CATEGORY_ID,
  COMMANDS_CHANNEL_NAME,
  COMMANDS_CHANNEL_TOPIC,
} from "../src/commands-channel.js";

test("commands guide is configured in the supplied Fun category", () => {
  assert.equal(COMMANDS_CATEGORY_ID, "1568179038625857576");
  assert.equal(COMMANDS_CHANNEL_NAME, "📖｜୨୧・commands");
  assert.ok(COMMANDS_CHANNEL_TOPIC.includes("sticky"));
});

test("commands panel contains interactive category buttons and is explicitly not pinned", () => {
  const payload = buildCommandsPanelPayload();
  assert.equal(payload.embeds.length, 1);
  assert.match(payload.embeds[0].data.title, /𝓒𝓸𝓶𝓶𝓪𝓷𝓭𝓼/);
  assert.match(payload.embeds[0].data.description, /Choose a category/);
  assert.match(payload.embeds[0].data.footer.text, /Not pinned/);
  const ids = payload.components.flatMap((row) => row.components.map((button) => button.data.custom_id));
  assert.deepEqual(ids, [
    "sugar-commands:fun", "sugar-commands:pets", "sugar-commands:community",
    "sugar-commands:private", "sugar-commands:profile", "sugar-commands:moderation",
  ]);
});

test("each category exposes current command syntax and access requirements", () => {
  const cases = {
    fun: ["!fuck @member", "VIP-only", "!funhelp", "!vip stats"],
    pets: ["!pet adopt", "!pet buy <treat|toy|potion>", "!pet gif", "One pet per member"],
    community: ["!rep", "one active vote per person", "one conversation thread"],
    private: ["/priv-chat create", "/priv-chat rename", "/priv-chat delete"],
    profile: ["!profile", "!quote", "/fun help"],
    moderation: ["/mod-delete", "moderator permissions"],
  };
  for (const [category, phrases] of Object.entries(cases)) {
    const embed = buildCommandsCategoryEmbed(category);
    for (const phrase of phrases) assert.ok(embed.data.description.includes(phrase), category + " missing " + phrase);
  }
  assert.throws(() => buildCommandsCategoryEmbed("unknown"), /Unknown commands category/);
});
