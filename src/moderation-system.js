import fs from "node:fs";
import path from "node:path";
import { ChannelType, Events, PermissionFlagsBits } from "discord.js";

const VIP_ROLE_ID = "1568188640113463437";
const REPORTS_CHANNEL_ID = "1569479283133382787";
const RAID_WINDOW_MS = 10_000;
const RAID_JOIN_THRESHOLD = 8;
const RAID_ACCOUNT_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const RAID_TIMEOUT_MS = 10 * 60 * 1000;
const SPAM_WINDOW_MS = 8_000;
const SPAM_MESSAGE_THRESHOLD = 5;
const REPEAT_THRESHOLD = 3;
const STRIKE_LIMIT = 3;
const PROMOTION_CHANNELS = new Set(["promotions", "promotion", "promos", "promo", "selling", "advertising", "advertise", "marketplace"]);
const PROMOTION_WORDS = /\b(?:promot(?:e|ion|ing)|advertis(?:e|ing)|selling|for sale|commission(?:s)?|my shop|my store|discount code|subscribe to|my services|buy now)\b/i;
const INVITE_LINK = /(?:discord\.gg\/|discord(?:app)?\.com\/invite\/)/i;

export class AutoModerationStore {
  constructor(dataDir) {
    this.file = path.join(dataDir, "automod-state.json");
    this.data = this.#read();
  }

  addStrike(guildId, userId, reason) {
    const key = `${guildId}:${userId}`;
    const current = this.data.strikes[key] ?? { count: 0, reasons: [] };
    const next = {
      count: Math.min(STRIKE_LIMIT, current.count + 1),
      reasons: [...current.reasons, { reason: String(reason).slice(0, 120), at: new Date().toISOString() }].slice(-STRIKE_LIMIT),
    };
    this.data.strikes[key] = next;
    this.#write();
    return { count: next.count, limit: STRIKE_LIMIT };
  }

  getStrikes(guildId, userId) {
    return this.data.strikes[`${guildId}:${userId}`]?.count ?? 0;
  }

  #read() {
    let raw;
    try {
      raw = fs.readFileSync(this.file, "utf8");
    } catch (error) {
      if (error?.code === "ENOENT") return { version: 1, strikes: {} };
      throw new Error("Unable to read automod-state.json; existing strike records were left untouched.");
    }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("automod-state.json is invalid JSON; repair it or restore a backup before restarting.");
    }
    if (!parsed || parsed.version !== 1 || !parsed.strikes || typeof parsed.strikes !== "object" || Array.isArray(parsed.strikes)) {
      throw new Error("automod-state.json has an invalid structure; refusing to overwrite it.");
    }
    for (const value of Object.values(parsed.strikes)) {
      if (!value || !Number.isInteger(value.count) || value.count < 0 || value.count > STRIKE_LIMIT || !Array.isArray(value.reasons)) {
        throw new Error("automod-state.json contains invalid strike data; refusing to overwrite it.");
      }
    }
    return parsed;
  }

  #write() {
    const temporary = `${this.file}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(this.data, null, 2), { mode: 0o600 });
    fs.chmodSync(temporary, 0o600);
    fs.renameSync(temporary, this.file);
  }
}

export function detectMessageViolation(message, recentMessages = []) {
  const content = String(message?.content ?? "");
  const normalized = content.toLowerCase().replace(/\s+/g, " ").trim();
  const mentions = (message?.mentions?.users?.size ?? 0) + (message?.mentions?.roles?.size ?? 0);
  if (message?.mentions?.everyone || mentions >= 5) return "mass mentions";
  if (recentMessages.length >= SPAM_MESSAGE_THRESHOLD - 1) return "message spam";
  if (normalized && recentMessages.filter((item) => item.content === normalized).length >= REPEAT_THRESHOLD - 1) {
    return "repeated messages";
  }

  const isVip = message?.member?.roles?.cache?.has?.(VIP_ROLE_ID) ?? false;
  const channel = normalize(message?.channel?.name);
  const inPromotionChannel = PROMOTION_CHANNELS.has(channel);
  if ((!isVip || !inPromotionChannel) && (INVITE_LINK.test(content) || PROMOTION_WORDS.test(content))) {
    return "unauthorized promotion";
  }
  return null;
}

function normalize(value) {
  return String(value ?? "").normalize("NFKD").toLowerCase().replace(/\p{M}/gu, "").replace(/[^a-z0-9]/g, "");
}

function hasModeratorAccess(member, settings) {
  if (member?.permissions?.has(PermissionFlagsBits.Administrator) || member?.permissions?.has(PermissionFlagsBits.ManageMessages)) {
    return true;
  }
  const allowed = new Set(settings.get(member.guild.id).moderatorRoleIds);
  return member.roles.cache.some((role) => allowed.has(role.id));
}

async function findModerationChannel(guild, settings) {
  const candidates = [
    settings.get(guild.id).reportsChannelId,
    REPORTS_CHANNEL_ID,
  ].filter((id, index, all) => /^d{17,20}$/.test(id ?? "") && all.indexOf(id) === index);

  for (const id of candidates) {
    const channel = await guild.channels.fetch(id).catch(() => null);
    if (isPrivateModerationChannel(channel, guild)) return channel;
  }

  return guild.channels.cache.find((channel) =>
    channel.type === ChannelType.GuildText &&
    ["modlogs", "moderationlogs", "reports"].includes(normalize(channel.name)) &&
    isPrivateModerationChannel(channel, guild),
  ) ?? null;
}

function isPrivateModerationChannel(channel, guild) {
  if (!channel || channel.type !== ChannelType.GuildText) return false;
  const everyone = channel.permissionsFor(guild.roles.everyone);
  return Boolean(everyone && !everyone.has(PermissionFlagsBits.ViewChannel));
}

async function report(guild, settings, content) {
  const channel = await findModerationChannel(guild, settings);
  if (!channel) {
    console.warn(`[automod] no private moderation reports channel is available in guild ${guild.id}`);
    return;
  }
  await channel.send({ content, allowedMentions: { parse: [] } }).catch((error) => {
    console.error(`[automod] could not send moderation notice: ${error.message}`);
  });
}

export function attachModerationSystem(client, { settings, store }) {
  const joins = new Map();
  const messageHistory = new Map();
  const violationCooldowns = new Map();

  client.on(Events.GuildMemberAdd, async (member) => {
    const now = Date.now();
    const recent = (joins.get(member.guild.id) ?? []).filter((entry) => now - entry.at <= RAID_WINDOW_MS);
    recent.push({ at: now, member });
    joins.set(member.guild.id, recent);
    if (recent.length < RAID_JOIN_THRESHOLD) return;

    // Only very recently created accounts are automatically restricted, to reduce false positives.
    const suspicious = recent
      .map((entry) => entry.member)
      .filter((candidate) => now - candidate.user.createdTimestamp < RAID_ACCOUNT_AGE_MS);
    for (const candidate of suspicious) {
      await candidate.timeout(RAID_TIMEOUT_MS, "Temporary anti-raid restriction: rapid join burst").catch((error) => {
        console.error(`[anti-raid] could not timeout ${candidate.id}: ${error.message}`);
      });
    }
    await report(member.guild, settings,
      `🚨 **Anti-raid alert:** ${recent.length} members joined within 10 seconds. ${suspicious.length} newly-created account(s) were temporarily timed out for 10 minutes.`);
    joins.set(member.guild.id, []);
  });

  client.on(Events.MessageCreate, async (message) => {
    if (!message.guild || message.author?.bot || message.webhookId || !message.member) return;
    // This channel is exempt from automatic message removal; members' messages must remain visible.
    if (message.channelId === "1570257241511170150") return;
    if (hasModeratorAccess(message.member, settings)) return;

    const now = Date.now();
    const key = `${message.guild.id}:${message.author.id}`;
    const history = (messageHistory.get(key) ?? []).filter((item) => now - item.at <= SPAM_WINDOW_MS);
    const normalized = String(message.content ?? "").toLowerCase().replace(/\s+/g, " ").trim();
    const violation = detectMessageViolation(message, history);
    history.push({ at: now, content: normalized });
    messageHistory.set(key, history);
    if (messageHistory.size > 5_000) messageHistory.delete(messageHistory.keys().next().value);
    if (!violation) return;

    const cooldownKey = `${key}:${violation}`;
    await message.delete().catch(() => {});
    if (now - (violationCooldowns.get(cooldownKey) ?? 0) < 5_000) return;
    violationCooldowns.set(cooldownKey, now);
    const strike = store.addStrike(message.guild.id, message.author.id, violation);
    if (strike.count === 1) {
      await message.author.send("This is your first Kittisugar moderation warning. Your message was removed for " + violation + ". Please follow the server rules; three infractions result in removal from the server.").catch(() => {});
    }
    if (strike.count >= STRIKE_LIMIT) {
      await message.author.send("You reached 3/3 Kittisugar infractions and are being removed from the server.").catch(() => {});
      const kicked = await message.member.kick("Three Kittisugar rule violations (automatic moderation)").then(() => true).catch((error) => {
        console.error(`[automod] could not remove ${message.author.id}: ${error.message}`);
        return false;
      });
      await report(message.guild, settings,
        `⛔ <@${message.author.id}> reached **3/3 strikes** for ${violation} and ${kicked ? "was removed from Kittisugar" : "could not be removed automatically; staff action is required"}.`);
      return;
    }

    if (strike.count === 2) {
      await message.member.timeout(10 * 60 * 1000, `Kittisugar strike 2/3: ${violation}`).catch((error) => {
        console.error(`[automod] could not timeout ${message.author.id}: ${error.message}`);
      });
      await message.author.send("This is your second Kittisugar infraction. You have received a 10-minute timeout. One more infraction will result in removal from the server.").catch(() => {});
    }
    await report(message.guild, settings,
      `⚠️ <@${message.author.id}> received strike **${strike.count}/3** for **${violation}**. ${strike.count === 2 ? "A 10-minute timeout was applied." : "One more violation will result in removal."}`);
  });
}
