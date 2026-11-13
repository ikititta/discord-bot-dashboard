import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Events, REST, Routes, SlashCommandBuilder } from "discord.js";
import { GENDER_ROLE_IDS } from "./role-onboarding.js";

const KITTISUGAR_GUILD_ID = "1567093019377930363";
const RETIRED_GIF_PREFERENCES_CHANNEL_ID = "1570873475038711973";

export const FUN_ROLE_IDS = GENDER_ROLE_IDS;
export const FUN_VIP_ROLE_ID = "1568188640113463437";
export const FUN_MEMBER_ROLE_ID = "1568188534836428812";

const GIFUKAI_API_BASE = "https://api.gifukai.com/v1";
const NEKOS_BEST_API_BASE = "https://nekos.best/api/v2";
const PURRBOT_API_BASE = "https://api.purrbot.site/v2";
const GIFUKAI_PAIRING_CATEGORIES = new Set(["hug", "kiss", "pat", "cry", "sleep", "pout", "smile", "shrug", "laugh", "dance", "happy", "blush", "smug", "wave", "facepalm", "wink"]);
const REQUEST_TIMEOUT_MS = 8_000;
const COLOR = 0xffd9ff;
const VIP_STATS_MESSAGE = "This is a VIP-only benefit. Get the VIP role to use !stats, view your complete report, and look up another member with !vip stats @member. ♡";

const TWO_PERSON_COMMANDS = Object.freeze({
  slap: { gif: "slap", text: "has slapped" },
  choke: { gif: null, text: "has playfully choked" },
  spit: { gif: null, text: "has spat at" },
  comfort: { gif: "hug", text: "has comforted" },
  noseboop: { gif: "poke", text: "has booped the nose of" },
  bonk: { gif: "bonk", text: "has bonked" },
  spank: { gif: "spank", text: "has given a playful spanking to" },
  fuck: { gif: "fuck", text: "has fucked" },
  masturbate: { gif: null, nsfwGif: "paired_catalog", text: "has masturbated" },
  oral: { gif: null, nsfwGif: "blowjob", text: "has initiated an oral NSFW interaction with" },
  anal: { gif: null, nsfwGif: "anal", text: "has initiated an anal NSFW interaction with" },
  hug: { gif: "hug", text: "has hugged" },
  kiss: { gif: "kiss", text: "has kissed" },
  tease: { gif: "wink", text: "has playfully teased" },
  seduce: { gif: "wink", text: "has tried to charm" },
  cuddle: { gif: "cuddle", text: "has cuddled" },
  pat: { gif: "pat", text: "has given a headpat to" },
  poke: { gif: "poke", text: "has poked" },
  bite: { gif: "bite", text: "has bitten" },
  lick: { gif: "lick", text: "has playfully licked" },
  feet: { gif: "pat", text: "has given a playful foot kiss to" },
  kick: { gif: "kick", text: "has kicked" },
  shoot: { gif: "shoot", text: "has playfully shot" },
  kill: { gif: "kick", text: "has dramatically defeated" },
  highfive: { gif: "highfive", text: "has high-fived" },
  handhold: { gif: "handhold", text: "is holding hands with" },
});

const SOLO_COMMANDS = Object.freeze({
  cry: { gif: "cry", text: "has cried" },
  scream: { gif: null, text: "has screamed" },
  sing: { gif: null, text: "has sung" },
  think: { gif: null, text: "is thinking" },
  laugh: { gif: "laugh", text: "has laughed" },
  dance: { gif: "dance", text: "has danced" },
  sleep: { gif: "sleep", text: "has fallen asleep" },
  happy: { gif: "happy", text: "is happy" },
  blush: { gif: "blush", text: "is blushing" },
  smug: { gif: "smug", text: "looks smug" },
  smirk: { gif: "smug", text: "is smirking" },
  wave: { gif: "wave", text: "has waved hello" },
  facepalm: { gif: "facepalm", text: "is facepalming" },
  wink: { gif: "wink", text: "has winked" },
  shrug: { gif: "shrug", text: "has shrugged" },
  smile: { gif: "smile", text: "is smiling" },
  pout: { gif: "pout", text: "is pouting" },
});

const BLOCKED_COMMANDS = new Set(["rape"]);
const GIF_CATEGORIES = new Set([...Object.values(TWO_PERSON_COMMANDS), ...Object.values(SOLO_COMMANDS)].map(({ gif }) => gif));

export function normalizeFunRole(member) {
  const matches = Object.entries(FUN_ROLE_IDS)
    .filter(([, roleId]) => member?.roles?.cache?.has(roleId))
    .map(([key]) => key);
  return matches.length === 1 ? matches[0] : "neutral";
}

export function normalizeFunDominance(member) {
  const normalize = (value) => [...String(value ?? "")].map((character) => {
    const point = character.codePointAt(0);
    if (point >= 0x1d4d0 && point <= 0x1d4e9) return String.fromCharCode(65 + point - 0x1d4d0);
    if (point >= 0x1d4ea && point <= 0x1d503) return String.fromCharCode(97 + point - 0x1d4ea);
    return character;
  }).join("").normalize("NFKD").toLowerCase().replace(/\p{M}/gu, "").replace(/[^a-z]/g, "");
  const labels = new Map([
    ["submissive", -2],
    ["mostlysubmissive", -1],
    ["switch", 0],
    ["mostlydominant", 1],
    ["dominant", 2],
  ]);
  for (const role of member?.roles?.cache?.values?.() ?? []) {
    const score = labels.get(normalize(role.name));
    if (score !== undefined) return score;
  }
  return null;
}

export function resolveDominancePair(actorDominance, targetDominance) {
  const actor = Number.isInteger(actorDominance) ? actorDominance : null;
  const target = Number.isInteger(targetDominance) ? targetDominance : null;
  if (actor === null || target === null) return { mode: "neutral", dominant: null, submissive: null };

  // Positive values are dominant; negative values are submissive; Switch is 0.
  if (actor > 0 && target < 0) return { mode: "directional", dominant: "actor", submissive: "target" };
  if (target > 0 && actor < 0) return { mode: "directional", dominant: "target", submissive: "actor" };
  if (actor === 0 && target > 0) return { mode: "directional", dominant: "target", submissive: "actor" };
  if (actor === 0 && target < 0) return { mode: "directional", dominant: "actor", submissive: "target" };
  if (target === 0 && actor > 0) return { mode: "directional", dominant: "actor", submissive: "target" };
  if (target === 0 && actor < 0) return { mode: "directional", dominant: "target", submissive: "actor" };

  // Same-side preferences (including two Switches) are neutral/random.
  return { mode: "neutral", dominant: null, submissive: null };
}

export function getFunCommandDefinition(name) {
  if (Object.hasOwn(TWO_PERSON_COMMANDS, name)) return { ...TWO_PERSON_COMMANDS[name], needsTarget: true };
  if (Object.hasOwn(SOLO_COMMANDS, name)) return { ...SOLO_COMMANDS[name], needsTarget: false };
  return null;
}

export function buildFunStatsEmbed({ user, stats, full = false, received = false, relationship = null, history = [] }) {
  const name = user?.displayName ?? user?.globalName ?? user?.username ?? "Member";
  const topCommands = Object.entries(stats.commands ?? {}).sort((a, b) => b[1] - a[1]).slice(0, full ? 15 : 3);
  const topReceived = Object.entries(stats.received ?? {}).sort((a, b) => b[1] - a[1]).slice(0, full ? 15 : 3);
  const topPartners = Object.entries(received ? stats.receivedFrom ?? {} : stats.partners ?? {})
    .sort((a, b) => b[1] - a[1]).slice(0, full ? 10 : 3);

  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(`୨୧ ${name}'s Fun Commands ${full ? "VIP " : ""}Stats ♡`)
    .setDescription(`**Used:** ${stats.total ?? 0} commands\n**Received:** ${stats.receivedTotal ?? 0} interactions`)
    .addFields({ name: "How stats work", value: full ? "This is the complete report: commands you use, interactions you receive, and the members you interact with. Use !vip stats @member to view another members report." : "This is your personal summary. Use !vip stats for your complete report if you have VIP. VIP members can view another member with !vip stats @member." });

  const relationshipLabel = relationship ? (relationship.type === "marriage" ? "Married" : "In a relationship") + " with <@" + relationship.partnerId + "> ♡" : "Single";
  const sent = history.filter((proposal) => proposal.proposerId === user.id).length;
  const receivedProposals = history.filter((proposal) => proposal.targetId === user.id).length;
  embed.addFields({ name: "♡ Relationship", value: "**Status:** " + relationshipLabel + "\n**Proposals sent:** " + sent + " · **received:** " + receivedProposals + "\n**Accepted:** " + history.filter((p) => p.status === "accepted").length + " · **Declined:** " + history.filter((p) => p.status === "declined").length });
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
    embed.setFooter({ text: "VIP stats · Type !commands for the command guide ♡" });
  } else {
    embed.setFooter({ text: "Use !vip stats for your complete VIP report · !commands for help ♡" });
  }
  return embed;
}

export function resolveGifPairing(actorRole, targetRole = null, actorDominance = null, targetDominance = null) {
  if (targetRole === null) {
    if (actorRole === "female") return "f";
    if (actorRole === "male") return "m";
    return null;
  }
  // Pairing order is always actor first, target second. Dominance describes
  // presentation only; it must never reverse who performs the action.
  return ({
    "female:female": "ff",
    "male:male": "mm",
    "female:male": "fm",
    "male:female": "mf",
  })[`${actorRole}:${targetRole}`] ?? null;
}

function validatedGifUrl(rawUrl, expectedHost) {
  let url;
  try { url = new URL(rawUrl ?? ""); }
  catch { throw new Error("Anime GIF service returned an invalid GIF URL."); }
  if (url.protocol !== "https:" || url.hostname !== expectedHost || !url.pathname.endsWith(".gif")) {
    throw new Error("Anime GIF service returned an invalid GIF URL.");
  }
  return url;
}

export function resolveMasturbateGifPairing(actorRole, targetRole) {
  return ({ 'female:female': 'ff', 'female:male': 'fm', 'male:female': 'mf', 'male:male': 'mm' })[String(actorRole) + ':' + String(targetRole)] ?? null;
}
export const MASTURBATE_GIF_CATALOG = Object.freeze({ ff: Object.freeze([]), fm: Object.freeze([]), mf: Object.freeze([]), mm: Object.freeze([]) });
export function selectMasturbateGif(actorRole, targetRole, { catalog = MASTURBATE_GIF_CATALOG, random = Math.random } = {}) {
  const pairing = resolveMasturbateGifPairing(actorRole, targetRole);
  if (!pairing) return null;
  const entries = Array.isArray(catalog?.[pairing]) ? catalog[pairing] : [];
  const valid = entries.filter((entry) => { try { const url = new URL(typeof entry === 'string' ? entry : entry?.url); return url.protocol === 'https:' && url.pathname.toLowerCase().endsWith('.gif'); } catch { return false; } });
  if (!valid.length) return null;
  const selected = valid[Math.min(valid.length - 1, Math.floor(random() * valid.length))];
  return { url: typeof selected === 'string' ? selected : selected.url, anime: typeof selected === 'string' ? '' : String(selected.anime ?? '').slice(0, 80), pairing, source: 'Kittisugar curated catalog' };
}
export function shouldPreferAnalGif(actorRole, targetRole, actorDominance = null, targetDominance = null) {
  const bothWomen = actorRole === "female" && targetRole === "female";
  // PurrBot's generic "anal" category cannot guarantee actor/target direction
  // for mixed-gender pairs. Do not use it for the male-submissive/female-dominant
  // case: that can return a GIF depicting the opposite action.
  return bothWomen;
}

export function resolveNsfwGifCategory(actorRole, targetRole, actorDominance = null, targetDominance = null) {
  // Preserve the gender pairing first: PurrBot's yaoi category is male-male.
  // Its generic anal category cannot guarantee the genders shown in the GIF.
  if (actorRole === "male" && targetRole === "male") return "yaoi";
  // For two women, prefer anal as requested; otherwise use the gender-specific yuri category.
  if (actorRole === "female" && targetRole === "female") return "anal";
  if (shouldPreferAnalGif(actorRole, targetRole, actorDominance, targetDominance)) return "anal";
  return "fuck";
}

export function resolveOralNsfwGifCategory(targetRole) {
  if (targetRole === "female") return "pussylick";
  if (targetRole === "male") return "blowjob";
  return null;
}

export async function fetchPurrbotNsfwGif(category, { fetchImpl = fetch } = {}) {
  const allowedCategories = new Set(["solo", "solo_male", "blowjob", "pussylick", "anal"]);
  if (!allowedCategories.has(category)) throw new Error("Invalid PurrBot NSFW GIF category.");
  const response = await fetchImpl(PURRBOT_API_BASE + "/img/nsfw/" + category + "/gif", {
    headers: { "User-Agent": "SugarDiscordBot/1.0 (https://github.com/ikititta/discord-bot-dashboard)" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`NSFW GIF service returned HTTP ${response.status}.`);
  const payload = await response.json();
  if (payload?.error !== false) throw new Error("NSFW GIF service did not return a valid result.");
  const gifUrl = validatedGifUrl(payload?.link, "cdn.purrbot.site");
  if (!gifUrl.pathname.startsWith("/nsfw/" + category + "/gif/")) {
    throw new Error("NSFW GIF service returned content outside the selected " + category + " category.");
  }
  return { url: gifUrl.toString(), anime: "", pairing: category, source: "PurrBot NSFW" };
}

export async function fetchPurrbotSfwGif(category, { fetchImpl = fetch } = {}) {
  if (!["lick"].includes(category)) throw new Error("Invalid PurrBot SFW GIF category.");
  const response = await fetchImpl(PURRBOT_API_BASE + "/img/sfw/" + category + "/gif", {
    headers: { "User-Agent": "SugarDiscordBot/1.0 (https://github.com/ikititta/discord-bot-dashboard)" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error("SFW GIF service returned HTTP " + response.status + ".");
  const payload = await response.json();
  if (payload?.error !== false) throw new Error("SFW GIF service did not return a valid result.");
  const gifUrl = validatedGifUrl(payload?.link, "cdn.purrbot.site");
  if (!gifUrl.pathname.startsWith("/sfw/" + category + "/gif/")) throw new Error("SFW GIF service returned content outside the selected category.");
  return { url: gifUrl.toString(), anime: "", pairing: category, source: "PurrBot SFW" };
}


export async function fetchNsfwGif({ fetchImpl = fetch, actorRole = "neutral", targetRole = null, actorDominance = null, targetDominance = null } = {}) {
  // The current provider cannot filter the top/bottom position. Keep GIFs
  // available rather than suppressing every directional pairing; dominance
  // still resolves in resolveDominancePair, but this generic GIF is not
  // guaranteed to depict that exact position.
  const category = resolveNsfwGifCategory(actorRole, targetRole, actorDominance, targetDominance);
  const response = await fetchImpl(PURRBOT_API_BASE + "/img/nsfw/" + category + "/gif", {
    headers: { "User-Agent": "SugarDiscordBot/1.0 (https://github.com/ikititta/discord-bot-dashboard)" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`NSFW GIF service returned HTTP ${response.status}.`);
  const payload = await response.json();
  if (payload?.error !== false) throw new Error("NSFW GIF service did not return a valid result.");
  const gifUrl = validatedGifUrl(payload?.link, "cdn.purrbot.site");
  if (!gifUrl.pathname.startsWith("/nsfw/" + category + "/gif/")) {
    throw new Error("NSFW GIF service returned content outside the selected " + category + " category.");
  }
  return { url: gifUrl.toString(), anime: "", pairing: category, source: "PurrBot NSFW" };
}

export async function fetchAnimeGif(category, {
  fetchImpl = fetch,
  actorRole = "neutral",
  targetRole = null,
  actorDominance = null,
  targetDominance = null,
} = {}) {
  if (!GIF_CATEGORIES.has(category)) throw new Error("Invalid anime GIF category.");

  if (GIFUKAI_PAIRING_CATEGORIES.has(category)) {
    const pairing = resolveGifPairing(actorRole, targetRole, actorDominance, targetDominance);
    const url = new URL(`${GIFUKAI_API_BASE}/${category}`);
    if (pairing) url.searchParams.set("pairing", pairing);
    try {
      const response = await fetchImpl(url, {
        headers: { "User-Agent": "SugarDiscordBot/1.0 (https://github.com/ikititta/discord-bot-dashboard)" },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`Gifukai returned HTTP ${response.status}.`);
      const payload = await response.json();
      const gifUrl = validatedGifUrl(payload?.url, "cdn.gifukai.com");
      return { url: gifUrl.toString(), anime: String(payload.anime ?? "").slice(0, 80), pairing, source: "Gifukai" };
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
  const gifUrl = validatedGifUrl(result?.url, "nekos.best");
  return { url: gifUrl.toString(), anime: String(result.anime_name ?? "").slice(0, 80), pairing: null, source: "Nekos.best" };
}

export function isVerifiedAdult(member) {
  const roles = member?.roles?.cache;
  if (!roles) return false;
  // Resolve Member by its live role name as well as the legacy ID. The
  // onboarding system manages this role by name, so its ID may change.
  const hasMemberRole = typeof roles.some === "function"
    ? roles.some((role) => String(role?.name ?? "").normalize("NFKD").toLowerCase().replace(/\p{M}/gu, "").replace(/[^a-z0-9]/g, "") === "member")
    : false;
  return Boolean(roles.has?.(FUN_MEMBER_ROLE_ID) || hasMemberRole);
}

export function isVip(member) {
  const roles = member?.roles?.cache;
  if (!roles) return false;
  // The configured ID is the primary check. Also recognize the live role by
  // its normalized name so a recreated/renamed Discord role does not silently
  // lock out VIP benefits while the stored ID is stale.
  if (roles.has?.(FUN_VIP_ROLE_ID)) return true;
  return typeof roles.some === "function"
    ? roles.some((role) => String(role?.name ?? "").normalize("NFKD").toLowerCase().replace(/\p{M}/gu, "").replace(/[^a-z0-9]/g, "") === "vip")
    : false;
}

export function isVipOnlyFunCommand(name) {
  return ["fuck", "kill", "masturbate", "oral", "anal", "tease", "seduce", "choke", "spit"].includes(name);
}

function displayName(member, user) {
  return member?.displayName ?? user?.globalName ?? user?.username ?? "Someone";
}

async function safeReply(message, payload, mentionUserIds = []) {
  return message.reply({
    ...payload,
    allowedMentions: { parse: [], users: mentionUserIds, repliedUser: false },
  });
}

export function buildFunActionText(actorId, targetId, definition) {
  return targetId
    ? "<@" + actorId + "> " + definition.text + " <@" + targetId + ">!"
    : "<@" + actorId + "> " + definition.text + "!";
}

async function showStats(message, store, { targetMember, targetUser, full, received = false }) {
  const stats = store.getStats(message.guild.id, targetUser.id);
  const embed = buildFunStatsEmbed({ user: { ...targetUser, id: targetUser.id, displayName: displayName(targetMember, targetUser) }, stats, full, received, relationship: store.getRelationship(message.guild.id, targetUser.id), history: store.getRelationshipHistory(message.guild.id, targetUser.id) });
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
    if (!isVip(message.member)) return safeReply(message, { content: VIP_STATS_MESSAGE });
    return showStats(message, store, {
      targetMember: message.member,
      targetUser: message.author,
      full: true,
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
  let targetDominance = null;
  const actorRole = normalizeFunRole(message.member);
  const actorDominance = normalizeFunDominance(message.member);
  if (definition.needsTarget) {
    targetUser = message.mentions.users.first();
    const replyTargetAllowed = !["fuck", "masturbate", "oral", "anal"].includes(name);
    if (!targetUser && replyTargetAllowed && message.reference?.messageId) {
      const replied = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
      if (replied?.author && !replied.author.bot) targetUser = replied.author;
    }
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
      await safeReply(message, { content: "That member needs the Member role first." });
      return true;
    }
    targetRole = normalizeFunRole(targetMember);
    targetDominance = normalizeFunDominance(targetMember);
    if (name === "oral" && !resolveOralNsfwGifCategory(targetRole)) {
      await safeReply(message, { content: "I need the mentioned member to have a Female or Male role to choose the matching oral GIF ♡" });
      return true;
    }
    // VIP access for paired commands is satisfied when either participant is VIP.
    if (isVipOnlyFunCommand(name) && !isVip(message.member) && !isVip(targetMember)) {
      await safeReply(message, { content: `The !${name} command is a VIP-only benefit ♡` });
      return true;
    }
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

  const actionText = buildFunActionText(message.author.id, targetUser?.id ?? null, definition);

  let gif = null;
  try {
    if (name === "fuck" || name === "anal") gif = await fetchNsfwGif({ fetchImpl, actorRole, targetRole, actorDominance, targetDominance });
    else if (name === "masturbate") {
      gif = selectMasturbateGif(actorRole, targetRole);
      // The curated gender-specific catalog is currently empty. Fall back to
      // the working generic NSFW source so the command still returns a GIF.
      if (!gif) gif = await fetchNsfwGif({ fetchImpl, actorRole, targetRole, actorDominance, targetDominance });
    } else if (definition.nsfwGif) {
      const category = name === "oral" ? resolveOralNsfwGifCategory(targetRole) : definition.nsfwGif;
      gif = await fetchPurrbotNsfwGif(category, { fetchImpl });
    } else if (definition.gif) {
      if (name === "lick") { try { gif = await fetchPurrbotSfwGif("lick", { fetchImpl }); } catch (error) { console.warn("[fun] PurrBot lick GIF unavailable; trying anime fallback: " + error.message); } }
      if (!gif) gif = await fetchAnimeGif(definition.gif, { fetchImpl, actorRole, targetRole, actorDominance, targetDominance });
    }
  }
  catch (error) { console.warn(`[fun] GIF lookup failed for !${name}: ${error.message}`); }

  if (!gif) {
    const content = actionText + (name === "masturbate" ? "\nNo se encontró un GIF disponible esta vez ♡" : "");
    await safeReply(message, { content }, [message.author.id, ...(targetUser ? [targetUser.id] : [])]);
    return true;
  }
  const embed = new EmbedBuilder().setColor(COLOR).setImage(gif.url);
  if (gif.anime) embed.setFooter({ text: `Anime: ${gif.anime} · ${gif.source}` });
  await safeReply(message, { content: actionText, embeds: [embed] }, [message.author.id, ...(targetUser ? [targetUser.id] : [])]);
  return true;
}

const RELATION_PREFIX = "sugar-relation:";
function relationshipRow(id) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(RELATION_PREFIX + id + ":yes").setLabel("Accept ♡").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(RELATION_PREFIX + id + ":no").setLabel("Decline").setStyle(ButtonStyle.Secondary),
  );
}
async function handleRelationshipButton(interaction, store) {
  if (!interaction.customId.startsWith(RELATION_PREFIX)) return false;
  const parts = interaction.customId.slice(RELATION_PREFIX.length).split(":");
  const result = store.resolveRelationshipProposal(interaction.guildId, parts[0], interaction.user.id, parts[1] === "yes");
  if (result.error) { await interaction.reply({ content: result.error === "not_target" ? "Only the person who received this proposal can answer ♡" : "This proposal is no longer available.", ephemeral: true }); return true; }
  await interaction.update({ content: parts[1] === "yes" ? (result.type === "marriage" ? "💍 They said yes! You are now married ♡" : "💗 You are now a couple ♡") : "The proposal was declined.", components: [] });
  return true;
}
async function handleRelationshipCommand(message, store, name, fetchImpl) {
  if (["couple", "propose", "marry"].includes(name)) {
    const target = message.mentions.users.first();
    if (!target || target.bot || target.id === message.author.id) { await safeReply(message, { content: "Usage: !" + name + " @member" }); return; }
    const member = await message.guild.members.fetch(target.id).catch(() => null);
    if (!member || !isVerifiedAdult(member)) { await safeReply(message, { content: "Both members must have the Member role ♡" }); return; }
    const type = name === "couple" ? "couple" : "marriage";
    const proposal = store.createRelationshipProposal({ guildId: message.guild.id, proposerId: message.author.id, targetId: target.id, type });
    if (proposal.error) { await safeReply(message, { content: proposal.error === "already_in_relationship" ? "One of you is already in a relationship ♡" : "One of you already has a pending proposal." }); return; }
    let gif = null;
    try {
      const category = name === "couple" ? "handhold" : "kiss";
      gif = await fetchAnimeGif(category, { fetchImpl, actorRole: normalizeFunRole(message.member), targetRole: normalizeFunRole(member), actorDominance: normalizeFunDominance(message.member), targetDominance: normalizeFunDominance(member) });
    } catch (error) { console.warn(`[fun] relationship GIF lookup failed for !${name}: ${error.message}`); }
    const embed = gif ? new EmbedBuilder().setColor(COLOR).setImage(gif.url) : null;
    await safeReply(message, { content: (type === "marriage" ? "💍 " : "💗 ") + "<@" + message.author.id + "> has proposed to <@" + target.id + ">!", ...(embed ? { embeds: [embed] } : {}), components: [relationshipRow(proposal.id)] }, [message.author.id, target.id]);
    return;
  }
  const expected = name === "divorce" ? "marriage" : "couple";
  const result = store.endRelationship(message.guild.id, message.author.id, expected);
  const response = result.error === "no_relationship" ? "You do not have an active relationship." : result.error === "wrong_type" ? (name === "divorce" ? "You are not married." : "You are not dating. Use !divorce if you are married.") : (name === "divorce" ? "The marriage has ended ♡" : "The relationship has ended ♡");
  await safeReply(message, { content: response });
}
const STATS_COMMAND = new SlashCommandBuilder().setName("stats").setDescription("Privately view your complete fun statistics").toJSON();
const VIP_COMMAND = new SlashCommandBuilder().setName("vip").setDescription("VIP commands").addSubcommand((sub) => sub.setName("stats").setDescription("Privately view complete stats").addUserOption((option) => option.setName("member").setDescription("Member whose stats to view").setRequired(false))).toJSON();

export async function removeGifPreferencesChannel(guild) {
  const channel = await guild.channels.fetch(RETIRED_GIF_PREFERENCES_CHANNEL_ID).catch(() => null);
  if (!channel) return false;
  await channel.delete("Retire GIF preferences panel; Sugar now uses anime GIFs only");
  console.info("[fun] retired GIF preferences channel and its embed");
  return true;
}

async function registerFunCommands(token, applicationId) {
  const rest = new REST({ version: "10" }).setToken(token);
  const route = Routes.applicationGuildCommands(applicationId, KITTISUGAR_GUILD_ID);
  const current = await rest.get(route);
  await rest.put(route, { body: [...current.filter((command) => !["fun", "stats", "vip"].includes(command.name)), STATS_COMMAND, VIP_COMMAND] });
}
export function attachFunCommands(client, { store, fetchImpl = fetch, token, applicationId } = {}) {
  if (!store) throw new Error("The fun-command statistics store is required.");

  client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isButton?.()) {
      try {
        await handleRelationshipButton(interaction, store);
      } catch (error) {
        console.error("[fun] button action failed: " + error.message);
        if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: "Sugar couldn't process this request ♡", ephemeral: true }).catch(() => {});
      }
    }

    if (interaction.isChatInputCommand?.() && ["stats", "vip"].includes(interaction.commandName)) {
      try {
        const targetUser = interaction.commandName === "vip" ? interaction.options.getUser("member") ?? interaction.user : interaction.user;
        const requesterMember = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
        if (!isVip(requesterMember)) { await interaction.reply({ content: VIP_STATS_MESSAGE, ephemeral: true }); return; }
        const targetMember = targetUser.id === interaction.user.id ? requesterMember : await interaction.guild.members.fetch(targetUser.id).catch(() => null);
        if (!targetMember) { await interaction.reply({ content: "Member not found in Kittisugar.", ephemeral: true }); return; }
        const stats = store.getStats(interaction.guildId, targetUser.id);
        const embed = buildFunStatsEmbed({ user: { ...targetUser, id: targetUser.id, displayName: displayName(targetMember, targetUser) }, stats, full: true, received: targetUser.id !== interaction.user.id, relationship: store.getRelationship(interaction.guildId, targetUser.id), history: store.getRelationshipHistory(interaction.guildId, targetUser.id) });
        await interaction.reply({ embeds: [embed], ephemeral: true });
      } catch (error) {
        console.error("[fun] private stats failed: " + error.message);
        if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: "Sugar could not load your private stats. Please try again ♡", ephemeral: true }).catch(() => {});
      }
    }
  });
  client.once(Events.ClientReady, () => {
    if (token && applicationId) void registerFunCommands(token, applicationId).catch((error) => console.error("[fun] stats command registration failed: " + error.message));
  });

  const retireGifPreferences = (guild) => {
    if (guild.id !== KITTISUGAR_GUILD_ID) return;
    void removeGifPreferencesChannel(guild).catch((error) =>
      console.error("[fun] could not delete retired GIF preferences channel: " + error.message),
    );
  };
  client.once(Events.ClientReady, () => {
    const guild = client.guilds.cache.get(KITTISUGAR_GUILD_ID);
    if (guild) retireGifPreferences(guild);
  });
  client.on(Events.GuildCreate, retireGifPreferences);

  client.on(Events.MessageCreate, async (message) => {
    if (!message.guild || message.guild.id !== KITTISUGAR_GUILD_ID ||
        message.author?.bot || message.webhookId || !message.member) return;
    const commandText = String(message.content ?? "").trim();
    const match = /^!([a-z-]+)(?:\s+([\s\S]*))?$/i.exec(commandText);
    if (!match) return;

    const name = match[1].toLowerCase();
    const args = match[2] ?? "";
    try {
      if (BLOCKED_COMMANDS.has(name)) {
        await safeReply(message, { content: "That command isn't available." });
        return;
      }
      if (["couple", "propose", "marry", "breakup", "divorce"].includes(name)) {
        if (!isVerifiedAdult(message.member)) { await safeReply(message, { content: "Relationships are available to verified Member accounts ♡" }); return; }
        await handleRelationshipCommand(message, store, name, fetchImpl);
        return;
      }
      if (name === "nsfw-on" || name === "nsfw-off") {
        await safeReply(message, { content: "All two-person fun interactions are automatic now. No approval settings are needed ♡" });
        return;
      }
      if (name === "stats" || name === "vip") {
        // Prefix commands cannot reply ephemerally; remove public invocations.
        await message.delete().catch(() => {});
        return;
      }
      if (!getFunCommandDefinition(name)) return;
      if (!isVerifiedAdult(message.member)) {
        await safeReply(message, { content: "Fun commands require the Member role ♡" });
        return;
      }
      await handleFunAction(message, store, name, args, fetchImpl);
    } catch (error) {
      console.error(`[fun] !${name} failed for member ${message.author.id}: ${error.message}`);
      await safeReply(message, { content: "Sugar couldn't complete that fun command. Please try again ♡" }).catch(() => {});
    }
  });
}
