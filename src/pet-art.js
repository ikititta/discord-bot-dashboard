import fs from "node:fs";
import path from "node:path";

const API_URL = "https://api.openai.com/v1/images/generations";
const MODEL = "gpt-image-2";
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

function buildPrompt(pet) {
  const identity = pet.visualIdentity ?? {};
  return [
    "Create one original, polished 2D kawaii virtual-pet character illustration, centered and fully visible.",
    `Species: ${String(pet.species ?? "fantasy animal").slice(0, 40)}.`,
    `Breed or variety: ${String(identity.breed ?? "not specified").slice(0, 40)}.`,
    `Main palette: ${String(identity.palette ?? "pastel").slice(0, 40)}.`,
    `Physical appearance: ${String(identity.appearance ?? "cute natural features").slice(0, 60)}.`,
    `Eyes: ${String(identity.eyes ?? "large expressive eyes").slice(0, 60)}.`,
    `Distinctive markings: ${String(identity.markings ?? "subtle cute markings").slice(0, 80)}.`,
    `Accessory: ${String(identity.accessory ?? "none").slice(0, 60)}.`,
    `Personality: ${String(identity.personality ?? "sweet").slice(0, 40)}.`,
    `Current outfit: ${String(pet.outfit ?? "default").slice(0, 40)}.`,
    "Soft pastel storybook art, crisp clean silhouette, delicate details, charming expressive face, subtle soft shadow.",
    "Plain transparent background, no text, no letters, no watermark, no border, no collage, no extra characters.",
    "This is a unique recurring character design. Preserve all listed traits exactly.",
  ].join(" ");
}

export async function generatePetArtwork({ pet, dataDir, apiKey = process.env.OPENAI_API_KEY, fetchImpl = fetch } = {}) {
  const key = String(apiKey ?? "").trim();
  if (!key) throw new Error("OPENAI_API_KEY is not configured.");
  if (!pet?.id || !pet?.visualIdentity || !dataDir) throw new Error("Pet identity or persistent storage is missing.");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);
  timer.unref?.();
  try {
    const response = await fetchImpl(API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        prompt: buildPrompt(pet),
        size: "1024x1024",
        quality: "medium",
        output_format: "png",
        n: 1,
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      let details = "";
      try {
        const errorPayload = await response.json();
        const providerError = errorPayload?.error ?? errorPayload;
        const code = typeof providerError?.code === "string" ? providerError.code : "";
        const type = typeof providerError?.type === "string" ? providerError.type : "";
        const message = typeof providerError?.message === "string" ? providerError.message : "";
        details = [code && `code=${code}`, type && `type=${type}`, message && message.slice(0, 500)]
          .filter(Boolean).join("; ");
      } catch {
        // Keep the HTTP status useful even if the provider response is not JSON.
      }
      const retryAfter = response.headers?.get?.("retry-after");
      throw new Error(`Pet artwork provider returned HTTP ${response.status}.${details ? " " + details : ""}${retryAfter ? " Retry-After=" + retryAfter + "s." : ""}`);
    }
    const payload = await response.json();
    const encoded = payload?.data?.[0]?.b64_json;
    if (typeof encoded !== "string" || !encoded) throw new Error("Pet artwork provider returned no image.");
    const bytes = Buffer.from(encoded, "base64");
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new Error("Generated pet artwork has an invalid size.");
    const directory = path.join(dataDir, "pet-art");
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    const filename = `${pet.id.replace(/[^a-z0-9-]/gi, "")}.png`;
    const destination = path.join(directory, filename);
    const temporary = destination + ".tmp";
    fs.writeFileSync(temporary, bytes, { mode: 0o600, flag: "w" });
    fs.renameSync(temporary, destination);
    return destination;
  } finally {
    clearTimeout(timer);
  }
}
