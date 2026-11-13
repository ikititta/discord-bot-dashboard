import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Events, REST, Routes, SlashCommandBuilder, StringSelectMenuBuilder } from "discord.js";
import { GENDER_ROLE_IDS } from "./role-onboarding.js";

const KITTISUGAR_GUILD_ID = "1567093019377930363";
const FUN_CATEGORY_ID = "1568179038625857576";
export const GIF_PREFERENCES_CHANNEL_NAME = "🎞️｜୨୧・𝓰𝓲𝓯-𝓹𝓻𝓮𝓯𝓼";
const GIF_PREFERENCES_CHANNEL_TOPIC = "Choose your personal GIF style for Sugar fun interactions";
const GIF_PREFERENCES_PANEL_TITLE = "୨୧ 𝓖𝓘𝓕 · 𝓟𝓻𝓮𝓯𝓮𝓻𝓮𝓷𝓬𝓮𝓼 ♡";

export const FUN_ROLE_IDS = GENDER_ROLE_IDS;
export const FUN_VIP_ROLE_ID = "1568188640113463437";
export const FUN_MEMBER_ROLE_ID = "1568188534836428812";

const GIFUKAI_API_BASE = "https://api.gifukai.com/v1";
const NEKOS_BEST_API_BASE = "https://nekos.best/api/v2";
const PURRBOT_API_BASE = "https://api.purrbot.site/v2";
const GIPHY_API_BASE = "https://api.giphy.com/v1/gifs/search";
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
  masturbate: { gif: null, nsfwGif: "solo", text: "has masturbated" },
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

function validatedGifUrl(rawUrl, expectedHost) {
  let url;
  try { url = new URL(rawUrl ?? ""); }
  catch { throw new Error("Anime GIF service returned an invalid GIF URL."); }
  if (url.protocol !== "https:" || url.hostname !== expectedHost || !url.pathname.endsWith(".gif")) {
    throw new Error("Anime GIF service returned an invalid GIF URL.");
  }
  return url;
}

export function resolveNsfwGifCategory(actorRole, targetRole) {
  if (actorRole === "female" && targetRole === "female") return "yuri";
  if (actorRole === "male" && targetRole === "male") return "yaoi";
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

export async function fetchRealGif(query, { fetchImpl = fetch, apiKey = process.env.GIPHY_API_KEY } = {}) {
  if (!apiKey) throw new Error("GIPHY_API_KEY is not configured.");
  const url = new URL(GIPHY_API_BASE);
  url.searchParams.set("api_key", apiKey); url.searchParams.set("q", query);
  url.searchParams.set("limit", "10"); url.searchParams.set("rating", "pg-13"); url.searchParams.set("lang", "en");
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!response.ok) throw new Error("Giphy returned HTTP " + response.status + ".");
  const payload = await response.json();
  const selected = (Array.isArray(payload?.data) ? payload.data : []).find((item) => item?.images?.original?.url);
  let gifUrl;
  try { gifUrl = new URL(selected?.images?.original?.url ?? ""); }
  catch { throw new Error("Giphy returned an invalid GIF URL."); }
  if (gifUrl.protocol !== "https:" || !/^media\\d*\\.giphy\\.com$/.test(gifUrl.hostname) || !gifUrl.pathname.endsWith(".gif")) {
    throw new Error("Giphy returned an invalid GIF URL.");
  }
  return { url: gifUrl.toString(), anime: "", pairing: null, source: "Giphy" };
}

const REAL_GIF_QUERIES = Object.freeze({
  shoot: "cinematic movie shooting scene gunshot reaction",
  kill: "cinematic movie dramatic defeat reaction",
  lick: "lick reaction gif",
});
export async function fetchNsfwGif({ fetchImpl = fetch, actorRole = "neutral", targetRole = null } = {}) {
  const category = resolveNsfwGifCategory(actorRole, targetRole);
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
      await safeReply(message, { content: "That member needs the Member role first." });
      return true;
    }
    targetRole = normalizeFunRole(targetMember);
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
    if (name === "fuck") gif = await fetchNsfwGif({ fetchImpl, actorRole: normalizeFunRole(message.member), targetRole });
    else if (definition.nsfwGif) {
      const actorRole = normalizeFunRole(message.member);
      const category = name === "oral" ? resolveOralNsfwGifCategory(targetRole) : definition.nsfwGif === "solo" && actorRole === "male" ? "solo_male" : definition.nsfwGif;
      gif = await fetchPurrbotNsfwGif(category, { fetchImpl });
    } else if (definition.gif) {
      const style = store.getGifStyle?.(message.guild.id, message.author.id) ?? "anime";
      if (style === "real") {
        const query = REAL_GIF_QUERIES[name] ?? (definition.gif + " reaction gif");
        try { gif = await fetchRealGif(query, { fetchImpl }); } catch (error) { console.warn("[fun] real GIF lookup failed; trying the anime provider: " + error.message); }
      }
      if (!gif && name === "lick") { try { gif = await fetchPurrbotSfwGif("lick", { fetchImpl }); } catch (error) { console.warn("[fun] PurrBot lick GIF unavailable; trying anime fallback: " + error.message); } }
      if (!gif) gif = await fetchAnimeGif(definition.gif, { fetchImpl, actorRole: normalizeFunRole(message.member), targetRole });
    }
  }
  catch (error) { console.warn(`[fun] GIF lookup failed for !${name}: ${error.message}`); }

  if (!gif) {
    await safeReply(message, { content: actionText }, [message.author.id, ...(targetUser ? [targetUser.id] : [])]);
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
      const style = store.getGifStyle?.(message.guild.id, message.author.id) ?? "anime";
      if (style === "real") {
        try { gif = await fetchRealGif(category + " romantic movie relationship reaction", { fetchImpl }); }
        catch (error) { console.warn("[fun] real relationship GIF lookup failed; using anime: " + error.message); }
      }
      if (!gif) gif = await fetchAnimeGif(category, { fetchImpl, actorRole: normalizeFunRole(message.member), targetRole: normalizeFunRole(member) });
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

export function buildGifPreferencesPanelPayload() {
  return {
    embeds: [new EmbedBuilder()
      .setColor(COLOR)
      .setTitle(GIF_PREFERENCES_PANEL_TITLE)
      .setDescription("Choose how Sugar displays GIFs in your fun and relationship interactions. Your choice is saved to your account. ♡\n\n**Anime GIFs** — anime reactions and illustrations\n**Real / movie GIFs** — real-life and cinematic reaction GIFs\n\nNSFW commands keep their existing VIP and Member access restrictions; this setting does not unlock them.")
      .setFooter({ text: "Your preference is personal · Change it any time ♡" })],
    components: [new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("sugar-gif-preferences")
        .setPlaceholder("Choose your GIF style ♡")
        .addOptions(
          { label: "Anime GIFs", value: "anime", description: "Anime reactions and illustrations", emoji: "🌸" },
          { label: "Real / movie GIFs", value: "real", description: "Real-life and cinematic reaction GIFs", emoji: "🎬" },
        ),
    )],
  };
}

export async function ensureGifPreferencesChannel(guild, client) {
  const category = await guild.channels.fetch(FUN_CATEGORY_ID).catch(() => null);
  if (!category || category.type !== 4) {
    console.warn("[fun] fun category " + FUN_CATEGORY_ID + " was not found; no GIF preferences channel was created.");
    return null;
  }

  let channel = await guild.channels.fetch().then((channels) =>
    channels.find((item) => item.type === 0 && item.parentId === FUN_CATEGORY_ID &&
      (item.name === GIF_PREFERENCES_CHANNEL_NAME || item.topic === GIF_PREFERENCES_CHANNEL_TOPIC)),
  ).catch(() => null);

  if (!channel) {
    channel = await guild.channels.create({
      name: GIF_PREFERENCES_CHANNEL_NAME,
      type: 0,
      parent: FUN_CATEGORY_ID,
      topic: GIF_PREFERENCES_CHANNEL_TOPIC,
      reason: "Create the GIF preferences panel in the Fun category",
    });
  } else {
    if (channel.name !== GIF_PREFERENCES_CHANNEL_NAME) {
      await channel.setName(GIF_PREFERENCES_CHANNEL_NAME, "Keep the GIF preferences channel in its designated format");
    }
    if (channel.topic !== GIF_PREFERENCES_CHANNEL_TOPIC) {
      await channel.setTopic(GIF_PREFERENCES_CHANNEL_TOPIC, "Keep the GIF preferences channel in its designated format");
    }
  }

  const recent = await channel.messages.fetch({ limit: 100 });
  const matches = [...recent.values()].filter((message) =>
    message.author?.id === client.user.id &&
    message.embeds.some((embed) => embed.title === GIF_PREFERENCES_PANEL_TITLE),
  ).sort((a, b) => b.createdTimestamp - a.createdTimestamp);
  const existing = matches.shift();
  if (existing) await existing.edit(buildGifPreferencesPanelPayload());
  else await channel.send(buildGifPreferencesPanelPayload());
  for (const duplicate of matches) {
    await duplicate.delete().catch((error) => {
      if (error?.code !== 10008) throw error;
    });
  }
  console.info("[fun] GIF preferences panel ready in #" + channel.name);
  return channel;
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
    if (interaction.isStringSelectMenu?.() && interaction.customId === "sugar-gif-preferences") {
      const style = interaction.values?.[0];
      if (!["anime", "real"].includes(style)) {
        return interaction.reply({ content: "Choose anime or real GIFs ♡", ephemeral: true });
      }
      store.setGifStyle(interaction.guildId, interaction.user.id, style);
      const note = style === "real" && !process.env.GIPHY_API_KEY
        ? "\nReal GIFs need GIPHY_API_KEY in FadeHost; Sugar will use anime GIFs until it is configured."
        : "";
      return interaction.reply({
        content: "Your GIF preference is now **" + (style === "anime" ? "Anime GIFs" : "Real / movie GIFs") + "** ♡" + note,
        ephemeral: true,
      });
    }
    if (interaction.isStringSelectMenu?.() && interaction.customId.startsWith("sugar-fun-style:")) {
      const ownerId = interaction.customId.split(":")[1];
      if (interaction.user.id !== ownerId) return interaction.reply({ content: "This GIF style menu belongs to someone else ♡", ephemeral: true });
      const style = interaction.values?.[0];
      if (!["anime", "real"].includes(style)) return interaction.reply({ content: "Choose anime or real GIFs ♡", ephemeral: true });
      store.setGifStyle(interaction.guildId, ownerId, style);
      const note = style === "real" && !process.env.GIPHY_API_KEY ? "\nReal GIFs need GIPHY_API_KEY in FadeHost; Sugar will use anime GIFs until it is configured." : "";
      return interaction.update({ content: "Your fun GIF style is now **" + style + "** ♡" + note, components: [] });
    }
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

  const setupGifPreferences = (guild) => {
    if (guild.id !== KITTISUGAR_GUILD_ID) return;
    void ensureGifPreferencesChannel(guild, client).catch((error) =>
      console.error("[fun] GIF preferences channel setup failed: " + error.message),
    );
  };
  client.once(Events.ClientReady, () => {
    const guild = client.guilds.cache.get(KITTISUGAR_GUILD_ID);
    if (guild) setupGifPreferences(guild);
  });
  client.on(Events.GuildCreate, setupGifPreferences);

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
      if (name === "funstyle") {
        const current = store.getGifStyle?.(message.guild.id, message.author.id) ?? "anime";
        await safeReply(message, {
          content: "Choose the GIF style for your fun interactions. NSFW commands keep their existing VIP and age-role restrictions ♡",
          components: [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder()
            .setCustomId("sugar-fun-style:" + message.author.id)
            .setPlaceholder("Choose your GIF style ♡")
            .addOptions(
              { label: "Anime GIFs", value: "anime", description: "Anime reactions and illustrations", default: current === "anime" },
              { label: "Real / movie GIFs", value: "real", description: "Real-life and cinematic reaction GIFs", default: current === "real" },
            ))],
        });
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
