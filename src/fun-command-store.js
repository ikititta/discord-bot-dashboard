import fs from "node:fs";
import path from "node:path";

const VERSION = 1;
const MAX_GUILDS = 20;
const MAX_USERS_PER_GUILD = 5_000;
const MAX_PARTNERS_PER_USER = 100;

function emptyState() {
  return { version: VERSION, guilds: {} };
}

function validCounterMap(value, { idsOnly = false } = {}) {
  return value && typeof value === "object" && !Array.isArray(value) &&
    Object.entries(value).every(([key, count]) =>
      (idsOnly ? /^\d{17,20}$/.test(key) : /^[a-z][a-z0-9-]{0,30}$/.test(key)) &&
      Number.isSafeInteger(count) && count >= 0,
    );
}

function validUserStats(value) {
  return value && typeof value === "object" && !Array.isArray(value) &&
    Number.isSafeInteger(value.total) && value.total >= 0 &&
    Number.isSafeInteger(value.receivedTotal) && value.receivedTotal >= 0 &&
    validCounterMap(value.commands) && validCounterMap(value.received) &&
    validCounterMap(value.partners, { idsOnly: true }) && validCounterMap(value.receivedFrom, { idsOnly: true }) &&
    typeof value.lastUsed === "string";
}

/** Durable, bounded per-guild fun-command counters. */
export class FunCommandStore {
  constructor(dataDir) {
    this.file = path.join(dataDir, "fun-command-state.json");
    this.data = this.#read();
  }

  record({ guildId, actorId, targetId = null, command, actorRole = "unknown", targetRole = null }) {
    if (!/^\d{17,20}$/.test(guildId ?? "") || !/^\d{17,20}$/.test(actorId ?? "") ||
        (targetId !== null && !/^\d{17,20}$/.test(targetId)) ||
        !/^[a-z][a-z0-9-]{0,30}$/.test(command ?? "")) {
      throw new Error("Invalid fun-command statistic input.");
    }

    const guild = this.data.guilds[guildId] ??= { users: {} };
    const now = new Date().toISOString();
    const actor = guild.users[actorId] ??= emptyUserStats();
    actor.total = increment(actor.total);
    actor.commands[command] = increment(actor.commands[command] ?? 0);
    actor.lastUsed = now;
    if (targetId) {
      actor.partners[targetId] = increment(actor.partners[targetId] ?? 0);
      trimMap(actor.partners, MAX_PARTNERS_PER_USER);
      const target = guild.users[targetId] ??= emptyUserStats();
      target.receivedTotal = increment(target.receivedTotal);
      target.received[command] = increment(target.received[command] ?? 0);
      target.receivedFrom[actorId] = increment(target.receivedFrom[actorId] ?? 0);
      target.lastUsed = now;
      trimMap(target.receivedFrom, MAX_PARTNERS_PER_USER);
    }
    actor.lastRole = actorRole;
    if (targetRole) actor.lastTargetRole = targetRole;
    this.#trimGuilds();
    this.#write();
    return this.getStats(guildId, actorId);
  }

  getStats(guildId, userId) {
    const stats = this.data.guilds[guildId]?.users?.[userId];
    return stats ? structuredClone(stats) : emptyUserStats();
  }

  getGuildStats(guildId) {
    const users = this.data.guilds[guildId]?.users ?? {};
    return Object.entries(users).map(([userId, stats]) => ({
      userId,
      ...structuredClone(stats),
    }));
  }

  #trimGuilds() {
    const guildIds = Object.keys(this.data.guilds);
    while (guildIds.length > MAX_GUILDS) delete this.data.guilds[guildIds.shift()];
    for (const guild of Object.values(this.data.guilds)) {
      const users = Object.keys(guild.users);
      while (users.length > MAX_USERS_PER_GUILD) delete guild.users[users.shift()];
    }
  }

  #read() {
    let raw;
    try {
      raw = fs.readFileSync(this.file, "utf8");
    } catch (error) {
      if (error?.code === "ENOENT") return emptyState();
      throw new Error("Unable to read fun-command-state.json; existing statistics were left untouched.");
    }
    let parsed;
    try { parsed = JSON.parse(raw); } catch {
      throw new Error("fun-command-state.json is invalid JSON; refusing to overwrite it.");
    }
    if (!parsed || parsed.version !== VERSION || !parsed.guilds ||
        typeof parsed.guilds !== "object" || Array.isArray(parsed.guilds) ||
        Object.keys(parsed.guilds).length > MAX_GUILDS) {
      throw new Error("fun-command-state.json has an invalid structure; refusing to overwrite it.");
    }
    for (const [guildId, guild] of Object.entries(parsed.guilds)) {
      if (!/^\d{17,20}$/.test(guildId) || !guild || typeof guild !== "object" ||
          !guild.users || typeof guild.users !== "object" || Array.isArray(guild.users) ||
          Object.keys(guild.users).length > MAX_USERS_PER_GUILD) {
        throw new Error("fun-command-state.json contains invalid guild data; refusing to overwrite it.");
      }
      for (const [userId, stats] of Object.entries(guild.users)) {
        if (!/^\d{17,20}$/.test(userId) || !validUserStats(stats)) {
          throw new Error("fun-command-state.json contains invalid member statistics; refusing to overwrite it.");
        }
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

function emptyUserStats() {
  return {
    total: 0,
    receivedTotal: 0,
    commands: {},
    received: {},
    partners: {},
    receivedFrom: {},
    lastUsed: "",
  };
}

function increment(value) {
  return value >= Number.MAX_SAFE_INTEGER ? value : value + 1;
}

function trimMap(map, maximum) {
  const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
  for (const [key] of entries.slice(maximum)) delete map[key];
}
