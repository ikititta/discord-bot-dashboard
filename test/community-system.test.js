import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { CommunityStore } from "../src/community-store.js";
import {
  buildConfessionsPanelPayload,
  buildLoveLettersPanelPayload,
  buildLoveLetterRecipientPicker,
  buildConfessionRecipientPicker,
  buildPublicationModePicker,
  buildPublicationRecipientPicker,
  buildCommunityPostComponents,
  buildReplyModePicker,
  buildConfessionModePicker,
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
  assert.equal(buttons[1].label, "Create a Poll ♡");
  assert.equal(buttons[1].style, 2);
  assert.equal(payload.embeds[0].toJSON().title, "୨୧ 𝒄𝒐𝒏𝒇𝒆𝒔𝒔ions ♡");
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

test("legacy standalone confess picker now opens two anonymous-or-named buttons", () => {
  const payload = buildConfessionModePicker();
  const buttons = payload.components[0].toJSON().components;
  assert.deepEqual(buttons.map((item) => item.custom_id), [
    "sugar-community:publication-mode:confess:anonymous",
    "sugar-community:publication-mode:confess:named",
  ]);
  assert.ok(buttons.every((item) => item.type === 2));
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
