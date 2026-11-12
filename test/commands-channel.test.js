import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCommandsPanelPayload,
  buildCommandsThreadGuidePayload,
  COMMANDS_CHANNEL_ID,
  COMMANDS_CHANNEL_NAME,
  COMMANDS_THREAD_NAME,
  isCommandsThread,
} from "../src/commands-channel.js";

test("commands board is designed to live in Reputation and creates a thread from its embed", () => {
  const payload = buildCommandsPanelPayload();
  assert.equal(payload.embeds.length, 1);
  assert.match(payload.embeds[0].data.description, /All reputation commands are listed inside the thread/);
  assert.doesNotMatch(payload.embeds[0].data.description, /!fun|!rep/);
  const guide = buildCommandsThreadGuidePayload();
  const guideText = guide.embeds[0].data.description;
  for (const command of ["!rep", "!rep @member", "!rep stats", "!rep stats @member", "!rep top", "!rep comments [@member]"]) {
    assert.ok(guideText.includes(command), `missing reputation command: ${command}`);
  }
  assert.doesNotMatch(guideText, /!fun|!pet/);
  assert.equal(COMMANDS_CHANNEL_NAME, "reputation");
  assert.equal(COMMANDS_THREAD_NAME, "💬 𝗰𝗼𝗺𝗺𝗮𝗻𝗱𝘀");
});

test("only the commands thread under Reputation is accepted for rep commands", () => {
  const message = {
    guild: {},
    channel: {
      name: COMMANDS_THREAD_NAME,
      parentId: COMMANDS_CHANNEL_ID,
      isThread: () => true,
    },
  };
  assert.equal(isCommandsThread(message), true);
  assert.equal(isCommandsThread({ ...message, channel: { ...message.channel, parentId: "different-channel-id" } }), false);
  assert.equal(isCommandsThread({ ...message, channel: { ...message.channel, isThread: () => false } }), false);
});
