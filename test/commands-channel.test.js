import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCommandsPanelPayload,
  COMMANDS_CHANNEL_NAME,
  COMMANDS_THREAD_NAME,
  isCommandsThread,
} from "../src/commands-channel.js";

test("commands board lists fun commands without mentioning the commands thread or reputation", () => {
  const payload = buildCommandsPanelPayload();
  assert.equal(payload.embeds.length, 1);
  assert.doesNotMatch(payload.embeds[0].data.description, /𝗰𝗼𝗺𝗺𝗮𝗻𝗱𝘀|thread/i);
  assert.match(payload.embeds[0].data.description, /!funhelp/);
  assert.doesNotMatch(payload.embeds[0].data.description, /!rep/i);
  assert.equal(COMMANDS_CHANNEL_NAME, "💬｜୨୧•𝓬𝓸𝓶𝓶𝓪𝓷𝓭𝓼");
  assert.equal(COMMANDS_THREAD_NAME, "💬 𝗰𝗼𝗺𝗺𝗮𝗻𝗱𝘀");
});

test("only messages in the dedicated commands thread are accepted", () => {
  const message = {
    guild: {},
    channel: {
      name: COMMANDS_THREAD_NAME,
      parent: { name: COMMANDS_CHANNEL_NAME },
      isThread: () => true,
    },
  };
  assert.equal(isCommandsThread(message), true);
  assert.equal(isCommandsThread({ ...message, channel: { ...message.channel, name: "general" } }), false);
  assert.equal(isCommandsThread({ ...message, channel: { ...message.channel, isThread: () => false } }), false);
});
