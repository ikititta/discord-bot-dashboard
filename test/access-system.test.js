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

test("access, rules, and guide panels contain the required confirmations and updated guide", () => {
  const guild = { emojis: { cache: [] } };
  const access = buildAccessPanelPayload(guild);
  const rules = buildRulesPayload();
  const channelNames = ["get-access", "rules", "guide", "confessions", "loveletters", "suggestions", "quotes", "selfies", "introductions", "pets", "support", "private-chat", "self-roles"];
  const channels = channelNames.map((name, index) => ({ name, id: String(100000000000000000n + BigInt(index)), type: 0 }));
  const guide = buildGuidePayload({ channels: { cache: { find: (predicate) => channels.find(predicate), values: () => channels.values() } } });

  assert.equal(access.embeds[0].data.title, `୨୧ ${toRoyalBold("Get Access!")} ♡`);
  assert.ok(access.embeds[0].data.description.includes("please read **Rules** & **Guide**"));
  assert.doesNotMatch(access.embeds[0].data.description, /Rules and \*\*Guide\*\*/);
  assert.match(access.embeds[0].data.description, /read & agree/i);
  assert.match(access.embeds[0].data.description, /18 years of age or older/i);
  assert.equal(access.components[0].components[0].data.label, "Enter Server ♡");
  assert.equal(access.components[0].components[0].data.style, 1);
  const ruleText = rules.embeds[0].data.description;
  assert.match(ruleText, /\$5 USD once, for life/);
  assert.match(ruleText, /Seller role is \*\*optional\*\*/);\n  assert.match(ruleText, /virtual-pet extras/);\n  assert.match(ruleText, /anonymous reputation posts/);\n  assert.match(ruleText, /bulk deletion/);\n  assert.doesNotMatch(ruleText, /no ads/i);\n  assert.match(ruleText, /a ban from Kittisugar/);
  assert.match(ruleText, /monthly hosting costs/);
  assert.match(ruleText, /NSFW content in NSFW channels/i);
  assert.doesNotMatch(ruleText, /Porn category|nsfw.*category/i);
  assert.match(ruleText, /server boosts/i);
  for (const heading of ["01 · Respect", "02 · Content", "03 · Promotions & Selling", "04 · Warnings", "05 · Support Kittisugar"]) {
    assert.ok(ruleText.includes(`## ${toRoyalBold(heading)}`), `missing fancy Rules heading: ${heading}`);
  }
  assert.doesNotMatch(ruleText, /\n\n##/);

  const guideText = guide.embeds[0].data.description;
  assert.equal(guide.embeds[0].data.title, `୨୧ ${toRoyalBold("Kittisugar Guide!")} ♡`);
  assert.match(guideText, /A little guide of Kittisugar/);
  assert.doesNotMatch(guideText, /\n\n(?:## )?୨୧/);
  for (const title of ["Start", "Community", "Help", "Commands", "Sugar AI"]) {
    assert.ok(guideText.includes(`## ୨୧ ${toRoyalBold(title)}`), `missing large guide heading: ${title}`);
  }
  assert.equal((guideText.match(/• <#\d{18}>/g) ?? []).length, 10);
  assert.ok(guideText.includes(`## ୨୧ ${toRoyalBold("Start")}\n\n• <#100000000000000000>\nRead the welcome message`));
  assert.ok(guideText.includes("`/delete amount:` — delete your own recent messages."));
  assert.ok(guideText.includes("`/vip-delete amount:` — VIP message cleanup."));
  assert.ok(guideText.includes("`/mod-delete amount: [member:]` — moderator cleanup."));
  assert.match(guideText, /!pet adopt/);
  assert.match(guideText, /!pet room/);
  assert.match(guideText, /!rep anonymous/);
  assert.match(guideText, /selfies/);
  assert.match(guideText, /introductions/);
  assert.match(guideText, /pets/);\n  assert.match(guideText, /!pet adopt/);\n  assert.match(guideText, /!pet room/);\n  assert.match(guideText, /!rep anonymous/);\n  assert.match(guideText, /selfies/);\n  assert.match(guideText, /introductions/);\n  assert.match(guideText, /pets/);
  assert.ok(guideText.includes("`!quote` — reply to a message with !quote to create an image quote."));
  assert.ok(guideText.includes("`/priv-chat create|add|remove|rename|leave|delete|commands` — manage your private chat."));
  assert.match(guideText, /show or hide channels/i);
  assert.match(guide.embeds[0].data.footer.text, /This guide is also pinned in dashboard/);
  assert.doesNotMatch(guideText, /pinned in #dashboard/);
  assert.ok(guideText.includes("`/delete amount:` — delete your own recent messages.\n`/vip-delete amount:` — VIP message cleanup.\n`/mod-delete amount: [member:]` — moderator cleanup."));
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
