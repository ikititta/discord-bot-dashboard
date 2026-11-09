import {
  AttachmentBuilder,
  ChannelType,
  Events,
  MessageType,
} from "discord.js";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { registerApplicationCommands } from "./command-registry.js";

const QUOTES_CHANNEL_NAME = "quotes";
const PINK = "#ffd9ff";
const MAX_QUOTE_LENGTH = 900;
const COMMAND = "!quote";

export function wrapQuoteText(ctx, text, maxWidth) {
  const words = String(text ?? "").trim().split(/\s+/u).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else line = candidate;
  }
  if (line) lines.push(line);
  return lines;
}

function averageAvatarColor(image) {
  const sample = createCanvas(32, 32);
  const sampleCtx = sample.getContext("2d");
  sampleCtx.drawImage(image, 0, 0, 32, 32);
  const pixels = sampleCtx.getImageData(0, 0, 32, 32).data;
  let r = 0, g = 0, b = 0, count = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 100) continue;
    r += pixels[i];
    g += pixels[i + 1];
    b += pixels[i + 2];
    count += 1;
  }
  if (!count) return { r: 255, g: 217, b: 255 };
  return { r: Math.round(r / count), g: Math.round(g / count), b: Math.round(b / count) };
}

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

export async function buildQuoteCard({ authorName, avatarUrl, content }) {
  const width = 1400;
  const height = 800;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#17131b";
  ctx.fillRect(0, 0, width, height);

  let avatar;
  let accent = { r: 255, g: 217, b: 255 };
  try {
    avatar = await loadImage(avatarUrl);
    accent = averageAvatarColor(avatar);
  } catch {
    // Keep the card complete if Discord's avatar CDN is unavailable.
  }

  ctx.save();
  ctx.filter = "blur(105px)";
  const glow = ctx.createRadialGradient(1000, 390, 30, 1000, 390, 620);
  glow.addColorStop(0, `rgba(${accent.r}, ${accent.g}, ${accent.b}, 0.62)`);
  glow.addColorStop(0.62, `rgba(${accent.r}, ${accent.g}, ${accent.b}, 0.22)`);
  glow.addColorStop(1, "rgba(23, 19, 27, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(430, -100, 1100, 1000);
  ctx.restore();

  const avatarX = 72, avatarY = 105, avatarW = 500, avatarH = 590;
  ctx.save();
  roundedRect(ctx, avatarX, avatarY, avatarW, avatarH, 42);
  ctx.clip();
  if (avatar) {
    const scale = Math.max(avatarW / avatar.width, avatarH / avatar.height);
    const drawW = avatar.width * scale;
    const drawH = avatar.height * scale;
    ctx.drawImage(avatar, avatarX + (avatarW - drawW) / 2, avatarY + (avatarH - drawH) / 2, drawW, drawH);
  } else {
    ctx.fillStyle = `rgb(${accent.r}, ${accent.g}, ${accent.b})`;
    ctx.fillRect(avatarX, avatarY, avatarW, avatarH);
  }
  ctx.restore();

  ctx.strokeStyle = PINK;
  ctx.lineWidth = 4;
  roundedRect(ctx, avatarX, avatarY, avatarW, avatarH, 42);
  ctx.stroke();

  const luminance = 0.2126 * accent.r + 0.7152 * accent.g + 0.0722 * accent.b;
  const quoteColor = luminance < 145 ? "#ffffff" : "#17131b";
  const rightWidth = 680;

  ctx.textAlign = "right";
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 38px Arial";
  ctx.fillText(String(authorName ?? "Unknown").slice(0, 70), width - 78, 145, rightWidth);

  const quote = `“${String(content ?? "").trim().slice(0, MAX_QUOTE_LENGTH)}”`;
  let fontSize = 48;
  let lines = [];
  do {
    ctx.font = `italic ${fontSize}px Georgia`;
    lines = wrapQuoteText(ctx, quote, rightWidth);
    if (lines.length <= 7 || fontSize <= 30) break;
    fontSize -= 3;
  } while (fontSize > 27);

  const lineHeight = Math.round(fontSize * 1.42);
  const quoteBlockHeight = lines.length * lineHeight;
  const startY = Math.max(270, Math.round(420 - quoteBlockHeight / 2));
  ctx.fillStyle = quoteColor;
  ctx.font = `italic ${fontSize}px Georgia`;
  lines.forEach((line, index) => {
    ctx.fillText(line, width - 78, startY + index * lineHeight, rightWidth);
  });

  ctx.fillStyle = PINK;
  ctx.font = "bold 30px Georgia";
  ctx.fillText("kittisugar ♡", width - 78, 735);
  return canvas.toBuffer("image/png");
}

export async function ensureQuotesChannel(guild) {
  let channel = guild.channels.cache.find(
    (item) => item.type === ChannelType.GuildText && item.name === QUOTES_CHANNEL_NAME,
  );
  if (!channel) {
    channel = await guild.channels.create({
      name: QUOTES_CHANNEL_NAME,
      type: ChannelType.GuildText,
      topic: "Beautiful words worth keeping ♡",
      reason: "Create the Kittisugar quote gallery",
    });
  }
  return channel;
}

export async function createQuoteFromReply(commandMessage) {
  const reference = commandMessage.reference;
  if (commandMessage.type !== MessageType.Reply || !reference?.messageId) {
    throw new Error("Reply to the message you want to quote, then send !quote.");
  }
  const channel = await commandMessage.client.channels.fetch(reference.channelId ?? commandMessage.channelId);
  if (!channel?.isTextBased() || !channel.messages) {
    throw new Error("I can't access the message you're replying to.");
  }
  const original = await channel.messages.fetch(reference.messageId).catch(() => null);
  if (!original) throw new Error("The original message could not be found.");
  if (!original.guild || original.author.bot) {
    throw new Error("You can only quote a message written by a server member.");
  }
  const content = original.content?.trim();
  if (!content) throw new Error("That message has no text to turn into a quote.");

  const image = await buildQuoteCard({
    authorName: original.member?.displayName ?? original.author.globalName ?? original.author.username,
    avatarUrl: original.author.displayAvatarURL({ extension: "png", size: 512 }),
    content,
  });
  const attachment = new AttachmentBuilder(image, { name: "kittisugar-quote.png" });
  const quotesChannel = await ensureQuotesChannel(original.guild);
  await quotesChannel.send({ files: [attachment], allowedMentions: { parse: [] } });
  if (commandMessage.channelId !== quotesChannel.id) {
    await commandMessage.channel.send({
      content: "♡ a quote worth keeping",
      files: [new AttachmentBuilder(image, { name: "kittisugar-quote.png" })],
      allowedMentions: { parse: [] },
    });
  }
  await commandMessage.react("♡").catch(() => {});
}

export function attachQuoteSystem(client, { token, applicationId } = {}) {
  client.once(Events.ClientReady, async () => {
    for (const guild of client.guilds.cache.values()) {
      try {
        await registerApplicationCommands({
          token,
          applicationId,
          guildId: guild.id,
          commands: [],
          removeCommandNames: ["quote", "Quote"],
        });
      } catch (error) {
        console.error(`[quotes] legacy command cleanup failed in ${guild.id}: ${error.message}`);
      }
    }
  });
  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild || message.content.trim().toLowerCase() !== COMMAND) return;
    try {
      await createQuoteFromReply(message);
    } catch (error) {
      const content = error instanceof Error ? error.message : "The quote could not be created.";
      await message.reply({ content, allowedMentions: { repliedUser: false } }).catch(() => {});
    }
  });
}
