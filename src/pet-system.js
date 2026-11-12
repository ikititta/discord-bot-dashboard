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
export const PET_ADOPTION_CHANNEL_IDS = new Set(["1570257241511170150", "1570263323159695482"]);
export const PET_ROOMS_CATEGORY_ID = "1568179038625857576";
export const PET_PANEL_CHANNEL_ID = "1570223501317513408";
export const PET_CATEGORY_BELOW_ID = "";
const BUTTON_ID = "sugar-pets:open";
const PET_SPECIES = {
  cat: "cat", kitten: "cat", dog: "dog", puppy: "dog",
  hamster: "hamster", rabbit: "rabbit", bunny: "rabbit", fish: "fish", bird: "bird",
  guinea: "guinea pig", "guinea pig": "guinea pig", "guinea-pig": "guinea pig",
  turtle: "turtle", fox: "fox", ferret: "ferret", hedgehog: "hedgehog",
  chinchilla: "chinchilla", mouse: "mouse", rat: "rat", squirrel: "squirrel",
  raccoon: "raccoon", deer: "deer", owl: "owl", parrot: "parrot",
  snake: "snake", lizard: "lizard", frog: "frog", axolotl: "axolotl",
};
const PET_SPECIES_OPTIONS = [...new Set(Object.values(PET_SPECIES))];
export const VIP_ONLY_PET_SPECIES = new Set(PET_SPECIES_OPTIONS.filter((species) => !["cat", "dog"].includes(species)));
export function canAdoptSpecies(species, vip) {
  const normalized = PET_SPECIES[String(species ?? "").toLowerCase()] ?? String(species ?? "").toLowerCase();
  return PET_SPECIES_OPTIONS.includes(normalized) && (vip === true || !VIP_ONLY_PET_SPECIES.has(normalized));
}
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
  delete(guildId, userId) {
    const guild = this.data.guilds[guildId];
    if (!guild || !Object.hasOwn(guild, userId)) return false;
    delete guild[userId];
    const temp = this.file + ".tmp";
    fs.writeFileSync(temp, JSON.stringify(this.data, null, 2), { mode: 0o600 });
    fs.chmodSync(temp, 0o600);
    fs.renameSync(temp, this.file);
    return true;
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

export function migratePetWallet(profile) {
  if (!profile || profile.walletVersion === 1) return profile;
  const additional = Array.isArray(profile.additionalPets) ? profile.additionalPets : [];
  const primaryCoins = Number.isFinite(Number(profile.coins)) ? Math.max(0, Number(profile.coins)) : 100;
  const legacyAdditionalCoins = additional.reduce((total, pet) => total + Math.max(0, Number(pet?.coins) || 0), 0);
  profile.coins = primaryCoins + legacyAdditionalCoins;
  for (const pet of additional) if (pet && typeof pet === "object") pet.coins = 0;
  profile.walletVersion = 1;
  return profile;
}
export function canAdoptPet(profile, vip) {
  if (!profile) return true;
  if (!vip) return false;
  const count = 1 + (profile.additionalPets?.length ?? 0);
  return count < Math.max(1, Number(profile.slots) || 1);
}
function normalizePetChannelLabel(value) {
  const label = String(value ?? "member").normalize("NFKC").toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 42).replace(/-+$/g, "");
  return label || "member";
}
export function formatPetChannelName(username) {
  return `🐾｜୨୧・${toRoyalBold(normalizePetChannelLabel(username))}’s 𝓹𝓮𝓽`;
}


export function isUsersPetRoom(channel, userId) {
  if (!channel || !userId || channel.type !== ChannelType.GuildText) return false;
  const topicOwner = /^Sugar personal pet room for (\d{17,20})$/.exec(channel.topic ?? "")?.[1];
  if (topicOwner) return topicOwner === userId;
  if (!/^🐾｜୨୧・.+’s 𝓹𝓮𝓽$/u.test(channel.name ?? "")) return false;
  const ownerOverwrite = channel.permissionOverwrites?.cache?.get(userId);
  const everyoneOverwrite = channel.permissionOverwrites?.cache?.get(channel.guild?.id);
  return Boolean(ownerOverwrite?.allow?.has(PermissionFlagsBits.SendMessages) &&
    everyoneOverwrite?.deny?.has(PermissionFlagsBits.ViewChannel));
}

function isVip(member) {
  return member?.roles?.cache?.has(VIP_ROLE_ID) === true;
}
export function canDeletePet(vip) {
  return vip === true;
}
function buildPetEmbed() {
  return new EmbedBuilder().setColor(COLOR).setTitle("୨୧ 𝓥𝓲𝓻𝓽𝓾𝓪𝓵 𝓟𝓮𝓽𝓼 ♡")
    .setDescription("Adopt your own virtual companion, create a private pet room and take care of your little friend ♡\n\n" +
      "All pet commands and activities are available inside your private room. Create your room below to get started!");
}
function buildPetRoomWelcomeEmbed(profile, pet, vip = false) {
  const description = pet
    ? status(pet, profile.coins, vip) + "\n\nThis is your little private corner together. Your companion was adopted in **#🐾｜୨୧ ・𝓹𝓮𝓽𝓼** and all their progress is saved here ♡"
    : "Your private pet corner is ready ♡ Adopt and choose your companion in **#🐾｜୨୧ ・𝓹𝓮𝓽𝓼** first. Once you have adopted them, their profile and information will appear here.";
  return new EmbedBuilder().setColor(COLOR).setTitle("୨୧ 𝓦𝓮𝓵𝓬𝓸𝓶𝓮 𝓱𝓸𝓶𝓮 ♡").setDescription(description)
    .setFooter({ text: "A little home for you and your companion ♡" });
}
const PET_HELP_CATEGORIES = {
  care: { label: "Care & bonding", title: "୨୧ 𝓒𝓪𝓻𝓮 & 𝓑𝓸𝓷𝓭𝓲𝓷𝓰 ♡", body: "`!pet` · `!pet stats` · `!pet feed` · `!pet play` · `!pet cuddle` · `!pet talk` · `!pet story` · `!pet gif [happy|dance|sleep]`\n\nFeed, play, cuddle and talk to care for your companion, build your bond and unlock stories and GIFs." },
  coins: { label: "Coins & items", title: "୨୧ 𝓒𝓸𝓲𝓷𝓼 & 𝓘𝓽𝓮𝓶𝓼 ♡", body: "`!pet daily` · `!pet shop` · `!pet buy <treat|toy|potion>` · `!pet use <item>` · `!pet inventory`\n\nEarn daily coins, buy treats, toys and potions. Your wallet is shared by all your pets." },
  manage: { label: "My pets", title: "୨୧ 𝓜𝔂 𝓟𝓮𝓽𝓼 ♡", body: "`!pet select <number>` · `!pet stats`\n\nChoose which companion is active and check their individual stats. Adoption and species selection happen in the pets channel." },
  customize: { label: "Customisation", title: "୨୧ 𝓒𝓾𝓼𝓽𝓸𝓶𝓲𝓼𝓪𝓽𝓲𝓸𝓷 ♡", body: "`!pet name <name>` · `!pet color <color>` · `!pet breed <breed>` · `!pet appearance <details>` · `!pet personality <traits>`\n\nVIP members can customise their companion's identity." },
  vip: { label: "VIP features", title: "୨୧ 𝓥𝓘𝓟 𝓕𝓮𝓪𝓽𝓾𝓻𝓮𝓼 ♡", body: "`!pet delete` · `!pet room` · `!pet outfit <name>` · `!pet slots` · `!pet minigame`\n\nVIP unlocks extra species, customisation, additional pet slots and pet deletion." },
};
function buildPetStickyPayload(ownerId) {
  const row = new ActionRowBuilder().addComponents(
    ...Object.entries(PET_HELP_CATEGORIES).map(([key, item]) =>
      new ButtonBuilder().setCustomId("sugar-pets:help:" + ownerId + ":" + key).setLabel(item.label).setStyle(ButtonStyle.Secondary)),
  );
  return { embeds: [new EmbedBuilder().setColor(COLOR).setTitle("୨୧ 𝓟𝓮𝓽 𝓗𝓮𝓵𝓹 ♡")
    .setDescription("Choose a category to see the commands for your companion ♡")], components: [row] };
}
function buildPetCategoryEmbed(category) {
  const item = PET_HELP_CATEGORIES[category];
  return new EmbedBuilder().setColor(COLOR).setTitle(item.title).setDescription(item.body)
    .setFooter({ text: "Use these commands in your private pet room ♡" });
}
function buildAdoptionEmbed(selectedSpecies = null, vip = false) {
  const speciesLine = selectedSpecies ? "Selected companion: **" + selectedSpecies + "** ♡" : "Choose the species you’d love to meet ♡";
  const designLine = vip
    ? "As a VIP member, you can customise your companion’s name, gender, colour, breed, appearance and personality. You also unlock the full species collection ♡"
    : "Your companion will receive a one-of-a-kind random name and design. Only cats and dogs are available to everyone. Every other species is VIP-exclusive, along with full customisation ♡";
  return new EmbedBuilder().setColor(COLOR).setTitle("୨୧ 𝓐 𝓛𝓲𝓽𝓽𝓵𝓮 𝓐𝓭𝓸𝓹𝓽𝓲𝓸𝓷 ♡")
    .setDescription(speciesLine + "\n\n" + designLine + "\n\nPick a species below to continue.")
    .setFooter({ text: "Every companion gets its own unique identity ♡" });
}
function buildSpeciesSelect(userId, vip = false) {
  return new ActionRowBuilder().addComponents(new StringSelectMenuBuilder()
    .setCustomId("sugar-pets:species:" + userId)
    .setPlaceholder("Choose your pet’s species ♡")
    .addOptions([
      { label: "Cat", value: "cat", emoji: "🐱" },
      { label: "Dog", value: "dog", emoji: "🐶" },
      { label: "Hamster", value: "hamster", emoji: "🐹" },
      { label: "Rabbit", value: "rabbit", emoji: "🐰" },
      { label: "Fish", value: "fish", emoji: "🐠" },
      { label: "Bird", value: "bird", emoji: "🐦" },
      { label: "Guinea pig", value: "guinea pig", emoji: "🐾" },
      { label: "Turtle", value: "turtle", emoji: "🐢" },
      { label: "Fox", value: "fox", emoji: "🦊" },
      { label: "Ferret", value: "ferret", emoji: "🤎" },
      { label: "Hedgehog", value: "hedgehog", emoji: "🦔" },
      { label: "Chinchilla", value: "chinchilla", emoji: "🐭" },
      { label: "Mouse", value: "mouse", emoji: "🐁" },
      { label: "Rat", value: "rat", emoji: "🐀" },
      { label: "Squirrel", value: "squirrel", emoji: "🐿️" },
      { label: "Raccoon", value: "raccoon", emoji: "🦝" },
      { label: "Deer", value: "deer", emoji: "🦌" },
      { label: "Owl", value: "owl", emoji: "🦉" },
      { label: "Parrot", value: "parrot", emoji: "🦜" },
      { label: "Snake", value: "snake", emoji: "🐍" },
      { label: "Lizard", value: "lizard", emoji: "🦎" },
      { label: "Frog", value: "frog", emoji: "🐸" },
      { label: "Axolotl", value: "axolotl", emoji: "🩷" },
    ].filter((option) => vip || !VIP_ONLY_PET_SPECIES.has(option.value))));
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
  const fields = [["pet_name", "Name", "Choose a name", true, 24], ["pet_gender", "Gender", "female or male", true, 6], ["pet_color", "Colour", "e.g. strawberry pink", false, 60], ["pet_appearance", "Appearance", "Describe face, body, ears, paws, markings...", false, 180], ["pet_personality", "Personality", "e.g. gentle, curious, playful", false, 100]];
  for (const [id, label, placeholder, required, maxLength] of fields) modal.addComponents(new ActionRowBuilder().addComponents(
    new TextInputBuilder().setCustomId(id).setLabel(label).setPlaceholder(placeholder).setStyle(id === "pet_appearance" || id === "pet_personality" ? TextInputStyle.Paragraph : TextInputStyle.Short).setRequired(required).setMaxLength(maxLength),
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
    new ButtonBuilder().setCustomId(BUTTON_ID).setLabel("Create A Pet Room ♡").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("sugar-pets:global-top").setLabel("Top Pets ♡").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("sugar-pets:create-pet").setLabel("Adopt A Pet ♡").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("sugar-pets:delete-pet").setLabel("Delete A Pet ♡").setStyle(ButtonStyle.Danger),
  )] };
}

async function ensurePetsChannel(guild, client, store) {
  // This is an existing server-managed channel. Never recreate it if it is
  // moved or renamed; only maintain the panel when the configured channel exists.
  // Use the configured channel ID, not its display name: the channel may
  // be renamed without preventing Sugar from refreshing the existing panel.
  const channel = guild.channels.cache.get(PET_PANEL_CHANNEL_ID) ??
    await guild.channels.fetch(PET_PANEL_CHANNEL_ID).catch(() => null);
  if (!channel) {
    console.warn(`[pets] existing pets channel was not found in guild ${guild.id}; no channel was created.`);
    return null;
  }
  await channel.permissionOverwrites.edit(guild.roles.everyone, {
    ViewChannel: true, SendMessages: true, AddReactions: false, CreatePublicThreads: false, SendMessagesInThreads: false, ReadMessageHistory: true,
  }, "Keep the virtual pets panel read-only");
  await channel.permissionOverwrites.edit(client.user.id, {
    ViewChannel: true, SendMessages: true, EmbedLinks: true, ReadMessageHistory: true,
    ManageMessages: true, AddReactions: false,
  }, "Allow Sugar to maintain the pets panel without reactions");
  const recent = await channel.messages.fetch({ limit: 100 });
  const oldPanels = recent.filter((message) => message.author?.id === client.user.id &&
    message.embeds.some((embed) => embed.title === "୨୧ 𝓥𝓲𝓻𝓽𝓾𝓪𝓵 𝓟𝓮𝓽𝓼 ♡"));
  if (oldPanels.size) {
    // Refresh every matching legacy panel so no stale two-button copy remains.
    await Promise.all([...oldPanels.values()].map((message) => message.edit(panelPayload())));
  } else {
    await channel.send(panelPayload());
  }
  return channel;
}

export async function ensurePetCategoryPosition(guild, onError = console.warn) {
  const category = guild.channels.cache.get(PET_ROOMS_CATEGORY_ID) ??
    await guild.channels.fetch(PET_ROOMS_CATEGORY_ID).catch(() => null);
  const reference = guild.channels.cache.get(PET_CATEGORY_BELOW_ID) ??
    await guild.channels.fetch(PET_CATEGORY_BELOW_ID).catch(() => null);
  if (!PET_CATEGORY_BELOW_ID || category?.type !== ChannelType.GuildCategory || reference?.type !== ChannelType.GuildCategory) {
    onError("[pets] pet-room category positioning skipped: no valid reference category is configured.");
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
    gender: choose(["female", "male"]),
    visualIdentity: createPetVisualIdentity(),
    level: 1, xp: 0, hunger: 70, happiness: 70, hygiene: 100, toilet: 100, energy: 100, bond: 0, coins: 100, walletVersion: 1,
    lastNeedsAt: Date.now(),
    inventory: [], room: "cozy room", outfit: "default", slots: 1, additionalPets: [], activePetIndex: 0,
    lastMinigame: null, lastDailyReward: null,
    dialogueCount: 0,
    storyUnlocks: [], gifUnlocks: [],
  };
}
function queuePetArtwork(message, store, profile, pet) {
  if (!String(process.env.CLOUDFLARE_ACCOUNT_ID ?? "").trim() || !String(process.env.CLOUDFLARE_API_TOKEN ?? "").trim()) return "missing-key";
  if (!pet.visualIdentity) return "unavailable";
  if (pet.visualIdentity.artStatus === "generating") return "generating";
  if (pet.visualIdentity.artStatus === "ready" && pet.visualIdentity.artPath && fs.existsSync(pet.visualIdentity.artPath)) return "ready";

  // A previous "ready" status is not enough: FadeHost may have restarted
  // without retaining the generated image file. Regenerate it when missing.
  pet.visualIdentity.artStatus = "generating";
  pet.visualIdentity.artPath = null;
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
  }).catch(async (error) => {
    pet.visualIdentity.artStatus = "failed";
    pet.visualIdentity.artPath = null;
    store.save(message.guild.id, message.author.id, profile);
    console.error("[pets] AI artwork generation failed: " + error.message);
    await message.channel.send({
      content: "I couldn't create your pet's illustration this time. Use `!pet` again to retry ♡",
      allowedMentions: { parse: [] },
    }).catch(() => {});
  });
  return "generating";
}

export function applyNeedsDecay(pet, now = Date.now()) {
  const last = Number(pet.lastNeedsAt) || now;
  const elapsedMs = Math.min(72 * 3_600_000, Math.max(0, now - last));
  const hungerProgress = (Number(pet.hungerDecayRemainderMs) || 0) + elapsedMs;
  const happinessProgress = (Number(pet.happinessDecayRemainderMs) || 0) + elapsedMs;
  const hungerLoss = Math.floor(hungerProgress / (3 * 3_600_000));
  const happinessLoss = Math.floor(happinessProgress / (12 * 3_600_000));
  pet.hunger = Math.max(0, (Number(pet.hunger) || 0) - hungerLoss);
  pet.happiness = Math.max(0, (Number(pet.happiness) || 0) - happinessLoss);
  pet.hungerDecayRemainderMs = hungerProgress % (3 * 3_600_000);
  pet.happinessDecayRemainderMs = happinessProgress % (12 * 3_600_000);
  pet.lastNeedsAt = now;
}

export function chileDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return values.year + "-" + values.month + "-" + values.day;
}

export function refreshPetUnlocks(pet) {
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
function status(pet, walletCoins = pet.coins, vip = false) {
  const displayName = pet.name + (vip ? " VIP" : "");
  return `**${displayName}** the ${pet.species} · ${pet.gender === "male" ? "Male" : "Female"} · Level ${pet.level}
♡ Hunger: ${pet.hunger}/100 · Happiness: ${pet.happiness}/100
♡ Hygiene: ${Number(pet.hygiene ?? 100)}/100 · Toilet: ${Number(pet.toilet ?? 100)}/100 · Energy: ${Number(pet.energy ?? 100)}/100
♡ Bond: ${pet.bond ?? 0} · Coins: ${walletCoins} · XP: ${pet.xp}
♡ Room: ${pet.room} · Outfit: ${pet.outfit}`;
}
export function removePetFromProfile(profile, petId) {
  if (!profile || !petId) return { removed: null, remaining: 0 };
  const additional = Array.isArray(profile.additionalPets) ? profile.additionalPets : [];
  let removed = null;
  if (profile.id === petId) {
    removed = structuredClone(profile);
    if (!additional.length) return { removed, remaining: 0, empty: true };
    const next = additional.shift();
    const coins = profile.coins, slots = profile.slots;
    Object.assign(profile, next);
    profile.coins = coins;
    profile.slots = slots;
    profile.additionalPets = additional;
    profile.activePetIndex = 0;
  } else {
    const index = additional.findIndex((item) => item?.id === petId);
    if (index < 0) return { removed: null, remaining: 1 + additional.length };
    [removed] = additional.splice(index, 1);
    profile.additionalPets = additional;
    if (Number(profile.activePetIndex) > index + 1) profile.activePetIndex -= 1;
    else if (Number(profile.activePetIndex) === index + 1) profile.activePetIndex = 0;
  }
  return { removed, remaining: 1 + (profile.additionalPets?.length ?? 0), empty: false };
}

export function parsePetDeleteConfirmationId(customId) {
  const match = /^sugar-pets:delete-confirm:([^:]+):([^:]+)$/.exec(String(customId ?? ""));
  return match ? { ownerId: match[1], petId: match[2] } : null;
}

function buildPetDeleteMenu(userId, profile) {
  const pets = [profile, ...(profile.additionalPets ?? [])].filter(Boolean);
  return new ActionRowBuilder().addComponents(new StringSelectMenuBuilder()
    .setCustomId("sugar-pets:delete-select:" + userId)
    .setPlaceholder("Choose the pet you want to delete")
    .addOptions(pets.map((pet, index) => ({
      label: String(pet.name || "Unnamed pet").slice(0, 100),
      description: (pet.species || "pet") + " · Slot " + (index + 1),
      value: String(pet.id),
    }))));
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
    migratePetWallet(profile);
    profile.coins ??= 100;
    if (pet) { applyNeedsDecay(pet); refreshPetUnlocks(pet); }
  }
  const reply = (content) => message.reply({ content, allowedMentions: { repliedUser: false } });

  if (action === "adopt") {
    if (profile && !vip) return reply("You already have a pet ♡ VIP members can unlock more pet slots.");
    if (profile && !canAdoptPet(profile, vip)) return reply("All your pet slots are full. Use `!pet slots` to unlock another VIP slot ♡");
    return message.reply({ embeds: [buildAdoptionEmbed(null, vip)], components: [buildSpeciesSelect(userId, vip)], allowedMentions: { repliedUser: false } });
  }
  if (action === "delete") {
    if (!canDeletePet(vip)) return reply("Deleting pets is a VIP-only feature ♡");
    if (!profile) return reply("You have no pets to delete ♡");
    const pets = [profile, ...(profile.additionalPets ?? [])].filter(Boolean);
    for (const item of pets) item.id ??= randomUUID();
    store.save(guildId, userId, profile);
    return message.reply({
      content: "Choose which companion you want to delete. Sugar will ask you to confirm before removing it ♡",
      components: [buildPetDeleteMenu(userId, profile)],
      allowedMentions: { repliedUser: false },
    });
  }
    if (!pet) return reply("You don't have a pet yet. Choose a species with `!pet adopt` ♡");

  if (action === "select") {
    const index = Number(argument);
    const count = 1 + (profile.additionalPets?.length ?? 0);
    if (!Number.isInteger(index) || index < 1 || index > count) return reply(`Choose a pet number from 1 to ${count} ♡`);
    profile.activePetIndex = index - 1;
    store.save(guildId, userId, profile);
    pet = index === 1 ? profile : profile.additionalPets[index - 2];
    return reply("Now caring for " + pet.name + (vip ? " VIP" : "") + " ♡\n" + status(pet, profile.coins, vip));
  }
  if (action === "redraw") {
    pet.id ??= randomUUID();
    pet.visualIdentity ??= createPetVisualIdentity();
    pet.visualIdentity.artStatus = "not_generated";
    pet.visualIdentity.artPath = null;
    pet.visualIdentity.artCreatedAt = null;
    store.save(guildId, userId, profile);
    const artworkStatus = queuePetArtwork(message, store, profile, pet);
    return reply(artworkStatus === "generating" ? "I'm redesigning your companion in the new kawaii chibi style, keeping their saved physical traits ♡" : artworkStatus === "missing-key" ? "Pet illustrations aren't configured. Please ask an admin to check the Cloudflare Workers AI settings in FadeHost." : "I couldn't start the new illustration right now. Please try again ♡");
  }

  if (action === "view" || action === "status") {
    pet.id ??= randomUUID();
    pet.visualIdentity ??= createPetVisualIdentity();
    store.save(guildId, userId, profile);
    const artworkStatus = queuePetArtwork(message, store, profile, pet);
    const artPath = pet.visualIdentity?.artStatus === "ready" ? pet.visualIdentity.artPath : null;
    if (artPath && fs.existsSync(artPath)) {
      return message.reply({ content: status(pet, profile.coins, vip), files: [artPath], allowedMentions: { repliedUser: false } });
    }
    const artworkNotice = artworkStatus === "missing-key"
      ? "\n♡ Pet illustrations aren't configured yet. Please ask an admin to check OPENAI_API_KEY in FadeHost."
      : artworkStatus === "generating"
        ? "\n♡ Your unique artwork is being created..."
        : artworkStatus === "unavailable"
          ? "\n♡ Your pet's illustration isn't available right now."
          : "";
    return reply(status(pet, profile.coins, vip) + artworkNotice);
  }

  if (action === "stats") {
    const pets = [profile, ...(profile.additionalPets ?? [])].filter(Boolean);
    return reply(`**${message.author.username}'s Pet Stats ♡**\nPets owned: ${pets.length}\nActive pet: ${pet.name}${vip ? " VIP" : ""}\nLevel: ${pet.level}\nXP: ${pet.xp}\nHunger: ${pet.hunger}/100\nHappiness: ${pet.happiness}/100\nCoins: ${profile.coins}\nBond: ${pet.bond ?? 0}\nDialogues: ${pet.dialogueCount ?? 0}\nStories unlocked: ${(pet.storyUnlocks ?? []).length}`);
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
    const maxLength = action === "appearance" ? 180 : 60;
    if (!argument || argument.length > maxLength) return reply("Please provide a customization value (1–" + maxLength + " characters).");
    pet.visualIdentity ??= createPetVisualIdentity();
    if (action === "name") pet.name = argument.slice(0, 24);
    if (action === "color") pet.visualIdentity.palette = argument.slice(0, 40);
    if (action === "breed") pet.visualIdentity.breed = argument.slice(0, 40);
    if (action === "appearance") pet.visualIdentity.appearance = argument.slice(0, 180);
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
  } else if (["room", "outfit", "slots", "minigame"].includes(action)) {
    if (!vip) return reply("That pet feature is VIP-only ♡ Your pet and progress are still yours.");
    if (action === "room") pet.room = "VIP dream room";
    if (action === "outfit") {
      if (!argument) return reply("Use `!pet outfit <name>` to choose an outfit.");
      pet.outfit = argument.slice(0, 30);
    }
    if (action === "slots") {
      const currentSlots = Math.max(1, Number(profile.slots) || 1);
      if (currentSlots >= 3) return reply("You already have the maximum of 3 VIP pet slots ♡");
      profile.slots = currentSlots + 1;
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
  refreshPetUnlocks(pet);
  store.save(guildId, userId, profile);
  await refreshPetsPanel(message.guild, store, client);
  return reply("Done ♡\n" + status(pet, profile.coins, vip));
}
export function attachPetSystem(client, store) {
  if (!store) throw new Error("The virtual-pet store is required.");
  client.once(Events.ClientReady, async () => {
    for (const guild of client.guilds.cache.values()) {
      try { await ensurePetsChannel(guild, client, store); }
      catch (error) { console.error("[pets] channel setup failed: " + error.message); }
    }
  });
  client.on(Events.GuildCreate, (guild) => {
    void ensurePetsChannel(guild, client, store)
      .catch((error) => console.error("[pets] channel setup failed: " + error.message));
  });
  client.on(Events.InteractionCreate, async (interaction) => {
    const owned = (ownerId) => interaction.user.id === ownerId;
    const createAdoptedPet = async (species, customization = {}) => {
      const guild = interaction.guild, user = interaction.user, vip = isVip(interaction.member);
      if (!guild || !canAdoptSpecies(species, vip)) {
        if (VIP_ONLY_PET_SPECIES.has(species)) throw new Error("That rare companion is VIP-only ♡");
        throw new Error("Invalid pet adoption request.");
      }
      let profile = store.get(guild.id, user.id);
      if (profile) migratePetWallet(profile);
      const count = profile ? 1 + (profile.additionalPets?.length ?? 0) : 0;
      if (profile && !vip) throw new Error("You already have a pet ♡ VIP members can unlock more pet slots.");
      if (profile && !canAdoptPet(profile, vip)) throw new Error("All your pet slots are full. Use `!pet slots` to unlock another VIP slot ♡");
      const companion = makePet(species);
      companion.vip = vip;
      if (vip && customization.gender) {
        const selectedGender = String(customization.gender).toLowerCase();
        if (!["female", "male"].includes(selectedGender)) throw new Error("Choose female or male for your pet ♡");
        companion.gender = selectedGender;
      }
      if (profile) companion.coins = 0;
      if (vip) {
        if (customization.name) companion.name = customization.name.slice(0, 24);
        if (customization.color) companion.visualIdentity.palette = customization.color.slice(0, 40);
        if (customization.breed) companion.visualIdentity.breed = customization.breed.slice(0, 40);
        if (customization.appearance) companion.visualIdentity.appearance = customization.appearance.slice(0, 180);
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

    if (interaction.isButton?.() && interaction.customId === "sugar-pets:create-pet") {
      const profile = store.get(interaction.guildId, interaction.user.id);
      const vip = isVip(interaction.member);
      if (profile && !vip) return interaction.reply({ content: "You already have a pet ♡ VIP members can unlock more pet slots.", ephemeral: true });
      if (profile && !canAdoptPet(profile, vip)) return interaction.reply({ content: "All your pet slots are full. Use !pet slots in your pet room to unlock another slot ♡", ephemeral: true });
      return interaction.reply({ embeds: [buildAdoptionEmbed(null, vip)], components: [buildSpeciesSelect(interaction.user.id, vip)], ephemeral: true });
    }

    if (interaction.isButton?.() && interaction.customId === "sugar-pets:delete-pet") {
      const profile = store.get(interaction.guildId, interaction.user.id);
      if (!canDeletePet(isVip(interaction.member))) return interaction.reply({ content: "Deleting pets is a VIP-only feature ♡", ephemeral: true });
      if (!profile) return interaction.reply({ content: "You have no pets to delete ♡", ephemeral: true });
      for (const item of [profile, ...(profile.additionalPets ?? [])]) item.id ??= randomUUID();
      store.save(interaction.guildId, interaction.user.id, profile);
      return interaction.reply({ content: "Choose which companion you want to delete. Sugar will ask you to confirm ♡", components: [buildPetDeleteMenu(interaction.user.id, profile)], ephemeral: true });
    }

    if (interaction.isButton?.() && interaction.customId.startsWith("sugar-pets:help:")) {
      const [, , ownerId, category] = interaction.customId.split(":");
      if (!owned(ownerId)) return interaction.reply({ content: "This pet help menu belongs to someone else ♡", ephemeral: true });
      if (!PET_HELP_CATEGORIES[category]) return interaction.reply({ content: "That help category is unavailable ♡", ephemeral: true });
      return interaction.reply({ embeds: [buildPetCategoryEmbed(category)], ephemeral: true });
    }

    if (interaction.isStringSelectMenu?.() && interaction.customId.startsWith("sugar-pets:delete-select:")) {
      const ownerId = interaction.customId.split(":")[2];
      if (!owned(ownerId)) return interaction.reply({ content: "This pet menu belongs to someone else ♡", ephemeral: true });
      if (!canDeletePet(isVip(interaction.member))) return interaction.reply({ content: "Deleting pets is a VIP-only feature ♡", ephemeral: true });
      const petId = interaction.values?.[0];
      const profile = store.get(interaction.guildId, ownerId);
      const selected = profile && [profile, ...(profile.additionalPets ?? [])].find((pet) => pet?.id === petId);
      if (!selected) return interaction.reply({ content: "That pet could not be found. Open !pet delete again ♡", ephemeral: true });
      const row = new ActionRowBuilder().addComponents(new ButtonBuilder()
        .setCustomId("sugar-pets:delete-confirm:" + ownerId + ":" + petId)
        .setLabel("Yes, delete this pet").setStyle(ButtonStyle.Danger));
      return interaction.reply({
        content: "Are you sure you want to permanently delete **" + selected.name + "** the " + selected.species + "? This cannot be undone.",
        components: [row], ephemeral: true,
      });
    }

    if (interaction.isButton?.() && interaction.customId.startsWith("sugar-pets:delete-confirm:")) {
      const confirmation = parsePetDeleteConfirmationId(interaction.customId);
      if (!confirmation) return interaction.reply({ content: "This deletion confirmation is invalid. Open !pet delete again ♡", ephemeral: true });
      const { ownerId, petId } = confirmation;
      if (!owned(ownerId)) return interaction.reply({ content: "This confirmation belongs to someone else ♡", ephemeral: true });
      if (!isVip(interaction.member)) return interaction.reply({ content: "Deleting pets is a VIP-only feature ♡", ephemeral: true });
      const profile = store.get(interaction.guildId, ownerId);
      if (!profile) return interaction.update({ content: "You no longer have any pets ♡", components: [] });
      const result = removePetFromProfile(profile, petId);
      if (!result.removed) return interaction.update({ content: "That pet was already removed. Open !pet delete to refresh the list ♡", components: [] });
      if (result.empty) store.delete(interaction.guildId, ownerId);
      else store.save(interaction.guildId, ownerId, profile);
      await refreshPetsPanel(interaction.guild, store, client);
      return interaction.update({
        content: result.empty
          ? "**" + result.removed.name + "** was deleted. You have no pets left; use !pet adopt whenever you want a new companion ♡"
          : "**" + result.removed.name + "** was deleted. You have " + result.remaining + " pet(s) remaining ♡",
        components: [],
      });
    }

    if (interaction.isStringSelectMenu?.() && interaction.customId.startsWith("sugar-pets:species:")) {
      const ownerId = interaction.customId.split(":")[2];
      if (!owned(ownerId)) return interaction.reply({ content: "This adoption menu belongs to someone else ♡", ephemeral: true });
      const species = interaction.values?.[0];
      const vip = isVip(interaction.member);
      if (!canAdoptSpecies(species, vip)) return interaction.reply({ content: VIP_ONLY_PET_SPECIES.has(species) ? "That rare companion is VIP-only ♡" : "Please choose a valid species ♡", ephemeral: true });
      return interaction.update({ embeds: [buildAdoptionEmbed(species, vip)], components: [buildAdoptionActions(ownerId, species, vip)] });
    }

    if (interaction.isModalSubmit?.() && interaction.customId.startsWith("sugar-pets:customize-submit:")) {
      const [, , ownerId, encodedSpecies] = interaction.customId.split(":");
      if (!owned(ownerId)) return interaction.reply({ content: "This customisation form belongs to someone else ♡", ephemeral: true });
      if (!isVip(interaction.member)) return interaction.reply({ content: "Full pet customisation is a VIP feature ♡ Your pet can still receive a random design.", ephemeral: true });
      await interaction.deferReply({ ephemeral: true });
      try {
        const companion = await createAdoptedPet(decodeURIComponent(encodedSpecies || ""), {
          name: interaction.fields.getTextInputValue("pet_name").trim(), gender: interaction.fields.getTextInputValue("pet_gender").trim(), color: interaction.fields.getTextInputValue("pet_color").trim(),
          breed: "",
          appearance: interaction.fields.getTextInputValue("pet_appearance").trim(),
          personality: interaction.fields.getTextInputValue("pet_personality").trim(),
        });
        return interaction.editReply({ content: "Welcome home, **" + companion.name + "** the " + companion.species + "! Your custom companion is being created ♡\n" + status(companion, store.get(interaction.guild.id, interaction.user.id)?.coins ?? companion.coins) });
      } catch (error) { return interaction.editReply({ content: error.message }); }
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
        await interaction.deferUpdate();
        try {
          const companion = await createAdoptedPet(species);
          const vip = isVip(interaction.member);
          return interaction.editReply({ embeds: [buildAdoptionEmbed(species, vip).setDescription("You adopted **" + companion.name + "** the " + companion.species + "!\n\n" + (vip ? "Your companion is ready to meet you." : "Sugar chose a unique random design for you. VIP members can customise every detail of future companions.") + " ♡\n\n" + status(companion, store.get(interaction.guild.id, interaction.user.id)?.coins ?? companion.coins))], components: [] });
        } catch (error) { return interaction.editReply({ content: error.message, embeds: [], components: [] }); }
      }
    }

    if (!interaction.isButton?.() || interaction.customId !== BUTTON_ID) return;
    await interaction.deferReply({ ephemeral: true });
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
        const ownerProfile = store.get(guild.id, interaction.user.id);
        const firstPet = ownerProfile ? (ownerProfile.activePetIndex > 0 ? ownerProfile.additionalPets?.[ownerProfile.activePetIndex - 1] : ownerProfile) : null;
        await petChannel.send({
          content: `Welcome <@${interaction.user.id}>! Your private pet corner is ready ♡`,
          embeds: [buildPetRoomWelcomeEmbed(ownerProfile, firstPet, isVip(interaction.member))],
          allowedMentions: { users: [interaction.user.id] },
        });
        await petChannel.send(buildPetStickyPayload(interaction.user.id));
      }
      const roomMessages = await petChannel.messages.fetch({ limit: 50 });
      const ownerProfile = store.get(guild.id, interaction.user.id);
      const activePet = ownerProfile ? (ownerProfile.activePetIndex > 0 ? ownerProfile.additionalPets?.[ownerProfile.activePetIndex - 1] : ownerProfile) : null;
      const welcome = roomMessages.find((message) => message.author?.id === client.user.id &&
        message.embeds.some((embed) => embed.title === "୨୧ 𝓦𝓮𝓵𝓬𝓸𝓶𝓮 𝓱𝓸𝓶𝓮 ♡"));
      if (!welcome) await petChannel.send({ embeds: [buildPetRoomWelcomeEmbed(ownerProfile, activePet, isVip(interaction.member))] });
      const legacyCommands = roomMessages.find((message) => message.author?.id === client.user.id && message.embeds.some((embed) => embed.title === "୨୧ 𝓟𝓮𝓽 𝓡𝓸𝓸𝓶 · 𝓒𝓸𝓶𝓶𝓪𝓷𝓭𝓼 ♡"));
      if (legacyCommands) await legacyCommands.delete().catch(() => {});
      const sticky = roomMessages.find((message) => message.author?.id === client.user.id && message.embeds.some((embed) => embed.title === "୨୧ 𝓟𝓮𝓽 𝓗𝓮𝓵𝓹 ♡"));
      if (!sticky) await petChannel.send(buildPetStickyPayload(interaction.user.id));
      await petChannel.permissionOverwrites.edit(interaction.user.id, { AddReactions: false });
      await petChannel.permissionOverwrites.edit(client.user.id, { AddReactions: false });
      await interaction.editReply({ content: `Your pet room is ready: <#${petChannel.id}> ♡` });
    } catch (error) {
      console.error("[pets] could not open pet channel: " + error.message);
      await interaction.editReply({ content: "I couldn’t open your pet room. Please try again ♡" }).catch(() => {});
    }
  });
    client.on(Events.MessageCreate, async (message) => {
    if (!message.guild || message.author?.bot || message.webhookId ||
        message.channel?.type !== ChannelType.GuildText ||
        !/^Sugar personal pet room for [0-9]{17,20}$/.test(message.channel.topic ?? "")) return;
    const ownerId = message.channel.topic.match(/^Sugar personal pet room for ([0-9]{17,20})$/)?.[1];
    if (message.author.id !== ownerId) return;
    try {
      const recent = await message.channel.messages.fetch({ limit: 30 });
      const previous = recent.find((item) => item.author?.id === client.user.id &&
        item.embeds.some((embed) => embed.title === "୨୧ 𝓟𝓮𝓽 𝓗𝓮𝓵𝓹 ♡"));
      if (previous) await previous.delete().catch(() => {});
      await message.channel.send(buildPetStickyPayload(ownerId));
    } catch (error) {
      console.error("[pets] sticky help refresh failed: " + error.message);
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
    if (!message.guild || message.author?.bot || message.webhookId ||
        message.channel?.type !== ChannelType.GuildText ||
        !/^!pet(?:\s|$)/i.test(String(message.content ?? "").trim())) return;
    const isPrivatePetRoom = isUsersPetRoom(message.channel, message.author.id);
    const isAdoptionCommand = /^!pet\s+adopt(?:\s|$)/i.test(String(message.content ?? "").trim());
    const isAdoptionChannel = PET_ADOPTION_CHANNEL_IDS.has(message.channel.id);
    if (!isPrivatePetRoom && !(isAdoptionChannel && isAdoptionCommand)) return;
    try { await runPetCommand(message, store, client); }
    catch (error) {
      console.error("[pets] command failed: " + error.message);
      await message.reply("Something went wrong with your pet command ♡").catch(() => {});
    }
  });}
