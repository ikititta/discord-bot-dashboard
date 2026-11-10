import test from "node:test";
import assert from "node:assert/strict";
import { toRoyalBold } from "../src/embed-format.js";

import {
  assignMemberAccess,
  buildAccessPanelPayload,
  buildGuidePayload,
  buildRulesPayload,
  normalizeName,
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
  const channelNames = ["get-access", "rules", "guide", "confessions", "loveletters", "suggestions", "quotes", "support", "private-chat", "self-roles"];
  const channels = channelNames.map((name, index) => ({ name, id: String(100000000000000000n + BigInt(index)), type: 0 }));
  const guide = buildGuidePayload({ channels: { cache: { find: (predicate) => channels.find(predicate) } } });

  assert.match(access.embeds[0].data.description, /read and agree/i);
  assert.match(access.embeds[0].data.description, /18 years of age or older/i);
  assert.equal(access.components[0].components[0].data.label, "Enter Server ♡");
  assert.equal(access.components[0].components[0].data.style, 1);
  const ruleText = rules.embeds[0].data.description;
  assert.match(ruleText, /\$5 USD once, for life/);
  assert.match(ruleText, /VIP, Seller, and a custom role/);
  assert.match(ruleText, /monthly hosting costs/);
  assert.match(ruleText, /NSFW content in NSFW channels/i);
  assert.doesNotMatch(ruleText, /Porn category|nsfw.*category/i);
  assert.match(ruleText, /server boosts/i);
  assert.match(ruleText, /^## 01 · Respect/m);
  assert.match(ruleText, /^## 02 · Content/m);
  assert.match(ruleText, /^## 03 · Promotions & Selling/m);
  assert.match(ruleText, /^## 04 · Warnings/m);
  assert.match(ruleText, /^## 05 · Support Kittisugar ♡/m);

  const guideText = guide.embeds[0].data.description;
  assert.equal(guide.embeds[0].data.title, `୨୧ ${toRoyalBold("Kittisugar Guide!")} ♡`);
  assert.match(guideText, /A little guide of Kittisugar/);
  for (const title of ["Start", "Community", "Help", "Commands", "Sugar AI"]) {
    assert.ok(guideText.includes(`୨୧ ${toRoyalBold(title)}`), `missing guide heading: ${title}`);
  }
  assert.equal((guideText.match(/• <#\d{18}>/g) ?? []).length, 10);
  assert.match(guideText, /\n• <#\d{18}>\nRead the welcome message/);
  assert.ok(guideText.includes("`/delete amount:` — delete your own recent messages."));
  assert.ok(guideText.includes("`/vip-delete amount:` — VIP message cleanup."));
  assert.ok(guideText.includes("`/mod-delete amount: [member:]` — moderator cleanup."));
  assert.ok(guideText.includes("`!quote` — reply to a message and quote it."));
  assert.ok(guideText.includes("`/priv-chat commands` — see private chat commands."));
  assert.match(guideText, /show or hide channels/i);
  assert.match(guideText, /This guide is also pinned in dashboard/);
  assert.doesNotMatch(guideText, /pinned in #dashboard/);
  assert.ok(guideText.includes("`/delete amount:` — delete your own recent messages.\n`/vip-delete amount:` — VIP message cleanup.\n`/mod-delete amount: [member:]` — moderator cleanup."));
});
