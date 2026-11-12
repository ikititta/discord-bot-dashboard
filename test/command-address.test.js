import test from "node:test";
import assert from "node:assert/strict";
import { extractAddressedCommand } from "../src/command-address.js";

const bot = { id: "123456789012345678", username: "SugarBot" };

test("commands require the bot mention, Sugar, or the bot username", () => {
  assert.equal(extractAddressedCommand({ content: "!hug @member" }, bot), null);
  assert.equal(extractAddressedCommand({ content: "sugar !hug @member" }, bot), "!hug @member");
  assert.equal(extractAddressedCommand({ content: "!hug @member Sugar" }, bot), "!hug @member");
  assert.equal(extractAddressedCommand({ content: "<@123456789012345678> !stats" }, bot), "!stats");
  assert.equal(extractAddressedCommand({ content: "SugarBot, !quote" }, bot), "!quote");
  assert.equal(extractAddressedCommand({ content: "!stats for sugar cookies" }, bot), "!stats for cookies");
});

test("address matching is case-insensitive and does not match parts of other words", () => {
  assert.equal(extractAddressedCommand({ content: "SUGAR !dance" }, bot), "!dance");
  assert.equal(extractAddressedCommand({ content: "!sugarcoat" }, bot), null);
  assert.equal(extractAddressedCommand({ content: "!hug @member SugarBot" }, bot), "!hug @member");
});
