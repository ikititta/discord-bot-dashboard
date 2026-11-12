import fs from "node:fs";
import path from "node:path";

const MODEL = "@cf/black-forest-labs/flux-1-schnell";
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

function buildPrompt(pet) {
  const identity = pet.visualIdentity ?? {};
  return [
    "Draw a cute 2D kawaii chibi mascot sticker, like a simple Japanese character sticker or cute stationery illustration. The result must be obviously cartoon art, not an animal portrait.",
    "Use an extreme cute mascot proportion: very large round head (about 65 percent of character height), tiny rounded body, tiny short limbs, simplified plush-like paws, huge shiny circular cartoon eyes, tiny simple mouth, rosy circular blush cheeks.",
    "Use thick clean dark-brown or black outer line art, smooth closed shapes, flat pastel colors, minimal cel shading, simple highlights, crisp graphic edges, adorable playful expression.",
    "ABSOLUTE STYLE RULE: flat 2D kawaii sticker illustration only. No realism, no semi-realism, no painterly rendering, no 3D, no realistic fur, no detailed animal anatomy, no soft airbrush portrait, no cinematic lighting, no thin sketch outlines. Keep it bold, simple, graphic and irresistibly cute.",
    `Species: ${String(pet.species ?? "fantasy animal").slice(0, 40)}.`,
    `Breed or variety: ${String(identity.breed ?? "not specified").slice(0, 40)}.`,
    `Main palette: ${String(identity.palette ?? "pastel").slice(0, 40)}.`,
    `CUSTOM PHYSICAL DESCRIPTION — highest priority; reproduce every detail exactly: ${String(identity.appearance ?? "no extra custom physical details").slice(0, 180)}.`,
    `Eye style only if not specified in the custom description: ${String(identity.eyes ?? "large glossy cartoon eyes").slice(0, 60)}.`,
    `Extra markings only if not specified in the custom description: ${String(identity.markings ?? "soft rosy cheeks").slice(0, 80)}.`,
    `Extra accessory only if not specified in the custom description: ${String(identity.accessory ?? "none").slice(0, 60)}. The custom physical description overrides this default if they conflict.`,
    `Personality: ${String(identity.personality ?? "sweet").slice(0, 40)}.`,
    `Current outfit: ${String(pet.outfit ?? "default").slice(0, 40)}.`,
    "The custom physical description is more important than randomized defaults. Never omit, replace, hide or contradict a user-requested accessory, ribbon, bow, color, marking, hairstyle or body feature.",
    "Keep the whole character visible, simple and readable at small Discord avatar size, on a plain white background. No text, no letters, no watermark, no border, no collage, no extra characters.",
    "Preserve the same individual character identity in every redraw. Reproduce all user-provided physical details exactly.",
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
