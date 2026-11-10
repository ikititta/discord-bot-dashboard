import test from "node:test";
import assert from "node:assert/strict";
import { PermissionFlagsBits } from "discord.js";
import { buildRoleOrganizationCommand, buildRoleOrganizationPlan } from "../src/roles-organization.js";

function role(name, id = name) {
  return { id, name, managed: false, everyone: false, editable: true, position: 1 };
}

test("role organization command is restricted to Manage Roles", () => {
  const command = buildRoleOrganizationCommand();
  assert.equal(command.name, "roles-organize");
  assert.equal(command.default_member_permissions, PermissionFlagsBits.ManageRoles.toString());
});

test("organization puts colors before staff and keeps Booster in Community", () => {
  const roles = [
    role("꒰ 𝒪𝓌𝓃ℯ𝓇 ! ꒱", "owner"),
    ...["pink","red","orange","yellow","green","cyan","blue","purple","white","gray","brown","black"].map((n) => role("color-" + n)),
    role("꒰ 𝒶𝒹𝓂𝒾𝓃 ! ꒱"),
    role("꒰ 𝓂ℴ𝒹 ! ꒱"),
    role("꒰ 𝓈𝓉𝒶𝒻𝒻 ! ꒱"),
    role("꒰ 𝓃ℯ𝓌 ! ꒱"),
    role("꒰ 𝓂ℯ𝓂𝒷ℯ𝓇 ! ꒱"),
    role("꒰ 𝓋ℯ𝓇𝒾𝒻𝒾ℯ𝒹 ! ꒱"),
    role("꒰ 𝒱ℐ𝒫 ! ꒱"),
    role("୨୧ 𝓑𝓸𝓸𝓼𝓽𝓮𝓻"),
    ...["18-","18","19","20","21","22","23","24","25","26","27","28","29","30","31","32","33","34","35","36","37","38","39","40"].map((n) => role("Age · " + n)),
    ...["gender-female","gender-male","gender-trans","gender-non-binary","sexuality-straight","sexuality-gay-lesbian","sexuality-bisexual","sexuality-pansexual","sexuality-asexual","sexuality-prefer-not-to-say","꒰ 𝓝𝓢𝓕𝓦 ! ꒱","nsfw-hidden"].map((n) => role(n)),
    { ...role("Sugar AI"), managed: true, editable: false },
  ];
  const plan = buildRoleOrganizationPlan(roles);
  assert.equal(plan.groups[0].divider, "colors");
  assert.deepEqual(plan.groups[1].roles.map((r) => r.name), ["꒰ 𝒶𝒹𝓂𝒾𝓃 ! ꒱","꒰ 𝓂ℴ𝒹 ! ꒱","꒰ 𝓈𝓉𝒶𝒻𝒻 ! ꒱"]);
  assert.equal(plan.groups[2].roles.at(-1).name, "୨୧ 𝓑𝓸𝓸𝓼𝓽𝓮𝓻");
  assert.equal(plan.groups[3].roles[0].name, "Age · 18-");
  assert.equal(plan.groups[3].roles.at(-1).name, "Age · 40");
  assert.equal(plan.orderedRoles[0].id, "owner");
});

test("incomplete role inventory is rejected before changes", () => {
  assert.throws(() => buildRoleOrganizationPlan([]), /Couldn't find the existing Owner/);
});
