import test from "node:test";
import assert from "node:assert/strict";
import { ChannelType, PermissionFlagsBits } from "discord.js";

import {
  FORUM_VISIBILITY_CATEGORY_ID,
  buildForumVisibilityPanelPayload,
  buildForumVisibilityPickerPayload,
  getCategoryForums,
} from "../src/forum-visibility.js";

function forum(id, name, { categoryId = FORUM_VISIBILITY_CATEGORY_ID, hidden = false } = {}) {
  const overwrite = hidden
    ? { deny: { has: (permission) => permission === PermissionFlagsBits.ViewChannel } }
    : null;
  return {
    id,
    name,
    type: ChannelType.GuildForum,
    parentId: categoryId,
    rawPosition: Number(id),
    permissionOverwrites: { cache: { get: (userId) => userId === "member-1" ? overwrite : null } },
  };
}

function guildWith(channels) {
  return { channels: { cache: { values: () => channels.values() } } };
}

test("forum visibility panel uses the Kittisugar pink embed and opens a personal selector", () => {
  const payload = buildForumVisibilityPanelPayload();
  assert.equal(payload.embeds[0].data.color, 0xffd9ff);
  assert.equal(payload.embeds[0].data.title, "୨୧ Forum Visibility ♡");
  assert.match(payload.embeds[0].data.description, /only affects your own view/i);
  assert.equal(payload.components[0].components[0].data.custom_id, "sugar-forum-visibility:open");
});

test("only forum channels directly inside the configured category are listed", () => {
  const channels = [
    forum("3", "music"),
    forum("1", "fandoms"),
    forum("2", "beauty", { categoryId: "another-category" }),
    { id: "4", name: "chat", type: ChannelType.GuildText, parentId: FORUM_VISIBILITY_CATEGORY_ID },
  ];
  assert.deepEqual(getCategoryForums(guildWith(channels)).map((channel) => channel.name), ["fandoms", "music"]);
});

test("picker marks the member's existing personal hides as selected", () => {
  const payload = buildForumVisibilityPickerPayload(
    guildWith([forum("1", "fandoms", { hidden: true }), forum("2", "music")]),
    "member-1",
  );
  const menu = payload.components[0].components[0].toJSON();
  assert.equal(menu.custom_id, "sugar-forum-visibility:apply");
  assert.equal(menu.min_values, 0);
  assert.equal(menu.max_values, 2);
  assert.deepEqual(menu.options.map((option) => option.default), [true, false]);
  assert.match(payload.embeds[0].data.description, /deselect them to show them again/i);
});

test("picker returns no panel when the category has no forum channels", () => {
  assert.equal(buildForumVisibilityPickerPayload(guildWith([]), "member-1"), null);
});

test("picker refuses to silently truncate categories larger than Discord's 25-option limit", () => {
  const channels = Array.from({ length: 26 }, (_, index) => forum(String(index + 1), `forum-${index + 1}`));
  assert.throws(
    () => buildForumVisibilityPickerPayload(guildWith(channels), "member-1"),
    /more than 25 forums/,
  );
});
