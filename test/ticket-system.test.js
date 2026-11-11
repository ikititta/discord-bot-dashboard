import test from "node:test";
import assert from "node:assert/strict";

import { buildTicketPanelPayload, buildTicketCreatedPayload, SUGGESTIONS_CHANNEL_ID, TICKET_CATEGORY_ID, TICKET_TRANSCRIPTS_CHANNEL_ID } from "../src/ticket-system.js";

test("support panel uses the requested title, English guidance, and suggestions mention", () => {
  const payload = buildTicketPanelPayload();
  const embed = payload.embeds[0].toJSON();

  assert.equal(embed.title, "𝓢𝓾𝓹𝓹𝓸𝓻𝓽 🎀");
  assert.match(embed.description, /Need help with something\?/);
  assert.match(embed.description, /\*\*General\*\*/);
  assert.match(embed.description, /\*\*Error\*\*/);
  assert.match(embed.description, /\*\*Report\*\*/);
  assert.match(embed.description, /\*\*Appeal\*\*/);
  assert.match(embed.description, /\*\*Partnership\*\*/);
  assert.match(embed.description, /\*\*Apply\*\* — Apply to become a member of our staff team\./);
  assert.match(embed.description, /\*\*Others\*\*/);
  assert.match(embed.description, /\*\*Buy VIP\*\* — Questions about purchasing VIP or getting VIP access\./);
  assert.ok(embed.description.endsWith(`<#${SUGGESTIONS_CHANNEL_ID}>!`));
});

test("support panel orders blue, green, red, and gray buttons and includes verification", () => {
  const payload = buildTicketPanelPayload();
  assert.equal(payload.components.length, 2);
  assert.deepEqual(payload.components.map((row) => row.toJSON().components.length), [5, 4]);

  const buttons = payload.components.flatMap((row) => row.toJSON().components);
  assert.deepEqual(buttons.map((item) => item.custom_id), [
    "sugar-ticket:category:general",
    "sugar-ticket:category:buy-vip",
    "sugar-ticket:category:partnership",
    "sugar-ticket:category:apply",
    "sugar-ticket:get-verified",
    "sugar-ticket:category:report",
    "sugar-ticket:category:appeal",
    "sugar-ticket:category:error",
    "sugar-ticket:category:other",
  ]);
  assert.deepEqual(buttons.map((item) => item.label), [
    "General ♡",
    "Buy VIP ♡",
    "Partnership ♡",
    "Apply ♡",
    "Get Verified ♡",
    "Report ♡",
    "Appeal ♡",
    "Error ♡",
    "Others ♡",
  ]);
  assert.deepEqual(buttons.map((item) => item.style), [1, 1, 3, 3, 3, 4, 4, 4, 2]);
  assert.ok(payload.components.every((row) => row.toJSON().components.length <= 5));
});

test("new tickets use the configured category and transcript destinations", () => {
  assert.equal(TICKET_CATEGORY_ID, "1569529041017503784");
  assert.equal(TICKET_TRANSCRIPTS_CHANNEL_ID, "1569529377102766131");
});

test("ticket controls include close and blue add-people buttons with empty hearts", () => {
  const payload = buildTicketCreatedPayload("123456789012345", "General");
  const embed = payload.embeds[0].toJSON();
  const buttons = payload.components[0].toJSON().components;

  assert.doesNotMatch(embed.description, /keep all relevant details/i);
  assert.deepEqual(buttons.map((button) => button.label), ["Close Ticket ♡", "Add People ♡"]);
  assert.deepEqual(buttons.map((button) => button.style), [4, 1]);
});
