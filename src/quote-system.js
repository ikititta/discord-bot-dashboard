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

function getAvatarPalette(image) {
  const sample = createCanvas(48, 48);
  const sampleCtx = sample.getContext("2d");
  sampleCtx.drawImage(image, 0, 0, 48, 48);
  const pixels = sampleCtx.getImageData(0, 0, 48, 48).data;
  const colors = [];
  let r = 0, g = 0, b = 0, count = 0;

  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 100) continue;
    const color = { r: pixels[i], g: pixels[i + 1], b: pixels[i + 2] };
    color.luminance = 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
    colors.push(color);
    r += color.r;
    g += color.g;
    b += color.b;
    count += 1;
  }

  if (!count) {
    const fallback = { r: 255, g: 217, b: 255, luminance: 222 };
    return { average: fallback, darkest: { r: 80, g: 65, b: 80 }, lightest: fallback };
  }

  colors.sort((first, second) => first.luminance - second.luminance);
  const average = {
    r: Math.round(r / count),
    g: Math.round(g / count),
    b: Math.round(b / count),
  };
  average.luminance = 0.2126 * average.r + 0.7152 * average.g + 0.0722 * average.b;

  // Use robust percentile samples so one isolated pixel does not dictate the palette.
  const darkest = colors[Math.floor((colors.length - 1) * 0.08)];
  const lightest = colors[Math.floor((colors.length - 1) * 0.92)];
  return { average, darkest, lightest };
}

function rgb(color) {
  return `rgb(${color.r}, ${color.g}, ${color.b})`;
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

  let avatar;
  let palette = { average: { r: 255, g: 217, b: 255, luminance: 222 }, darkest: { r: 80, g: 65, b: 80 }, lightest: { r: 255, g: 217, b: 255, luminance: 222 } };
  try {
    avatar = await loadImage(avatarUrl);
    palette = getAvatarPalette(avatar);
  } catch {
    // Keep the card complete if Discord's avatar CDN is unavailable.
  }

  const isLightPhoto = palette.average.luminance >= 145;
  const backgroundColor = isLightPhoto ? palette.lightest : palette.darkest;
  const textColor = isLightPhoto ? palette.darkest : palette.lightest;
  const middleColor = palette.average;
  const leftWidth = Math.round(width * 0.48);
  const rightX = leftWidth;
  const rightWidth = width - rightX;

  // The member's avatar fills the entire left side, edge to edge.
  if (avatar) {
    const scale = Math.max(leftWidth / avatar.width, height / avatar.height);
    const drawW = avatar.width * scale;
    const drawH = avatar.height * scale;
    ctx.drawImage(avatar, (leftWidth - drawW) / 2, (height - drawH) / 2, drawW, drawH);
  } else {
    ctx.fillStyle = rgb(backgroundColor);
    ctx.fillRect(0, 0, leftWidth, height);
  }

  // A three-stop gradient brings the photo's own palette softly through the center.
  const gradient = ctx.createLinearGradient(rightX, 0, width, height);
  gradient.addColorStop(0, rgb(backgroundColor));
  gradient.addColorStop(0.52, rgb(middleColor));
  gradient.addColorStop(1, rgb(backgroundColor));
  ctx.fillStyle = gradient;
  ctx.fillRect(rightX, 0, rightWidth, height);

  const panelPadding = 70;
  const textWidth = rightWidth - panelPadding * 2;
  const username = String(authorName ?? "Unknown").trim().slice(0, 70);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = rgb(textColor);
  ctx.font = "600 30px Arial";
  ctx.fillText(username, rightX + rightWidth / 2, 125, textWidth);

  const quote = `“${String(content ?? "").trim().slice(0, MAX_QUOTE_LENGTH)}”`;
  let fontSize = 58;
  let lines = [];
  do {
    ctx.font = `italic 600 ${fontSize}px Georgia`;
    lines = wrapQuoteText(ctx, quote, textWidth);
    if (lines.length <= 8 || fontSize <= 34) break;
    fontSize -= 3;
  } while (fontSize > 31);

  const lineHeight = Math.round(fontSize * 1.38);
  const quoteBlockHeight = lines.length * lineHeight;
  const quoteAreaTop = 175;
  const quoteAreaBottom = 650;
  const quoteAreaHeight = quoteAreaBottom - quoteAreaTop;
  const startY = quoteAreaTop + Math.max(fontSize, (quoteAreaHeight - quoteBlockHeight) / 2 + fontSize * 0.78);

  ctx.fillStyle = rgb(textColor);
  ctx.font = `italic 600 ${fontSize}px Georgia`;
  lines.forEach((line, index) => {
    ctx.fillText(line, rightX + rightWidth / 2, startY + index * lineHeight, textWidth);
  });

  ctx.fillStyle = rgb(textColor);
  ctx.font = "500 28px Arial";
  ctx.fillText("kittisugar", rightX + rightWidth / 2, 748);
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
    authorName: original.author.username,
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
    if (message.author.bot || !message.guild) return;

    const commandText = String(message.content ?? "").trim();
    if (!/^!quote(?:\\s|$)/i.test(commandText)) return;

    console.info(
      `[quotes] command received guild=${message.guild.id} channel=${message.channelId} message=${message.id} type=${message.type} hasReference=${Boolean(message.reference?.messageId)}`,
    );

    try {
      await createQuoteFromReply(message);
      console.info(`[quotes] quote published guild=${message.guild.id} sourceMessage=${message.reference?.messageId ?? "unknown"}`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.error(
        `[quotes] command failed guild=${message.guild.id} channel=${message.channelId} code=${error?.code ?? "unknown"}: ${detail}`,
      );
      await message.reply({
        content: detail || "The quote could not be created.",
        allowedMentions: { repliedUser: false },
      }).catch((replyError) => {
        console.error(`[quotes] could not send command error reply: ${replyError?.message ?? replyError}`);
      });
    }
  });
}
