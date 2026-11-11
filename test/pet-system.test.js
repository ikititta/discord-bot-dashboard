import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PetStore, formatPetChannelName } from "../src/pet-system.js";

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
