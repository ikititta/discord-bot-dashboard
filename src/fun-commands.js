import { EmbedBuilder, Events } from "discord.js";

const KITTISUGAR_GUILD_ID = "1567093019377930363";

export const FUN_ROLE_IDS = Object.freeze({
  female: "1569638102949953567",
  male: "1569807000278269983",
  trans: "1569807011217145948",
  "non-binary": "1569807020809396455",
});
export const FUN_VIP_ROLE_ID = "1568188640113463437";
export const FUN_MEMBER_ROLE_ID = "1568188534836428812";

const GIFUKAI_API_BASE = "https://api.gifukai.com/v1";
const NEKOS_BEST_API_BASE = "https://nekos.best/api/v2";
const GIFUKAI_PAIRING_CATEGORIES = new Set(["hug", "kiss", "pat", "cry", "sleep", "pout"]);
const REQUEST_TIMEOUT_MS = 8_000;
const COLOR = 0xffd9ff;
const VIP_STATS_MESSAGE = "Get VIP to see everyone's stats.";

const TWO_PERSON_COMMANDS = Object.freeze({
  slap: { gif: "slap", text: "slaps" },
  bonk: { gif: "bonk", text: "bonks" },
  spank: { gif: "slap", text: "gives a playful spank to" },
  hug: { gif: "hug", text: "hugs" },
  kiss: { gif: "kiss", text: "kisses" },
  cuddle: { gif: "cuddle", text: "cuddles" },
  pat: { gif: "pat", text: "gives a headpat to" },
  poke: { gif: "poke", text: "pokes" },
  bite: { gif: "bite", text: "bites" },
  kick: { gif: "kick", text: "kicks" },
  kill: { gif: "kick", text: "defeats" },
  highfive: { gif: "highfive", text: "high-fives" },
  handhold: { gif: "handhold", text: "holds hands with" },
});

const SOLO_COMMANDS = Object.freeze({
  cry: { gif: "cry", text: "is crying" },
  laugh: { gif: "laugh", text: "is laughing" },
  dance: { gif: "dance", text: "is dancing" },
  sleep: { gif: "sleep", text: "is sleeping" },
  happy: { gif: "happy", text: "is happy" },
  blush: { gif: "blush", text: "is blushing" },
  smug: { gif: "smug", text: "looks smug" },
  wave: { gif: "wave", text: "waves hello" },
  facepalm: { gif: "facepalm", text: "is facepalming" },
  wink: { gif: "wink", text: "winks" },
  shrug: { gif: "shrug", text: "shrugs" },
  smile: { gif: "smile", text: "is smiling" },
  pout: { gif: "pout", text: "is pouting" },
});

const BLOCKED_COMMANDS = new Set(["rape", "fuck"]);
const GIF_CATEGORIES = new Set([...Object.values(TWO_PERSON_COMMANDS), ...Object.values(SOLO_COMMANDS)].map(({ gif }) => gif));

export function normalizeFunRole(member) {
  const matches = Object.entries(FUN_ROLE_IDS)
    .filter(([, roleId]) => member?.roles?.cache?.has(roleId))
    .map(([key]) => key);
  return matches.length === 1 ? matches[0] : "neutral";
}

export function getFunCommandDefinition(name) {
  if (Object.hasOwn(TWO_PERSON_COMMANDS, name)) return { ...TWO_PERSON_COMMANDS[name], needsTarget: true };
  if (Object.hasOwn(SOLO_COMMANDS, name)) return { ...SOLO_COMMANDS[name], needsTarget: false };
  return null;
}

export function buildFunStatsEmbed({ user, stats, full = false, received = false }) {
  const name = user?.displayName ?? user?.globalName ?? user?.username ?? "Member";
  const topCommands = Object.entries(stats.commands ?? {}).sort((a, b) => b[1] - a[1]).slice(0, full ? 15 : 3);
  const topReceived = Object.entries(stats.received ?? {}).sort((a, b) => b[1] - a[1]).slice(0, full ? 15 : 3);
  const topPartners = Object.entries(received ? stats.receivedFrom ?? {} : stats.partners ?? {})
    .sort((a, b) => b[1] - a[1]).slice(0, full ? 10 : 3);

  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(`୨୧ ${name}'s Fun Commands ${full ? "VIP " : ""}Stats ♡`)
    .setDescription(`**Used:** ${stats.total ?? 0} commands\n**Received:** ${stats.receivedTotal ?? 0} interactions`);

  if (topCommands.length) embed.addFields({
    name: "Most used",
    value: topCommands.map(([command, count]) => "!" + command + " — **" + count + "**").join("\n"),
    inline: true,
  });
  if (topReceived.length) embed.addFields({
    name: "Most received",
    value: topReceived.map(([command, count]) => "!" + command + " — **" + count + "**").join("\n"),
    inline: true,
  });
  if (topPartners.length) embed.addFields({
    name: received ? "Top interactions from" : "Top partners",
    value: topPartners.map(([id, count]) => `<@${id}> — **${count}**`).join("\n"),
    inline: false,
  });
  if (full) {
    const allCommands = Object.entries(stats.commands ?? {}).sort((a, b) => a[0].localeCompare(b[0]));
    const allReceived = Object.entries(stats.received ?? {}).sort((a, b) => a[0].localeCompare(b[0]));
    if (allCommands.length) embed.addFields({ name: "Complete command history", value: allCommands.map(([command, count]) => "!" + command + " · " + count).join("\n").slice(0, 1024) });
    if (allReceived.length) embed.addFields({ name: "Complete received history", value: allReceived.map(([command, count]) => "!" + command + " · " + count).join("\n").slice(0, 1024) });
    embed.setFooter({ text: "VIP member statistics ♡" });
  } else {
    embed.setFooter({ text: "Use !vip stats for your complete VIP report ♡" });
  }
  return embed;
}

export function resolveGifPairing(actorRole, targetRole = null) {
  if (targetRole === null) {
    if (actorRole === "female") return "f";
    if (actorRole === "male") return "m";
    return null;
  }
  return ({
    "female:female": "ff",
    "male:male": "mm",
    "female:male": "fm",
    "male:female": "mf",
  })[`${actorRole}:${targetRole}`] ?? null;
}

export async function fetchAnimeGif(category, {
  fetchImpl = fetch,
  actorRole = "neutral",
  targetRole = null,
} = {}) {
  if (!GIF_CATEGORIES.has(category)) throw new Error("Invalid anime GIF category.");

  if (GIFUKAI_PAIRING_CATEGORIES.has(category)) {
    const pairing = resolveGifPairing(actorRole, targetRole);
    const url = new URL(`${GIFUKAI_API_BASE}/${category}`);
    if (pairing) url.searchParams.set("pairing", pairing);
    try {
      const response = await fetchImpl(url, {
        headers: { "User-Agent": "SugarDiscordBot/1.0 (https://github.com/ikititta/discord-bot-dashboard)" },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`Gifukai returned HTTP ${response.status}.`);
      const payload = await response.json();
      const gifUrl = new URL(payload?.url ?? "");
      if (gifUrl.protocol !== "https:" || gifUrl.hostname !== "cdn.gifukai.com" || !gifUrl.pathname.endsWith(".gif")) {
        throw new Error("Gifukai returned an invalid GIF URL.");
      }
      return { url: gifUrl.toString(), anime: String(payload.anime ?? "").slice(0, 80), pairing };
    } catch (error) {
      console.warn(`[fun] paired GIF lookup failed for ${category}; trying the generic anime GIF source: ${error.message}`);
    }
  }

  const response = await fetchImpl(`${NEKOS_BEST_API_BASE}/${category}`, {
    headers: { "User-Agent": "SugarDiscordBot/1.0 (https://github.com/ikititta/discord-bot-dashboard)" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Anime GIF service returned HTTP ${response.status}.`);
  const payload = await response.json();
  const result = payload?.results?.[0];
  const gifUrl = new URL(result?.url ?? "");
  if (gifUrl.protocol !== "https:" || gifUrl.hostname !== "nekos.best" || !gifUrl.pathname.endsWith(".gif")) {
    throw new Error("Anime GIF service returned an invalid GIF URL.");
  }
  return { url: gifUrl.toString(), anime: String(result.anime_name ?? "").slice(0, 80), pairing: null };
}

function isVerifiedAdult(member) {
  return Boolean(member?.roles?.cache?.has(FUN_MEMBER_ROLE_ID));
}

function isVip(member) {
  return Boolean(member?.roles?.cache?.has(FUN_VIP_ROLE_ID));
}

function displayName(member, user) {
  return member?.displayName ?? user?.globalName ?? user?.username ?? "Someone";
}

async function safeReply(message, payload) {
  return message.reply({
    ...payload,
    allowedMentions: { parse: [], repliedUser: false },
  });
}

async function showStats(message, store, { targetMember, targetUser, full, received = false }) {
  const stats = store.getStats(message.guild.id, targetUser.id);
  const embed = buildFunStatsEmbed({ user: { ...targetUser, displayName: displayName(targetMember, targetUser) }, stats, full, received });
  return safeReply(message, { embeds: [embed] });
}

async function handleStats(message, store, args) {
  const parts = args.trim().split(/\s+/).filter(Boolean);
  if (parts[0]?.toLowerCase() === "vip" && parts[1]?.toLowerCase() === "stats") {
    const targetUser = message.mentions.users.first();
    if (!isVip(message.member)) return safeReply(message, { content: VIP_STATS_MESSAGE });
    const target = targetUser
      ? await message.guild.members.fetch(targetUser.id).catch(() => null)
      : message.member;
    if (!target) return safeReply(message, { content: "I couldn't find that member in Kittisugar." });
    return showStats(message, store, {
      targetMember: target,
      targetUser: target.user,
      full: true,
      received: target.id !== message.author.id,
    });
  }

  if (parts[0]?.toLowerCase() === "stats") {
    return showStats(message, store, {
      targetMember: message.member,
      targetUser: message.author,
      full: false,
    });
  }
  return null;
}

async function handleFunAction(message, store, name, args, fetchImpl) {
  const definition = getFunCommandDefinition(name);
  if (!definition) return false;

  let targetMember = null;
  let targetUser = null;
  let targetRole = null;
  if (definition.needsTarget) {
    targetUser = message.mentions.users.first();
    if (!targetUser) {
      await safeReply(message, { content: `Usage: !${name} @user` });
      return true;
    }
    if (targetUser.id === message.author.id || targetUser.bot) {
      await safeReply(message, { content: "Choose another server member for this interaction ♡" });
      return true;
    }
    targetMember = await message.guild.members.fetch(targetUser.id).catch(() => null);
    if (!targetMember || !isVerifiedAdult(targetMember)) {
      await safeReply(message, { content: "That member must complete Kittisugar's 18+ verification first." });
      return true;
    }
    targetRole = normalizeFunRole(targetMember);
  } else if (message.mentions.users.size) {
    await safeReply(message, { content: `!${name} is a solo command and doesn't need a mention.` });
    return true;
  }

  store.record({
    guildId: message.guild.id,
    actorId: message.author.id,
    targetId: targetUser?.id ?? null,
    command: name,
  });

  const actionText = definition.needsTarget
    ? `**${displayName(message.member, message.author)}** ${definition.text} **${displayName(targetMember, targetUser)}**!`
    : `**${displayName(message.member, message.author)}** ${definition.text}!`;

  let gif = null;
  try { gif = await fetchAnimeGif(definition.gif, { fetchImpl, actorRole: normalizeFunRole(message.member), targetRole }); }
  catch (error) { console.warn(`[fun] GIF lookup failed for !${name}: ${error.message}`); }

  const embed = new EmbedBuilder().setColor(COLOR).setDescription(actionText);
  if (gif) {
    embed.setImage(gif.url);
    if (gif.anime) embed.setFooter({ text: `Anime: ${gif.anime} · Nekos.best` });
  } else {
    embed.setFooter({ text: "Anime GIF unavailable right now ♡" });
  }
  await safeReply(message, { embeds: [embed] });
  return true;
}

export function attachFunCommands(client, { store, fetchImpl = fetch } = {}) {
  if (!store) throw new Error("The fun-command statistics store is required.");

  client.on(Events.MessageCreate, async (message) => {
    if (!message.guild || message.guild.id !== KITTISUGAR_GUILD_ID ||
        message.author?.bot || message.webhookId || !message.member) return;
    const match = /^!([a-z-]+)(?:\s+([\s\S]*))?$/i.exec(String(message.content ?? "").trim());
    if (!match) return;

    const name = match[1].toLowerCase();
    const args = match[2] ?? "";
    try {
      if (BLOCKED_COMMANDS.has(name)) {
        await safeReply(message, { content: "That command isn't available. Please keep interactions consensual ♡" });
        return;
      }
      if (name === "stats" || name === "vip") {
        await handleStats(message, store, name === "vip" ? `vip ${args}` : `stats ${args}`);
        return;
      }
      if (!getFunCommandDefinition(name)) return;
      if (!isVerifiedAdult(message.member)) {
        await safeReply(message, { content: "Fun commands are available after completing Kittisugar's 18+ verification ♡" });
        return;
      }
      await handleFunAction(message, store, name, args, fetchImpl);
    } catch (error) {
      console.error(`[fun] !${name} failed for member ${message.author.id}: ${error.message}`);
      await safeReply(message, { content: "Sugar couldn't complete that fun command. Please try again ♡" }).catch(() => {});
    }
  });
}
