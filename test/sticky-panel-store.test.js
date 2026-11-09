import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { StickyPanelStore } from "../src/sticky-panel-store.js";

test("sticky panel message IDs persist across restarts", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sugar-sticky-"));
  try {
    const first = new StickyPanelStore(dir);
    assert.equal(first.get("confessions"), null);
    first.set("confessions", "123456789012345678");
    first.set("tickets", "223456789012345678");
    const restarted = new StickyPanelStore(dir);
    assert.equal(restarted.get("confessions"), "123456789012345678");
    assert.equal(restarted.get("tickets"), "223456789012345678");
    restarted.set("confessions", null);
    assert.equal(new StickyPanelStore(dir).get("confessions"), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("sticky panel store rejects invalid IDs and keys", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sugar-sticky-"));
  try {
    const store = new StickyPanelStore(dir);
    assert.throws(() => store.get("../settings"), /Invalid sticky panel key/);
    assert.throws(() => store.set("confessions", "not-a-snowflake"), /valid Discord message ID/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("sticky panel store refuses to overwrite corrupt state", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sugar-sticky-"));
  try {
    fs.writeFileSync(path.join(dir, "sticky-panels.json"), "{broken");
    assert.throws(() => new StickyPanelStore(dir), /invalid JSON/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
