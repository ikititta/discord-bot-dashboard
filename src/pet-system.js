import fs from "node:fs";
import path from "node:path";
import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, Events,
} from "discord.js";

const COLOR = 0xffd9ff;
const VIP_ROLE_ID = "1568188640113463437";
const CHANNEL_NAME = "🐾｜୨୧ ・𝓹𝓮𝓽𝓼";
const BUTTON_ID = "sugar-pets:open";
const PETS = ["cat", "bunny", "fox", "puppy", "hamster", "kitten"];
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

function isVip(member) {
  return member?.roles?.cache?.has(VIP_ROLE_ID) === true;
}
function buildPetEmbed() {
  return new EmbedBuilder().setColor(COLOR).setTitle("୨୧ 𝓥𝓲𝓻𝓽𝓾𝓪𝓵 𝓟𝓮𝓽𝓼 ♡")
    .setDescription(
      "Welcome to the Kittisugar pet corner! Adopt a little friend, look after them, and watch them grow.\n\n" +
      "**How to play**\n" +
      "♡ Press **Open Pet Room ♡** to create your own command thread.\n" +
      "♡ Everyone can adopt a pet and use the basic care commands.\n" +
      "♡ VIP unlocks extra rooms, outfits, rare pets, additional pet slots, and minigames.\n\n" +
      "**Commands**\n" +
      "`!pet` — check your pet. `!pet adopt` — adopt one.\n" +
      "`!pet feed`, `!pet play`, `!pet cuddle` — take care of your pet.\n" +
      "`!pet shop`, `!pet inventory`, `!pet rename <name>`, `!pet select <number>` — shop, inventory, rename, and switch pets.\n" +
      "**VIP:** `!pet room`, `!pet outfit <name>`, `!pet rare`, `!pet slots`, `!pet minigame`."
    ).setFooter({ text: "Your pet's progress is saved ♡" });
}
function panelPayload() {
  return { embeds: [buildPetEmbed()], components: [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(BUTTON_ID).setLabel("Open Pet Room ♡").setStyle(ButtonStyle.Primary),
  )] };
}
async function ensurePetsChannel(guild, client) {
  let channel = guild.channels.cache.find((item) =>
    item.type === ChannelType.GuildText && item.name === CHANNEL_NAME,
  );
  if (!channel) {
    const general = guild.channels.cache.find((item) =>
      item.type === ChannelType.GuildText && /general/i.test(item.name),
    );
    channel = await guild.channels.create({
      name: CHANNEL_NAME,
      type: ChannelType.GuildText,
      ...(general?.parentId ? { parent: general.parentId } : {}),
      reason: "Create the Kittisugar virtual pets channel",
    });
  }
  await channel.permissionOverwrites.edit(guild.roles.everyone, {
    ViewChannel: true, SendMessages: false, SendMessagesInThreads: true, ReadMessageHistory: true,
  }, "Keep the virtual pets channel panel read-only");
  await channel.permissionOverwrites.edit(client.user.id, {
    ViewChannel: true, SendMessages: true, EmbedLinks: true, ReadMessageHistory: true,
    ManageMessages: true, CreatePublicThreads: true, SendMessagesInThreads: true, ManageThreads: true,
  }, "Allow Sugar to maintain the pet panel and create pet threads");
  const recent = await channel.messages.fetch({ limit: 50 });
  const old = recent.find((message) => message.author?.id === client.user.id &&
    message.embeds.some((embed) => embed.title === "୨୧ 𝓥𝓲𝓻𝓽𝓾𝓪𝓵 𝓟𝓮𝓽𝓼 ♡"));
  if (old) await old.edit(panelPayload());
  else await channel.send(panelPayload());
  return channel;
}
function makePet() {
  return {
    name: "Mochi", species: PETS[Math.floor(Math.random() * PETS.length)],
    level: 1, xp: 0, hunger: 70, happiness: 70, coins: 100,
    inventory: [], room: "cozy room", outfit: "default", slots: 1, additionalPets: [], activePetIndex: 0,
    lastMinigame: null,
  };
}
function status(pet) {
  return `**${pet.name}** the ${pet.species} · Level ${pet.level}
♡ Hunger: ${pet.hunger}/100 · Happiness: ${pet.happiness}/100
♡ Coins: ${pet.coins} · XP: ${pet.xp}
♡ Room: ${pet.room} · Outfit: ${pet.outfit}`;
}
async function runPetCommand(message, store) {
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
      const companion = makePet();
      companion.name = "Mochi " + (count + 1);
      profile.additionalPets ??= [];
      profile.additionalPets.push(companion);
      profile.activePetIndex = count;
      store.save(guildId, userId, profile);
      return reply(`You adopted **${companion.name}** the ${companion.species}! Welcome home ♡\n${status(companion)}`);
    }
    pet = makePet();
    profile = pet;
    store.save(guildId, userId, profile);
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
  if (action === "view" || action === "status") return reply(status(pet));

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
  } else if (action === "rename") {
    if (!argument || argument.length > 24) return reply("Use `!pet rename <name>` (up to 24 characters).");
    pet.name = argument;
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
    return reply("Try `!pet`, `adopt`, `feed`, `play`, `cuddle`, `shop`, `inventory`, `rename`, or `select` ♡");
  }

  while (pet.xp >= pet.level * 25) { pet.xp -= pet.level * 25; pet.level += 1; }
  store.save(guildId, userId, profile);
  return reply("Done ♡\n" + status(pet));
}
export function attachPetSystem(client, store) {
  if (!store) throw new Error("The virtual-pet store is required.");
  client.once(Events.ClientReady, async () => {
    for (const guild of client.guilds.cache.values()) {
      try { await ensurePetsChannel(guild, client); }
      catch (error) { console.error("[pets] channel setup failed: " + error.message); }
    }
  });
  client.on(Events.GuildCreate, (guild) => {
    void ensurePetsChannel(guild, client).catch((error) => console.error("[pets] channel setup failed: " + error.message));
  });
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton?.() || interaction.customId !== BUTTON_ID) return;
    try {
      const thread = await interaction.channel.threads.create({
        name: `${interaction.user.username}'s pet room`.slice(0, 100),
        autoArchiveDuration: 1440,
        type: ChannelType.PublicThread,
        reason: "Open a member's Kittisugar pet command thread",
      });
      await thread.members.add(interaction.user.id);
      await thread.send({ content: `Welcome <@${interaction.user.id}>! Your pet commands go here ♡`, embeds: [buildPetEmbed()] });
      await interaction.reply({ content: `Your pet room is ready: <#${thread.id}> ♡`, ephemeral: true });
    } catch (error) {
      console.error("[pets] could not open pet thread: " + error.message);
      if (!interaction.replied) await interaction.reply({ content: "I couldn't open your pet room. Please try again ♡", ephemeral: true }).catch(() => {});
    }
  });
  client.on(Events.MessageCreate, async (message) => {
    if (!message.guild || message.author?.bot || !message.channel?.isThread?.()) return;
    const parent = message.channel.parent;
    if (!parent || parent.name !== CHANNEL_NAME || !/^!pet(?:\s|$)/i.test(message.content.trim())) return;
    try { await runPetCommand(message, store); }
    catch (error) { console.error("[pets] command failed: " + error.message); await message.reply("Something went wrong with your pet command ♡").catch(() => {}); }
  });
}
