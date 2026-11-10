import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { SuggestionStore } from "../src/suggestion-store.js";

test("suggestion votes persist, switch direction, and toggle off", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sugar-suggestions-"));
  try {
    const store = new SuggestionStore(dir);
    assert.deepEqual(store.vote("123456789012345678", "223456789012345678", "up"), { up: 1, down: 0 });
    assert.deepEqual(store.vote("123456789012345678", "323456789012345678", "down"), { up: 1, down: 1 });
    assert.deepEqual(store.vote("123456789012345678", "223456789012345678", "down"), { up: 0, down: 2 });
    assert.deepEqual(store.vote("123456789012345678", "223456789012345678", "down"), { up: 0, down: 1 });

    const restarted = new SuggestionStore(dir);
    assert.deepEqual(restarted.counts("123456789012345678"), { up: 0, down: 1 });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("suggestion store rejects invalid votes and corrupt state", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sugar-suggestions-"));
  try {
    const store = new SuggestionStore(dir);
    assert.throws(() => store.vote("bad", "223456789012345678", "up"), /Invalid suggestion vote/);
    fs.writeFileSync(path.join(dir, "suggestion-votes.json"), "{broken");
    assert.throws(() => new SuggestionStore(dir), /invalid JSON/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("reaction votes set and remove one direction per member", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sugar-suggestion-votes-"));
  try {
    const store = new SuggestionStore(dir);
    const messageId = "123456789012345678";
    const userId = "223456789012345678";
    assert.deepEqual(store.setVote(messageId, userId, "up"), { up: 1, down: 0 });
    assert.deepEqual(store.setVote(messageId, userId, "down"), { up: 0, down: 1 });
    assert.deepEqual(store.removeVote(messageId, userId, "up"), { up: 0, down: 1 });
    assert.deepEqual(store.removeVote(messageId, userId, "down"), { up: 0, down: 0 });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
