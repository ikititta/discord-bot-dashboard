// The bot half: community event and moderation logs.
//
// Everything it does is read out of the settings file, which the dashboard
// writes, so a change takes effect on the next event with no restart.

import { ChannelType, Client, EmbedBuilder, Events, GatewayIntentBits, PermissionFlagsBits, Partials, AttachmentBuilder } from "discord.js";
import { createCanvas, loadImage } from "@napi-rs/canvas";

import { createMessageResponder } from "./message-handler.js";
import { shouldAutoReactToMessage, addAutoReactions } from "./auto-reactions.js";
import { formatEmbedTitle, toRoyalBold } from "./embed-format.js";
import { attachMessageDeletionSystem } from "./message-deletion.js";
import { attachPrivateChatSystem } from "./private-chat-system.js";
import { PRIVATE_CHAT_LOBBY_CHANNEL_ID } from "./private-chat-format.js";
import { attachTicketSystem } from "./ticket-system.js";
import { attachCommunitySystem } from "./community-system.js";
import { attachQuoteSystem } from "./quote-system.js";
import { attachGeneralQuoteStickyTip } from "./general-quote-sticky.js";
import { attachAccessSystem } from "./access-system.js";
import { registerApplicationCommands } from "./command-registry.js";
import { attachModerationSystem } from "./moderation-system.js";
import { attachForumVisibilitySystem } from "./forum-visibility.js";
import { attachFunCommands } from "./fun-commands.js";
import { attachReputationSystem } from "./reputation-system.js";
import { attachPetSystem } from "./pet-system.js";
import { attachMemberProfileSystem } from "./member-profile-system.js";
import { attachCommandsChannel } from "./commands-channel.js";
import { protectChannelNames, protectNewChannel } from "./channel-renames.js";

const COLORS = { join: 0x4ade80, leave: 0xf87171, edit: 0xfbbf24, delete: 0xf87171 };

/**
 * Start the bot.
 *
 * @param {object} options
 * @param {string} options.token
 * @param {string} options.applicationId
 * @param {import("./settings.js").SettingsStore} options.settings
 * @param {import("./private-chat-store.js").PrivateChatStore} options.privateChats
 * @param {import("./moderation-log-store.js").ModerationLogStore} options.moderationLogs
 * @param {(message: string) => Promise<string>} [options.generateReply]
 * @returns {Client}
 */
export function createBot({
  token,
  applicationId,
  settings,
  generateReply,
  memory,
  privateChats,
  moderationLogs,
  communityStore,
  suggestionStore,
  stickyPanels,
  funCommands,
  reputationStore,
  petStore,
  autoModeration,
}) {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      // Privileged. Turn Server Members on in the Developer Portal.
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessageReactions,
      // Privileged. Turn Message Content on to log what a deleted message said.
      GatewayIntentBits.MessageContent,
    ],
    // Without these, a deleted or edited message that is not in the cache
    // (anything from before the bot started) arrives empty and is dropped.
    partials: [Partials.Message, Partials.Channel, Partials.User, Partials.Reaction],
  });

  client.once(Events.ClientReady, () => {
    const protectedCount = protectChannelNames(client.guilds.cache);
    console.log(`[bot] protected ${protectedCount} channel name(s); private-chat owner rename remains enabled`);
    console.log(`[bot] logged in as ${client.user.tag} in ${client.guilds.cache.size} server(s)`);
  });
  client.on(Events.GuildCreate, (guild) => {
    protectChannelNames(new Map([[guild.id, guild]]));
  });
  client.on(Events.ChannelCreate, (channel) => {
    protectNewChannel(channel);
  });
  client.on(Events.MessageCreate, (message) => {
    if (!shouldAutoReactToMessage(message, { stickyPanels })) return;
    void addAutoReactions(message).catch((error) => {
      console.error(`[reactions] automatic reactions failed for message ${message.id}: ${error.message}`);
    });
  });

  if (generateReply) {
    client.on(
      Events.MessageCreate,
      createMessageResponder({
        generateReply,
        memory,
        getBotUserId: () => client.user?.id,
      }),
    );
  }

  let goodbyeChannelId;
  client.once(Events.ClientReady, () => {
    const guild = client.guilds.cache.get("1567093019377930363");
    if (guild) {
      void ensureGoodbyeChannel(guild).then((channel) => {
        goodbyeChannelId = channel?.id;
      }).catch((error) => {
        console.error(`[goodbye] could not create/find channel: ${error.message}`);
      });
    }
  });

  client.on(Events.GuildMemberAdd, async (member) => {
    const config = settings.get(member.guild.id);
    await log(client, config.logChannelId, {
      title: "Member joined",
      color: COLORS.join,
      description: `<@${member.id}> (${member.user.tag})`,
      footer: `${member.guild.memberCount} members`,
    });

    // Kittisugar welcome card: server artwork as the background, member avatar,
    // and all welcome copy rendered in white directly on the image.
    if (member.guild.id === "1567093019377930363") {
      try {
        const channel = await client.channels.fetch("1569909644590321737");
        if (channel?.isTextBased()) {
          const width = 1200;
          const height = 480;
          const canvas = createCanvas(width, height);
          const ctx = canvas.getContext("2d");

          const backgroundUrl =
            member.guild.bannerURL({ extension: "png", size: 2048 }) ??
            member.guild.iconURL({ extension: "png", size: 1024 });
          if (backgroundUrl) {
            const background = await loadImage(backgroundUrl);
            const scale = Math.max(width / background.width, height / background.height);
            const cropWidth = width / scale;
            const cropHeight = height / scale;
            ctx.drawImage(
              background,
              (background.width - cropWidth) / 2,
              (background.height - cropHeight) / 2,
              cropWidth,
              cropHeight,
              0,
              0,
              width,
              height,
            );
          } else {
            const gradient = ctx.createLinearGradient(0, 0, width, height);
            gradient.addColorStop(0, "#3d2945");
            gradient.addColorStop(1, "#b77eaa");
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, width, height);
          }

          // A soft dark veil keeps the white lettering readable over any server image.
          const veil = ctx.createLinearGradient(0, 0, width, 0);
          veil.addColorStop(0, "rgba(20, 12, 25, 0.72)");
          veil.addColorStop(0.58, "rgba(20, 12, 25, 0.35)");
          veil.addColorStop(1, "rgba(20, 12, 25, 0.12)");
          ctx.fillStyle = veil;
          ctx.fillRect(0, 0, width, height);

          const avatarUrl = member.user.displayAvatarURL({ extension: "png", size: 512 });
          const avatar = await loadImage(avatarUrl);
          const avatarSize = 184;
          const avatarX = 112;
          const avatarY = 148;
          ctx.save();
          ctx.beginPath();
          ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 9, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255,255,255,0.96)";
          ctx.fill();
          ctx.beginPath();
          ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
          ctx.restore();

          const displayName = member.user.globalName ?? member.user.username;
          ctx.textAlign = "left";
          ctx.textBaseline = "alphabetic";
          ctx.shadowColor = "rgba(0,0,0,0.35)";
          ctx.shadowBlur = 12;
          ctx.fillStyle = "#ffffff";
          ctx.font = 'bold 30px sans-serif';
          ctx.fillText("KITTISUGAR  ♡", 350, 174);
          ctx.font = 'bold 66px sans-serif';
          ctx.fillText("WELCOME", 350, 258);
          ctx.font = 'bold 40px sans-serif';
          ctx.fillText(displayName.slice(0, 24), 350, 318);
          ctx.font = '28px sans-serif';
          ctx.fillText("we're so happy you're here ♡", 350, 374);

          const attachment = new AttachmentBuilder(await canvas.encode("png"), { name: "kittisugar-welcome.png" });
          const welcome = new EmbedBuilder()
            .setColor(0xffffff)
            .setImage("attachment://kittisugar-welcome.png")
            .setFooter({ text: `${member.guild.memberCount} members` });
          await channel.send({
            files: [attachment],
            embeds: [welcome],
            allowedMentions: { parse: [] },
          });
        }
      } catch (error) {
        console.error(`[welcome] could not send welcome for ${member.id}: ${error.message}`);
      }
    }
  });

  client.on(Events.GuildMemberRemove, async (member) => {
    const config = settings.get(member.guild.id);

    await log(client, config.logChannelId, {
      title: "Member left",
      color: COLORS.leave,
      description: `${member.user?.tag ?? member.id}`,
      footer: `${member.guild.memberCount} members`,
    });

    if (member.guild.id === "1567093019377930363" && member.user) {
      try {
        const channel = goodbyeChannelId
          ? await client.channels.fetch(goodbyeChannelId).catch(() => null)
          : await ensureGoodbyeChannel(member.guild);
        if (channel?.isTextBased()) {
          const width = 1200;
          const height = 480;
          const canvas = createCanvas(width, height);
          const ctx = canvas.getContext("2d");
          const backgroundUrl =
            member.guild.bannerURL({ extension: "png", size: 2048 }) ??
            member.guild.iconURL({ extension: "png", size: 1024 });
          if (backgroundUrl) {
            const background = await loadImage(backgroundUrl);
            const scale = Math.max(width / background.width, height / background.height);
            const cropWidth = width / scale;
            const cropHeight = height / scale;
            ctx.drawImage(background, (background.width - cropWidth) / 2, (background.height - cropHeight) / 2, cropWidth, cropHeight, 0, 0, width, height);
          } else {
            const gradient = ctx.createLinearGradient(0, 0, width, height);
            gradient.addColorStop(0, "#3d2945");
            gradient.addColorStop(1, "#b77eaa");
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, width, height);
          }
          const veil = ctx.createLinearGradient(0, 0, width, 0);
          veil.addColorStop(0, "rgba(20, 12, 25, 0.72)");
          veil.addColorStop(0.58, "rgba(20, 12, 25, 0.35)");
          veil.addColorStop(1, "rgba(20, 12, 25, 0.12)");
          ctx.fillStyle = veil;
          ctx.fillRect(0, 0, width, height);

          const avatar = await loadImage(member.user.displayAvatarURL({ extension: "png", size: 512 }));
          const avatarSize = 184;
          const avatarX = 112;
          const avatarY = 148;
          ctx.save();
          ctx.beginPath();
          ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 9, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255,255,255,0.96)";
          ctx.fill();
          ctx.beginPath();
          ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
          ctx.restore();

          const displayName = member.user.globalName ?? member.user.username;
          ctx.textAlign = "left";
          ctx.textBaseline = "alphabetic";
          ctx.shadowColor = "rgba(0,0,0,0.35)";
          ctx.shadowBlur = 12;
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 30px sans-serif";
          ctx.fillText("KITTISUGAR  🥀", 350, 174);
          ctx.font = "bold 66px sans-serif";
          ctx.fillText("GOODBYE", 350, 258);
          ctx.font = "bold 40px sans-serif";
          ctx.fillText(displayName.slice(0, 24), 350, 318);
          ctx.font = "28px sans-serif";
          ctx.fillText("we'll miss you ♡", 350, 374);

          const attachment = new AttachmentBuilder(await canvas.encode("png"), { name: "kittisugar-goodbye.png" });
          const goodbye = new EmbedBuilder()
            .setColor(0xffffff)
            .setImage("attachment://kittisugar-goodbye.png")
            .setFooter({ text: `${member.guild.memberCount} members` });
          await channel.send({ files: [attachment], embeds: [goodbye], allowedMentions: { parse: [] } });
        }
      } catch (error) {
        console.error(`[goodbye] could not send goodbye for ${member.id}: ${error.message}`);
      }
    }
  });

  client.on(Events.MessageDelete, async (message) => {
    if (!shouldPubliclyLogDeletedMessage(message, moderationLogs)) return;

    const config = settings.get(message.guild.id);

    await log(client, config.logChannelId, {
      title: "Message deleted",
      color: COLORS.delete,
      description: quote(message.content) || "(no text, or it was posted before the bot started)",
      fields: [
        { name: "Author", value: message.author ? `<@${message.author.id}>` : "unknown", inline: true },
        { name: "Channel", value: `<#${message.channelId}>`, inline: true },
      ],
    });
  });

  client.on(Events.MessageUpdate, async (before, after) => {
    if (!after.guild || after.author?.bot) return;
    if (before.content === after.content) return;

    const config = settings.get(after.guild.id);

    await log(client, config.logChannelId, {
      title: "Message edited",
      color: COLORS.edit,
      description: `[Jump to it](${after.url})`,
      fields: [
        { name: "Before", value: quote(before.content) || "(not cached)" },
        { name: "After", value: quote(after.content) || "(empty)" },
        { name: "Author", value: after.author ? `<@${after.author.id}>` : "unknown", inline: true },
        { name: "Channel", value: `<#${after.channelId}>`, inline: true },
      ],
    });
  });

  client.on(Events.Error, (error) => console.error(`[bot] ${error.message}`));

  attachPrivateChatSystem(client, {
    token,
    applicationId,
    store: privateChats,
    lobbyChannelId: PRIVATE_CHAT_LOBBY_CHANNEL_ID,
    stickyPanels,
  });
  attachMessageDeletionSystem(client, { settings, moderationLogs });
  attachTicketSystem(client, { settings, stickyPanels });
  attachCommunitySystem(client, { store: communityStore, suggestionStore, stickyPanels, settings });
  attachQuoteSystem(client, { token, applicationId });
  attachGeneralQuoteStickyTip(client, { store: stickyPanels });
  attachAccessSystem(client, { settings });
  attachForumVisibilitySystem(client);
  attachCommandsChannel(client);
  attachFunCommands(client, { store: funCommands, token, applicationId });
  if (reputationStore) attachReputationSystem(client, reputationStore);
  if (petStore) attachPetSystem(client, petStore);
  if (petStore && funCommands && reputationStore) {
    attachMemberProfileSystem(client, { petStore, funStore: funCommands, reputationStore });
  }
  attachRetiredRoleCommandCleanup(client, { token, applicationId });
  if (autoModeration) attachModerationSystem(client, { settings, store: autoModeration });

  client.login(token).catch((error) => {
    if (String(error?.code) === "TokenInvalid" || String(error).includes("TOKEN_INVALID")) {
      console.error(
        "[config] Discord rejected DISCORD_TOKEN. Reset it in the Developer Portal under Bot, Reset Token, " +
          "update the environment variable and restart.",
      );
      process.exit(1);
    }

    if (String(error).includes("disallowed intents")) {
      console.error(
        "[config] Discord refused the login because the privileged intents are off. In the Developer Portal, " +
          "under Bot, Privileged Gateway Intents, turn on Server Members and Message Content, then restart.",
      );
      process.exit(1);
    }

    console.error(`[config] Could not log in to Discord: ${error.message}`);
    process.exit(1);
  });

  return client;
}

async function ensureGoodbyeChannel(guild) {
  const channels = await guild.channels.fetch();
  const existing = channels.find(
    (channel) => channel?.type === ChannelType.GuildText && channel.name === "goodbye",
  );
  if (existing) return existing;

  const welcomeChannel = await guild.channels.fetch("1569909644590321737").catch(() => null);
  return guild.channels.create({
    name: "goodbye",
    type: ChannelType.GuildText,
    ...(welcomeChannel?.parentId ? { parent: welcomeChannel.parentId } : {}),
    topic: "Goodbye messages for members leaving Kittisugar.",
    reason: "Create the matching Kittisugar goodbye channel.",
  });
}

/**
 * Remove the retired role administration commands from each guild while
 * preserving commands registered by every other Sugar feature.
 */
function attachRetiredRoleCommandCleanup(client, { token, applicationId }) {
  let readyHandled = false;

  const removeCommands = async (guildId) => {
    await registerApplicationCommands({
      token,
      applicationId,
      guildId,
      commands: [],
      removeCommandNames: ["roles-organize", "roles-audit"],
    });
  };

  client.once(Events.ClientReady, () => {
    readyHandled = true;
    for (const guild of client.guilds.cache.values()) {
      void removeCommands(guild.id).catch((error) => {
        console.error(`[commands] retired role commands cleanup failed in ${guild.id}: ${error.message}`);
      });
    }
  });

  client.on(Events.GuildCreate, (guild) => {
    if (!readyHandled) return;
    void removeCommands(guild.id).catch((error) => {
      console.error(`[commands] retired role commands cleanup failed in ${guild.id}: ${error.message}`);
    });
  });
}

export function shouldPubliclyLogDeletedMessage(message, moderationLogs) {
  return Boolean(
    message?.guild &&
      !message.author?.bot &&
      !moderationLogs?.isPrivateModerationDelete?.(message.id),
  );
}

/**
 * The text channels a guild has, for the dashboard's dropdowns. Only channels
 * the bot can actually post in are offered, so nobody picks one and wonders
 * why nothing appears.
 *
 * @param {Client} client
 * @param {string} guildId
 * @returns {{id: string, name: string}[]}
 */
export function postableChannels(client, guildId) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return [];

  return guild.channels.cache
    .filter(
      (channel) =>
        (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement) &&
        channel.permissionsFor(guild.members.me)?.has(PermissionFlagsBits.SendMessages),
    )
    .sort((a, b) => a.rawPosition - b.rawPosition)
    .map((channel) => ({ id: channel.id, name: channel.name }));
}

async function send(client, channelId, payload) {
  try {
    const channel = await client.channels.fetch(channelId);
    if (channel?.isTextBased()) await channel.send(payload);
  } catch (error) {
    // A deleted channel or a missing permission must not take the bot down.
    console.error(`[bot] could not post in ${channelId}: ${error.message}`);
  }
}

async function log(client, channelId, { title, color, description, fields = [], footer }) {
  if (!channelId) return;

  const embed = buildLogEmbed({ title, color, description, fields, footer });
  await send(client, channelId, { embeds: [embed] });
}

export function buildLogEmbed({ title, color, description, fields = [], footer }) {
  const embed = new EmbedBuilder().setTitle(formatEmbedTitle(title)).setColor(color).setTimestamp(new Date());
  if (description) embed.setDescription(description.slice(0, 4000));
  if (fields.length) {
    embed.addFields(
      fields.map((field) => ({
        ...field,
        name: toRoyalBold(field.name),
        value: String(field.value).slice(0, 1024),
      })),
    );
  }
  if (footer) embed.setFooter({ text: footer });
  return embed;
}

// Quote somebody's text without letting it pretend to be part of the embed.
function quote(content) {
  const text = String(content ?? "").trim();
  if (!text) return "";
  return `>>> ${text.slice(0, 900)}`;
}
