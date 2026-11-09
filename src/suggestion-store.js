import fs from "node:fs";
import path from "node:path";

/** Persistent one-vote-per-member records for Suggestences posts. */
export class SuggestionStore {
  constructor(dataDir) {
    this.file = path.join(dataDir, "suggestion-votes.json");
    this.data = this.#read();
  }

  vote(messageId, userId, direction) {
    if (!/^\\d{17,20}$/.test(messageId ?? "") ||
        !/^\\d{17,20}$/.test(userId ?? "") ||
        !["up", "down"].includes(direction)) {
      throw new Error("Invalid suggestion vote.");
    }
    const votes = this.data[messageId] ?? {};
    if (votes[userId] === direction) delete votes[userId];
    else votes[userId] = direction;
    if (Object.keys(votes).length) this.data[messageId] = votes;
    else delete this.data[messageId];
    this.#write();
    return this.counts(messageId);
  }

  counts(messageId) {
    const votes = this.data[messageId] ?? {};
    return {
      up: Object.values(votes).filter((vote) => vote === "up").length,
      down: Object.values(votes).filter((vote) => vote === "down").length,
    };
  }

  #write() {
    const temporary = `${this.file}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(this.data, null, 2), { mode: 0o600 });
    fs.renameSync(temporary, this.file);
  }

  #read() {
    let raw;
    try {
      raw = fs.readFileSync(this.file, "utf8");
    } catch (error) {
      if (error?.code === "ENOENT") return {};
      throw new Error(`Unable to read suggestion-votes.json (${error?.code ?? "unknown"}).`);
    }
    let parsed;
    try { parsed = JSON.parse(raw); } catch {
      throw new Error("suggestion-votes.json is invalid JSON; refusing to overwrite it.");
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) ||
        Object.entries(parsed).some(([messageId, votes]) =>
          !/^\\d{17,20}$/.test(messageId) || !votes || typeof votes !== "object" ||
          Array.isArray(votes) || Object.entries(votes).some(([userId, vote]) =>
            !/^\\d{17,20}$/.test(userId) || !["up", "down"].includes(vote)))) {
      throw new Error("suggestion-votes.json has an invalid structure; refusing to overwrite it.");
    }
    return parsed;
  }
}
