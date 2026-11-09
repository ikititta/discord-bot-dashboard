import test from "node:test";
import assert from "node:assert/strict";

import { buildTicketPanelPayload } from "../src/ticket-system.js";

test("support panel offers every category as a button", () => {
  const payload = buildTicketPanelPayload();
  const buttons = payload.components[0].toJSON().components;
  assert.deepEqual(buttons.map((item) => item.custom_id), [
    "sugar-ticket:category:general",
    "sugar-ticket:category:appeal",
    "sugar-ticket:category:roles",
    "sugar-ticket:category:technical",
    "sugar-ticket:category:other",
  ]);
  assert.ok(buttons.every((item) => item.type === 2));
  assert.ok(buttons.every((item) => item.style === 1));
  assert.ok(buttons.every((item) => item.label.endsWith(" ♡")));
});
