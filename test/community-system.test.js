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
  buildLoveLetterRecipientPicker,
  buildConfessionRecipientPicker,
  buildPublicationModePicker,
  buildPublicationRecipientPicker,
  buildCommunityPostComponents,
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

test("Suggestions panel has a submission button and each suggestion has green up, red down, grey report", () => {
  const panel = buildSuggestionsPanelPayload();
  assert.equal(panel.embeds[0].toJSON().title, "୨୧ Suggestions ♡");
  assert.equal(panel.components[0].toJSON().components[0].custom_id, "sugar-community:suggestion-start");

  const buttons = buildSuggestionComponents("123456789012345678")[0].toJSON().components;
  assert.deepEqual(buttons.map((item) => item.label), ["↑", "↓", "⚑"]);
  assert.deepEqual(buttons.map((item) => item.style), [3, 4, 2]);
  assert.deepEqual(buttons.map((item) => item.custom_id), [
    "sugar-community:suggestion-vote:123456789012345678:up",
    "sugar-community:suggestion-vote:123456789012345678:down",
    "sugar-community:report:suggestion:123456789012345678",
  ]);
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

test("reply thread lookup fetches the thread by its starter message ID", () => {
  const source = fs.readFileSync(new URL("../src/community-system.js", import.meta.url), "utf8");
  assert.match(source, /channel\.threads\.fetch\(parent\.id, \{ force: true \}\)/);
  assert.doesNotMatch(source, /threads\.fetch\(\{\s*message:/);
});

test("community post reply picker offers anonymous and named thread replies", () => {
  const payload = buildReplyModePicker("confession", "123456789012345678");
  const buttons = payload.components[0].toJSON().components;
  assert.deepEqual(buttons.map((item) => item.label), ["Anonymously ♡", "With My Name ♡"]);
  assert.ok(buttons.every((item) => item.custom_id.includes(":123456789012345678")));
});

test("ticket panel offers the five support categories as buttons", () => {
  const payload = buildTicketPanelPayload();
  const buttons = payload.components[0].toJSON().components;
  assert.deepEqual(buttons.map((item) => item.custom_id), [
    "sugar-ticket:category:general",
    "sugar-ticket:category:appeal",
    "sugar-ticket:category:roles",
    "sugar-ticket:category:technical",
    "sugar-ticket:category:other",
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
