import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ChannelType } from "discord.js";
import { PetStore, formatPetChannelName, isUsersPetRoom, PET_ADOPTION_CHANNEL_IDS, ensurePetCategoryPosition, PET_ROOMS_CATEGORY_ID, PET_PANEL_CHANNEL_ID, PET_CATEGORY_BELOW_ID, applyNeedsDecay, chileDateKey, canAdoptPet, refreshPetUnlocks, migratePetWallet, removePetFromProfile, parsePetDeleteConfirmationId, canDeletePet, canAdoptSpecies, VIP_ONLY_PET_SPECIES } from "../src/pet-system.js";
import { petSummary } from "../src/member-profile-system.js";

test("virtual pet data persists across store restarts", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "kittisugar-pets-"));
  try {
    const first = new PetStore(directory);
    const pet = {
      name: "Mochi", species: "bunny", level: 2, xp: 4,
      hunger: 80, happiness: 90, coins: 125, inventory: ["toy"],
      room: "VIP dream room", outfit: "pink", slots: 2,
      additionalPets: [{ name: "Mimi", species: "cat" }], activePetIndex: 1,
    };
    first.save("1567093019377930363", "1568188534836428812", pet);
    const restarted = new PetStore(directory);
    assert.deepEqual(
      restarted.get("1567093019377930363", "1568188534836428812"),
      pet,
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("missing pet data starts with an empty guild collection", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "kittisugar-pets-"));
  try {
    const store = new PetStore(directory);
    assert.equal(store.get("1567093019377930363", "1568188534836428812"), null);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("personal pet rooms use private text-channel title format", () => {
  const name = formatPetChannelName("Kitti");
  assert.match(name, /^🐾｜୨୧・.+’s 𝓹𝓮𝓽$/u);
  assert.ok(name.length < 100);
});



test("pet adoption is enabled in the configured pets and personal pet channels", () => {
  assert.equal(PET_ADOPTION_CHANNEL_IDS.has("1570257241511170150"), true);
  assert.equal(PET_ADOPTION_CHANNEL_IDS.has("1570263323159695482"), true);
  assert.equal(PET_ADOPTION_CHANNEL_IDS.has("general"), false);
});

test("personal pet room ownership recovers from a missing topic using private overwrites", () => {
  const channel = {
    type: ChannelType.GuildText, name: "🐾｜୨୧・kitti’s 𝓹𝓮𝓽", topic: null, guild: { id: "guild-1" },
    permissionOverwrites: { cache: new Map([
      ["user-1", { allow: { has: (p) => p === 2048n } }],
      ["guild-1", { deny: { has: (p) => p === 1024n } }],
    ]) },
  };
  assert.equal(isUsersPetRoom(channel, "user-1"), true);
  assert.equal(isUsersPetRoom(channel, "user-2"), false);
  assert.equal(isUsersPetRoom({ ...channel, name: "general" }, "user-1"), false);
});

test("personal pet room topic remains the authoritative owner check", () => {
  const channel = { type: ChannelType.GuildText, topic: "Sugar personal pet room for 123456789012345678" };
  assert.equal(isUsersPetRoom(channel, "123456789012345678"), true);
  assert.equal(isUsersPetRoom(channel, "987654321098765432"), false);
});

test("pet rooms category is positioned below the configured reference category", async () => {
  const events = [];
  const petCategory = {
    id: PET_ROOMS_CATEGORY_ID, type: ChannelType.GuildCategory, position: 2,
    async setPosition(position, options) { events.push({ position, options }); this.position = position; },
  };
  const referenceCategory = { id: PET_CATEGORY_BELOW_ID, type: ChannelType.GuildCategory, position: 7 };
  const guild = { channels: { cache: new Map([[petCategory.id, petCategory], [referenceCategory.id, referenceCategory]]) } };

  assert.equal(await ensurePetCategoryPosition(guild, () => {}), true);
  assert.equal(petCategory.position, 8);
  assert.equal(events.length, 1);
});

test("pet rooms category is not moved when it is already below the reference category", async () => {
  const petCategory = {
    id: PET_ROOMS_CATEGORY_ID, type: ChannelType.GuildCategory, position: 9,
    async setPosition() { throw new Error("should not move an already correctly placed category"); },
  };
  const referenceCategory = { id: PET_CATEGORY_BELOW_ID, type: ChannelType.GuildCategory, position: 7 };
  const guild = { channels: { cache: new Map([[petCategory.id, petCategory], [referenceCategory.id, referenceCategory]]) } };

  assert.equal(await ensurePetCategoryPosition(guild, () => {}), false);
  assert.equal(petCategory.position, 9);
});

test("pet needs decrease gently and cap offline decay", () => {
  const pet = { hunger: 70, happiness: 70, lastNeedsAt: 1_000 };
  applyNeedsDecay(pet, 1_000 + 24 * 60 * 60 * 1000);
  assert.equal(pet.hunger, 62);
  assert.equal(pet.happiness, 68);
  applyNeedsDecay(pet, 1_000 + 10 * 24 * 60 * 60 * 1000);
  assert.ok(pet.hunger >= 38);
  assert.ok(pet.happiness >= 62);
  assert.ok(pet.hunger >= 0 && pet.happiness >= 0);
});

test("one pet is the default and VIP can use only unlocked slots", () => {
  const profile = { additionalPets: [], slots: 1 };
  assert.equal(canAdoptPet(null, false), true);
  assert.equal(canAdoptPet(profile, false), false);
  assert.equal(canAdoptPet(profile, true), false);
  profile.slots = 2;
  assert.equal(canAdoptPet(profile, true), true);
  profile.additionalPets.push({ name: "Mimi" });
  assert.equal(canAdoptPet(profile, true), false);
});

test("pet bond unlocks reaction GIF categories progressively", () => {
  const pet = { bond: 10, gifUnlocks: [] };
  refreshPetUnlocks(pet);
  assert.deepEqual(pet.gifUnlocks, ["happy"]);
  pet.bond = 25;
  refreshPetUnlocks(pet);
  assert.deepEqual(pet.gifUnlocks, ["happy", "dance"]);
  pet.bond = 50;
  refreshPetUnlocks(pet);
  assert.deepEqual(pet.gifUnlocks, ["happy", "dance", "sleep"]);
});

test("pet daily date keys use Chile local time", () => {
  assert.equal(chileDateKey(new Date("2026-11-12T02:00:00.000Z")), "2026-11-11");
});
test("legacy pet balances migrate into one shared wallet without losing coins", () => {
  const profile = {
    coins: 100,
    additionalPets: [{ name: "Mimi", coins: 35 }, { name: "Boba", coins: 20 }],
  };
  migratePetWallet(profile);
  assert.equal(profile.coins, 155);
  assert.deepEqual(profile.additionalPets.map((pet) => pet.coins), [0, 0]);
  assert.equal(profile.walletVersion, 1);
  migratePetWallet(profile);
  assert.equal(profile.coins, 155);
});
test("member profiles show the shared wallet and pet bond", () => {
  const summary = petSummary({
    coins: 150,
    activePetIndex: 1,
    additionalPets: [{
      name: "Mimi", species: "cat", level: 2, xp: 4, hunger: 60, happiness: 80, bond: 25, coins: 0,
    }],
  });
  assert.match(summary, /Bond 25\/100/);
  assert.match(summary, /Coins: 150/);
});

test("pet deletion removes the selected additional pet and preserves the shared wallet", () => {
  const profile = {
    id: "pet-1", name: "Mochi", species: "cat", coins: 120, slots: 3, activePetIndex: 2,
    additionalPets: [
      { id: "pet-2", name: "Mimi", species: "dog" },
      { id: "pet-3", name: "Boba", species: "rabbit" },
    ],
  };
  const result = removePetFromProfile(profile, "pet-2");
  assert.equal(result.removed.name, "Mimi");
  assert.equal(result.remaining, 2);
  assert.equal(profile.coins, 120);
  assert.equal(profile.additionalPets[0].id, "pet-3");
  assert.equal(profile.activePetIndex, 1);
});

test("deleting the primary pet promotes the next pet without losing wallet or slots", () => {
  const profile = {
    id: "pet-1", name: "Mochi", species: "cat", coins: 175, slots: 3, activePetIndex: 0,
    additionalPets: [{ id: "pet-2", name: "Mimi", species: "dog" }],
  };
  const result = removePetFromProfile(profile, "pet-1");
  assert.equal(result.removed.name, "Mochi");
  assert.equal(profile.id, "pet-2");
  assert.equal(profile.name, "Mimi");
  assert.equal(profile.coins, 175);
  assert.equal(profile.slots, 3);
  assert.equal(profile.activePetIndex, 0);
  assert.equal(result.remaining, 1);
});

test("deleting the only pet marks the profile empty", () => {
  const profile = { id: "pet-1", name: "Mochi", additionalPets: [] };
  const result = removePetFromProfile(profile, "pet-1");
  assert.equal(result.empty, true);
  assert.equal(result.removed.name, "Mochi");
  assert.equal(result.remaining, 0);
});


test("pet deletion confirmation parses the actual owner and pet IDs", () => {
  assert.deepEqual(parsePetDeleteConfirmationId("sugar-pets:delete-confirm:user-123:pet-456"), {
    ownerId: "user-123", petId: "pet-456",
  });
  assert.equal(parsePetDeleteConfirmationId("sugar-pets:delete-confirm:user-123"), null);
  assert.equal(parsePetDeleteConfirmationId("other:delete-confirm:user-123:pet-456"), null);
});

test("pet deletion is restricted to VIP members", () => {
  assert.equal(canDeletePet(true), true);
  assert.equal(canDeletePet(false), false);
  assert.equal(canDeletePet(undefined), false);
});


test("only cats and dogs are available to everyone; all other species are VIP-only", () => {
  assert.deepEqual([...VIP_ONLY_PET_SPECIES], [
    "hamster", "rabbit", "fish", "bird", "guinea pig", "turtle", "fox", "ferret",
    "hedgehog", "chinchilla", "mouse", "rat", "squirrel", "raccoon", "deer",
    "owl", "parrot", "snake", "lizard", "frog", "axolotl",
  ]);
  for (const species of VIP_ONLY_PET_SPECIES) {
    assert.equal(canAdoptSpecies(species, false), false, species + " must be VIP-only");
    assert.equal(canAdoptSpecies(species, true), true, species + " should be available to VIP");
  }
  for (const species of ["cat", "dog"]) {
    assert.equal(canAdoptSpecies(species, false), true);
    assert.equal(canAdoptSpecies(species, true), true);
  }
  assert.equal(canAdoptSpecies("kitten", false), true);
  assert.equal(canAdoptSpecies("puppy", false), true);
  assert.equal(canAdoptSpecies("dragon", true), false);
});



test("pets startup refreshes every old panel and does not treat the panel channel as a category", () => {
  const source = fs.readFileSync(new URL("../src/pet-system.js", import.meta.url), "utf8");
  assert.ok(source.includes("oldPanels.size"));
  assert.ok(source.includes("Promise.all([...oldPanels.values()].map((message) => message.edit(panelPayload())))"));
  assert.ok(source.includes('export const PET_CATEGORY_BELOW_ID = "";'));
  assert.ok(!source.includes("await ensurePetCategoryPosition(guild);"));
  assert.ok(!source.includes("ensurePetCategoryPosition(guild).then"));
});

test("pets panel targets the configured channel ID even if its name changes", () => {
  const source = fs.readFileSync(new URL("../src/pet-system.js", import.meta.url), "utf8");
  assert.equal(PET_PANEL_CHANNEL_ID, "1570223501317513408");
  assert.ok(source.includes("guild.channels.cache.get(PET_PANEL_CHANNEL_ID)"));
  assert.ok(source.includes("guild.channels.fetch(PET_PANEL_CHANNEL_ID)"));
  assert.ok(!source.includes("item.type === ChannelType.GuildText && item.name === CHANNEL_NAME"));
});

test("pets hub exposes create-pet and delete-pet actions", () => {
  const source = fs.readFileSync(new URL("../src/pet-system.js", import.meta.url), "utf8");
  assert.ok(source.includes("sugar-pets:create-pet"));
  assert.ok(source.includes("sugar-pets:delete-pet"));
  assert.ok(source.includes("sugar-pets:global-top"));
});

test("adoption customisation uses no more than Discord modal five fields", () => {
  const source = fs.readFileSync(new URL("../src/pet-system.js", import.meta.url), "utf8");
  assert.ok(source.includes('"pet_appearance", "Appearance"'));
  assert.ok(source.includes('"pet_personality", "Personality"'));
  assert.ok(!source.includes('"pet_details", "Appearance & personality"'));
});

test("pet room welcome embed is only created once and remains separate from the sticky", () => {
  const source = fs.readFileSync(new URL("../src/pet-system.js", import.meta.url), "utf8");
  assert.ok(source.includes("if (!welcome) await petChannel.send"));
  assert.ok(source.includes("if (!sticky) await petChannel.send(buildPetStickyPayload"));
});


test("pets panel buttons use the requested order, labels and Discord colours", () => {
  const source = fs.readFileSync(new URL("../src/pet-system.js", import.meta.url), "utf8");
  const panel = source.slice(source.indexOf("function panelPayload()"), source.indexOf("async function ensurePetsChannel"));
  const expected = [
    '.setCustomId(BUTTON_ID).setLabel("Create A Pet Room ♡").setStyle(ButtonStyle.Primary)',
    '.setCustomId("sugar-pets:global-top").setLabel("Top Pets ♡").setStyle(ButtonStyle.Secondary)',
    '.setCustomId("sugar-pets:create-pet").setLabel("Adopt A Pet ♡").setStyle(ButtonStyle.Success)',
    '.setCustomId("sugar-pets:delete-pet").setLabel("Delete A Pet ♡").setStyle(ButtonStyle.Danger)',
  ];
  let previous = -1;
  for (const button of expected) {
    const position = panel.indexOf(button);
    assert.ok(position > previous, "button is missing or out of order: " + button);
    previous = position;
  }
});
