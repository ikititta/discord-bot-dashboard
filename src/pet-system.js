import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, Events, PermissionFlagsBits,
} from "discord.js";
import { toRoyalBold } from "./embed-format.js";
import { generatePetArtwork } from "./pet-art.js";

const COLOR = 0xffd9ff;
const VIP_ROLE_ID = "1568188640113463437";
const CHANNEL_NAME = "🐾｜୨୧ ・𝓹𝓮𝓽𝓼";
const BUTTON_ID = "sugar-pets:open";
const PET_SPECIES = {
  cat: "cat", dog: "dog", puppy: "dog", kitten: "cat", hamster: "hamster",
  rabbit: "rabbit", bunny: "rabbit", fish: "fish", bird: "bird",
  guinea: "guinea pig", "guinea pig": "guinea pig", "guinea-pig": "guinea pig", turtle: "turtle", fox: "fox", ferret: "ferret",
};
const PET_SPECIES_LABELS = Object.keys(PET_SPECIES).join(", ");
const SHOP = { treat: 10, toy: 25 };

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
    .setDescription("Adopt a little companion, take care of them, and watch them grow ♡\n\n" +
      "Create your private pet room to see the commands and care for your pet. " +
      "Everyone can adopt a pet; VIP members get extra perks and exclusive features.")
    .setFooter({ text: "Your pet progress is saved ♡" });
}
function buildPetCommandsEmbed() {
  return new EmbedBuilder().setColor(COLOR).setTitle("୨୧ 𝓟𝓮𝓽 𝓡𝓸𝓸𝓶 · 𝓒𝓸𝓶𝓶𝓪𝓷𝓭𝓼 ♡")
    .setDescription("**Everyone**\\n`!pet adopt <species>` · `!pet` · `!pet stats`\\n`!pet feed` · `!pet play` · `!pet cuddle` · `!pet talk` · `!pet story`\\n`!pet shop` · `!pet buy treat/toy` · `!pet inventory` · `!pet select <number>`\\n\\n**VIP customization**\\n`!pet name <name>` · `!pet color <color>` · `!pet breed <breed>`\\n`!pet appearance <details>` · `!pet personality <traits>`\\n\\n**VIP extras**\\n`!pet room` · `!pet outfit <name>` · `!pet rare` · `!pet slots` · `!pet minigame`")
    .setFooter({ text: "Use these commands in your private pet room ♡" });
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
    level: 1, xp: 0, hunger: 70, happiness: 70, coins: 100,
    inventory: [], room: "cozy room", outfit: "default", slots: 1, additionalPets: [], activePetIndex: 0,
    lastMinigame: null,
    dialogueCount: 0,
    storyUnlocks: [],
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

function status(pet) {
  return `**${pet.name}** the ${pet.species} · Level ${pet.level}
♡ Hunger: ${pet.hunger}/100 · Happiness: ${pet.happiness}/100
♡ Coins: ${pet.coins} · XP: ${pet.xp}
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
  const reply = (content) => message.reply({ content, allowedMentions: { repliedUser: false } });

  if (action === "adopt") {
    if (pet) {
      if (!vip) return reply("You already have a pet ♡ VIP members can unlock more pet slots.");
      const count = 1 + (profile.additionalPets?.length ?? 0);
      if (count >= profile.slots) return reply("All your pet slots are full. Use `!pet slots` to unlock another VIP slot ♡");
      const requestedSpecies = String(argument || "").toLowerCase();
      const species = PET_SPECIES[requestedSpecies];
      if (!species) return reply("Choose a species: " + PET_SPECIES_LABELS + " ♡");
      const companion = makePet(species);
      companion.name = "Mochi " + (count + 1);
      profile.additionalPets ??= [];
      profile.additionalPets.push(companion);
      profile.activePetIndex = count;
      store.save(guildId, userId, profile);
      queuePetArtwork(message, store, profile, companion);
      await refreshPetsPanel(message.guild, store, client);
      return reply(`You adopted **${companion.name}** the ${companion.species}! Welcome home ♡\n${status(companion)}`);
    }
    const requestedSpecies = String(argument || "").toLowerCase();
    const species = PET_SPECIES[requestedSpecies];
    if (!species) return reply("Choose a species: " + PET_SPECIES_LABELS + " ♡\nExample: `!pet adopt hamster`");
    pet = makePet(species);
    profile = pet;
    store.save(guildId, userId, profile);
    queuePetArtwork(message, store, profile, pet);
    await refreshPetsPanel(message.guild, store, client);
    return reply(`You adopted **${pet.name}** the ${pet.species}! Welcome home ♡\n${status(pet)}`);
  }
  if (!pet) return reply("You don't have a pet yet. Use `!pet adopt` to meet your new friend ♡");

  if (action === "select") {
    const index = Number(argument);
    const count = 1 + (profile.additionalPets?.length ?? 0);
    if (!Number.isInteger(index) || index < 1 || index > count) return reply(`Choose a pet number from 1 to ${count} ♡`);
    profile.activePetIndex = index - 1;
    store.save(guildId, userId, profile);
    pet = index === 1 ? profile : profile.additionalPets[index - 2];
    return reply("Now caring for " + pet.name + " ♡\n" + status(pet));
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
    return reply(status(pet) + (pet.visualIdentity?.artStatus === "generating" ? "\n♡ Your unique artwork is being created..." : ""));
  }

  if (action === "stats") {
    const pets = [profile, ...(profile.additionalPets ?? [])].filter(Boolean);
    return reply(`**${message.author.username}'s Pet Stats ♡**\nPets owned: ${pets.length}\nActive pet: ${pet.name}\nLevel: ${pet.level}\nXP: ${pet.xp}\nHunger: ${pet.hunger}/100\nHappiness: ${pet.happiness}/100\nCoins: ${pet.coins}\nDialogues: ${pet.dialogueCount ?? 0}\nStories unlocked: ${(pet.storyUnlocks ?? []).length}`);
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
    const personality = String(pet.visualIdentity?.personality ?? "gentle").toLowerCase();
    const line = choose(lines[personality] ?? lines.gentle);
    pet.dialogueCount = (pet.dialogueCount ?? 0) + 1;
    pet.happiness = Math.min(100, pet.happiness + 2);
    store.save(guildId, userId, profile);
    return reply(line + " ♡");
  }
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

  if (action === "feed") {
    if (pet.hunger >= 100) return reply("Your pet is already full ♡");
    if (pet.coins < SHOP.treat) return reply("You need 10 coins for a treat. Try a minigame when you're VIP ♡");
    pet.coins -= SHOP.treat; pet.hunger = Math.min(100, pet.hunger + 25); pet.xp += 2;
  } else if (action === "play") {
    pet.happiness = Math.min(100, pet.happiness + 20); pet.hunger = Math.max(0, pet.hunger - 8); pet.xp += 8;
  } else if (action === "cuddle") {
    pet.happiness = Math.min(100, pet.happiness + 12); pet.xp += 3;
  } else if (action === "shop") {
    return reply("**Pet shop ♡**\n`!pet buy treat` — 10 coins\n`!pet buy toy` — 25 coins");
  } else if (action === "buy") {
    const price = SHOP[argument.toLowerCase()];
    if (!price) return reply("Choose `treat` or `toy` ♡");
    if (pet.coins < price) return reply("You don't have enough coins yet ♡");
    pet.coins -= price; pet.inventory.push(argument.toLowerCase());
  } else if (action === "inventory") {
    return reply(pet.inventory.length ? "Your inventory: " + pet.inventory.join(", ") : "Your inventory is empty ♡");
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
      profile.slots = Math.min(3, profile.slots + 1);
      store.save(guildId, userId, profile);
      return reply(`VIP pet slots: ${profile.slots}/3 ♡ Use !pet adopt to fill your new slot.`);
    }
    if (action === "minigame") {
      const today = new Date().toISOString().slice(0, 10);
      if (pet.lastMinigame === today) return reply("You already played today's minigame. Come back tomorrow ♡");
      pet.lastMinigame = today; pet.coins += 30; pet.xp += 10;
    }
  } else {
    return reply("Try `!pet adopt <species>`, `stats`, `feed`, `play`, `talk`, `story`, `shop`, `inventory`, or `select` ♡");
  }

  while (pet.xp >= pet.level * 25) { pet.xp -= pet.level * 25; pet.level += 1; }
  store.save(guildId, userId, profile);
  await refreshPetsPanel(message.guild, store, client);
  return reply("Done ♡\n" + status(pet));
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
    void ensurePetsChannel(guild, client, store).catch((error) => console.error("[pets] channel setup failed: " + error.message));
  });
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton?.() || ![BUTTON_ID, "sugar-pets:global-top"].includes(interaction.customId)) return;
    if (interaction.customId === "sugar-pets:global-top") {
      try {
        if (!interaction.guild) return interaction.reply({ content: "The global pet top is only available inside a server ♡", ephemeral: true });
        return interaction.reply({ embeds: [buildGlobalPetLeaderboard(store, interaction.guild.id)], ephemeral: true });
      } catch (error) {
        console.error("[pets] leaderboard failed: " + error.message);
        return interaction.reply({ content: "Could not load the global pet top. Please try again ♡", ephemeral: true });
      }
    }
    try {
      const guild = interaction.guild;
      if (!guild) return interaction.reply({ content: "Pet rooms are only available inside a server ♡", ephemeral: true });
      const topic = `Sugar personal pet room for ${interaction.user.id}`;
      let petChannel = guild.channels.cache.find((item) =>
        item.type === ChannelType.GuildText && item.topic === topic,
      );
      if (!petChannel) {
        await guild.channels.fetch();
        petChannel = guild.channels.cache.find((item) =>
          item.type === ChannelType.GuildText && item.topic === topic,
        );
      }
      if (!petChannel) {
        petChannel = await guild.channels.create({
          name: formatPetChannelName(interaction.user.username),
          type: ChannelType.GuildText,
          ...(guild.channels.cache.find((item) => item.name === CHANNEL_NAME)?.parentId ? { parent: guild.channels.cache.find((item) => item.name === CHANNEL_NAME).parentId } : {}),
          topic,
          permissionOverwrites: [
            { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
            {
              id: interaction.user.id,
              allow: [
                PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.EmbedLinks,
              ],
              deny: [PermissionFlagsBits.AddReactions],
            },
            {
              id: client.user.id,
              allow: [
                PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.EmbedLinks,
                PermissionFlagsBits.ManageMessages,
              ],
              deny: [PermissionFlagsBits.AddReactions],
            },
          ],
          reason: "Create a private personal pet channel",
        });
        await petChannel.send({
          content: `Welcome <@${interaction.user.id}>! Your little pet corner is ready ♡`,
          embeds: [buildPetCommandsEmbed()],
          allowedMentions: { users: [interaction.user.id] },
        });
      }
      const roomMessages = await petChannel.messages.fetch({ limit: 20 });
      const hasCommands = roomMessages.some((message) => message.author?.id === client.user.id && message.embeds.some((embed) => embed.title === "୨୧ 𝓟𝓮𝓽 𝓡𝓸𝓸𝓶 · 𝓒𝓸𝓶𝓶𝓪𝓷𝓭𝓼 ♡"));
      if (!hasCommands) await petChannel.send({ embeds: [buildPetCommandsEmbed()] });
      await petChannel.permissionOverwrites.edit(interaction.user.id, { AddReactions: false });
      await petChannel.permissionOverwrites.edit(client.user.id, { AddReactions: false });
      await interaction.reply({ content: `Your pet room is ready: <#${petChannel.id}> ♡`, ephemeral: true });
    } catch (error) {
      console.error("[pets] could not open pet channel: " + error.message);
      if (!interaction.replied) await interaction.reply({
        content: "I couldn't open your pet room. Please try again ♡",
        ephemeral: true,
      }).catch(() => {});
    }
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
