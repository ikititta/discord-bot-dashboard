import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { AutoModerationStore, detectMessageViolation } from "../src/moderation-system.js";

function message({ content = "", mentions = {}, channel = "general", roles = [] } = {}) {
  return {
    content,
    mentions: { users: { size: 0 }, roles: { size: 0 }, ...mentions },
    channel: { name: channel },
    member: { roles: { cache: { some: (callback) => roles.some(callback) } } },
  };
}

test("detects mass mentions", () => {
  assert.equal(detectMessageViolation(message({ mentions: { users: { size: 5 } } })), "mass mentions");
});

test("detects rapid repeated messages", () => {
  const current = message({ content: "same message" });
  const history = [{ content: "same message" }, { content: "same message" }];
  assert.equal(detectMessageViolation(current, history), "repeated messages");
});

test("detects message flooding", () => {
  const history = Array.from({ length: 4 }, (_, index) => ({ content: `message ${index}` }));
  assert.equal(detectMessageViolation(message({ content: "another message" }), history), "message spam");
});

test("blocks non-VIP promotions outside the assigned channel", () => {
  assert.equal(detectMessageViolation(message({ content: "Buy now https://example.com" })), "unauthorized promotion");
});

test("allows promotion links only for VIPs inside the assigned channel", () => {
  const vip = { id: "1568188640113463437", name: "Member" };
  const roles = [vip];
  assert.equal(detectMessageViolation(message({ content: "Buy now https://example.com", channel: "promotions", roles })), null);
  assert.equal(detectMessageViolation(message({ content: "Buy now https://example.com", channel: "general", roles })), "unauthorized promotion");
  assert.equal(detectMessageViolation(message({ content: "Buy now https://example.com", channel: "promotions" })), "unauthorized promotion");
});

test("persists three strikes and caps the counter", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sugar-automod-"));
  try {
    const store = new AutoModerationStore(directory);
    assert.equal(store.addStrike("guild1", "user1", "spam").count, 1);
    assert.equal(store.addStrike("guild1", "user1", "spam").count, 2);
    assert.equal(store.addStrike("guild1", "user1", "spam").count, 3);
    assert.equal(store.addStrike("guild1", "user1", "spam").count, 3);
    const restarted = new AutoModerationStore(directory);
    assert.equal(restarted.getStrikes("guild1", "user1"), 3);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});


test("VIP promotion exemption uses the configured VIP role ID, not a role name", () => {
  const byNameOnly = { name: "VIP" };
  const byId = { id: "1568188640113463437", name: "Member" };
  assert.equal(detectMessageViolation(message({ content: "Buy now", channel: "promotions", roles: [byNameOnly] })), "unauthorized promotion");
  assert.equal(detectMessageViolation(message({ content: "Buy now", channel: "promotions", roles: [byId] })), null);
});
