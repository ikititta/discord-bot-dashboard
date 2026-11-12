import fs from "node:fs";
import path from "node:path";

const MODEL = "@cf/black-forest-labs/flux-1-schnell";
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

function buildPrompt(pet) {
  const identity = pet.visualIdentity ?? {};
  return [
    "Create a charming full-scene illustration for a kawaii virtual pet game, with the feeling of a collectible digital companion in a pastel fantasy world. This is game character artwork, NOT a sticker, NOT a product cutout, NOT an avatar icon.",
    "Art direction: adorable Japanese kawaii mascot game art, sweet Sanrio-like charm and classic handheld virtual-pet game atmosphere, while keeping the character original. Cute rounded shapes, expressive oversized sparkling eyes, tiny nose and mouth, rosy cheeks, soft pastel palette, simple appealing cartoon anatomy.",
    "The pet must have a complete visible body, a cute pose, and occupy the center of the scene. Keep its design polished, colorful, friendly, and unmistakably illustrated rather than realistic.",
    "BACKGROUND IS REQUIRED AND IMPORTANT: create a beautiful coordinated pastel environment around the pet, like its little home in a virtual pet game. Include a softly detailed room or garden setting, decorative objects, plants or flowers, cushions, toys, gentle depth, and a visible floor or ground beneath the pet. Choose details that suit the species and personality. The background must fill the entire image edge to edge; do not leave it plain white or empty.",
    "NO STICKER LOOK: absolutely no white sticker border, no white halo, no die-cut outline, no thick white rim around the character, no floating isolated cutout, no transparent or blank background, no badge frame, no circular avatar crop.",
    "Use clean confident cartoon linework, soft cel shading, rich but gentle pastel colors, charming little environmental details, warm cozy lighting, and a cohesive game-art composition. Avoid photorealism, semi-realistic animal portraits, realistic fur, painterly realism, and 3D rendering.",
    `Species: ${String(pet.species ?? "fantasy animal").slice(0, 40)}.`,
    `Breed or variety: ${String(identity.breed ?? "not specified").slice(0, 40)}.`,
    `Main palette: ${String(identity.palette ?? "pastel").slice(0, 40)}.`,
    `CUSTOM PHYSICAL DESCRIPTION — reproduce every requested detail: ${String(identity.appearance ?? "no extra custom physical details").slice(0, 180)}.`,
    `Eye details: ${String(identity.eyes ?? "large sparkling cartoon eyes").slice(0, 60)}.`,
    `Markings: ${String(identity.markings ?? "soft rosy cheeks").slice(0, 80)}.`,
    `Accessories: ${String(identity.accessory ?? "none").slice(0, 60)}.`,
    `Personality: ${String(identity.personality ?? "sweet").slice(0, 40)}.`,
    `Current outfit: ${String(pet.outfit ?? "default").slice(0, 40)}.`,
    "User-provided physical details and accessories always override defaults. Never omit, replace, hide or contradict a requested ribbon, bow, color, marking, hairstyle or body feature. If a pink ribbon is requested, clearly draw a visible pink ribbon on the pet.",
    "Preserve this individual pet's identity across redraws. No text, no letters, no watermark, no collage, no extra pets.",
  ].join(" ").slice(0, 3500);
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
