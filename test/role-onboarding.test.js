import test from "node:test";
import assert from "node:assert/strict";

import {
  AGE_OPTIONS,
  GENDER_OPTIONS,
  SEXUALITY_OPTIONS,
  buildSelfRolesPanelPayload,
  isValidHexColor,
  normalizeHexColor,
  roleNameForSelection,
} from "../src/role-onboarding.js";

test("self-role categories use the agreed gender and sexuality options", () => {
  assert.deepEqual(GENDER_OPTIONS.map(([, label]) => label), ["Female", "Male", "Trans", "Non-binary"]);
  assert.deepEqual(SEXUALITY_OPTIONS.map(([, label]) => label), [
    "Straight",
    "Gay/Lesbian",
    "Bisexual",
    "Pansexual",
    "Asexual",
    "Prefer not to say",
  ]);
  assert.equal(SEXUALITY_OPTIONS.some(([value]) => value === "queer"), false);
});

test("age options are individual ages from 18 through 40 without emoji labels", () => {
  assert.equal(AGE_OPTIONS.length, 23);
  assert.equal(AGE_OPTIONS[0][0], "18");
  assert.equal(AGE_OPTIONS.at(-1)[0], "40");
  assert.ok(AGE_OPTIONS.every(([value, label]) => value === label && /^\\d+$/.test(label)));
});

test("validates and normalizes custom HEX chat colors", () => {
  assert.equal(isValidHexColor("#ffd9ff"), true);
  assert.equal(isValidHexColor("FFD9FF"), true);
  assert.equal(isValidHexColor("#fff"), false);
  assert.equal(isValidHexColor("pink"), false);
  assert.equal(normalizeHexColor("#ffd9ff"), "FFD9FF");
  assert.throws(() => normalizeHexColor("pink"), /valid HEX color/);
});

test("creates stable role names and rejects options outside the configured categories", () => {
  assert.equal(roleNameForSelection("gender", "non-binary"), "gender-non-binary");
  assert.equal(roleNameForSelection("age", "40"), "age-40");
  assert.equal(roleNameForSelection("sexuality", "gay-lesbian"), "sexuality-gay-lesbian");
  assert.throws(() => roleNameForSelection("sexuality", "queer"), /not available/);
  assert.throws(() => roleNameForSelection("interests", "music"), /Unknown role category/);
});

test("self-roles panel contains four selectors and a custom-color button", () => {
  const payload = buildSelfRolesPanelPayload();
  assert.equal(payload.components.length, 5);
  assert.match(payload.embeds[0].data.description, /Gender · Age · Sexuality · Chat color · NSFW visibility/);
  const selectorIds = payload.components.slice(0, 4).map((row) => row.components[0].data.custom_id);
  assert.deepEqual(selectorIds, [
    "sugar-selfroles:gender",
    "sugar-selfroles:age",
    "sugar-selfroles:sexuality",
    "sugar-selfroles:nsfw",
  ]);
  assert.equal(payload.components[4].components[0].data.custom_id, "sugar-selfroles:color");
});
