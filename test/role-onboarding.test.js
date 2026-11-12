import test from "node:test";
import assert from "node:assert/strict";

import {
  AGE_OPTIONS,
  COLOR_OPTIONS,
  GENDER_OPTIONS,
  SEXUALITY_OPTIONS,
  GENDER_ROLE_IDS,
  buildSelfRolesPanelPayload,
  roleNameForSelection,
  findNsfwHiddenRole,
  NSFW_HIDDEN_ROLE_ID,
  restrictUnderageMember,
} from "../src/role-onboarding.js";

test("self-role categories use the agreed gender and sexuality options", () => {
  assert.deepEqual(GENDER_OPTIONS.map(([, label]) => label), ["Female", "Male", "Trans", "Non-binary"]);
  assert.deepEqual(SEXUALITY_OPTIONS.map(([, label]) => label), [
    "Straight",
    "Gay/Lesbian",
    "Bisexual",
    "Pansexual",
    "Asexual",
    "Queer",
    "Prefer not to say",
  ]);
  assert.equal(SEXUALITY_OPTIONS.some(([value]) => value === "queer"), true);
});

test("age options include the 18- restricted-access route followed by ages 18 through 40", () => {
  assert.equal(AGE_OPTIONS.length, 24);
  assert.deepEqual(AGE_OPTIONS[0], ["18-", "18-"]);
  assert.equal(AGE_OPTIONS[1][0], "18");
  assert.equal(AGE_OPTIONS.at(-1)[0], "40");
  assert.ok(AGE_OPTIONS.slice(1).every(([value, label]) => value === label && /^\d+$/.test(label)));
});

test("chat colors are a fixed set of basic named colors", () => {
  assert.deepEqual(COLOR_OPTIONS.map(([value]) => value), [
    "red", "orange", "yellow", "green", "cyan", "blue",
    "purple", "pink", "white", "gray", "brown", "black",
  ]);
  assert.ok(COLOR_OPTIONS.every(([value, label, color]) =>
    /^[a-z]+$/.test(value) && label.length > 0 && Number.isInteger(color)
  ));
});

test("creates stable role names and rejects options outside the configured categories", () => {
  assert.equal(roleNameForSelection("gender", "non-binary"), "gender-non-binary");
  assert.equal(roleNameForSelection("age", "40"), "age-40");
  assert.equal(roleNameForSelection("sexuality", "gay-lesbian"), "sexuality-gay-lesbian");
  assert.equal(roleNameForSelection("sexuality", "queer"), "sexuality-queer");
  assert.throws(() => roleNameForSelection("interests", "music"), /Unknown role category/);
});

test("self-roles panel separates every category into its own message and selector", () => {
  const payloads = buildSelfRolesPanelPayload();
  assert.equal(payloads.length, 5);
  assert.deepEqual(payloads.map((payload) => payload.components[0].components[0].data.custom_id), [
    "sugar-selfroles:gender",
    "sugar-selfroles:age",
    "sugar-selfroles:sexuality",
    "sugar-selfroles:color",
    "sugar-selfroles:nsfw",
  ]);
  assert.ok(payloads.every((payload) => payload.embeds.length === 1 && payload.components.length === 1));
  assert.match(payloads[3].embeds[0].data.description, /basic colors/);
  assert.equal(payloads[3].components[0].components[0].options.length, COLOR_OPTIONS.length);
});

test("NSFW visibility uses the explicitly configured Hide NSFW Channels role ID", () => {
  const role = { id: NSFW_HIDDEN_ROLE_ID, name: "Hide NSFW Channels" };
  const guild = { roles: { cache: new Map([[role.id, role]]) } };
  assert.equal(NSFW_HIDDEN_ROLE_ID, "1569885841180856361");
  assert.equal(findNsfwHiddenRole(guild), role);
  assert.equal(findNsfwHiddenRole({ roles: { cache: new Map() } }), null);
});


test("18- restriction grants Support first, removes Member, and applies a removable access role", async () => {
  const calls = [];
  const ageRole = { id: "age-review", name: "age-review" };
  const memberRole = { id: "1568188534836428812", name: "Member" };
  const newRole = { id: "1568188492704522330", name: "New" };
  const roleMap = new Map([[memberRole.id, memberRole], [newRole.id, newRole]]);
  const roleCache = { get: (id) => roleMap.get(id), find: (callback) => [...roleMap.values()].find(callback) };
  const support = {
    id: "1568492748732895313",
    type: 0,
    permissionOverwrites: { edit: async (role, permissions) => calls.push(["support", role.id, permissions]) },
  };
  const general = {
    id: "general",
    type: 0,
    isThread: () => false,
    permissionOverwrites: { edit: async (role, permissions) => calls.push(["general", role.id, permissions]) },
  };
  const guild = {
    roles: {
      cache: roleCache,
      create: async () => { roleMap.set(ageRole.id, ageRole); return ageRole; },
    },
    channels: { cache: { get: (id) => new Map([[support.id, support], [general.id, general]]).get(id), find: (callback) => [support, general].find(callback), values: () => [support, general].values() } },
  };
  const assigned = new Set([memberRole.id]);
  const member = {
    roles: {
      cache: { has: (id) => assigned.has(id) },
      add: async (role) => { calls.push(["add", role.id]); assigned.add(role.id); },
      remove: async (role) => { calls.push(["remove", role.id]); assigned.delete(role.id); },
    },
    send: async (payload) => calls.push(["dm", payload.embeds[0].data.description]),
  };

  const result = await restrictUnderageMember(guild, member);

  assert.equal(result, support);
  assert.deepEqual(calls[0], ["support", ageRole.id, {
    ViewChannel: true, ReadMessageHistory: true, SendMessages: false,
  }]);
  assert.deepEqual(calls.find((call) => call[0] === "general"), ["general", ageRole.id, { ViewChannel: false }]);
  assert.equal(assigned.has(memberRole.id), false);
  assert.equal(assigned.has(ageRole.id), true);
  assert.match(calls.find((call) => call[0] === "dm")[1], /limited to/);
  assert.doesNotMatch(calls.find((call) => call[0] === "dm")[1], /manual age verification/i);
});

test("18- restriction fails safely when Support is missing", async () => {
  let roleCreated = false;
  const guild = {
    roles: { cache: { get: () => null, find: () => null }, create: async () => { roleCreated = true; } },
    channels: { cache: { get: () => null, find: () => null, values: () => [][Symbol.iterator]() } },
  };
  const member = {
    roles: { cache: { has: () => false }, add: async () => { throw new Error("must not assign"); }, remove: async () => {} },
    send: async () => {},
  };
  await assert.rejects(restrictUnderageMember(guild, member), /Support channel/);
  assert.equal(roleCreated, false);
});


test("onboarding and fun commands share the exact configured Discord gender role IDs", () => {
  assert.deepEqual(GENDER_ROLE_IDS, {
    female: "1569638102949953567",
    male: "1569807000278269983",
    trans: "1569807011217145948",
    "non-binary": "1569807020809396455",
  });
});


test("self-role creation is serialized and reuses a suffixed legacy duplicate", async () => {
  const { getOrCreateRole } = await import("../src/role-onboarding.js");
  const roleMap = new Map();
  let creates = 0;
  let refreshes = 0;
  const guild = {
    id: "guild-role-lock",
    roles: {
      cache: {
        values: () => roleMap.values(),
      },
      fetch: async () => {
        refreshes += 1;
        await new Promise((resolve) => setTimeout(resolve, 5));
        return roleMap;
      },
      create: async (data) => {
        creates += 1;
        const role = { id: `created-${creates}`, name: data.name };
        roleMap.set(role.id, role);
        return role;
      },
    },
  };

  const [first, second] = await Promise.all([
    getOrCreateRole(guild, "color-red", 0xe74c3c),
    getOrCreateRole(guild, "color-red", 0xe74c3c),
  ]);
  assert.equal(first.id, second.id);
  assert.equal(creates, 1);
  assert.equal(refreshes, 1);

  roleMap.delete(first.id);
  roleMap.set("legacy", { id: "legacy", name: "color-red 1" });
  const reused = await getOrCreateRole(guild, "color-red", 0xe74c3c);
  assert.equal(reused.id, "legacy");
  assert.equal(creates, 1);
});
