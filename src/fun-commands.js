import { EmbedBuilder, Events } from "discord.js";
import { isCommandsThread } from "./commands-channel.js";

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
const VIP_STATS_MESSAGE = "VIP unlocks full stats and lets you view another member with !vip stats @member. Everyone can view their own basic stats with !stats; VIP members can use !vip stats for their complete report. ♡";

const TWO_PERSON_COMMANDS = Object.freeze({
  slap: { gif: "slap", text: "has slapped" },
  bonk: { gif: "bonk", text: "has bonked" },
  spank: { gif: "slap", text: "has given a playful spank to" },
  hug: { gif: "hug", text: "has hugged" },
  kiss: { gif: "kiss", text: "has kissed" },
  cuddle: { gif: "cuddle", text: "has cuddled" },
  pat: { gif: "pat", text: "has given a headpat to" },
  poke: { gif: "poke", text: "has poked" },
  bite: { gif: "bite", text: "has bitten" },
  kick: { gif: "kick", text: "has kicked" },
  kill: { gif: "kick", text: "has defeated" },
  highfive: { gif: "highfive", text: "has high-fived" },
  handhold: { gif: "handhold", text: "is holding hands with" },
});

const SOLO_COMMANDS = Object.freeze({
  cry: { gif: "cry", text: "has cried" },
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
    .setDescription(`**Used:** ${stats.total ?? 0} commands\n**Received:** ${stats.receivedTotal ?? 0} interactions`)
    .addFields({ name: "How stats work", value: full ? "This is the complete report: commands you use, interactions you receive, and the members you interact with. Use !vip stats @member to view another members report." : "This is your personal summary. Use !vip stats for your complete report if you have VIP. VIP members can view another member with !vip stats @member." });

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
    embed.setFooter({ text: "VIP stats · Type !funhelp for the command guide ♡" });
  } else {
    embed.setFooter({ text: "Use !vip stats for your complete VIP report · !funhelp for help ♡" });
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

function isVip(member) {
  return Boolean(member?.roles?.cache?.has(FUN_VIP_ROLE_ID));
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

export function buildFunHelpEmbed() {
  return new EmbedBuilder()
    .setColor(COLOR)
    .setTitle("Sugar Fun Commands Guide ♡")
    .setDescription("Use these commands in Kittisugar. Every fun command requires the Member role (18+ verification). Two-person commands need a member mention; solo commands do not.")
    .addFields(
      { name: "Two-person commands", value: "!hug @member · !slap @member · !bonk @member · !spank @member · !kiss @member · !cuddle @member · !pat @member · !poke @member · !bite @member · !kick @member · !kill @member · !highfive @member · !handhold @member" },
      { name: "Solo commands", value: "!cry · !laugh · !dance · !sleep · !happy · !blush · !smug · !wave · !facepalm · !wink · !shrug · !smile · !pout" },
      { name: "Statistics", value: "!stats — see your own basic stats.\n!vip stats — VIP members see their complete stats.\n!vip stats @member — VIP members see another members complete stats.\nStats count commands used, interactions received, and interaction partners." },
      { name: "VIP", value: "VIP is a server role. It unlocks complete statistics and the ability to look up other members stats. Without VIP, you can still use !stats to see your own summary." },
    )
    .setFooter({ text: "Be kind and keep every interaction consensual ♡" });
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

  const actionText = buildFunActionText(message.author.id, targetUser?.id ?? null, definition);

  let gif = null;
  try { gif = await fetchAnimeGif(definition.gif, { fetchImpl, actorRole: normalizeFunRole(message.member), targetRole }); }
  catch (error) { console.warn(`[fun] GIF lookup failed for !${name}: ${error.message}`); }

  const embed = new EmbedBuilder().setColor(COLOR);
  if (gif) {
    embed.setImage(gif.url);
    if (gif.anime) embed.setFooter({ text: `Anime: ${gif.anime} · ${gif.source}` });
  } else {
    embed.setFooter({ text: "Anime GIF unavailable right now ♡" });
  }
  await safeReply(message, { content: actionText, embeds: [embed] }, [message.author.id, ...(targetUser ? [targetUser.id] : [])]);
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
    if (!isCommandsThread(message)) {
      const parentName = String(message.channel?.parent?.name ?? message.channel?.name ?? "")
        .normalize("NFKD").toLowerCase().replace(/\p{M}/gu, "").replace(/[^a-z0-9]/g, "");
      if (parentName.includes("commands") &&
          (getFunCommandDefinition(name) || name === "funhelp" || name === "stats" || name === "vip")) {
        await safeReply(message, { content: "Please use the 💬 commands thread for fun commands ♡" });
      }
      return;
    }
    try {
      if (BLOCKED_COMMANDS.has(name)) {
        await safeReply(message, { content: "That command isn't available. Please keep interactions consensual ♡" });
        return;
      }
      if (name === "funhelp") {
        await safeReply(message, { embeds: [buildFunHelpEmbed()] });
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
