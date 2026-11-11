import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { CommunityStore } from "../src/community-store.js";
import {
  buildConfessionsPanelPayload,
  buildLoveLettersPanelPayload,
  buildSuggestionsPanelPayload,
  buildSuggestionComponents,
  buildSuggestionModePicker,
  buildLoveLetterRecipientPicker,
  buildConfessionRecipientPicker,
  buildPublicationModePicker,
  buildPublicationRecipientPicker,
  buildCommunityPostComponents,
  buildCommunityRepliesChannelName,
  buildLoveLetterReplyComponents,
  buildCommunityThreadReplyComponents,
  buildThreadReplyModePicker,
  buildReplyModePicker,
  buildConfessionModePicker,
  buildReportNotificationPayload,
  REPORT_NOTIFICATION_ROLE_IDS,
} from "../src/community-system.js";
import { buildTicketPanelPayload } from "../src/ticket-system.js";

test("community counters persist and increment independently", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sugar-community-"));
  try {
    const first = new CommunityStore(dir);
    assert.equal(first.nextNumber("confessions:channel"), 1);
    assert.equal(first.nextNumber("confessions:channel"), 2);
    assert.equal(first.nextNumber("letters:channel"), 1);
    const restarted = new CommunityStore(dir);
    assert.equal(restarted.nextNumber("confessions:channel"), 3);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("community store refuses to overwrite corrupt state", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sugar-community-"));
  try {
    fs.writeFileSync(path.join(dir, "community-state.json"), "{broken");
    assert.throws(() => new CommunityStore(dir), /invalid JSON/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("confessions panel offers anonymous, named, and poll actions", () => {
  const payload = buildConfessionsPanelPayload();
  const buttons = payload.components[0].toJSON().components;
  assert.deepEqual(buttons.map((item) => item.custom_id), [
    "sugar-community:confess-start",
    "sugar-community:poll-start",
  ]);
  assert.ok(buttons.every((item) => !item.label.toLowerCase().includes("with my name")));
  assert.equal(buttons[1].label, "Create Poll ♡");
  assert.equal(buttons[1].style, 2);
  assert.equal(payload.embeds[0].toJSON().title, "୨୧ 𝒄𝒐𝒏𝒇𝒆𝒔𝒔ions ♡");
});

test("Suggestions panel offers anonymous or named submissions and native vote/report reactions", () => {
  const panel = buildSuggestionsPanelPayload();
  assert.equal(panel.embeds[0].toJSON().title, "୨୧ Suggestions ♡");
  assert.equal(panel.components[0].toJSON().components[0].custom_id, "sugar-community:suggestion-start");
  const modes = buildSuggestionModePicker();
  assert.equal(modes.ephemeral, true);
  assert.deepEqual(modes.components[0].toJSON().components.map((item) => item.label), ["Anonymously ♡", "With My Name ♡"]);
  assert.deepEqual(buildSuggestionComponents(), []);
  const source = fs.readFileSync(new URL("../src/community-system.js", import.meta.url), "utf8");
  assert.match(source, /for \(const emoji of \["⬆️", "⬇️", "⚠️"\]\)/);
  assert.match(source, /sendSuggestionReactionReport/);
});
test("love letters panel offers anonymous and named public submissions", () => {
  const payload = buildLoveLettersPanelPayload();
  const buttons = payload.components[0].toJSON().components;
  assert.deepEqual(buttons.map((item) => item.custom_id), [
    "sugar-community:letter:anonymous",
    "sugar-community:letter:named",
  ]);
});

test("love letter starts by privately asking for one recipient", () => {
  const payload = buildLoveLetterRecipientPicker("anonymous");
  assert.match(payload.content, /who would you like to tag/i);
  const picker = payload.components[0].toJSON().components[0];
  assert.equal(picker.type, 5);
  assert.equal(picker.custom_id, "sugar-community:letter-recipient:anonymous");
  assert.equal(picker.min_values, 1);
  assert.equal(picker.max_values, 1);
});

test("confession and poll mode pickers use two buttons for anonymous or named posting", () => {
  for (const kind of ["confess", "poll"]) {
    const payload = buildPublicationModePicker(kind);
    const buttons = payload.components[0].toJSON().components;
    assert.deepEqual(buttons.map((item) => item.custom_id), [
      `sugar-community:publication-mode:${kind}:anonymous`,
      `sugar-community:publication-mode:${kind}:named`,
    ]);
    assert.deepEqual(buttons.map((item) => item.label), ["Anonymously ♡", "With My Name ♡"]);
    assert.ok(buttons.every((item) => item.type === 2));
  }
});

test("confession and poll recipient pickers allow tagging someone or skipping", () => {
  for (const kind of ["confess", "poll"]) {
    const payload = buildPublicationRecipientPicker(kind, "named");
    assert.match(payload.content, /optional/i);
    assert.equal(payload.components[0].toJSON().components[0].custom_id,
      `sugar-community:publication-recipient:${kind}:named`);
    assert.equal(payload.components[1].toJSON().components[0].custom_id,
      `sugar-community:publication-skip:${kind}:named`);
  }
});

test("Love Letters posts use green Reply and red Report buttons with an empty heart", () => {
  const letterButtons = buildCommunityPostComponents("letter", "123456789012345678")[0].toJSON().components;
  assert.equal(letterButtons[0].style, 3);
  assert.equal(letterButtons[0].label, "Reply ♡");
  assert.equal(letterButtons.at(-1).style, 4);
  assert.equal(letterButtons.at(-1).label, "Report ♡");

  const confessionButtons = buildCommunityPostComponents("confession", "123456789012345678")[0].toJSON().components;
  assert.equal(confessionButtons[0].style, 3);
  assert.equal(confessionButtons[0].label, "Reply ♡");
  assert.equal(confessionButtons.at(-1).style, 4);
  assert.equal(confessionButtons.at(-1).label, "Report ♡");
});

test("Confession and Love Letter thread replies show green Reply before red Report", () => {
  for (const kind of ["confession", "letter"]) {
    const buttons = buildCommunityThreadReplyComponents(kind, "123456789012345678")[0].toJSON().components;
    assert.deepEqual(buttons.map((item) => item.label), ["Reply ♡", "Report ♡"]);
    assert.deepEqual(buttons.map((item) => item.style), [3, 4]);
    assert.deepEqual(buttons.map((item) => item.custom_id), [
      `sugar-community:thread-reply:${kind}:123456789012345678`,
      `sugar-community:report:${kind}-reply:123456789012345678`,
    ]);
  }
});

test("thread reply picker preserves anonymous and named choices", () => {
  for (const kind of ["confession", "letter"]) {
    const buttons = buildThreadReplyModePicker(kind, "123456789012345678").components[0].toJSON().components;
    assert.deepEqual(buttons.map((item) => item.label), ["Anonymously ♡", "With My Name ♡"]);
    assert.ok(buttons.every((item) => item.custom_id.includes(`:${kind}:`)));
  }
});

test("named thread replies show who replied to whom only when both are named", async () => {
  const source = (await import("node:fs")).readFileSync(new URL("../src/community-system.js", import.meta.url), "utf8");
  assert.match(source, /function formatReplyDescription/);
  assert.match(source, /if \(replyName && targetName\)/);
  assert.match(source, /replied to/);
});

test("legacy standalone confess picker now opens two anonymous-or-named buttons", () => {
  const payload = buildConfessionModePicker();
  const buttons = payload.components[0].toJSON().components;
  assert.deepEqual(buttons.map((item) => item.custom_id), [
    "sugar-community:publication-mode:confess:anonymous",
    "sugar-community:publication-mode:confess:named",
  ]);
  assert.ok(buttons.every((item) => item.type === 2));
});

test("confession and love letter replies use public text channel names with their post numbers", () => {
  assert.equal(
    buildCommunityRepliesChannelName("confession", "001"),
    "🤫｜୨୧・𝓬𝓸𝓷𝓯𝓮𝓼𝓼𝓲𝓸𝓷-001-𝓻𝓮𝓹𝓵𝓲𝓮𝓼",
  );
  assert.equal(
    buildCommunityRepliesChannelName("letter", "012"),
    "💌｜୨୧・𝓵𝓸𝓿𝓮-𝓵𝓮𝓽𝓽𝓮𝓻-012-𝓻𝓮𝓹𝓵𝓲𝓮𝓼",
  );
  assert.throws(() => buildCommunityRepliesChannelName("poll", "001"), /Invalid/);
  const source = fs.readFileSync(new URL("../src/community-system.js", import.meta.url), "utf8");
  assert.match(source, /guild\.channels\\.create\\(/);
  assert.doesNotMatch(source, /channel\.threads\\.fetch\\(parent\\.id/);
  assert.doesNotMatch(source, /parent\.startThread\\(/);
});

test("community post reply picker offers anonymous and named thread replies", () => {
  const payload = buildReplyModePicker("confession", "123456789012345678");
  const buttons = payload.components[0].toJSON().components;
  assert.deepEqual(buttons.map((item) => item.label), ["Anonymously ♡", "With My Name ♡"]);
  assert.ok(buttons.every((item) => item.custom_id.includes(":123456789012345678")));
});

test("support panel places Get Verified beside the first four ticket categories", () => {
  const payload = buildTicketPanelPayload();
  const buttons = payload.components[0].toJSON().components;
  assert.deepEqual(buttons.map((item) => item.custom_id), [
    "sugar-ticket:category:general",
    "sugar-ticket:category:buy-vip",
    "sugar-ticket:category:partnership",
    "sugar-ticket:category:apply",
    "sugar-ticket:get-verified",
  ]);
  assert.ok(buttons.every((item) => item.type === 2));
});


test("community reports ping all configured moderation roles without broad mentions", () => {
  const embed = { toJSON: () => ({ title: "Community Report" }) };
  const payload = buildReportNotificationPayload(embed);
  assert.equal(payload.content, REPORT_NOTIFICATION_ROLE_IDS.map((id) => `<@&${id}>`).join(" "));
  assert.deepEqual(payload.allowedMentions, {
    parse: [],
    roles: [
      "1567796193268858950",
      "1568188570890403910",
      "1568188595171500123",
    ],
  });
  assert.deepEqual(payload.embeds, [embed]);
});


test("suggestions publish with native upvote, downvote, and report reactions", async () => {
  const source = fs.readFileSync(new URL("../src/community-system.js", import.meta.url), "utf8");
  const publish = source.slice(source.indexOf("async function publishSuggestion"), source.indexOf("async function handleSuggestionReaction"));
  assert.match(publish, /await addSuggestionReactions\(message\)/);
  assert.doesNotMatch(publish, /components:/);
  assert.match(source, /emoji === "⚠️"/);
  assert.match(source, /sendSuggestionReactionReport/);
});
test("suggestion publication mode is validated and suggestion embeds omit timestamps", () => {
  const source = fs.readFileSync(new URL("../src/community-system.js", import.meta.url), "utf8");
  assert.match(source, /suggestion:submit:\$\{mode\}/);
  assert.match(source, /if \(mode === "named"\)/);
  const publish = source.slice(source.indexOf("async function publishSuggestion"), source.indexOf("async function handleSuggestionReaction"));
  assert.doesNotMatch(publish, /\.setTimestamp\(\)/);
  assert.doesNotMatch(publish, /Upvotes|Downvotes|Reports/);
  assert.match(source, /Suggestions can receive upvotes and downvotes/);
});
