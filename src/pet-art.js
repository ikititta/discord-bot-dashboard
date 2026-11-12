import fs from "node:fs";
import path from "node:path";

const MODEL = "@cf/black-forest-labs/flux-1-schnell";
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

function buildPrompt(pet) {
  const identity = pet.visualIdentity ?? {};
  return [
    "Create one original 2D super-deformed chibi mascot illustration in an unmistakably cute kawaii sticker / character-design style, centered and fully visible.",
    "Match the visual language of popular Japanese kawaii mascot stickers: enormous rounded head, tiny compact body, short stubby paws or limbs, simplified rounded anatomy, oversized expressive glossy eyes, tiny nose and mouth, soft blush cheeks, adorable friendly expression.",
    "Use clean bold smooth dark outlines, simple flat pastel fills, crisp cel shading with only a few soft highlights, high contrast readable shapes, polished vector-like cartoon finish.",
    "This must look like a cute illustrated mascot or plushie character design, NOT realistic animal concept art, NOT semi-realistic, NOT painterly, NOT 3D, NOT photorealistic. Avoid realistic fur strands, realistic anatomy, realistic lighting, gradients that make it look lifelike, and delicate thin sketch lines.",
    `Species: ${String(pet.species ?? "fantasy animal").slice(0, 40)}.`,
    `Breed or variety: ${String(identity.breed ?? "not specified").slice(0, 40)}.`,
    `Main palette: ${String(identity.palette ?? "pastel").slice(0, 40)}.`,
    `Physical appearance (follow these details literally): ${String(identity.appearance ?? "simple rounded kawaii features").slice(0, 180)}.`,
    `Eyes: ${String(identity.eyes ?? "large expressive eyes").slice(0, 60)}.`,
    `Distinctive markings: ${String(identity.markings ?? "subtle cute markings").slice(0, 80)}.`,
    `Accessory: ${String(identity.accessory ?? "none").slice(0, 60)}.`,
    `Personality: ${String(identity.personality ?? "sweet").slice(0, 40)}.`,
    `Current outfit: ${String(pet.outfit ?? "default").slice(0, 40)}.`,
    "Keep the character design simple, bold, cute and instantly readable at small Discord avatar size. Use a plain white or very pale pastel background, no text, no letters, no watermark, no border, no collage, no extra characters.",
    "This is a unique recurring character design. Preserve all listed traits exactly.",
  ].join(" ").slice(0, 2048);
}

export async function generatePetArtwork({
  pet,
  dataDir,
  accountId = process.env.CLOUDFLARE_ACCOUNT_ID,
  apiToken = process.env.CLOUDFLARE_API_TOKEN,
  fetchImpl = fetch,
} = {}) {
  const account = String(accountId ?? "").trim();
  const token = String(apiToken ?? "").trim();
  if (!account || !token) throw new Error("CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN is not configured.");
  if (!pet?.id || !pet?.visualIdentity || !dataDir) throw new Error("Pet identity or persistent storage is missing.");

  const apiUrl = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}/ai/run/${MODEL}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);
  timer.unref?.();
  try {
    const response = await fetchImpl(apiUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: buildPrompt(pet), steps: 4 }),
      signal: controller.signal,
    });
    if (!response.ok) {
      let details = "";
      try {
        const errorPayload = await response.json();
        const errors = Array.isArray(errorPayload?.errors) ? errorPayload.errors : [];
        details = errors.map((item) => [item?.code, item?.message].filter(Boolean).join(": "))
          .filter(Boolean).join("; ").slice(0, 500);
      } catch {
        // Keep the HTTP status useful even if the provider response is not JSON.
      }
      const retryAfter = response.headers?.get?.("retry-after");
      throw new Error(`Cloudflare Workers AI returned HTTP ${response.status}.${details ? " " + details : ""}${retryAfter ? " Retry-After=" + retryAfter + "s." : ""}`);
    }
    const payload = await response.json();
    const encoded = payload?.result?.image;
    if (payload?.success === false || typeof encoded !== "string" || !encoded) {
      const errors = Array.isArray(payload?.errors) ? payload.errors.map((item) => item?.message).filter(Boolean).join("; ") : "";
      throw new Error("Cloudflare Workers AI returned no image." + (errors ? " " + errors.slice(0, 500) : ""));
    }
    const bytes = Buffer.from(encoded, "base64");
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new Error("Generated pet artwork has an invalid size.");
    const isPng = bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    if (!isPng && !isJpeg) throw new Error("Cloudflare Workers AI returned an unsupported image format.");
    const directory = path.join(dataDir, "pet-art");
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    const safeId = pet.id.replace(/[^a-z0-9-]/gi, "");
    if (!safeId) throw new Error("Pet ID is invalid.");
    const destination = path.join(directory, `${safeId}.${isPng ? "png" : "jpg"}`);
    const temporary = destination + ".tmp";
    fs.writeFileSync(temporary, bytes, { mode: 0o600, flag: "w" });
    fs.renameSync(temporary, destination);
    return destination;
  } finally {
    clearTimeout(timer);
  }
}
