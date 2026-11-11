import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCommandsPanelPayload,
  COMMANDS_CHANNEL_NAME,
  COMMANDS_THREAD_NAME,
  isCommandsThread,
} from "../src/commands-channel.js";

test("commands board is designed to live in Reputation and creates a thread from its embed", () => {
  const payload = buildCommandsPanelPayload();
  assert.equal(payload.embeds.length, 1);
  assert.match(payload.embeds[0].data.description, /!funhelp/);
  assert.match(payload.embeds[0].data.description, /!rep/);
  assert.equal(COMMANDS_CHANNEL_NAME, "reputation");
  assert.equal(COMMANDS_THREAD_NAME, "💬 𝗰𝗼𝗺𝗺𝗮𝗻𝗱𝘀");
});

test("only the commands thread under Reputation is accepted for rep commands", () => {
  const message = {
    guild: {},
    channel: {
      name: COMMANDS_THREAD_NAME,
      parent: { name: "reputation" },
      isThread: () => true,
    },
  };
  assert.equal(isCommandsThread(message), true);
  assert.equal(isCommandsThread({ ...message, channel: { ...message.channel, parent: { name: "general" } } }), false);
  assert.equal(isCommandsThread({ ...message, channel: { ...message.channel, isThread: () => false } }), false);
});
