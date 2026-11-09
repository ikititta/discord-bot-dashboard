import test from "node:test";
import assert from "node:assert/strict";

import { buildQuoteCard, wrapQuoteText } from "../src/quote-system.js";

test("quote text wraps to the available width", () => {
  const measurements = {
    measureText(value) { return { width: value.length * 10 }; },
  };
  assert.deepEqual(wrapQuoteText(measurements, "one two three four", 75), [
    "one two", "three", "four",
  ]);
});

test("quote card is generated as a PNG even if the avatar cannot be loaded", async () => {
  const image = await buildQuoteCard({
    authorName: "Kittisugar member",
    avatarUrl: "https://invalid.example/avatar.png",
    content: "A little quote worth keeping.",
  });
  assert.equal(image.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.ok(image.length > 10_000);
});
