import test from "node:test";
import assert from "node:assert/strict";

import {
  AGE_OPTIONS,
  COLOR_OPTIONS,
  GENDER_OPTIONS,
  SEXUALITY_OPTIONS,
  buildSelfRolesPanelPayload,
  roleNameForSelection,
  findNsfwHiddenRole,
  NSFW_HIDDEN_ROLE_ID,
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
