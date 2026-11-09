import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { CommunityStore } from "../src/community-store.js";
import { buildConfessionsPanelPayload, buildLoveLettersPanelPayload } from "../src/community-system.js";
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
    "sugar-community:confess:anonymous",
    "sugar-community:confess:named",
    "sugar-community:poll",
  ]);
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

test("ticket panel offers the five support categories", () => {
  const payload = buildTicketPanelPayload();
  const options = payload.components[0].toJSON().components[0].options;
  assert.deepEqual(options.map((item) => item.value), ["general", "appeal", "roles", "technical", "other"]);
});
