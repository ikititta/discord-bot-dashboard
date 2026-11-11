import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { ReputationStore, makePanelPayload } from "../src/reputation-system.js";

function temporaryDirectory() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "sugar-reputation-"));
}

const guildId = "1567093019377930363";
const authorId = "1568188534836428812";
const targetId = "1568188640113463437";

test("reputation comments persist and contribute to the top ranking", () => {
  const directory = temporaryDirectory();
  try {
    const store = new ReputationStore(directory);
    store.add({ guildId, authorId, targetId, text: "Always kind and helpful ♡", anonymous: false });
    const restored = new ReputationStore(directory);
    assert.equal(restored.getForUser(guildId, targetId).length, 1);
    assert.deepEqual(restored.getTop(guildId), [{ userId: targetId, reputation: 1 }]);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("anonymous reputation keeps the author in private storage", () => {
  const directory = temporaryDirectory();
  try {
    const store = new ReputationStore(directory);
    store.add({ guildId, authorId, targetId, text: "A lovely member", anonymous: true });
    const [comment] = store.getForUser(guildId, targetId);
    assert.equal(comment.anonymous, true);
    assert.equal(comment.authorId, authorId);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("the same author can only review the same member once per 24 hours", () => {
  const directory = temporaryDirectory();
  try {
    const store = new ReputationStore(directory);
    store.add({ guildId, authorId, targetId, text: "First comment", anonymous: false });
    assert.throws(
      () => store.add({ guildId, authorId, targetId, text: "Second comment", anonymous: false }),
      /24 hours/,
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("reputation rejects self-reviews and invalid comment text", () => {
  const directory = temporaryDirectory();
  try {
    const store = new ReputationStore(directory);
    assert.throws(
      () => store.add({ guildId, authorId, targetId: authorId, text: "Self review", anonymous: false }),
      /Invalid reputation entry/,
    );
    assert.throws(
      () => store.add({ guildId, authorId, targetId, text: " ", anonymous: false }),
      /Invalid reputation entry/,
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("reputation votes can be positive or negative and one member can update their vote", () => {
  const directory = temporaryDirectory();
  try {
    const store = new ReputationStore(directory);
    assert.equal(store.vote({ guildId, authorId, targetId, value: 1 }), 1);
    assert.equal(store.getScore(guildId, targetId), 1);
    assert.equal(store.vote({ guildId, authorId, targetId, value: -1 }), -1);
    assert.equal(store.getScore(guildId, targetId), -1);
    assert.deepEqual(store.getTop(guildId), [{ userId: targetId, reputation: -1 }]);
    assert.throws(() => store.vote({ guildId, authorId, targetId: authorId, value: 1 }), /Invalid reputation vote/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});


test("reputation panel exposes only English positive and negative vote buttons", () => {
  const payload = makePanelPayload();
  const buttons = payload.components.flatMap((row) => row.toJSON().components);
  assert.deepEqual(buttons.map((button) => button.label), ["Give Positive", "Give Negative"]);
  assert.deepEqual(buttons.map((button) => button.style), [3, 4]);
  assert.doesNotMatch(payload.embeds[0].data.description, /Leave a Comment|Dar positiva|Dar negativa/i);
});
