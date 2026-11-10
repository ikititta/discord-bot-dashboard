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

function mixColor(color, target, amount) {
  return {
    r: Math.round(color.r + (target.r - color.r) * amount),
    g: Math.round(color.g + (target.g - color.g) * amount),
    b: Math.round(color.b + (target.b - color.b) * amount),
  };
}

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

export async function buildQuoteCard({ authorName, displayNameValue, avatarUrl, content, mediaUrl }) {
  const width = 1400;
  const height = 800;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  let avatar;
  let media;
  if (mediaUrl) {
    try { media = await loadImage(mediaUrl); } catch {
      // The text or avatar can still be quoted if the attached image is unavailable.
    }
  }
  let palette = { average: { r: 255, g: 217, b: 255, luminance: 222 }, darkest: { r: 80, g: 65, b: 80 }, lightest: { r: 255, g: 217, b: 255, luminance: 222 } };
  try {
    avatar = await loadImage(avatarUrl);
    palette = getAvatarPalette(avatar);
  } catch {
    // Keep the card complete if Discord's avatar CDN is unavailable.
  }

  const isLightPhoto = palette.average.luminance >= 145;
  const backgroundColor = isLightPhoto
    ? mixColor(palette.lightest, { r: 255, g: 255, b: 255 }, 0.2)
    : mixColor(palette.darkest, { r: 0, g: 0, b: 0 }, 0.24);
  const textColor = isLightPhoto
    ? mixColor(palette.darkest, { r: 0, g: 0, b: 0 }, 0.24)
    : mixColor(palette.lightest, { r: 255, g: 255, b: 255 }, 0.2);
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
  const displayName = String(displayNameValue ?? authorName ?? "Unknown").trim().slice(0, 70);
  const username = String(authorName ?? "Unknown").trim().slice(0, 70);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = rgb(textColor);
  ctx.font = "700 40px Arial";
  ctx.fillText(displayName, rightX + rightWidth / 2, 112, textWidth);
  ctx.font = "500 23px Arial";
  ctx.fillText(`@${username}`, rightX + rightWidth / 2, 151, textWidth);

  const quoteText = String(content ?? "").trim().slice(0, MAX_QUOTE_LENGTH);
  if (media) {
    // Keep the quoted image visible while preserving any accompanying message text.
    if (quoteText) {
      let fontSize = 43;
      let lines = [];
      do {
        ctx.font = `italic 700 ${fontSize}px Georgia`;
        lines = wrapQuoteText(ctx, `“${quoteText}”`, textWidth);
        if (lines.length <= 3 || fontSize <= 30) break;
        fontSize -= 2;
      } while (fontSize > 28);
      ctx.font = `italic 700 ${fontSize}px Georgia`;
      ctx.fillStyle = rgb(textColor);
      const lineHeight = Math.round(fontSize * 1.2);
      const startY = 205 + fontSize;
      lines.forEach((line, index) => {
        ctx.fillText(line, rightX + rightWidth / 2, startY + index * lineHeight, textWidth);
      });
    }

    const maxImageWidth = textWidth;
    const maxImageHeight = quoteText ? 310 : 470;
    const scale = Math.min(maxImageWidth / media.width, maxImageHeight / media.height);
    const imageWidth = media.width * scale;
    const imageHeight = media.height * scale;
    const imageX = rightX + (rightWidth - imageWidth) / 2;
    const imageY = quoteText ? 330 + (maxImageHeight - imageHeight) / 2 : 205 + (maxImageHeight - imageHeight) / 2;
    ctx.save();
    roundedRect(ctx, imageX, imageY, imageWidth, imageHeight, 18);
    ctx.clip();
    ctx.drawImage(media, imageX, imageY, imageWidth, imageHeight);
    ctx.restore();
  } else if (quoteText) {
    const quote = `“${quoteText}”`;
    let fontSize = 76;
    let lines = [];
    do {
      ctx.font = `italic 700 ${fontSize}px Georgia`;
      lines = wrapQuoteText(ctx, quote, textWidth);
      if (lines.length <= 7 || fontSize <= 40) break;
      fontSize -= 3;
    } while (fontSize > 37);

    const lineHeight = Math.round(fontSize * 1.32);
    const quoteBlockHeight = lines.length * lineHeight;
    const quoteAreaTop = 185;
    const quoteAreaBottom = 665;
    const quoteAreaHeight = quoteAreaBottom - quoteAreaTop;
    const startY = quoteAreaTop + Math.max(fontSize, (quoteAreaHeight - quoteBlockHeight) / 2 + fontSize * 0.78);

    ctx.fillStyle = rgb(textColor);
    ctx.font = `italic 700 ${fontSize}px Georgia`;
    lines.forEach((line, index) => {
      ctx.fillText(line, rightX + rightWidth / 2, startY + index * lineHeight, textWidth);
    });
  }

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

async function copySourceReactions(sourceMessage, quoteMessage) {
  const reactions = [...(sourceMessage.reactions?.cache?.values?.() ?? [])];
  for (const reaction of reactions) {
    const emoji = reaction.emoji?.id
      ? `${reaction.emoji.name}:${reaction.emoji.id}`
      : reaction.emoji?.name;
    if (!emoji) continue;
    await quoteMessage.react(emoji).catch((error) => {
      console.warn(`[quotes] could not copy reaction ${emoji}: ${error.message}`);
    });
  }
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
  if (!original.guild) {
    throw new Error("You can only quote messages from this server.");
  }
  const content = original.content?.trim() ?? "";
  const imageAttachment = [...(original.attachments?.values?.() ?? [])]
    .find((attachment) => attachment.contentType?.startsWith("image/") || /\.(?:png|jpe?g|gif|webp|avif)(?:\?.*)?$/i.test(attachment.url ?? ""));
  const embeddedImage = original.embeds?.find((embed) => embed.image?.url)?.image?.url;
  const mediaUrl = imageAttachment?.url ?? embeddedImage;
  if (!content && !mediaUrl) {
    throw new Error("That message has no text or image to turn into a quote.");
  }

  const image = await buildQuoteCard({
    authorName: original.author.username,
    displayNameValue: original.member?.displayName ?? original.author.globalName ?? original.author.username,
    avatarUrl: original.author.displayAvatarURL({ extension: "png", size: 512 }),
    content,
    mediaUrl,
  });
  const attachment = new AttachmentBuilder(image, { name: "kittisugar-quote.png" });
  const quotesChannel = await ensureQuotesChannel(original.guild);
  const mention = `<@${original.author.id}>`;
  const publishedQuote = await quotesChannel.send({
    content: mention,
    files: [attachment],
    allowedMentions: { parse: [], users: [original.author.id] },
  });
  await copySourceReactions(original, publishedQuote);
  if (commandMessage.channelId !== quotesChannel.id) {
    const channelQuote = await commandMessage.channel.send({
      content: `♡ a quote worth keeping · ${mention}`,
      files: [new AttachmentBuilder(image, { name: "kittisugar-quote.png" })],
      allowedMentions: { parse: [], users: [original.author.id] },
    });
    await copySourceReactions(original, channelQuote);
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
