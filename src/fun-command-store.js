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

  record({ guildId, actorId, targetId = null, command }) {
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
    this.#trimGuilds();
    this.#write();
    return this.getStats(guildId, actorId);
  }

  setGifStyle(guildId, userId, style) {
    if (!["anime", "real"].includes(style)) throw new Error("Invalid fun GIF style.");
    const guild = this.#guild(guildId);
    guild.gifStyles ??= {};
    guild.gifStyles[userId] = style;
    this.#write();
    return style;
  }

  getGifStyle(guildId, userId) {
    const style = this.data.guilds[guildId]?.gifStyles?.[userId];
    return ["anime", "real"].includes(style) ? style : "anime";
  }

  setNsfwAutoAccept(guildId, userId, enabled) {
    const guild = this.#guild(guildId);
    guild.nsfwAutoAccept ??= {};
    guild.nsfwAutoAccept[userId] = Boolean(enabled);
    this.#write();
    return guild.nsfwAutoAccept[userId];
  }

  getNsfwAutoAccept(guildId, userId) {
    return this.data.guilds[guildId]?.nsfwAutoAccept?.[userId] === true;
  }

  setInteractionConsent(guildId, actorId, targetId, command) {
    if (!/^\d{17,20}$/.test(guildId ?? "") || !/^\d{17,20}$/.test(actorId ?? "") ||
        !/^\d{17,20}$/.test(targetId ?? "") || actorId === targetId ||
        !["kiss", "fuck"].includes(command)) throw new Error("Invalid interaction consent.");
    const guild = this.#guild(guildId);
    guild.interactionConsents ??= {};
    const key = actorId + ":" + targetId + ":" + command;
    guild.interactionConsents[key] = new Date().toISOString();
    const entries = Object.entries(guild.interactionConsents).sort((a, b) => a[1].localeCompare(b[1]));
    for (const [oldKey] of entries.slice(0, Math.max(0, entries.length - 5000))) delete guild.interactionConsents[oldKey];
    this.#write();
    return true;
  }

  hasInteractionConsent(guildId, actorId, targetId, command) {
    if (!["kiss", "fuck"].includes(command)) return false;
    const key = actorId + ":" + targetId + ":" + command;
    return typeof this.data.guilds[guildId]?.interactionConsents?.[key] === "string";
  }

  createRelationshipProposal({ guildId, proposerId, targetId, type }) {
    if (!/^\d{17,20}$/.test(guildId ?? "") || !/^\d{17,20}$/.test(proposerId ?? "") ||
        !/^\d{17,20}$/.test(targetId ?? "") || proposerId === targetId ||
        !["couple", "marriage"].includes(type)) throw new Error("Invalid relationship proposal.");
    const guild = this.#guild(guildId);
    guild.relationships ??= {};
    guild.proposals ??= [];
    this.#expireProposals(guild);
    if (guild.relationships[proposerId] || guild.relationships[targetId]) return { error: "already_in_relationship" };
    if (guild.proposals.some((p) => p.status === "pending" && (p.proposerId === proposerId || p.targetId === proposerId || p.proposerId === targetId || p.targetId === targetId))) return { error: "pending_proposal" };
    const proposal = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`, proposerId, targetId, type, status: "pending", createdAt: new Date().toISOString(), expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 };
    guild.proposals.push(proposal);
    guild.proposals = guild.proposals.slice(-500);
    this.#write();
    return structuredClone(proposal);
  }

  resolveRelationshipProposal(guildId, proposalId, userId, accept) {
    const guild = this.#guild(guildId);
    guild.relationships ??= {};
    guild.proposals ??= [];
    this.#expireProposals(guild);
    const proposal = guild.proposals.find((p) => p.id === proposalId && p.status === "pending");
    if (!proposal) return { error: "not_pending" };
    if (proposal.targetId !== userId) return { error: "not_target" };
    if (accept && (guild.relationships[proposal.proposerId] || guild.relationships[proposal.targetId])) return { error: "already_in_relationship" };
    proposal.status = accept ? "accepted" : "declined";
    proposal.resolvedAt = new Date().toISOString();
    if (accept) {
      const relation = { partnerId: proposal.targetId, type: proposal.type, proposerId: proposal.proposerId, since: proposal.resolvedAt };
      guild.relationships[proposal.proposerId] = relation;
      guild.relationships[proposal.targetId] = { ...relation, partnerId: proposal.proposerId };
    }
    this.#write();
    return structuredClone(proposal);
  }

  endRelationship(guildId, userId, expectedType) {
    const guild = this.#guild(guildId);
    guild.relationships ??= {};
    const relation = guild.relationships[userId];
    if (!relation) return { error: "no_relationship" };
    if (expectedType && relation.type !== expectedType) return { error: "wrong_type" };
    delete guild.relationships[userId];
    delete guild.relationships[relation.partnerId];
    this.#write();
    return structuredClone(relation);
  }

  getRelationship(guildId, userId) {
    const guild = this.data.guilds[guildId];
    const relation = guild?.relationships?.[userId];
    return relation ? structuredClone(relation) : null;
  }

  getRelationshipHistory(guildId, userId) {
    const proposals = this.data.guilds[guildId]?.proposals ?? [];
    return proposals.filter((p) => p.proposerId === userId || p.targetId === userId).map((p) => structuredClone(p));
  }

  #guild(guildId) {
    if (!/^\d{17,20}$/.test(guildId ?? "")) throw new Error("Invalid guild ID.");
    return this.data.guilds[guildId] ??= { users: {}, nsfwAutoAccept: {}, interactionConsents: {}, relationships: {}, proposals: [] };
  }

  #expireProposals(guild) {
    const now = Date.now();
    for (const proposal of guild.proposals ?? []) {
      if (proposal.status === "pending" && proposal.expiresAt <= now) {
        proposal.status = "expired";
        proposal.resolvedAt = new Date(now).toISOString();
      }
    }
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
