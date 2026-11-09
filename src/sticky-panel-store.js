import fs from "node:fs";
import path from "node:path";

const KEY_PATTERN = /^[a-z0-9:_-]{1,100}$/i;
const SNOWFLAKE_PATTERN = /^\d{5,25}$/;

/** Persistent Discord message IDs for Sugar's sticky primary panels. */
export class StickyPanelStore {
  constructor(dataDir) {
    this.file = path.join(dataDir, "sticky-panels.json");
    this.data = this.#read();
  }

  get(key) {
    validateKey(key);
    return this.data.panels[key] ?? null;
  }

  set(key, messageId) {
    validateKey(key);
    if (messageId !== null && (typeof messageId !== "string" || !SNOWFLAKE_PATTERN.test(messageId))) {
      throw new Error("A valid Discord message ID or null is required.");
    }
    const panels = { ...this.data.panels };
    if (messageId === null) delete panels[key];
    else panels[key] = messageId;
    this.#write({ version: 1, panels });
    return messageId;
  }

  #read() {
    let raw;
    try {
      raw = fs.readFileSync(this.file, "utf8");
    } catch (error) {
      if (error?.code === "ENOENT") return { version: 1, panels: {} };
      throw new Error(`Unable to read sticky-panels.json (${error?.code ?? "unknown"}).`);
    }
    let parsed;
    try { parsed = JSON.parse(raw); } catch {
      throw new Error("sticky-panels.json is invalid JSON; refusing to overwrite it.");
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) ||
        parsed.version !== 1 || !parsed.panels || typeof parsed.panels !== "object" ||
        Array.isArray(parsed.panels) ||
        Object.entries(parsed.panels).some(([key, id]) =>
          !KEY_PATTERN.test(key) || typeof id !== "string" || !SNOWFLAKE_PATTERN.test(id))) {
      throw new Error("sticky-panels.json has an invalid structure; refusing to overwrite it.");
    }
    return parsed;
  }

  #write(next) {
    const temporary = `${this.file}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(next, null, 2), { mode: 0o600 });
    fs.renameSync(temporary, this.file);
    this.data = next;
  }
}

function validateKey(key) {
  if (typeof key !== "string" || !KEY_PATTERN.test(key)) {
    throw new Error("Invalid sticky panel key.");
  }
}
