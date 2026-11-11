import test from "node:test";
import assert from "node:assert/strict";

import { mergeApplicationCommands } from "../src/command-registry.js";

test("retired role commands are removed while other Sugar commands remain registered", () => {
  const existing = [
    { id: "one", name: "roles-organize", type: 1 },
    { id: "two", name: "roles-audit", type: 1 },
    { id: "three", name: "tickets", type: 1 },
    { id: "four", name: "quote", type: 1 },
  ];

  const merged = mergeApplicationCommands(existing, [], ["roles-organize", "roles-audit"]);

  assert.deepEqual(merged.map(({ name }) => name), ["tickets", "quote"]);
});

test("retired role command cleanup preserves other features' owned commands", () => {
  const existing = [
    { id: "one", name: "roles-organize", type: 1 },
    { id: "two", name: "roles-audit", type: 1 },
    { id: "three", name: "tickets", type: 1 },
  ];
  const owned = [{ name: "private-chat", type: 1 }];

  const merged = mergeApplicationCommands(existing, owned, ["roles-organize", "roles-audit"]);

  assert.deepEqual(merged.map(({ name }) => name), ["tickets", "private-chat"]);
});
