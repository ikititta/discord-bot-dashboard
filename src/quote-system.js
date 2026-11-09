import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  AttachmentBuilder,
  ChannelType,
  Events,
} from "discord.js";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { registerApplicationCommands } from "./command-registry.js";

const QUOTES_CHANNEL_NAME = "quotes";
const PINK = "#ffd9ef";
const MAX_QUOTE_LENGTH = 900;
const COMMANDS = [
  { name: "Quote", type: ApplicationCommandType.Message },
  {
    name: "quote",
    description: "Create a quote card from a message link",
    options: [{
      name: "message",
      description: "Message link to turn into a quote",
      type: ApplicationCommandOptionType.String,
      required: true,
    }],
  },
];

export function extractMessageReference(value) {
  const match = String(value ?? "").match(/discord(?:app)?\.com\/channels\/(\d+)\/(\d+)\/(\d+)/u);
  return match ? { guildId: match[1], channelId: match[2], messageId: match[3] } : null;
}

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

export async function buildQuoteCard({ authorName, authorTag, avatarUrl, content }) {
  const width = 1200, height = 675;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  const base = ctx.createLinearGradient(0, 0, width, height);
  base.addColorStop(0, "#17121c");
  base.addColorStop(1, "#302033");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  try {
    const avatar = await loadImage(avatarUrl);
    const sample = createCanvas(24, 24);
    const sampleCtx = sample.getContext("2d");
    sampleCtx.drawImage(avatar, 0, 0, 24, 24);
    const pixels = sampleCtx.getImageData(0, 0, 24, 24).data;
    let r = 0, g = 0, b = 0, count = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3] < 100) continue;
      r += pixels[i]; g += pixels[i + 1]; b += pixels[i + 2]; count++;
    }
    if (count) {
      const color = `rgba(${Math.round(r/count)},${Math.round(g/count)},${Math.round(b/count)},0.38)`;
      const glow = ctx.createRadialGradient(width/2, height/2, 20, width/2, height/2, 620);
      glow.addColorStop(0, color);
      glow.addColorStop(1, "rgba(23,18,28,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.save();
    ctx.beginPath();
    ctx.arc(width/2, 145, 76, 0, Math.PI*2);
    ctx.clip();
    ctx.drawImage(avatar, width/2-76, 69, 152, 152);
    ctx.restore();
    ctx.strokeStyle = PINK;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(width/2, 145, 80, 0, Math.PI*2);
    ctx.stroke();
  } catch {
    // Keep a complete quote card even if Discord's avatar CDN is temporarily unavailable.
  }

  ctx.textAlign = "center";
  ctx.fillStyle = "#fff";
  ctx.font = "italic 38px Georgia";
  const lines = wrapQuoteText(ctx, String(content ?? "").trim().slice(0, MAX_QUOTE_LENGTH), 900).slice(0, 6);
  const lineHeight = 54;
  const startY = Math.max(330, 365 - lines.length * lineHeight / 2);
  lines.forEach((line, i) => ctx.fillText(line, width/2, startY + i*lineHeight, 980));
  ctx.fillStyle = "#f4dce9";
  ctx.font = "600 23px Arial";
  ctx.fillText(String(authorName).slice(0, 70), width/2, 570);
  ctx.fillStyle = "#bcaaba";
  ctx.font = "18px Arial";
  ctx.fillText(String(authorTag).slice(0, 80), width/2, 601);
  ctx.fillStyle = PINK;
  ctx.font = "bold 24px Georgia";
  ctx.fillText("kittisugar ♡", width/2, 645);
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

async function resolveMessage(interaction) {
  if (interaction.isMessageContextMenuCommand()) return interaction.targetMessage;
  const reference = extractMessageReference(interaction.options.getString("message", true));
  if (!reference || reference.guildId !== interaction.guildId) {
    throw new Error("Please provide a message link from this server.");
  }
  const channel = await interaction.client.channels.fetch(reference.channelId);
  if (!channel?.isTextBased() || !channel.messages) throw new Error("I can't access that message.");
  return channel.messages.fetch(reference.messageId);
}

async function createQuote(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const message = await resolveMessage(interaction);
  if (!message.guild || message.author.bot) throw new Error("Choose a message from a member, not a bot.");
  const content = message.content?.trim();
  if (!content) throw new Error("That message has no text to turn into a quote.");
  const image = await buildQuoteCard({
    authorName: message.member?.displayName ?? message.author.globalName ?? message.author.username,
    authorTag: `@${message.author.username}`,
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
      content: `♡ quote by <@${message.author.id}>`,
      files: [new AttachmentBuilder(image, { name: "kittisugar-quote.png" })],
      allowedMentions: { users: [message.author.id] },
    });
  }
  await interaction.editReply({ content: `Your quote is in <#${quotesChannel.id}> and this channel ♡` });
}

export function attachQuoteSystem(client, { token, applicationId }) {
  client.once(Events.ClientReady, async () => {
    for (const guild of client.guilds.cache.values()) {
      try {
        await registerApplicationCommands({ token, applicationId, guildId: guild.id, commands: COMMANDS });
      } catch (error) {
        console.error(`[quotes] command registration failed in ${guild.id}: ${error.message}`);
      }
    }
  });
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isMessageContextMenuCommand() && !interaction.isChatInputCommand()) return;
    if ((interaction.commandName !== "Quote" && interaction.commandName !== "quote") || !interaction.inGuild()) return;
    try {
      await createQuote(interaction);
    } catch (error) {
      const message = error instanceof Error ? error.message : "The quote could not be created.";
      if (interaction.deferred || interaction.replied) await interaction.editReply({ content: message }).catch(() => {});
      else await interaction.reply({ content: message, ephemeral: true }).catch(() => {});
    }
  });
}
