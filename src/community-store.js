import fs from "node:fs";
import path from "node:path";

/** Persistent counters for community posts. */
export class CommunityStore {
  constructor(dataDir) {
    this.file = path.join(dataDir, "community-state.json");
    this.data = this.#read();
    this.pollFile = path.join(dataDir, "community-polls.json");
    this.pollData = this.#readPolls();
  }

  nextNumber(key) {
    if (typeof key !== "string" || !/^[a-z0-9:_-]{1,100}$/i.test(key)) {
      throw new Error("Invalid community counter key.");
    }
    const next = (Number.isSafeInteger(this.data[key]) && this.data[key] >= 0 ? this.data[key] : 0) + 1;
    this.data[key] = next;
    const temporary = `${this.file}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(this.data, null, 2), { mode: 0o600 });
    fs.renameSync(temporary, this.file);
    return next;
  }

  createPoll(guildId, messageId, question, options) {
    if (!/^[0-9]{17,20}$/.test(guildId ?? "") || !/^[0-9]{17,20}$/.test(messageId ?? "") ||
        typeof question !== "string" || !question.trim() || !Array.isArray(options) ||
        options.length < 2 || options.length > 4 ||
        options.some((option) => typeof option !== "string" || !option.trim() || option.length > 100)) {
      throw new Error("Invalid poll.");
    }
    const guild = this.pollData.guilds[guildId] ??= {};
    if (guild[messageId]) throw new Error("Poll already exists.");
    guild[messageId] = { question: question.trim(), options: options.map((option) => option.trim()), votes: {} };
    this.#writePolls();
    return this.getPoll(guildId, messageId);
  }

  getPoll(guildId, messageId) {
    const poll = this.pollData.guilds[guildId]?.[messageId];
    return poll ? structuredClone(poll) : null;
  }

  votePoll(guildId, messageId, userId, optionIndex) {
    if (!/^[0-9]{17,20}$/.test(guildId ?? "") || !/^[0-9]{17,20}$/.test(messageId ?? "") ||
        !/^[0-9]{17,20}$/.test(userId ?? "") || !Number.isInteger(optionIndex)) throw new Error("Invalid poll vote.");
    const poll = this.pollData.guilds[guildId]?.[messageId];
    if (!poll || optionIndex < 0 || optionIndex >= poll.options.length) throw new Error("Poll not found.");
    poll.votes[userId] = optionIndex;
    this.#writePolls();
    return this.getPollResults(guildId, messageId);
  }

  getPollResults(guildId, messageId) {
    const poll = this.getPoll(guildId, messageId);
    if (!poll) return null;
    const counts = poll.options.map((_, index) => Object.values(poll.votes).filter((vote) => vote === index).length);
    return { ...poll, counts, totalVotes: Object.keys(poll.votes).length };
  }

  #writePolls() {
    const temporary = this.pollFile + ".tmp";
    fs.writeFileSync(temporary, JSON.stringify(this.pollData, null, 2), { mode: 0o600 });
    fs.chmodSync(temporary, 0o600);
    fs.renameSync(temporary, this.pollFile);
  }

  #readPolls() {
    let raw;
    try { raw = fs.readFileSync(this.pollFile, "utf8"); }
    catch (error) { if (error?.code === "ENOENT") return { version: 1, guilds: {} }; throw error; }
    let parsed;
    try { parsed = JSON.parse(raw); } catch { throw new Error("community-polls.json is invalid JSON; refusing to overwrite it."); }
    if (parsed?.version !== 1 || !parsed.guilds || typeof parsed.guilds !== "object" || Array.isArray(parsed.guilds)) {
      throw new Error("community-polls.json has an invalid structure; refusing to overwrite it.");
    }
    return parsed;
  }

  #read() {
    let raw;
    try {
      raw = fs.readFileSync(this.file, "utf8");
    } catch (error) {
      if (error?.code === "ENOENT") return {};
      throw new Error(`Unable to read community-state.json (${error?.code ?? "unknown"}).`);
    }
    let parsed;
    try { parsed = JSON.parse(raw); } catch {
      throw new Error("community-state.json is invalid JSON; refusing to overwrite it.");
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) ||
        Object.values(parsed).some((value) => !Number.isSafeInteger(value) || value < 0)) {
      throw new Error("community-state.json has an invalid structure; refusing to overwrite it.");
    }
    return parsed;
  }
}
