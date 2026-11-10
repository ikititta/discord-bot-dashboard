import test from "node:test";
import assert from "node:assert/strict";

import { PermissionFlagsBits } from "discord.js";

import { buildRolesAuditCommand, buildRolesAuditData } from "../src/roles-audit.js";

test("roles audit command is restricted to members with Manage Roles", () => {
  const command = buildRolesAuditCommand();
  assert.equal(command.name, "roles-audit");
  assert.equal(command.default_member_permissions, PermissionFlagsBits.ManageRoles.toString());
});

test("roles audit data sorts roles by hierarchy and includes safety-relevant metadata", () => {
  const guild = { id: "guild-1", name: "Kittisugar" };
  const roles = [
    {
      id: "role-low",
      name: "Member",
      position: 2,
      hexColor: "#000000",
      color: 0,
      permissions: { toArray: () => ["ViewChannel"] },
      managed: false,
      hoist: false,
      mentionable: false,
      editable: true,
    },
    {
      id: "guild-1",
      name: "@everyone",
      position: 0,
      hexColor: "#000000",
      color: 0,
      permissions: { toArray: () => ["ViewChannel"] },
      managed: false,
      hoist: false,
      mentionable: false,
      editable: false,
    },
    {
      id: "role-high",
      name: "Administrator",
      position: 10,
      hexColor: "#ffd9ff",
      color: 16767487,
      permissions: { toArray: () => ["Administrator"] },
      managed: false,
      hoist: true,
      mentionable: true,
      editable: false,
    },
  ];

  const audit = buildRolesAuditData(guild, roles);

  assert.equal(audit.guild.name, "Kittisugar");
  assert.equal(audit.roleCount, 3);
  assert.deepEqual(audit.roles.map((role) => role.id), ["role-high", "role-low", "guild-1"]);
  assert.equal(audit.roles[0].color, "#ffd9ff");
  assert.deepEqual(audit.roles[0].permissions, ["Administrator"]);
  assert.equal(audit.roles[0].hoist, true);
  assert.equal(audit.roles[0].editableByBot, false);
  assert.equal(audit.roles[2].everyone, true);
});

test("roles audit rejects incomplete input", () => {
  assert.throws(() => buildRolesAuditData(null, []), /server and a role list/);
  assert.throws(() => buildRolesAuditData({ id: "guild-1" }, null), /server and a role list/);
});
