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
const MAX_PENDING_REFERENCES = 200;
const REFERENCE_TTL_MS = 2 * 60 * 1000;
const COMMANDS = [{
  name: "quote",
  description: "Create a quote card from the message you're replying to",
}];

const pendingReferences = new Map();

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
    // The card remains readable if Discord's avatar CDN is unavailable.
  }

  // A soft, blurred wash sampled from the avatar fills the background.
  ctx.save();
  ctx.filter = "blur(105px)";
  const glow = ctx.createRadialGradient(1000, 390, 30, 1000, 390, 620);
  glow.addColorStop(0, `rgba(${accent.r}, ${accent.g}, ${accent.b}, 0.62)`);
  glow.addColorStop(0.62, `rgba(${accent.r}, ${accent.g}, ${accent.b}, 0.22)`);
  glow.addColorStop(1, "rgba(23, 19, 27, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(430, -100, 1100, 1000);
  ctx.restore();

  // Keep the left portrait large and dominant.
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

  // Thin pink frame, matching the Kittisugar identity.
  ctx.strokeStyle = PINK;
  ctx.lineWidth = 4;
  roundedRect(ctx, avatarX, avatarY, avatarW, avatarH, 42);
  ctx.stroke();

  const luminance = 0.2126 * accent.r + 0.7152 * accent.g + 0.0722 * accent.b;
  const quoteColor = luminance < 145 ? "#ffffff" : "#17131b";
  const rightLeft = 650;
  const rightWidth = 680;

  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
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

function rememberReplyReference(message, now = Date.now()) {
  if (message.type !== MessageType.ChatInputCommand) return;
  const interactionId = message.interactionMetadata?.id ?? message.interaction?.id;
  const messageId = message.reference?.messageId;
  if (!interactionId || !messageId) return;

  for (const [id, entry] of pendingReferences) {
    if (now - entry.createdAt > REFERENCE_TTL_MS) pendingReferences.delete(id);
  }
  pendingReferences.set(interactionId, {
    channelId: message.reference.channelId ?? message.channelId,
    messageId,
    guildId: message.reference.guildId ?? message.guildId,
    createdAt: now,
  });
  while (pendingReferences.size > MAX_PENDING_REFERENCES) {
    pendingReferences.delete(pendingReferences.keys().next().value);
  }
}

async function resolveRepliedMessage(interaction) {
  const directReference = interaction.message?.reference ?? interaction.messageReference;
  const cached = pendingReferences.get(interaction.id);
  pendingReferences.delete(interaction.id);
  const reference = directReference?.messageId
    ? {
        channelId: directReference.channelId ?? interaction.channelId,
        messageId: directReference.messageId,
        guildId: directReference.guildId ?? interaction.guildId,
      }
    : cached;

  if (!reference?.messageId || reference.guildId !== interaction.guildId) {
    throw new Error("You must use /quote while replying to the message you want to quote.");
  }
  const channel = await interaction.client.channels.fetch(reference.channelId);
  if (!channel?.isTextBased() || !channel.messages) {
    throw new Error("I can't access the message you're replying to.");
  }
  const message = await channel.messages.fetch(reference.messageId).catch(() => null);
  if (!message) throw new Error("The message you're replying to could not be found.");
  return message;
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

async function createQuote(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const message = await resolveRepliedMessage(interaction);
  if (!message.guild || message.author.bot) {
    throw new Error("You can only quote a message written by a server member.");
  }
  const content = message.content?.trim();
  if (!content) throw new Error("That message has no text to turn into a quote.");

  const image = await buildQuoteCard({
    authorName: message.member?.displayName ?? message.author.globalName ?? message.author.username,
    avatarUrl: message.author.displayAvatarURL({ extension: "png", size: 512 }),
    content,
  });
  const quotesChannel = await ensureQuotesChannel(message.guild);
  await quotesChannel.send({
    files: [new AttachmentBuilder(image, { name: "kittisugar-quote.png" })],
    allowedMentions: { parse: [] },
  });
  if (message.channelId !== quotesChannel.id) {
    await message.channel.send({
      content: "♡ a quote worth keeping",
      files: [new AttachmentBuilder(image, { name: "kittisugar-quote.png" })],
      allowedMentions: { parse: [] },
    });
  }
  await interaction.editReply({ content: `Your quote has been created in <#${quotesChannel.id}> ♡` });
}

export function attachQuoteSystem(client, { token, applicationId }) {
  client.on(Events.MessageCreate, (message) => rememberReplyReference(message));
  client.once(Events.ClientReady, async () => {
    for (const guild of client.guilds.cache.values()) {
      try {
        await registerApplicationCommands({
          token,
          applicationId,
          guildId: guild.id,
          commands: COMMANDS,
          removeCommandNames: ["Quote"],
        });
      } catch (error) {
        console.error(`[quotes] command registration failed in ${guild.id}: ${error.message}`);
      }
    }
  });
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand() || interaction.commandName !== "quote" || !interaction.inGuild()) return;
    try {
      await createQuote(interaction);
    } catch (error) {
      const message = error instanceof Error ? error.message : "The quote could not be created.";
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: message }).catch(() => {});
      } else {
        await interaction.reply({ content: message, ephemeral: true }).catch(() => {});
      }
    }
  });
}
