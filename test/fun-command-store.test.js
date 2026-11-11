import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { FunCommandStore } from "../src/fun-command-store.js";

function temporaryDirectory() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "sugar-fun-stats-"));
}

test("fun command statistics persist actor usage, received actions, and partners", () => {
  const directory = temporaryDirectory();
  try {
    const store = new FunCommandStore(directory);
    store.record({
      guildId: "1567093019377930363",
      actorId: "11111111111111111",
      targetId: "22222222222222222",
      command: "hug",
      actorRole: "female",
      targetRole: "male",
    });

    const reopened = new FunCommandStore(directory);
    const actor = reopened.getStats("1567093019377930363", "11111111111111111");
    const target = reopened.getStats("1567093019377930363", "22222222222222222");

    assert.equal(actor.total, 1);
    assert.equal(actor.commands.hug, 1);
    assert.equal(actor.partners["22222222222222222"], 1);
    assert.equal(actor.lastRole, "female");
    assert.equal(actor.lastTargetRole, "male");
    assert.equal(target.receivedTotal, 1);
    assert.equal(target.received.hug, 1);
    assert.equal(target.receivedFrom["11111111111111111"], 1);
    assert.equal(reopened.getGuildStats("1567093019377930363").length, 2);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("fun command store rejects invalid identifiers and commands", () => {
  const directory = temporaryDirectory();
  try {
    const store = new FunCommandStore(directory);
    assert.throws(() => store.record({
      guildId: "guild",
      actorId: "11111111111111111",
      command: "hug",
    }), /Invalid fun-command statistic input/);
    assert.throws(() => store.record({
      guildId: "1567093019377930363",
      actorId: "11111111111111111",
      command: "not a command",
    }), /Invalid fun-command statistic input/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("corrupt fun command state is never silently overwritten", () => {
  const directory = temporaryDirectory();
  try {
    fs.writeFileSync(path.join(directory, "fun-command-state.json"), "{broken");
    assert.throws(() => new FunCommandStore(directory), /invalid JSON/);
    assert.equal(fs.readFileSync(path.join(directory, "fun-command-state.json"), "utf8"), "{broken");
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
