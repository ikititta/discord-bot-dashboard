import test from "node:test";
import assert from "node:assert/strict";

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

test("access, rules, and guide panels contain the required confirmations and command guide", () => {
  const guild = { emojis: { cache: [] } };
  const access = buildAccessPanelPayload(guild);
  const rules = buildRulesPayload();
  const guide = buildGuidePayload();

  assert.match(access.embeds[0].data.description, /read and agree/i);
  assert.match(access.embeds[0].data.description, /18 years of age or older/i);
  assert.equal(access.components[0].components[0].data.label, "Enter Server ♡");
  assert.equal(access.components[0].components[0].data.style, 1);
  assert.match(rules.embeds[0].data.description, /18\+/);
  const ruleText = rules.embeds[0].data.fields.map((field) => field.value).join("\n");
  assert.match(ruleText, /\$5 USD once, for life/);
  assert.match(ruleText, /VIP, Seller, and a custom role/);
  assert.match(ruleText, /monthly hosting costs/);
  assert.match(ruleText, /NSFW content in NSFW channels/i);
  assert.doesNotMatch(ruleText, /Porn category|nsfw.*category/i);
  assert.match(ruleText, /server boosts/i);
  assert.match(guide.embeds[0].data.description, /\/priv-chat commands/);
  assert.match(guide.embeds[0].data.description, /\/mod-delete/);
  const guideText = guide.embeds[0].data.description;
  assert.match(guideText, /selfroles/i);
  assert.match(guideText, /show or hide channels/i);
  assert.doesNotMatch(guide.embeds[0].data.description, /<#\d{17,20}>/);
});
