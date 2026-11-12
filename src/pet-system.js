import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, Events, PermissionFlagsBits,
  StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
} from "discord.js";
import { toRoyalBold } from "./embed-format.js";
import { generatePetArtwork } from "./pet-art.js";

const COLOR = 0xffd9ff;
const VIP_ROLE_ID = "1568188640113463437";
const CHANNEL_NAME = "🐾｜୨୧ ・𝓹𝓮𝓽𝓼";
export const PET_ROOMS_CATEGORY_ID = "1568179038625857576";
export const PET_CATEGORY_BELOW_ID = "1570223501317513408";
const BUTTON_ID = "sugar-pets:open";
const PET_SPECIES = {
  cat: "cat", dog: "dog", puppy: "dog", kitten: "cat", hamster: "hamster",
  rabbit: "rabbit", bunny: "rabbit", fish: "fish", bird: "bird",
  guinea: "guinea pig", "guinea pig": "guinea pig", "guinea-pig": "guinea pig", turtle: "turtle", fox: "fox", ferret: "ferret",
};
const PET_SPECIES_OPTIONS = [...new Set(Object.values(PET_SPECIES))];
const SHOP = { treat: 10, toy: 25, potion: 60 };
const MEMBER_ROLE_ID = "1568188534836428812";

export class PetStore {
  constructor(dataDir) {
    this.file = path.join(dataDir, "pets-state.json");
    this.data = this.read();
  }
  get(guildId, userId) {
    const pet = this.data.guilds[guildId]?.[userId];
    return pet ? structuredClone(pet) : null;
  }
  save(guildId, userId, pet) {
    const guild = this.data.guilds[guildId] ??= {};
    guild[userId] = pet;
    const temp = this.file + ".tmp";
    fs.writeFileSync(temp, JSON.stringify(this.data, null, 2), { mode: 0o600 });
    fs.chmodSync(temp, 0o600);
    fs.renameSync(temp, this.file);
    return structuredClone(pet);
  }
  read() {
    let raw;
    try { raw = fs.readFileSync(this.file, "utf8"); }
    catch (error) { if (error?.code === "ENOENT") return { version: 1, guilds: {} }; throw error; }
    const data = JSON.parse(raw);
    if (data?.version !== 1 || !data.guilds || typeof data.guilds !== "object" || Array.isArray(data.guilds)) {
      throw new Error("pets-state.json has an invalid structure; refusing to overwrite it.");
    }
    return data;
  }
}

function normalizePetChannelLabel(value) {
  const label = String(value ?? "member").normalize("NFKC").toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 42).replace(/-+$/g, "");
  return label || "member";
}
export function formatPetChannelName(username) {
  return `🐾｜୨୧・${toRoyalBold(normalizePetChannelLabel(username))}’s 𝓹𝓮𝓽`;
}

function isVip(member) {
  return member?.roles?.cache?.has(VIP_ROLE_ID) === true;
}
function buildPetEmbed() {
  return new EmbedBuilder().setColor(COLOR).setTitle("୨୧ 𝓥𝓲𝓻𝓽𝓾𝓪𝓵 𝓟𝓮𝓽𝓼 ♡")
    .setDescription("Adopt your own little companion and watch them grow ♡\n\n" +
      "Open your private pet room, then type `!pet adopt` to start the interactive adoption. " +
      "Choose a species from the selector. Everyone gets a unique, randomly designed pet; VIP members can customise its name, colour, breed, appearance and personality before adopting.\n\n" +
      "Care for your pet, earn XP and coins, unlock stories, and collect more companions with VIP slots.")
    .setFooter({ text: "Your pet and progress are saved ♡ · Adoption starts with !pet adopt" });
}
function buildPetCommandsEmbed() {
  return new EmbedBuilder().setColor(COLOR).setTitle("୨୧ 𝓟𝓮𝓽 𝓡𝓸𝓸𝓶 · 𝓒𝓸𝓶𝓶𝓪𝓷𝓭𝓼 ♡")
    .setDescription("**Adoption · Everyone**\n`!pet adopt` — open the adoption embed and choose a species: cat, dog, hamster, rabbit, fish, bird, guinea pig, turtle, fox or ferret.\nNon-VIP pets receive a unique random design. VIP members can customise before adopting.\n\n" +
      "**Care & play · Everyone**\n`!pet` · `!pet stats` · `!pet feed` · `!pet play` · `!pet cuddle` · `!pet talk` · `!pet story`\n`!pet shop` · `!pet buy <treat|toy|potion>` · `!pet use <item>` · `!pet daily` · `!pet gif` · `!pet inventory` · `!pet select <number>`\n\n" +
      "**VIP customisation**\nChoose your pet’s name, colour, breed, appearance and personality in the adoption form. Existing pets can also be edited with `!pet name <name>`, `!pet color <color>`, `!pet breed <breed>`, `!pet appearance <details>` and `!pet personality <traits>`.\n\n" +
      "**VIP extras**\n`!pet room` · `!pet outfit <name>` · `!pet rare` · `!pet slots` · `!pet minigame`")
    .setFooter({ text: "Use these commands in your private pet room ♡" });
}
function buildAdoptionEmbed(selectedSpecies = null, vip = false) {
  const speciesLine = selectedSpecies ? "Selected companion: **" + selectedSpecies + "** ♡" : "Choose the species you’d love to meet ♡";
  const designLine = vip
    ? "As a VIP member, you can customise your companion’s name, colour, breed, appearance and personality before adopting."
    : "Your companion will receive a one-of-a-kind random name and design. Want to choose every detail yourself? VIP unlocks full pet customisation ♡";
  return new EmbedBuilder().setColor(COLOR).setTitle("୨୧ 𝓐 𝓛𝓲𝓽𝓽𝓵𝓮 𝓐𝓭𝓸𝓹𝓽𝓲𝓸𝓷 ♡")
    .setDescription(speciesLine + "\n\n" + designLine + "\n\nPick a species below to continue.")
    .setFooter({ text: "Every companion gets its own unique identity ♡" });
}
function buildSpeciesSelect(userId) {
  return new ActionRowBuilder().addComponents(new StringSelectMenuBuilder()
    .setCustomId("sugar-pets:species:" + userId)
    .setPlaceholder("Choose your pet’s species ♡")
    .addOptions(
      { label: "Cat", value: "cat", emoji: "🐱" }, { label: "Dog", value: "dog", emoji: "🐶" },
      { label: "Hamster", value: "hamster", emoji: "🐹" }, { label: "Rabbit", value: "rabbit", emoji: "🐰" },
      { label: "Fish", value: "fish", emoji: "🐠" }, { label: "Bird", value: "bird", emoji: "🐦" },
      { label: "Guinea pig", value: "guinea pig", emoji: "🐾" }, { label: "Turtle", value: "turtle", emoji: "🐢" },
      { label: "Fox", value: "fox", emoji: "🦊" }, { label: "Ferret", value: "ferret", emoji: "🤎" },
    ));
}
function buildAdoptionActions(userId, species, vip) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("sugar-pets:adopt:" + userId + ":" + encodeURIComponent(species))
      .setLabel(vip ? "Adopt this pet ♡" : "Adopt your random companion ♡").setStyle(ButtonStyle.Primary),
  );
  if (vip) row.addComponents(new ButtonBuilder()
    .setCustomId("sugar-pets:customize:" + userId + ":" + encodeURIComponent(species))
    .setLabel("Customise before adopting ♡").setStyle(ButtonStyle.Success));
  return row;
}
function buildAdoptionModal(userId, species) {
  const modal = new ModalBuilder().setCustomId("sugar-pets:customize-submit:" + userId + ":" + encodeURIComponent(species)).setTitle("Customise your companion ♡");
  const fields = [["pet_name", "Name", "Choose a name", true, 24], ["pet_color", "Colour", "e.g. strawberry pink", false, 60], ["pet_breed", "Breed", "Optional breed", false, 60], ["pet_appearance", "Appearance", "Markings, eyes, accessories...", false, 60], ["pet_personality", "Personality", "e.g. gentle, curious, playful", false, 60]];
  for (const [id, label, placeholder, required, maxLength] of fields) modal.addComponents(new ActionRowBuilder().addComponents(
    new TextInputBuilder().setCustomId(id).setLabel(label).setPlaceholder(placeholder).setStyle(TextInputStyle.Short).setRequired(required).setMaxLength(maxLength),
  ));
  return modal;
}
function buildGlobalPetLeaderboard(store, guildId) {
  const entries = [];
  for (const [userId, profile] of Object.entries(store.data.guilds[guildId] ?? {})) {
    for (const pet of [profile, ...(profile.additionalPets ?? [])]) {
      if (!pet || typeof pet !== "object") continue;
      entries.push({ userId, pet, score: (Number(pet.level) || 1) * 1000 + (Number(pet.xp) || 0) });
    }
  }
  entries.sort((a, b) => b.score - a.score);
  const lines = entries.slice(0, 5).map((entry, index) =>
    `**${index + 1}.** ${entry.pet.name} the ${entry.pet.species} · Level ${entry.pet.level} · <@${entry.userId}>`,
  );
  return new EmbedBuilder().setColor(0x57c785).setTitle("୨୧ 𝓖𝓵𝓸𝓫𝓪𝓵 𝓟𝓮𝓽 𝓣𝓸𝓹 ♡")
    .setDescription(lines.length ? lines.join("\n") : "No pets have been adopted yet. Be the first to join the top ♡")
    .setFooter({ text: "Sugar AI · Global pet leaderboard" });
}
function panelPayload() {
  return { embeds: [buildPetEmbed()], components: [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(BUTTON_ID).setLabel("Create your pet room ♡").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("sugar-pets:global-top").setLabel("Global top ♡").setStyle(ButtonStyle.Success),
  )] };
}

async function ensurePetsChannel(guild, client, store) {
  // This is an existing server-managed channel. Never recreate it if it is
  // moved or renamed; only maintain the panel when the configured channel exists.
  const channel = guild.channels.cache.find((item) =>
    item.type === ChannelType.GuildText && item.name === CHANNEL_NAME,
  );
  if (!channel) {
    console.warn(`[pets] existing pets channel was not found in guild ${guild.id}; no channel was created.`);
    return null;
  }
  await channel.permissionOverwrites.edit(guild.roles.everyone, {
    ViewChannel: true, SendMessages: false, AddReactions: false, CreatePublicThreads: false, SendMessagesInThreads: false, ReadMessageHistory: true,
  }, "Keep the virtual pets panel read-only");
  await channel.permissionOverwrites.edit(client.user.id, {
    ViewChannel: true, SendMessages: true, EmbedLinks: true, ReadMessageHistory: true,
    ManageMessages: true, AddReactions: false,
  }, "Allow Sugar to maintain the pets panel without reactions");
  const recent = await channel.messages.fetch({ limit: 50 });
  const old = recent.find((message) => message.author?.id === client.user.id &&
    message.embeds.some((embed) => embed.title === "୨୧ 𝓥𝓲𝓻𝓽𝓾𝓪𝓵 𝓟𝓮𝓽𝓼 ♡"));
  if (old) await old.edit(panelPayload());
  else await channel.send(panelPayload());
  return channel;
}

export async function ensurePetCategoryPosition(guild, onError = console.warn) {
  const category = guild.channels.cache.get(PET_ROOMS_CATEGORY_ID) ??
    await guild.channels.fetch(PET_ROOMS_CATEGORY_ID).catch(() => null);
  const reference = guild.channels.cache.get(PET_CATEGORY_BELOW_ID) ??
    await guild.channels.fetch(PET_CATEGORY_BELOW_ID).catch(() => null);
  if (category?.type !== ChannelType.GuildCategory || reference?.type !== ChannelType.GuildCategory) {
    onError("[pets] pet-room category positioning skipped: one or both configured categories are missing.");
    return false;
  }
  if (category.position > reference.position) return false;
  try {
    await category.setPosition(reference.position + 1, {
      reason: "Place the pet rooms category below the configured server category",
    });
    return true;
  } catch (error) {
    onError("[pets] pet-room category could not be repositioned: " + error.message);
    return false;
  }
}

const PET_VISUAL_TRAITS = {
  palettes: ["vanilla cream", "strawberry pink", "lavender", "peach", "mint", "powder blue", "cocoa"],
  eyes: ["glossy round eyes", "sleepy crescent eyes", "sparkling starry eyes", "soft gradient eyes"],
  markings: ["tiny heart-shaped marking", "freckles", "soft ear gradients", "little forehead star", "cloud-shaped patches", "speckled paws"],
  accessories: ["satin bow", "tiny bell collar", "flower clip", "lace ribbon", "moon charm", "pearl collar", "no accessory"],
  personalities: ["gentle", "mischievous", "sleepy", "curious", "playful", "shy", "adventurous"],
};

function choose(values) {
  return values[Math.floor(Math.random() * values.length)];
}

function createPetVisualIdentity() {
  return {
    palette: choose(PET_VISUAL_TRAITS.palettes),
    eyes: choose(PET_VISUAL_TRAITS.eyes),
    markings: choose(PET_VISUAL_TRAITS.markings),
    accessory: choose(PET_VISUAL_TRAITS.accessories),
    personality: choose(PET_VISUAL_TRAITS.personalities),
    artStatus: "not_generated",
    artPath: null,
    artCreatedAt: null,
  };
}

function makePet(species = "cat") {
  return {
    id: randomUUID(),
    name: "Mochi",
    species,
    visualIdentity: createPetVisualIdentity(),
    level: 1, xp: 0, hunger: 70, happiness: 70, bond: 0, coins: 100,
    lastNeedsAt: Date.now(),
    inventory: [], room: "cozy room", outfit: "default", slots: 1, additionalPets: [], activePetIndex: 0,
    lastMinigame: null, lastDailyReward: null,
    dialogueCount: 0,
    storyUnlocks: [], gifUnlocks: [],
  };
}
function queuePetArtwork(message, store, profile, pet) {
  if (!process.env.OPENAI_API_KEY || !pet.visualIdentity ||
      pet.visualIdentity.artStatus === "generating" || pet.visualIdentity.artStatus === "ready") return;
  pet.visualIdentity.artStatus = "generating";
  store.save(message.guild.id, message.author.id, profile);
  void generatePetArtwork({ pet, dataDir: path.dirname(store.file) }).then((file) => {
    pet.visualIdentity.artStatus = "ready";
    pet.visualIdentity.artPath = file;
    pet.visualIdentity.artCreatedAt = new Date().toISOString();
    store.save(message.guild.id, message.author.id, profile);
    return message.channel.send({
      content: `Your one-of-a-kind ${pet.name} artwork is ready ♡`,
      files: [file],
      allowedMentions: { parse: [] },
    });
  }).catch((error) => {
    pet.visualIdentity.artStatus = "failed";
    store.save(message.guild.id, message.author.id, profile);
    console.error("[pets] AI artwork generation failed: " + error.message);
  });
}

function applyNeedsDecay(pet, now = Date.now()) {
  const last = Number(pet.lastNeedsAt) || now;
  const elapsedHours = Math.min(72, Math.max(0, (now - last) / 3_600_000));
  pet.hunger = Math.max(0, Math.round((Number(pet.hunger) || 0) - elapsedHours / 3));
  pet.happiness = Math.max(0, Math.round((Number(pet.happiness) || 0) - elapsedHours / 12));
  pet.lastNeedsAt = now;
}

function chileDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
}

function refreshPetUnlocks(pet) {
  const thresholds = [{ bond: 10, id: "happy" }, { bond: 25, id: "dance" }, { bond: 50, id: "sleep" }];
  pet.gifUnlocks ??= [];
  for (const item of thresholds) if ((pet.bond ?? 0) >= item.bond && !pet.gifUnlocks.includes(item.id)) pet.gifUnlocks.push(item.id);
}

async function sendPetGif(message, pet, category) {
  const unlocks = pet.gifUnlocks ?? [];
  const selected = category || unlocks[0];
  if (!selected || !["happy", "dance", "sleep"].includes(selected) || !unlocks.includes(selected)) {
    return message.reply("That reaction is still locked. Build your bond with play, cuddles and conversations to unlock more ♡");
  }
  const response = await fetch("https://nekos.best/api/v2/" + selected, {
    headers: { "User-Agent": "SugarDiscordBot/1.0" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error("Pet reaction GIF service returned HTTP " + response.status + ".");
  const payload = await response.json();
  const url = new URL(payload?.results?.[0]?.url ?? "");
  if (url.protocol !== "https:" || url.hostname !== "nekos.best" || !url.pathname.endsWith(".gif")) {
    throw new Error("Pet reaction GIF service returned an invalid GIF URL.");
  }
  const embed = new EmbedBuilder().setColor(COLOR).setDescription(pet.name + " shares a little " + selected + " moment with you ♡").setImage(url.toString());
  return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
}
function status(pet, walletCoins = pet.coins) {
  return `**${pet.name}** the ${pet.species} · Level ${pet.level}
♡ Hunger: ${pet.hunger}/100 · Happiness: ${pet.happiness}/100
♡ Bond: ${pet.bond ?? 0} · Coins: ${walletCoins} · XP: ${pet.xp}
♡ Room: ${pet.room} · Outfit: ${pet.outfit}`;
}
async function refreshPetsPanel(guild, store, client) {
  const channel = guild.channels.cache.find((item) =>
    item.type === ChannelType.GuildText && item.name === CHANNEL_NAME,
  );
  if (!channel) return;
  const recent = await channel.messages.fetch({ limit: 50 });
  const panel = recent.find((message) => message.author?.id === client.user.id &&
    message.embeds.some((embed) => embed.title === "୨୧ 𝓥𝓲𝓻𝓽𝓾𝓪𝓵 𝓟𝓮𝓽𝓼 ♡"));
  if (panel) await panel.edit(panelPayload());
}
async function runPetCommand(message, store, client) {
  const match = /^!pet(?:\s+([a-z]+)(?:\s+([\s\S]+))?)?$/i.exec(message.content.trim());
  if (!match) return;
  const action = (match[1] || "view").toLowerCase();
  const argument = (match[2] || "").trim();
  const guildId = message.guild.id, userId = message.author.id;
  let profile = store.get(guildId, userId);
  const vip = isVip(message.member);
  let pet = profile ? (profile.activePetIndex > 0 ? profile.additionalPets?.[profile.activePetIndex - 1] : profile) : null;
  if (profile) {
    profile.coins ??= 100;
    if (pet) { applyNeedsDecay(pet); refreshPetUnlocks(pet); }
  }
  const reply = (content) => message.reply({ content, allowedMentions: { repliedUser: false } });

  if (action === "adopt") {
    if (profile && !vip) return reply("You already have a pet ♡ VIP members can unlock more pet slots.");
    if (profile && 1 + (profile.additionalPets?.length ?? 0) >= (profile.slots ?? 1)) return reply("All your pet slots are full. Use `!pet slots` to unlock another VIP slot ♡");
    return message.reply({ embeds: [buildAdoptionEmbed(null, vip)], components: [buildSpeciesSelect(userId)], allowedMentions: { repliedUser: false } });
  }
  if (!pet) return reply("You don't have a pet yet. Choose a species with `!pet adopt` ♡");

  if (action === "select") {
    const index = Number(argument);
    const count = 1 + (profile.additionalPets?.length ?? 0);
    if (!Number.isInteger(index) || index < 1 || index > count) return reply(`Choose a pet number from 1 to ${count} ♡`);
    profile.activePetIndex = index - 1;
    store.save(guildId, userId, profile);
    pet = index === 1 ? profile : profile.additionalPets[index - 2];
    return reply("Now caring for " + pet.name + " ♡\n" + status(pet, profile.coins));
  }
  if (action === "view" || action === "status") {
    pet.id ??= randomUUID();
    pet.visualIdentity ??= createPetVisualIdentity();
    store.save(guildId, userId, profile);
    queuePetArtwork(message, store, profile, pet);
    const artPath = pet.visualIdentity?.artStatus === "ready" ? pet.visualIdentity.artPath : null;
    if (artPath && fs.existsSync(artPath)) {
      return message.reply({ content: status(pet), files: [artPath], allowedMentions: { repliedUser: false } });
    }
    return reply(status(pet, profile.coins) + (pet.visualIdentity?.artStatus === "generating" ? "\n♡ Your unique artwork is being created..." : ""));
  }

  if (action === "stats") {
    const pets = [profile, ...(profile.additionalPets ?? [])].filter(Boolean);
    return reply(`**${message.author.username}'s Pet Stats ♡**\nPets owned: ${pets.length}\nActive pet: ${pet.name}\nLevel: ${pet.level}\nXP: ${pet.xp}\nHunger: ${pet.hunger}/100\nHappiness: ${pet.happiness}/100\nCoins: ${profile.coins}\nBond: ${pet.bond ?? 0}\nDialogues: ${pet.dialogueCount ?? 0}\nStories unlocked: ${(pet.storyUnlocks ?? []).length}`);
  }
  if (action === "talk") {
    const lines = {
      gentle: [` ${pet.name} nuzzles your hand. "I'm happiest when we're together."`, ` ${pet.name} gives you a tiny, warm smile. "You make my world feel safe."`],
      mischievous: [` ${pet.name} hides behind your back, clearly plotting something silly.`, ` ${pet.name} boops your nose and pretends nothing happened.`],
      sleepy: [` ${pet.name} yawns. "Five more minutes... stay here?"`, ` ${pet.name} curls up beside you with a tiny sigh.`],
      curious: [` ${pet.name} tilts their head. "What's that? Can we explore?"`, ` ${pet.name} investigates your sleeve like it's a great mystery.`],
      playful: [` ${pet.name} bounces excitedly. "Play with me, please!"`, ` ${pet.name} brings you an imaginary present.`],
      shy: [` ${pet.name} peeks out, then quietly scoots closer to you.`, ` ${pet.name} whispers, "I saved you the comfiest spot."`],
      adventurous: [` ${pet.name} looks toward the horizon. "Let's discover somewhere new!"`, ` ${pet.name} is already ready for your next little adventure.`],
    };
    const personalityText = String(pet.visualIdentity?.personality ?? "gentle").toLowerCase();
    const personality = Object.keys(lines).find((trait) => personalityText.includes(trait)) ?? "gentle";
    const bondDialogue = (pet.bond ?? 0) >= 30
      ? [`${pet.name} whispers, "I know your footsteps. I always hope it's you."`, `${pet.name} curls close. "You're my safest place."`]
      : (pet.bond ?? 0) >= 15
        ? [`${pet.name} nudges you. "I saved my favourite moment of the day for you."`, `${pet.name} says, "I think we're becoming family."`]
        : (pet.bond ?? 0) >= 5
          ? [`${pet.name} looks delighted. "I remember you. You're my person!"`]
          : [];
    const unlockedDialogue = pet.level >= 10
      ? [`${pet.name} whispers, "No matter how far we go, you're my favorite part of every story."`, `${pet.name} looks at you with a knowing smile. "Remember our very first day together?"`]
      : pet.level >= 5
        ? [`${pet.name} tells you about a dream where you explored a castle in the clouds.`, `${pet.name} says, "I think we're becoming quite the team."`]
        : pet.level >= 3
          ? [`${pet.name} has a new little secret to share: "I saved a special place in my heart for you."`, `${pet.name} asks if you'll go on another adventure soon.`]
          : [];
    const line = choose([...lines[personality], ...unlockedDialogue, ...bondDialogue]);
    pet.dialogueCount = (pet.dialogueCount ?? 0) + 1;
    pet.happiness = Math.min(100, pet.happiness + 2);
    pet.bond = Math.min(100, (pet.bond ?? 0) + 2);
    if (pet.bond >= 10 && !pet.gifUnlocks?.includes("happy")) pet.gifUnlocks = [...(pet.gifUnlocks ?? []), "happy"];
    if (pet.bond >= 25 && !pet.gifUnlocks?.includes("dance")) pet.gifUnlocks = [...(pet.gifUnlocks ?? []), "dance"];
    if (pet.bond >= 50 && !pet.gifUnlocks?.includes("sleep")) pet.gifUnlocks = [...(pet.gifUnlocks ?? []), "sleep"];
    store.save(guildId, userId, profile);
    return reply(line + " ♡");
  }
  if (action === "gif") return sendPetGif(message, pet, argument.toLowerCase() || null);
  if (action === "story") {
    const thresholds = [{ level: 3, id: "first-adventure", title: "A Little Adventure" }, { level: 5, id: "secret-garden", title: "The Secret Garden" }, { level: 10, id: "starlight-promise", title: "A Starlight Promise" }];
    const unlocked = thresholds.filter((item) => pet.level >= item.level);
    pet.storyUnlocks = [...new Set([...(pet.storyUnlocks ?? []), ...unlocked.map((item) => item.id)])];
    const available = unlocked.length
      ? unlocked.map((item) => `**${item.title}** · ${item.id === "first-adventure" ? "You and " + pet.name + " discover a tiny path full of flowers and new smells." : item.id === "secret-garden" ? pet.name + " finds a hidden garden that seems to bloom just for you." : pet.name + " makes a quiet wish beneath a sky full of stars, promising to stay by your side."}`).join("\n\n")
      : "Your first story unlocks at level 3. Keep caring for your companion ♡";
    store.save(guildId, userId, profile);
    return reply("**" + pet.name + "'s Stories ♡**\n" + available);
  }
  if (["name", "color", "breed", "appearance", "personality"].includes(action)) {
    if (!vip) return reply("Pet customization is a VIP feature ♡");
    if (!argument || argument.length > 60) return reply("Please provide a customization value (1–60 characters).");
    pet.visualIdentity ??= createPetVisualIdentity();
    if (action === "name") pet.name = argument.slice(0, 24);
    if (action === "color") pet.visualIdentity.palette = argument.slice(0, 40);
    if (action === "breed") pet.visualIdentity.breed = argument.slice(0, 40);
    if (action === "appearance") pet.visualIdentity.appearance = argument.slice(0, 60);
    if (action === "personality") pet.visualIdentity.personality = argument.slice(0, 60);
    if (pet.visualIdentity.artPath && fs.existsSync(pet.visualIdentity.artPath)) {
      fs.unlinkSync(pet.visualIdentity.artPath);
    }
    pet.visualIdentity.artStatus = "not_generated";
    pet.visualIdentity.artPath = null;
    pet.visualIdentity.artCreatedAt = null;
    store.save(guildId, userId, profile);
    queuePetArtwork(message, store, profile, pet);
    return reply("Your pet's identity has been updated ♡ I'll create artwork matching the new design if image generation is enabled.");
  }

  if (action === "daily") {
    const today = chileDateKey();
    if (profile.lastDailyReward === today) return reply("You already collected today's reward ♡ Come back tomorrow.");
    const reward = vip ? 25 : 20;
    profile.lastDailyReward = today;
    profile.coins += reward;
    store.save(guildId, userId, profile);
    return reply("Daily care bonus: +" + reward + " coins ♡ Your balance is " + profile.coins + ".");
  } else if (action === "feed") {
    if (pet.hunger >= 100) return reply("Your pet is already full ♡");
    if (profile.coins < SHOP.treat) return reply("You need 10 coins for a treat. Earn coins with daily rewards and server activity ♡");
    profile.coins -= SHOP.treat; pet.hunger = Math.min(100, pet.hunger + 25); pet.xp += 2; pet.bond = Math.min(100, (pet.bond ?? 0) + 1);
  } else if (action === "play") {
    pet.happiness = Math.min(100, pet.happiness + 20); pet.hunger = Math.max(0, pet.hunger - 8); pet.xp += 8;
    pet.bond = Math.min(100, (pet.bond ?? 0) + 5);
  } else if (action === "cuddle") {
    pet.happiness = Math.min(100, pet.happiness + 12); pet.xp += 3;
    pet.bond = Math.min(100, (pet.bond ?? 0) + 3);
  } else if (action === "shop") {
    return reply("**Pet shop ♡**\n`!pet buy treat` — 10 coins\n`!pet buy toy` — 25 coins\n`!pet buy potion` — 60 coins (fills hunger completely)\nUse `!pet use <item>` to use an item.");
  } else if (action === "buy") {
    const item = argument.toLowerCase();
    const price = SHOP[item];
    if (!price) return reply("Choose `treat`, `toy` or `potion` ♡");
    if (profile.coins < price) return reply("You don't have enough coins yet ♡");
    profile.coins -= price; pet.inventory ??= []; pet.inventory.push(item);
  } else if (action === "use") {
    const item = argument.toLowerCase();
    pet.inventory ??= [];
    const index = pet.inventory.indexOf(item);
    if (index < 0) return reply("You don't have that item in your inventory ♡");
    if (item === "potion") {
      pet.hunger = 100;
    } else if (item === "treat") {
      pet.hunger = Math.min(100, pet.hunger + 25);
      pet.bond = Math.min(100, (pet.bond ?? 0) + 2);
    } else if (item === "toy") {
      pet.happiness = Math.min(100, pet.happiness + 20);
      pet.hunger = Math.max(0, pet.hunger - 2);
      pet.bond = Math.min(100, (pet.bond ?? 0) + 4);
    } else return reply("That item cannot be used yet ♡");
    pet.inventory.splice(index, 1);
    pet.xp += 2;
  } else if (action === "inventory") {
    return reply(pet.inventory?.length ? "Your inventory: " + pet.inventory.join(", ") : "Your inventory is empty ♡");
  } else if (["room", "outfit", "rare", "slots", "minigame"].includes(action)) {
    if (!vip) return reply("That pet feature is VIP-only ♡ Your pet and progress are still yours.");
    if (action === "room") pet.room = "VIP dream room";
    if (action === "outfit") {
      if (!argument) return reply("Use `!pet outfit <name>` to choose an outfit.");
      pet.outfit = argument.slice(0, 30);
    }
    if (action === "rare") {
      if (!pet.species.startsWith("rare ")) pet.species = "rare " + pet.species;
      pet.xp += 15;
    }
    if (action === "slots") {
      profile.slots = Math.min(3, Math.max(1, Number(profile.slots) || 1) + 1);
      store.save(guildId, userId, profile);
      return reply(`VIP pet slots: ${profile.slots}/3 ♡ Use !pet adopt to fill your new slot.`);
    }
    if (action === "minigame") {
      const today = chileDateKey();
      if (pet.lastMinigame === today) return reply("You already played today's minigame. Come back tomorrow ♡");
      pet.lastMinigame = today; profile.coins += 30; pet.xp += 10;
    }
  } else {
    return reply("Try `!pet adopt`, `stats`, `feed`, `play`, `talk`, `story`, `shop`, `inventory`, or `select` ♡");
  }

  while (pet.xp >= pet.level * 25) { pet.xp -= pet.level * 25; pet.level += 1; }
  store.save(guildId, userId, profile);
  await refreshPetsPanel(message.guild, store, client);
  return reply("Done ♡\n" + status(pet, profile.coins));
}
export function attachPetSystem(client, store) {
  if (!store) throw new Error("The virtual-pet store is required.");
  client.once(Events.ClientReady, async () => {
    for (const guild of client.guilds.cache.values()) {
      await ensurePetCategoryPosition(guild);
      try { await ensurePetsChannel(guild, client, store); }
      catch (error) { console.error("[pets] channel setup failed: " + error.message); }
    }
  });
  client.on(Events.GuildCreate, (guild) => {
    void ensurePetCategoryPosition(guild).then(() => ensurePetsChannel(guild, client, store))
      .catch((error) => console.error("[pets] channel setup failed: " + error.message));
  });
  client.on(Events.InteractionCreate, async (interaction) => {
    const owned = (ownerId) => interaction.user.id === ownerId;
    const createAdoptedPet = async (species, customization = {}) => {
      const guild = interaction.guild, user = interaction.user, vip = isVip(interaction.member);
      if (!guild || !PET_SPECIES_OPTIONS.includes(species)) throw new Error("Invalid pet adoption request.");
      let profile = store.get(guild.id, user.id);
      const count = profile ? 1 + (profile.additionalPets?.length ?? 0) : 0;
      if (profile && !vip) throw new Error("You already have a pet ♡ VIP members can unlock more pet slots.");
      if (profile && count >= (profile.slots ?? 1)) throw new Error("All your pet slots are full. Use `!pet slots` to unlock another VIP slot ♡");
      const companion = makePet(species);
      if (profile) companion.coins = 0;
      if (vip) {
        if (customization.name) companion.name = customization.name.slice(0, 24);
        if (customization.color) companion.visualIdentity.palette = customization.color.slice(0, 40);
        if (customization.breed) companion.visualIdentity.breed = customization.breed.slice(0, 40);
        if (customization.appearance) companion.visualIdentity.appearance = customization.appearance.slice(0, 60);
        if (customization.personality) companion.visualIdentity.personality = customization.personality.slice(0, 60);
      } else companion.name = choose(["Mochi", "Mimi", "Mallow", "Peaches", "Pudding", "Boba", "Cookie", "Tofu"]);
      if (!profile) profile = companion;
      else {
        if (!customization.name) companion.name = "Mochi " + (count + 1);
        profile.additionalPets ??= []; profile.additionalPets.push(companion); profile.activePetIndex = count;
      }
      store.save(guild.id, user.id, profile);
      queuePetArtwork({ guild, author: user, channel: interaction.channel }, store, profile, companion);
      await refreshPetsPanel(guild, store, client);
      return companion;
    };

    if (interaction.isStringSelectMenu?.() && interaction.customId.startsWith("sugar-pets:species:")) {
      const ownerId = interaction.customId.split(":")[2];
      if (!owned(ownerId)) return interaction.reply({ content: "This adoption menu belongs to someone else ♡", ephemeral: true });
      const species = interaction.values?.[0];
      if (!PET_SPECIES_OPTIONS.includes(species)) return interaction.reply({ content: "Please choose a valid species ♡", ephemeral: true });
      const vip = isVip(interaction.member);
      return interaction.update({ embeds: [buildAdoptionEmbed(species, vip)], components: [buildAdoptionActions(ownerId, species, vip)] });
    }

    if (interaction.isModalSubmit?.() && interaction.customId.startsWith("sugar-pets:customize-submit:")) {
      const [, , ownerId, encodedSpecies] = interaction.customId.split(":");
      if (!owned(ownerId)) return interaction.reply({ content: "This customisation form belongs to someone else ♡", ephemeral: true });
      if (!isVip(interaction.member)) return interaction.reply({ content: "Full pet customisation is a VIP feature ♡ Your pet can still receive a random design.", ephemeral: true });
      try {
        const companion = await createAdoptedPet(decodeURIComponent(encodedSpecies || ""), {
          name: interaction.fields.getTextInputValue("pet_name").trim(), color: interaction.fields.getTextInputValue("pet_color").trim(),
          breed: interaction.fields.getTextInputValue("pet_breed").trim(), appearance: interaction.fields.getTextInputValue("pet_appearance").trim(),
          personality: interaction.fields.getTextInputValue("pet_personality").trim(),
        });
        return interaction.reply({ content: "Welcome home, **" + companion.name + "** the " + companion.species + "! Your custom companion is being created ♡\n" + status(companion), ephemeral: true });
      } catch (error) { return interaction.reply({ content: error.message, ephemeral: true }); }
    }

    if (interaction.isButton?.() && (interaction.customId === "sugar-pets:global-top" || interaction.customId.startsWith("sugar-pets:adopt:") || interaction.customId.startsWith("sugar-pets:customize:"))) {
      if (interaction.customId === "sugar-pets:global-top") {
        try {
          if (!interaction.guild) return interaction.reply({ content: "The global pet top is only available inside a server ♡", ephemeral: true });
          return interaction.reply({ embeds: [buildGlobalPetLeaderboard(store, interaction.guild.id)], ephemeral: true });
        } catch (error) { console.error("[pets] leaderboard failed: " + error.message); return interaction.reply({ content: "Could not load the global pet top. Please try again ♡", ephemeral: true }); }
      }
      const [, action, ownerId, encodedSpecies] = interaction.customId.split(":");
      if (!owned(ownerId)) return interaction.reply({ content: "This adoption belongs to someone else ♡", ephemeral: true });
      const species = decodeURIComponent(encodedSpecies || "");
      if (action === "customize") {
        if (!isVip(interaction.member)) return interaction.reply({ content: "Full pet customisation is a VIP feature ♡", ephemeral: true });
        return interaction.showModal(buildAdoptionModal(ownerId, species));
      }
      if (action === "adopt") {
        try {
          const companion = await createAdoptedPet(species);
          const vip = isVip(interaction.member);
          return interaction.update({ embeds: [buildAdoptionEmbed(species, vip).setDescription("You adopted **" + companion.name + "** the " + companion.species + "!\n\n" + (vip ? "Your companion is ready to meet you." : "Sugar chose a unique random design for you. VIP members can customise every detail of future companions.") + " ♡\n\n" + status(companion))], components: [] });
        } catch (error) { return interaction.reply({ content: error.message, ephemeral: true }); }
      }
    }

    if (!interaction.isButton?.() || interaction.customId !== BUTTON_ID) return;
    try {
      const guild = interaction.guild;
      if (!guild) return interaction.reply({ content: "Pet rooms are only available inside a server ♡", ephemeral: true });
      const topic = `Sugar personal pet room for ${interaction.user.id}`;
      let petChannel = guild.channels.cache.find((item) => item.type === ChannelType.GuildText && item.topic === topic);
      if (!petChannel) {
        await guild.channels.fetch();
        petChannel = guild.channels.cache.find((item) => item.type === ChannelType.GuildText && item.topic === topic);
      }
      if (!petChannel) {
        const petsCategory = guild.channels.cache.get(PET_ROOMS_CATEGORY_ID) ??
          await guild.channels.fetch(PET_ROOMS_CATEGORY_ID).catch(() => null);
        if (!petsCategory || petsCategory.type !== ChannelType.GuildCategory) {
          return interaction.reply({
            content: "The pet rooms category is unavailable. Please ask a moderator to check the server setup ♡",
            ephemeral: true,
          });
        }
        petChannel = await guild.channels.create({
          name: formatPetChannelName(interaction.user.username), type: ChannelType.GuildText,
          parent: PET_ROOMS_CATEGORY_ID, topic,
          permissionOverwrites: [
            { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks], deny: [PermissionFlagsBits.AddReactions] },
            { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ManageMessages], deny: [PermissionFlagsBits.AddReactions] },
          ], reason: "Create a private personal pet channel",
        });
        await petChannel.send({ content: `Welcome <@${interaction.user.id}>! Your little pet corner is ready ♡`, embeds: [buildPetCommandsEmbed()], allowedMentions: { users: [interaction.user.id] } });
      }
      const roomMessages = await petChannel.messages.fetch({ limit: 20 });
      const commandsEmbed = roomMessages.find((message) => message.author?.id === client.user.id && message.embeds.some((embed) => embed.title === "୨୧ 𝓟𝓮𝓽 𝓡𝓸𝓸𝓶 · 𝓒𝓸𝓶𝓶𝓪𝓷𝓭𝓼 ♡"));
      if (commandsEmbed) await commandsEmbed.edit({ embeds: [buildPetCommandsEmbed()] }); else await petChannel.send({ embeds: [buildPetCommandsEmbed()] });
      await petChannel.permissionOverwrites.edit(interaction.user.id, { AddReactions: false });
      await petChannel.permissionOverwrites.edit(client.user.id, { AddReactions: false });
      await interaction.reply({ content: `Your pet room is ready: <#${petChannel.id}> ♡`, ephemeral: true });
    } catch (error) {
      console.error("[pets] could not open pet channel: " + error.message);
      if (!interaction.replied) await interaction.reply({ content: "I couldn’t open your pet room. Please try again ♡", ephemeral: true }).catch(() => {});
    }
  });
    client.on(Events.MessageCreate, async (message) => {
    if (!message.guild || message.guild.id !== "1567093019377930363" || message.author?.bot || message.webhookId ||
        !message.member?.roles?.cache?.has(MEMBER_ROLE_ID) || message.channel?.type !== ChannelType.GuildText) return;
    const content = String(message.content ?? "").trim();
    if (content.length < 12 || content.startsWith("!")) return;
    if (/^Sugar personal pet room for [0-9]{17,20}$/.test(message.channel.topic ?? "")) return;
    const profile = store.get(message.guild.id, message.author.id);
    if (!profile) return;
    const now = Date.now();
    const today = chileDateKey(new Date(now));
    profile.activity ??= { day: today, lastMessageAt: 0, earnedToday: 0 };
    if (profile.activity.day !== today) profile.activity = { day: today, lastMessageAt: 0, earnedToday: 0 };
    if (now - (Number(profile.activity.lastMessageAt) || 0) < 60_000 || profile.activity.earnedToday >= 20) return;
    profile.coins = (Number(profile.coins) || 0) + 1;
    profile.activity.lastMessageAt = now;
    profile.activity.earnedToday += 1;
    store.save(message.guild.id, message.author.id, profile);
  });
  client.on(Events.MessageCreate, async (message) => {
    if (!message.guild || message.author?.bot || message.channel?.type !== ChannelType.GuildText) return;
    const ownerId = /^Sugar personal pet room for (\d{17,20})$/.exec(message.channel.topic ?? "")?.[1];
    if (!ownerId || ownerId !== message.author.id || !/^!pet(?:\s|$)/i.test(message.content.trim())) return;
    try { await runPetCommand(message, store, client); }
    catch (error) {
      console.error("[pets] command failed: " + error.message);
      await message.reply("Something went wrong with your pet command ♡").catch(() => {});
    }
  });
}
