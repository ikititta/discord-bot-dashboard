import test from "node:test";
import assert from "node:assert/strict";
import { toRoyalBold } from "../src/embed-format.js";

import {
  applyNewRoleVisibility,
  assignMemberAccess,
  canNewRoleViewChannel,
  NEW_USER_VISIBLE_CATEGORY_ID,
  buildAccessPanelPayload,
  buildGuidePayload,
  buildRulesPayload,
  normalizeName,
  isServerBooster,
  syncBoosterRole,
  BOOSTER_ROLE_NAME,
  BOOSTER_ROLE_COLOR,
} from "../src/access-system.js";

function createMember(initialRoles = []) {
  const cache = new Map(initialRoles.map((role) => [role.id, role]));
  const calls = [];
  return {
    calls,
    roles: {
      cache: {
        has: (id) => cache.has(id),
      },
      async add(role) {
        calls.push(["add", role.id]);
        cache.set(role.id, role);
      },
      async remove(role) {
        calls.push(["remove", role.id]);
        cache.delete(role.id);
      },
    },
  };
}

test("normalizes styled and spaced channel and role names", () => {
  assert.equal(normalizeName("Get Access"), "getaccess");
  assert.equal(normalizeName("🖋️｜୨୧•𝓺𝓾𝓸𝓽𝓮𝓼"), "quotes");
});

test("New role can only view the configured category and its child channels", () => {
  assert.equal(canNewRoleViewChannel({ id: NEW_USER_VISIBLE_CATEGORY_ID }), true);
  assert.equal(canNewRoleViewChannel({ id: "child", parentId: NEW_USER_VISIBLE_CATEGORY_ID }), true);
  assert.equal(canNewRoleViewChannel({ id: "other-category" }), false);
  assert.equal(canNewRoleViewChannel({ id: "other-channel", parentId: "other-category" }), false);
  assert.equal(canNewRoleViewChannel({ id: "uncategorized" }), false);
});

test("applies New-role visibility without breaking synced category permissions", async () => {
  const calls = [];
  const makeChannel = (id, type, parentId = null, permissionsLocked = false) => ({
    id,
    type,
    parentId,
    permissionsLocked,
    permissionOverwrites: {
      edit: async (_role, permissions) => calls.push([id, permissions.ViewChannel]),
    },
  });
  const target = makeChannel(NEW_USER_VISIBLE_CATEGORY_ID, 4);
  const targetSyncedChild = makeChannel("target-synced", 0, NEW_USER_VISIBLE_CATEGORY_ID, true);
  const targetUnsyncedChild = makeChannel("target-unsynced", 0, NEW_USER_VISIBLE_CATEGORY_ID, false);
  const other = makeChannel("other-category", 4);
  const otherSyncedChild = makeChannel("other-synced", 0, "other-category", true);
  const otherUnsyncedChild = makeChannel("other-unsynced", 0, "other-category", false);
  const uncategorized = makeChannel("uncategorized", 0);
  const thread = { id: "thread", parentId: NEW_USER_VISIBLE_CATEGORY_ID, isThread: () => true };
  const channels = [target, targetSyncedChild, targetUnsyncedChild, other, otherSyncedChild, otherUnsyncedChild, uncategorized, thread];
  const guild = { channels: { cache: { get: (id) => channels.find((channel) => channel.id === id), values: () => channels.values() } } };

  assert.equal(await applyNewRoleVisibility(guild, { id: "new" }), true);
  assert.deepEqual(calls, [
    [NEW_USER_VISIBLE_CATEGORY_ID, true],
    ["target-unsynced", true],
    ["other-category", false],
    ["other-unsynced", false],
    ["uncategorized", false],
  ]);
});

test("does not change permissions if the configured visible category is missing", async () => {
  let edits = 0;
  const guild = { channels: { cache: { get: () => null, values: () => [ { permissionOverwrites: { edit: async () => edits++ } } ] } } };
  assert.equal(await applyNewRoleVisibility(guild, { id: "new" }), false);
  assert.equal(edits, 0);
});

test("verification adds Member and removes New", async () => {
  const newRole = { id: "new" };
  const memberRole = { id: "member" };
  const member = createMember([newRole]);

  assert.equal(await assignMemberAccess(member, { newRole, memberRole }), true);
  assert.deepEqual(member.calls, [["add", "member"], ["remove", "new"]]);
  assert.equal(member.roles.cache.has("member"), true);
  assert.equal(member.roles.cache.has("new"), false);
});

test("verification is idempotent for an already verified member", async () => {
  const memberRole = { id: "member" };
  const member = createMember([memberRole]);
  assert.equal(await assignMemberAccess(member, { newRole: { id: "new" }, memberRole }), false);
  assert.deepEqual(member.calls, []);
});

test("verification refuses members without the New role", async () => {
  const member = createMember([]);
  await assert.rejects(
    assignMemberAccess(member, { newRole: { id: "new" }, memberRole: { id: "member" } }),
    /do not have the New role/,
  );
});

test("verification rolls back Member if removing New fails", async () => {
  const newRole = { id: "new" };
  const memberRole = { id: "member" };
  const member = createMember([newRole]);
  const remove = member.roles.remove;
  member.roles.remove = async (role, reason) => {
    if (role.id === "new") throw new Error("missing Manage Roles");
    return remove.call(member.roles, role, reason);
  };

  await assert.rejects(assignMemberAccess(member, { newRole, memberRole }), /Manage Roles/);
  assert.equal(member.roles.cache.has("member"), false);
  assert.equal(member.roles.cache.has("new"), true);
});

test("access, rules, and guide panels use one ordered, fully described channel directory", () => {
  const guild = { emojis: { cache: [] } };
  const access = buildAccessPanelPayload(guild);
  const rules = buildRulesPayload();
  const startCategory = { id: "1569548036055507055", name: "start", type: 4, rawPosition: 0 };
  const communityCategory = { id: "1569548036055507056", name: "community", type: 4, rawPosition: 1 };
  const privateCategory = { id: "1568179036520321035", name: "private chats", type: 4, rawPosition: 2 };
  const staffCategory = { id: "1568179036520321036", name: "staff", type: 4, rawPosition: 3 };
  const ticketCategory = { id: "1568179036520321037", name: "tickets", type: 4, rawPosition: 4 };
  const adminCategory = { id: "1568179036520321038", name: "admin", type: 4, rawPosition: 5 };
  const channelNames = ["get-access", "welcomes", "rules", "guide", "confessions", "loveletters", "suggestions", "reputation", "quotes", "selfies", "introductions", "pets", "support", "self-roles"];
  const channels = channelNames.map((name, index) => ({
    name,
    id: String(100000000000000000n + BigInt(index)),
    type: 0,
    parentId: index < 4 ? startCategory.id : communityCategory.id,
    rawPosition: index,
  }));
  const lobby = {
    id: "1568179043356901376",
    name: "private-chat-lobby",
    type: 0,
    parentId: privateCategory.id,
    rawPosition: 0,
  };
  const privateRoom = {
    id: "1568179043356901377",
    name: "👥｜୨୧・test-room",
    type: 0,
    parentId: privateCategory.id,
    rawPosition: 1,
  };
  const hiddenChannels = [
    { id: "1568179043356901380", name: "staff-chat", type: 0, parentId: staffCategory.id, rawPosition: 0 },
    { id: "1568179043356901381", name: "ticket-123", type: 0, parentId: ticketCategory.id, rawPosition: 0 },
    { id: "1568179043356901382", name: "admin-logs", type: 0, parentId: adminCategory.id, rawPosition: 0 },
  ];
  const allChannels = [startCategory, communityCategory, privateCategory, staffCategory, ticketCategory, adminCategory, ...channels, lobby, privateRoom, ...hiddenChannels];
  const guide = buildGuidePayload({
    channels: {
      cache: {
        find: (predicate) => allChannels.find(predicate),
        values: () => allChannels.values(),
      },
    },
  });

  assert.equal(access.embeds[0].data.title, `୨୧ ${toRoyalBold("Get Access!")} ♡`);
  assert.ok(access.embeds[0].data.description.includes("please read **Rules** & **Guide**"));
  assert.match(access.embeds[0].data.description, /read & agree/i);
  assert.match(access.embeds[0].data.description, /18 years of age or older/i);
  assert.equal(access.components[0].components[0].data.label, "Enter Server ♡");

  const ruleText = rules.embeds[0].data.description;
  assert.match(ruleText, /\$5 USD once, for life/);
  assert.match(ruleText, /Seller role is \*\*optional\*\*/);
  assert.match(ruleText, /virtual-pet extras/);
  assert.match(ruleText, /anonymous reputation posts/);
  assert.match(ruleText, /bulk deletion/);
  assert.match(ruleText, /a ban from Kittisugar/);
  assert.match(ruleText, /monthly hosting costs/);
  assert.match(ruleText, /NSFW content in NSFW channels/i);

  const guideText = guide.embeds[0].data.description;
  const directory = guide.embeds.slice(1).map((item) => item.data.description).join("\n");
  assert.equal(guide.embeds[0].data.title, `${toRoyalBold("Kittisugar Guide!")} 🎀`);
  assert.match(guideText, /`!commands` — explore all Sugar commands/);
  assert.match(guideText, /reply to someone's message with `!quote`/);
  assert.match(guideText, /`!smile` — try a fun interaction command/);
  assert.match(guideText, /#dashboard/);
  assert.equal((guide.embeds[0].data.title.match(/🎀/gu) ?? []).length, 1);
  assert.doesNotMatch(directory, /^\*\*୨୧ /m);
  assert.ok(directory.includes("• <#100000000000000000> — Start here:"));
  assert.ok(directory.includes("• <#100000000000000009> — Share your selfies"));
  assert.ok(directory.includes("• <#100000000000000010> — Introduce yourself"));
  assert.ok(directory.includes("• <#1568179043356901376> — Create a private chat room here"));
  assert.doesNotMatch(directory, /1568179043356901377/);
  assert.doesNotMatch(directory, /private chat room.*test-room/i);

  const lines = directory.split("\n").filter((line) => line.includes("<#"));
  assert.equal(lines.length, channels.length);
  for (const line of lines) {
    assert.match(line, /^• <#\d{17,20}> — .+$/);
  }
  assert.equal(new Set(lines.map((line) => line.match(/<#(\d+)>/)[1])).size, lines.length);
  assert.ok(guide.embeds.length >= 3 && guide.embeds.length <= 4);
  for (const item of guide.embeds.slice(1)) assert.equal((item.data.title.match(/🎀/gu) ?? []).length, 1);
  assert.doesNotMatch(directory, /<#\d+> — Use this channel for support/);
  assert.equal((guideText.match(/<#!?\d{17,20}>/g) ?? []).length, 0);
});
test("detects Discord server booster status", () => {
  assert.equal(isServerBooster({ premiumSinceTimestamp: 123, premiumSince: new Date(123) }), true);
  assert.equal(isServerBooster({ premiumSinceTimestamp: null, premiumSince: null }), false);
  assert.equal(BOOSTER_ROLE_NAME, "୨୧ 𝓑𝓸𝓸𝓼𝓽𝓮𝓻");
  assert.equal(BOOSTER_ROLE_COLOR, 0xff9ad5);
});

test("automatically adds and removes the custom Booster role as boost status changes", async () => {
  const role = { id: "booster" };
  const member = createMember([]);
  member.premiumSinceTimestamp = 123;
  assert.equal(await syncBoosterRole(member, role), true);
  assert.equal(member.roles.cache.has(role.id), true);
  assert.equal(await syncBoosterRole(member, role), false);
  member.premiumSinceTimestamp = null;
  assert.equal(await syncBoosterRole(member, role), true);
  assert.equal(member.roles.cache.has(role.id), false);
});
