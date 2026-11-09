import fs from "node:fs";
import path from "node:path";

/** Persistent counters for community posts. */
export class CommunityStore {
  constructor(dataDir) {
    this.file = path.join(dataDir, "community-state.json");
    this.data = this.#read();
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
