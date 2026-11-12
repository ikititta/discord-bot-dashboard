import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ChannelType } from "discord.js";
import { PetStore, formatPetChannelName, ensurePetCategoryPosition, PET_ROOMS_CATEGORY_ID, PET_CATEGORY_BELOW_ID, applyNeedsDecay, chileDateKey, canAdoptPet, refreshPetUnlocks } from "../src/pet-system.js";

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