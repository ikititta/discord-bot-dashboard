import test from "node:test";
import assert from "node:assert/strict";

import { buildTicketPanelPayload, SUGGESTIONS_CHANNEL_ID } from "../src/ticket-system.js";

test("support panel uses the requested title, English guidance, and suggestions mention", () => {
  const payload = buildTicketPanelPayload();
  const embed = payload.embeds[0].toJSON();

  assert.equal(embed.title, "𝑺𝒖𝒑𝒑𝒐𝒓𝒕 🎀");
  assert.match(embed.description, /Need help with something\?/);
  assert.match(embed.description, /\*\*General Help\*\*/);
  assert.match(embed.description, /\*\*Error\*\*/);
  assert.match(embed.description, /\*\*Report\*\*/);
  assert.match(embed.description, /\*\*Appeal\*\*/);
  assert.match(embed.description, /\*\*Partnership\*\*/);
  assert.match(embed.description, /\*\*Apply\*\* — Apply to become a member of our staff team\./);
  assert.match(embed.description, /\*\*Other\*\*/);
  assert.ok(embed.description.endsWith(`<#${SUGGESTIONS_CHANNEL_ID}>!`));
});

test("support panel offers seven categorized buttons with appropriate Discord styles", () => {
  const payload = buildTicketPanelPayload();
  assert.equal(payload.components.length, 2);

  const buttons = payload.components.flatMap((row) => row.toJSON().components);
  assert.deepEqual(buttons.map((item) => item.custom_id), [
    "sugar-ticket:category:general",
    "sugar-ticket:category:error",
    "sugar-ticket:category:report",
    "sugar-ticket:category:appeal",
    "sugar-ticket:category:partnership",
    "sugar-ticket:category:apply",
    "sugar-ticket:category:other",
  ]);
  assert.deepEqual(buttons.map((item) => item.label), [
    "General Help ♡",
    "Error ♡",
    "Report ♡",
    "Appeal ♡",
    "Partnership ♡",
    "Apply ♡",
    "Other ♡",
  ]);
  assert.deepEqual(buttons.map((item) => item.style), [1, 2, 2, 4, 1, 3, 2]);
  assert.ok(payload.components.every((row) => row.toJSON().components.length <= 5));
});
