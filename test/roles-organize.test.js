import test from "node:test";
import assert from "node:assert/strict";

import { buildRoleOrganizationPlan, KITTISUGAR_GUILD_ID } from "../src/roles-organize.js";

const makeRole = (id, name, { managed = false } = {}) => ({
  id, name, managed, editable: !managed,
  permissions: { bitfield: 0n },
  color: 0,
});

function inventory() {
  const ids = [
    ["1567669697061724263", "Sugar AI", true],
    ["1567796193268858950", "Owner"],
    ["1568188492704522330", "New"],
    ["1568188534836428812", "Member"],
    ["1568188570890403910", "Admin"],
    ["1568188595171500123", "Mod"],
    ["1568188640113463437", "VIP"],
    ["1568188714247524382", "Verified"],
    ["1568483423608381600", "NSFW"],
    ["1569242096932622376", "Age 18-"],
    ["1569242097440260126", "Age 18"],
    ["1569242100057378907", "Age 19"],
    ["1569242100883525744", "Age 20"],
    ["1569242101907193866", "Age 21"],
    ["1569242102414573698", "Age 22"],
    ["1569242103383597167", "Age 23"],
    ["1569242104322854993", "Age 24"],
    ["1569242104935354411", "Age 25"],
    ["1569242105153331312", "Age 26"],
    ["1569242106130731080", "Age 27"],
    ["1569242106797629471", "Age 28"],
    ["1569242107527430164", "Age 29"],
    ["1569242107821170802", "Age 30"],
    ["1569242109020733440", "Age 31"],
    ["1569242109918052453", "Age 32"],
    ["1569242110920499230", "Age 33"],
    ["1569242111600107611", "Age 34"],
    ["1569242112397017088", "Age 35"],
    ["1569242112921313371", "Age 36"],
    ["1569242113067978756", "Age 37"],
    ["1569242114036994118", "Age 38"],
    ["1569242114582249554", "Age 39"],
    ["1569242115077177400", "Age 40"],
    ["1569493295686746152", "Staff"],
    ["1569637397774340116", "nsfw-hidden"],
    ["1569638102949953567", "gender-female"],
    ["1569638169660489903", "sexuality-straight"],
    ["1569780848545235045", "color-pink"],
    ["1569802495792914593", "Server Booster", true],
    ["1569807000278269983", "gender-male"],
    ["1569807011217145948", "gender-trans"],
    ["1569807020809396455", "gender-non-binary"],
    ["1569807071765856307", "sexuality-gay-lesbian"],
    ["1569807083769958422", "sexuality-bisexual"],
    ["1569807093966438591", "sexuality-pansexual"],
    ["1569807104917770284", "sexuality-asexual"],
    ["1569807116590649558", "sexuality-prefer-not-to-say"],
    ["1569807135775395941", "color-red"],
    ["1569807145598329052", "color-orange"],
    ["1569807155253485708", "color-yellow"],
    ["1569807169283686491", "color-green"],
    ["1569807182415921174", "color-cyan"],
    ["1569807196437356585", "color-blue"],
    ["1569807215194415277", "color-purple"],
    ["1569807243006705706", "color-white"],
    ["1569807253555388487", "color-gray"],
    ["1569807265060626653", "color-brown"],
    ["1569807276469129357", "color-black"],
    ["1569809500955738164", "Booster"],
    [KITTISUGAR_GUILD_ID, "@everyone"],
  ];
  return ids.map(([id, name, managed]) => makeRole(id, name, { managed: Boolean(managed) }));
}

test("plan includes all categories in the approved order and keeps color roles above community", () => {
  const plan = buildRoleOrganizationPlan(inventory());
  const names = plan.ordered.map((item) => item.dividerName ?? item.role?.name);
  assert.equal(names[0], "Sugar AI");
  assert.match(names.indexOf("color-pink") < names.indexOf("New") ? "ok" : "bad", /ok/);
  assert.equal(plan.dividers.length, 6);
  assert.equal(plan.untouchedManaged.length, 2);
});

test("ages are renamed without emoji and managed Discord roles are never renamed", () => {
  const plan = buildRoleOrganizationPlan(inventory());
  const ageRenames = plan.renames.filter((item) => item.role.id.startsWith("156924"));
  assert.equal(ageRenames.length, 24);
  assert.ok(ageRenames.every(({ name }) => !/\p{Extended_Pictographic}/u.test(name)));
  assert.ok(plan.renames.every(({ role }) => !role.managed));
  assert.ok(!plan.renames.some(({ role }) => role.id === "1567669697061724263"));
  assert.ok(!plan.renames.some(({ role }) => role.id === "1569802495792914593"));
});

test("rejects any other guild", () => {
  assert.throws(() => buildRoleOrganizationPlan(inventory(), "123"), /restricted/);
});

test("rejects a stale or incomplete role inventory", () => {
  const roles = inventory().filter((role) => role.id !== "1569809500955738164");
  assert.throws(() => buildRoleOrganizationPlan(roles), /inventory no longer matches/);
});


test("safe positioning reuses unique editable role slots below Sugar's highest role", async () => {
  const { buildSafeRolePositions } = await import("../src/roles-organize.js");
  const top = makeRole("top", "Top");
  const middle = makeRole("middle", "Middle");
  const bottom = makeRole("bottom", "Bottom");
  top.position = 8;
  middle.position = 4;
  bottom.position = 2;

  const positions = buildSafeRolePositions([top, middle, bottom], 10);
  assert.deepEqual(positions.map(({ role, position }) => [role.id, position]), [
    ["bottom", 2],
    ["middle", 4],
    ["top", 8],
  ]);
});

test("safe positioning rejects roles at or above Sugar and managed roles", async () => {
  const { buildSafeRolePositions } = await import("../src/roles-organize.js");
  const tooHigh = makeRole("high", "High");
  tooHigh.position = 10;
  assert.throws(() => buildSafeRolePositions([tooHigh], 10), /safe position slot/);

  const managed = makeRole("managed", "Managed", { managed: true });
  managed.position = 2;
  assert.throws(() => buildSafeRolePositions([managed], 10), /managed or not editable/);
});

test("safe positioning rejects duplicate role IDs instead of assigning colliding slots", async () => {
  const { buildSafeRolePositions } = await import("../src/roles-organize.js");
  const duplicateA = makeRole("same", "A");
  const duplicateB = makeRole("same", "B");
  duplicateA.position = 2;
  duplicateB.position = 3;
  assert.throws(() => buildSafeRolePositions([duplicateA, duplicateB], 10), /Duplicate role/);
});
