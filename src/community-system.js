import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  Events,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
  StringSelectMenuBuilder,
} from "discord.js";

import { formatEmbedTitle } from "./embed-format.js";
import { attachStickyPanel } from "./sticky-panels.js";

export const CONFESSIONS_CHANNEL_ID = "1568179046209028106";
export const LOVE_LETTERS_CHANNEL_ID = "1568179044900409418";
export const SUGGESTIONS_CHANNEL_ID = "1569164719309328455";
const PREFIX = "sugar-community:";
const COLOR = 0xffd9ff;
const CONFESSION_PANEL_TITLE = "୨୧ 𝒄𝒐𝒏𝒇𝒆𝒔𝒔ions ♡";
const LOVE_PANEL_TITLE = "୨୧ Love Letters ♡";
const SUGGESTIONS_PANEL_TITLE = "୨୧ Suggestions ♡";
const LEGACY_SUGGESTIONS_PANEL_TITLE = "୨୧ Suggestences ♡";
const CONFESSION_REACTIONS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣"];

function button(id, label, style = ButtonStyle.Primary) {
  return new ButtonBuilder().setCustomId(`${PREFIX}${id}`).setLabel(label).setStyle(style);
}

function replyButton(kind, messageId) {
  return button(`reply:${kind}:${messageId}`, "Reply ♡", ButtonStyle.Success);
}

function reportButton(kind, messageId) {
  return button(`report:${kind}:${messageId}`, "Report ♡", ButtonStyle.Danger);
}

function communityThreadReplyButton(kind, messageId) {
  return button(`thread-reply:${kind}:${messageId}`, "Reply ♡", ButtonStyle.Success);
}

export function buildCommunityThreadReplyComponents(kind, messageId) {
  if (!validReplyKind(kind) || !/^\d{17,20}$/.test(messageId ?? "")) {
    throw new Error("Invalid thread reply target.");
  }
  return [new ActionRowBuilder().addComponents(
    communityThreadReplyButton(kind, messageId),
    reportButton(`${kind}-reply`, messageId),
  )];
}

export function buildLoveLetterReplyComponents(messageId) {
  return buildCommunityThreadReplyComponents("letter", messageId);
}

export function buildSuggestionsPanelPayload() {
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(SUGGESTIONS_PANEL_TITLE)
    .setDescription("Have an idea to make the server better? Share it with everyone and let the community vote ♡");
  return {
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(
      button("suggestion-start", "Submit a Suggestion ♡"),
    )],
  };
}

export function buildSuggestionComponents(messageId) {
  if (!/^(?:0|\d{17,20})$/.test(messageId ?? "")) throw new Error("Invalid suggestion message ID.");
  return [new ActionRowBuilder().addComponents(
    button(`suggestion-vote:${messageId}:up`, "↑", ButtonStyle.Success),
    button(`suggestion-vote:${messageId}:down`, "↓", ButtonStyle.Danger),
    button(`report:suggestion:${messageId}`, "⚑", ButtonStyle.Secondary),
  )];
}

export function buildCommunityPostComponents(kind, messageId) {
  const buttons = [];
  if (kind === "confession" || kind === "letter") buttons.push(replyButton(kind, messageId));
  if (kind === "confession") buttons.push(button("confess-new", "Confess ♡", ButtonStyle.Primary));
  buttons.push(reportButton(kind, messageId));
  return [new ActionRowBuilder().addComponents(...buttons)];
}

export function buildConfessionsPanelPayload() {
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(CONFESSION_PANEL_TITLE)
    .setDescription("Share a confession or create a poll. Choose how you want your post to appear.");
  const row = new ActionRowBuilder().addComponents(
    button("confess-start", "Submit a Confession ♡"),
    button("poll-start", "Create Poll ♡", ButtonStyle.Secondary),
  );
  return { embeds: [embed], components: [row] };
}

export function buildLoveLettersPanelPayload() {
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(LOVE_PANEL_TITLE)
    .setDescription("Send a sweet letter for everyone to read. Choose whether to sign it or keep it anonymous.");
  const row = new ActionRowBuilder().addComponents(
    button("letter:anonymous", "Send Anonymously ♡"),
    button("letter:named", "With My Name ♡", ButtonStyle.Secondary),
  );
  return { embeds: [embed], components: [row] };
}

export function buildLoveLetterRecipientPicker(mode) {
  if (!validMode(mode)) throw new Error("Invalid love letter mode.");
  const picker = new UserSelectMenuBuilder()
    .setCustomId(`${PREFIX}letter-recipient:${mode}`)
    .setPlaceholder("Choose who this letter is for ♡")
    .setMinValues(1)
    .setMaxValues(1);
  return {
    content: "Who would you like to tag in your love letter?",
    components: [new ActionRowBuilder().addComponents(picker)],
    ephemeral: true,
  };
}

export function buildPublicationModePicker(kind) {
  if (!["confess", "poll"].includes(kind)) throw new Error("Invalid publication type.");
  return {
    content: "Would you like to publish anonymously or with your name?",
    components: [new ActionRowBuilder().addComponents(
      button(`publication-mode:${kind}:anonymous`, "Anonymously ♡", ButtonStyle.Secondary),
      button(`publication-mode:${kind}:named`, "With My Name ♡", ButtonStyle.Primary),
    )],
    ephemeral: true,
  };
}

export function buildPublicationRecipientPicker(kind, mode) {
  if (!["confess", "poll"].includes(kind) || !validMode(mode)) {
    throw new Error("Invalid publication options.");
  }
  const picker = new UserSelectMenuBuilder()
    .setCustomId(`${PREFIX}publication-recipient:${kind}:${mode}`)
    .setPlaceholder("Tag someone (optional) ♡")
    .setMinValues(1)
    .setMaxValues(1);
  const skip = new ActionRowBuilder().addComponents(
    button(`publication-skip:${kind}:${mode}`, "Skip ♡", ButtonStyle.Secondary),
  );
  return {
    content: "Would you like to tag someone? This is optional.",
    components: [new ActionRowBuilder().addComponents(picker), skip],
    ephemeral: true,
  };
}

export function buildConfessionRecipientPicker(mode) {
  return buildPublicationRecipientPicker("confess", mode);
}

function validMode(mode) {
  return mode === "anonymous" || mode === "named";
}

export function buildConfessionModePicker() {
  return buildPublicationModePicker("confess");
}

export function buildThreadReplyModePicker(kind, messageId) {
  if (!validReplyKind(kind) || !/^\d{17,20}$/.test(messageId ?? "")) {
    throw new Error("Invalid thread reply target.");
  }
  return {
    content: "How would you like to reply?",
    components: [new ActionRowBuilder().addComponents(
      button(`thread-reply-mode:${kind}:anonymous:${messageId}`, "Anonymously ♡"),
      button(`thread-reply-mode:${kind}:named:${messageId}`, "With My Name ♡", ButtonStyle.Secondary),
    )],
    ephemeral: true,
  };
}

export function buildReplyModePicker(kind, messageId) {
  if (!["confession", "letter"].includes(kind) || !/^\d{17,20}$/.test(messageId ?? "")) {
    throw new Error("Invalid reply target.");
  }
  return {
    content: "How would you like to reply?",
    components: [new ActionRowBuilder().addComponents(
      button(`reply-mode:${kind}:anonymous:${messageId}`, "Anonymously ♡"),
      button(`reply-mode:${kind}:named:${messageId}`, "With My Name ♡", ButtonStyle.Secondary),
    )],
    ephemeral: true,
  };
}

export function attachCommunitySystem(client, { store, stickyPanels, settings, suggestionStore }) {
  if (!store || typeof store.nextNumber !== "function") {
    throw new Error("The community system requires a persistent community store.");
  }
  let refreshConfessionsPanel = async () => {};
  let refreshLoveLettersPanel = async () => {};
  let refreshSuggestionsPanel = async () => {};
  if (stickyPanels) {
    const legacyPanelMessageId = stickyPanels.get("suggestences");
    if (legacyPanelMessageId && !stickyPanels.get("suggestions")) {
      stickyPanels.set("suggestions", legacyPanelMessageId);
    }
    if (legacyPanelMessageId) stickyPanels.set("suggestences", null);
    refreshConfessionsPanel = attachStickyPanel(client, {
      store: stickyPanels,
      key: "confessions",
      channelId: CONFESSIONS_CHANNEL_ID,
      titles: [CONFESSION_PANEL_TITLE],
      buildPayload: buildConfessionsPanelPayload,
      pinOnCreate: false,
      logger: "community",
    }).refresh;
    refreshLoveLettersPanel = attachStickyPanel(client, {
      store: stickyPanels,
      key: "love-letters",
      channelId: LOVE_LETTERS_CHANNEL_ID,
      titles: [LOVE_PANEL_TITLE],
      buildPayload: buildLoveLettersPanelPayload,
      pinOnCreate: false,
      logger: "community",
    }).refresh;
    client.once(Events.ClientReady, () => {
      void renameSuggestionsChannel(client).catch((error) => {
        console.error(`[community] suggestions channel rename failed: ${error.message}`);
      });
    });
    refreshSuggestionsPanel = attachStickyPanel(client, {
      store: stickyPanels,
      key: "suggestions",
      channelId: SUGGESTIONS_CHANNEL_ID,
      titles: [SUGGESTIONS_PANEL_TITLE, LEGACY_SUGGESTIONS_PANEL_TITLE],
      buildPayload: buildSuggestionsPanelPayload,
      pinOnCreate: false,
      logger: "community",
    }).refresh;
  } else {
    client.once(Events.ClientReady, () => {
      void ensureCommunityPanels(client).catch((error) => {
        console.error(`[community] panel setup failed: ${error.message}`);
      });
    });
  }
  client.on(Events.InteractionCreate, (interaction) => {
    if (interaction.isButton() && interaction.customId.startsWith(PREFIX)) {
      void handleCommunityButton(interaction).catch(async (error) => {
        console.error(`[community] interaction failed: ${error.message}`);
        await replyEphemeral(interaction, "Something went wrong. Please try again.");
      });
    } else if (interaction.isStringSelectMenu() && interaction.customId.startsWith(PREFIX)) {
      void handleCommunityStringSelect(interaction).catch(async (error) => {
        console.error(`[community] mode selection failed: ${error.message}`);
        await replyEphemeral(interaction, "Please choose a valid publication option.");
      });
    } else if (interaction.isUserSelectMenu() && interaction.customId.startsWith(PREFIX)) {
      void handleCommunityUserSelect(interaction).catch(async (error) => {
        console.error(`[community] user selection failed: ${error.message}`);
        await replyEphemeral(interaction, "Please choose a server member and try again.");
      });
    } else if (interaction.isModalSubmit() && interaction.customId.startsWith(PREFIX)) {
      void handleCommunityModal(interaction, {
        store, settings, suggestionStore, refreshConfessionsPanel, refreshLoveLettersPanel,
        refreshSuggestionsPanel,
      }).catch(async (error) => {
        console.error("[community] submission failed:", error);
        await replyEphemeral(interaction, "Sugar couldn't publish that reply. Please try again, or contact a moderator if it keeps happening.");
      });
    }
  });
}

async function renameSuggestionsChannel(client) {
  const channel = await client.channels.fetch(SUGGESTIONS_CHANNEL_ID).catch(() => null);
  if (!channel || channel.type !== ChannelType.GuildText || channel.name === "suggestions") return;
  const botMember = channel.guild.members.me;
  if (!botMember?.permissions.has(PermissionFlagsBits.ManageChannels)) {
    console.warn("[community] Sugar needs Manage Channels permission to rename the suggestions channel.");
    return;
  }
  await channel.setName("suggestions", "Use the correct English spelling for the Suggestions channel");
}

export async function ensureCommunityPanels(client) {
  const confessions = await upsertPanel(client, CONFESSIONS_CHANNEL_ID, CONFESSION_PANEL_TITLE, buildConfessionsPanelPayload(), { pinOnCreate: false });
  const letters = await upsertPanel(client, LOVE_LETTERS_CHANNEL_ID, LOVE_PANEL_TITLE, buildLoveLettersPanelPayload(), { pinOnCreate: false });
  const suggestionsChannel = await client.channels.fetch(SUGGESTIONS_CHANNEL_ID).catch(() => null);
  if (suggestionsChannel?.type === ChannelType.GuildText && suggestionsChannel.name !== "suggestions") {
    const botMember = suggestionsChannel.guild.members.me;
    if (botMember?.permissions.has(PermissionFlagsBits.ManageChannels)) {
      await suggestionsChannel.setName("suggestions", "Use the correct English spelling for the Suggestions channel");
    }
  }
  const suggestions = await upsertPanel(client, SUGGESTIONS_CHANNEL_ID, SUGGESTIONS_PANEL_TITLE, buildSuggestionsPanelPayload(), { pinOnCreate: false });
  return { confessions, letters, suggestions };
}

async function upsertPanel(client, channelId, title, payload, { pinOnCreate = true } = {}) {
  const channel = await client.channels.fetch(channelId);
  if (!channel || channel.type !== ChannelType.GuildText) {
    throw new Error(`Community panel channel ${channelId} is not an accessible text channel.`);
  }
  const recent = await channel.messages.fetch({ limit: 50 });
  const existing = recent.find((message) =>
    message.author.id === client.user.id && message.embeds.some((embed) => embed.title === title),
  );
  if (existing) {
    await existing.edit(payload);
    if (!pinOnCreate && existing.pinned) await existing.unpin().catch((error) => {
      console.error(`[community] panel in ${channelId} could not be unpinned: ${error.message}`);
    });
    return existing;
  }
  const message = await channel.send(payload);
  if (pinOnCreate) {
    try { await message.pin(); } catch (error) {
      console.error(`[community] panel posted in ${channelId} but could not be pinned: ${error.message}`);
    }
  }
  return message;
}

async function handleCommunityButton(interaction) {
  const id = interaction.customId.slice(PREFIX.length);
  if (id === "suggestion-start") {
    if (!interaction.inGuild() || interaction.channelId !== SUGGESTIONS_CHANNEL_ID) {
      return replyEphemeral(interaction, "Please use the Suggestions channel.");
    }
    return interaction.showModal(buildSuggestionModal());
  }

  if (id.startsWith("suggestion-vote:")) {
    const [, messageId, direction] = id.split(":");
    if (!["up", "down"].includes(direction) || !/^\d{17,20}$/.test(messageId ?? "") ||
        !interaction.inGuild() || interaction.channelId !== SUGGESTIONS_CHANNEL_ID ||
        interaction.message?.id !== messageId || !hasSuggestionButtons(interaction.message, messageId)) {
      return replyEphemeral(interaction, "This suggestion vote is no longer valid.");
    }
    return handleSuggestionVote(interaction, { suggestionStore, messageId, direction });
  }

  if (id === "confess-new" || id === "confess-start" || id === "poll-start") {
    const kind = id === "poll-start" ? "poll" : "confess";
    if (!interaction.inGuild() || interaction.channelId !== CONFESSIONS_CHANNEL_ID) {
      return replyEphemeral(interaction, "Please use the Confessions channel.");
    }
    return interaction.reply(buildPublicationModePicker(kind));
  }

  if (id.startsWith("publication-mode:")) {
    const [, kind, mode] = id.split(":");
    if (!["confess", "poll"].includes(kind) || !validMode(mode) ||
        !interaction.inGuild() || interaction.channelId !== CONFESSIONS_CHANNEL_ID) {
      return replyEphemeral(interaction, "Please use the correct community panel.");
    }
    return interaction.reply(buildPublicationRecipientPicker(kind, mode));
  }

  if (id.startsWith("report:")) {
    const [, kind, messageId] = id.split(":");
    if (!validReportKind(kind) || !/^\d{17,20}$/.test(messageId ?? "") ||
        interaction.message?.id !== messageId ||
        !hasReportButton(interaction.message, kind, messageId) ||
        !isExpectedCommunityLocation(interaction, reportChannelForKind(kind))) {
      return replyEphemeral(interaction, "This report button is no longer valid.");
    }
    return interaction.showModal(buildReportModal(kind, messageId));
  }

  if (id.startsWith("thread-reply:")) {
    const [, kind, messageId] = id.split(":");
    const thread = interaction.channel;
    const expectedParent = kind === "confession" ? CONFESSIONS_CHANNEL_ID
      : kind === "letter" ? LOVE_LETTERS_CHANNEL_ID : null;
    if (!expectedParent || !/^\d{17,20}$/.test(messageId ?? "") ||
        interaction.message?.id !== messageId || !interaction.inGuild() ||
        !thread?.isThread?.() || thread.parentId !== expectedParent ||
        !hasThreadReplyButton(interaction.message, kind, messageId)) {
      return replyEphemeral(interaction, "This reply button is no longer valid.");
    }
    return interaction.reply(buildThreadReplyModePicker(kind, messageId));
  }

  if (id.startsWith("thread-reply-mode:")) {
    const [, kind, mode, messageId] = id.split(":");
    const thread = interaction.channel;
    const expectedParent = kind === "confession" ? CONFESSIONS_CHANNEL_ID
      : kind === "letter" ? LOVE_LETTERS_CHANNEL_ID : null;
    if (!expectedParent || !validMode(mode) || !/^\d{17,20}$/.test(messageId ?? "") ||
        !interaction.inGuild() || !thread?.isThread?.() || thread.parentId !== expectedParent) {
      return replyEphemeral(interaction, "This reply option is no longer valid.");
    }
    return interaction.showModal(buildThreadReplyModal(kind, mode, messageId));
  }

  if (id.startsWith("reply:")) {
    const [, kind, messageId] = id.split(":");
    if (!validReplyKind(kind) || !/^\d{17,20}$/.test(messageId ?? "")) {
      return replyEphemeral(interaction, "This reply button is invalid.");
    }
    const expectedChannel = kind === "confession" ? CONFESSIONS_CHANNEL_ID : LOVE_LETTERS_CHANNEL_ID;
    if (!interaction.inGuild() || interaction.channelId !== expectedChannel) {
      return replyEphemeral(interaction, "Please reply from the original post.");
    }
    return interaction.reply(buildReplyModePicker(kind, messageId));
  }

  if (id.startsWith("reply-mode:")) {
    const [, kind, mode, messageId] = id.split(":");
    if (!validReplyKind(kind) || !validMode(mode) || !/^\d{17,20}$/.test(messageId ?? "")) {
      return replyEphemeral(interaction, "This reply option is invalid.");
    }
    return interaction.showModal(buildReplyModal(kind, mode, messageId));
  }

  if (id.startsWith("publication-skip:")) {
    const [, kind, mode] = id.split(":");
    if (!["confess", "poll"].includes(kind) || !validMode(mode) ||
        !interaction.inGuild() || interaction.channelId !== CONFESSIONS_CHANNEL_ID) {
      return replyEphemeral(interaction, "Please use the Confessions panel.");
    }
    return interaction.showModal(kind === "poll"
      ? buildPollModal(mode, null)
      : buildConfessionModal(mode, null));
  }

  const [kind, mode] = id.split(":");
  const expectedChannel = kind === "confess" || kind === "poll"
    ? CONFESSIONS_CHANNEL_ID
    : kind === "letter" ? LOVE_LETTERS_CHANNEL_ID : null;
  if (!expectedChannel || !interaction.inGuild() || interaction.channelId !== expectedChannel) {
    return replyEphemeral(interaction, "Please use the panel in its designated channel.");
  }

  if (kind === "letter") return interaction.reply(buildLoveLetterRecipientPicker(mode));
  if (kind === "confess" && validMode(mode)) {
    return interaction.reply(buildConfessionRecipientPicker(mode));
  }
  return replyEphemeral(interaction, "Invalid publication option.");
}

async function handleCommunityStringSelect(interaction) {
  if (!interaction.inGuild()) return replyEphemeral(interaction, "This feature is only available in the server.");
  const [action, kind] = interaction.customId.slice(PREFIX.length).split(":");
  const mode = interaction.values[0];
  if (action !== "publication-mode" || !["confess", "poll"].includes(kind) ||
      !validMode(mode) || interaction.channelId !== CONFESSIONS_CHANNEL_ID) {
    return replyEphemeral(interaction, "Please use the correct community panel.");
  }
  return interaction.reply(buildPublicationRecipientPicker(kind, mode));
}

async function handleCommunityUserSelect(interaction) {
  if (!interaction.inGuild()) return replyEphemeral(interaction, "This feature is only available in the server.");
  const parts = interaction.customId.slice(PREFIX.length).split(":");
  const [kind, mode, extra] = parts;
  const isPublication = kind === "publication-recipient";
  const publicationKind = isPublication ? mode : null;
  const publicationMode = isPublication ? extra : mode;
  const expectedChannel = kind === "letter-recipient" ? LOVE_LETTERS_CHANNEL_ID
    : kind === "confess-recipient" || isPublication ? CONFESSIONS_CHANNEL_ID : null;
  if (!expectedChannel || interaction.channelId !== expectedChannel || !validMode(publicationMode) ||
      (isPublication && !["confess", "poll"].includes(publicationKind))) {
    return replyEphemeral(interaction, "Please use the correct community panel.");
  }
  const recipientId = interaction.values[0];
  if (!/^\d{17,20}$/.test(recipientId ?? "")) {
    return replyEphemeral(interaction, "Please choose someone first.");
  }
  const member = await interaction.guild.members.fetch(recipientId).catch(() => null);
  if (!member) return replyEphemeral(interaction, "That user is not available in this server.");
  if (kind === "letter-recipient") {
    return interaction.showModal(buildLoveLetterModal(mode, recipientId));
  }
  if (isPublication && publicationKind === "poll") {
    return interaction.showModal(buildPollModal(publicationMode, recipientId));
  }
  return interaction.showModal(buildConfessionModal(isPublication ? publicationMode : mode, recipientId));
}

function buildSuggestionModal() {
  const modal = new ModalBuilder()
    .setCustomId(`${PREFIX}suggestion:submit`)
    .setTitle("Submit a Suggestion");
  const input = new TextInputBuilder()
    .setCustomId("body")
    .setLabel("Your suggestion")
    .setPlaceholder("Share your idea for the server...")
    .setStyle(TextInputStyle.Paragraph)
    .setMinLength(5)
    .setMaxLength(1800)
    .setRequired(true);
  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return modal;
}

function buildConfessionModal(mode, recipientId) {
  const modal = new ModalBuilder()
    .setCustomId(`${PREFIX}confess:${mode}:${recipientId ?? "none"}`)
    .setTitle("Submit a Confession");
  const input = new TextInputBuilder()
    .setCustomId("body")
    .setLabel("Your confession")
    .setPlaceholder("Share what's on your mind...")
    .setStyle(TextInputStyle.Paragraph)
    .setMinLength(1)
    .setMaxLength(1800)
    .setRequired(true);
  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return modal;
}

function buildLoveLetterModal(mode, recipientId) {
  const modal = new ModalBuilder()
    .setCustomId(`${PREFIX}letter:${mode}:${recipientId}`)
    .setTitle("Write a Love Letter");
  const input = new TextInputBuilder()
    .setCustomId("body")
    .setLabel("Your letter")
    .setPlaceholder("Write something sweet...")
    .setStyle(TextInputStyle.Paragraph)
    .setMinLength(1)
    .setMaxLength(1800)
    .setRequired(true);
  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return modal;
}

function buildReplyModal(kind, mode, messageId) {
  const modal = new ModalBuilder()
    .setCustomId(`${PREFIX}reply:${kind}:${mode}:${messageId}`)
    .setTitle(kind === "confession" ? "Reply to Confession" : "Reply to Love Letter");
  const input = new TextInputBuilder()
    .setCustomId("body")
    .setLabel("Your reply")
    .setPlaceholder("Write your reply...")
    .setStyle(TextInputStyle.Paragraph)
    .setMinLength(1)
    .setMaxLength(1800)
    .setRequired(true);
  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return modal;
}

function buildThreadReplyModal(kind, mode, messageId) {
  const modal = new ModalBuilder()
    .setCustomId(`${PREFIX}thread-reply:${kind}:${mode}:${messageId}`)
    .setTitle(kind === "confession" ? "Reply to Confession Reply" : "Reply to Love Letter Reply");
  const input = new TextInputBuilder()
    .setCustomId("body")
    .setLabel("Your reply")
    .setPlaceholder("Write your reply...")
    .setStyle(TextInputStyle.Paragraph)
    .setMinLength(1)
    .setMaxLength(1800)
    .setRequired(true);
  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return modal;
}

function buildPollModal(mode, recipientId) {
  if (!validMode(mode) || (recipientId !== null && recipientId !== undefined && !/^\d{17,20}$/.test(recipientId))) {
    throw new Error("Invalid poll options.");
  }
  const modal = new ModalBuilder()
    .setCustomId(`${PREFIX}poll:${mode}:${recipientId ?? "none"}`)
    .setTitle("Create a Poll");
  const fields = [
    ["question", "Poll question", "What should everyone vote on?", true],
    ["option1", "Option 1", "First option", true],
    ["option2", "Option 2", "Second option", true],
    ["option3", "Option 3 (optional)", "Third option", false],
    ["option4", "Option 4 (optional)", "Fourth option", false],
  ];
  modal.addComponents(fields.map(([id, label, placeholder, required]) =>
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId(id).setLabel(label).setPlaceholder(placeholder)
        .setStyle(TextInputStyle.Short).setMaxLength(100).setRequired(required),
    ),
  ));
  return modal;
}

async function handleCommunityModal(interaction, {
  store, settings, suggestionStore, refreshConfessionsPanel, refreshLoveLettersPanel,
  refreshSuggestionsPanel,
}) {
  if (!interaction.inGuild()) return replyEphemeral(interaction, "This feature is only available in the server.");
  const id = interaction.customId.slice(PREFIX.length);
  const isPoll = id.startsWith("poll:");
  const isConfession = id.startsWith("confess:");
  const isLetter = id.startsWith("letter:");
  const isSuggestion = id === "suggestion:submit";
  const isReply = id.startsWith("reply:");
  const isThreadReply = id.startsWith("thread-reply:");
  const isReport = id.startsWith("report:");
  const reportParts = isReport ? id.split(":") : [];
  const reportKind = reportParts[1];
  const expectedChannel = isReport ? reportChannelForKind(reportKind)
    : isSuggestion ? SUGGESTIONS_CHANNEL_ID
      : isConfession || isPoll || id.startsWith("reply:confession:")
        ? CONFESSIONS_CHANNEL_ID
        : isLetter || id.startsWith("reply:letter:") ? LOVE_LETTERS_CHANNEL_ID : null;
  const threadReplyParts = isThreadReply ? id.split(":") : [];
  const threadReplyKind = threadReplyParts[1];
  const validThreadReplyLocation = isThreadReply &&
    ["confession", "letter"].includes(threadReplyKind) &&
    interaction.channel?.isThread?.() &&
    interaction.channel.parentId === (threadReplyKind === "confession"
      ? CONFESSIONS_CHANNEL_ID : LOVE_LETTERS_CHANNEL_ID);
  if ((!expectedChannel && !validThreadReplyLocation) || (isReport
    ? !isExpectedCommunityLocation(interaction, expectedChannel)
    : isThreadReply ? !validThreadReplyLocation : interaction.channelId !== expectedChannel)) {
    return replyEphemeral(interaction, "Please submit this from the correct community channel.");
  }

  await interaction.deferReply({ ephemeral: true });
  if (isReport) {
    return submitCommunityReport(interaction, {
      reportKind, messageId: reportParts[2], settings,
    });
  }
  if (isSuggestion) {
    return publishSuggestion(interaction, suggestionStore, refreshSuggestionsPanel);
  }
  if (isThreadReply) {
    const [, kind, mode, targetId] = id.split(":");
    if (!validReplyKind(kind) || !validMode(mode) || !/^\d{17,20}$/.test(targetId ?? "")) {
      return interaction.editReply("This reply is invalid.");
    }
    return publishCommunityThreadMessageReply(interaction, kind, mode, targetId);
  }

  const channel = await interaction.guild.channels.fetch(expectedChannel);
  if (!channel || channel.type !== ChannelType.GuildText) {
    return interaction.editReply("The publication channel is unavailable.");
  }

  if (isReply) {
    const [, kind, mode, parentId] = id.split(":");
    if (!validReplyKind(kind) || !validMode(mode) || !/^\d{17,20}$/.test(parentId ?? "")) {
      return interaction.editReply("This reply is invalid.");
    }
    return publishThreadReply(interaction, channel, kind, mode, parentId);
  }

  if (isPoll) {
    const [, mode, recipientValue] = id.split(":");
    const recipientId = recipientValue && recipientValue !== "none" ? recipientValue : null;
    if (!validMode(mode) || (recipientId && !/^\d{17,20}$/.test(recipientId))) {
      return interaction.editReply("Invalid poll options.");
    }
    const question = cleanText(interaction.fields.getTextInputValue("question"), 100);
    const options = ["option1", "option2", "option3", "option4"]
      .map((key) => interaction.fields.getTextInputValue(key).trim())
      .filter(Boolean)
      .map((value) => cleanText(value, 100));
    if (!question || options.length < 2 || new Set(options.map((value) => value.toLowerCase())).size !== options.length) {
      return interaction.editReply("Please provide a question and at least two different options.");
    }
    const embed = new EmbedBuilder()
      .setColor(COLOR)
      .setTitle(formatEmbedTitle("Poll"))
      .setDescription(`**${question}**\n\n${options.map((option, index) => `${CONFESSION_REACTIONS[index]}  ${option}`).join("\n")}\n\n*React to vote!*`);
    if (mode === "named") {
      embed.setAuthor({
        name: interaction.member?.displayName ?? interaction.user.username,
        iconURL: interaction.user.displayAvatarURL(),
      });
    }
    const message = await channel.send({
      content: recipientId ? `<@${recipientId}> ♡` : undefined,
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(reportButton("poll", "0"))],
      allowedMentions: { parse: [], users: recipientId ? [recipientId] : [] },
    });
    await message.edit({ components: [new ActionRowBuilder().addComponents(reportButton("poll", message.id))] });
    for (let index = 0; index < options.length; index += 1) {
      await message.react(CONFESSION_REACTIONS[index]);
    }
    await refreshConfessionsPanel();
    return interaction.editReply("Your poll has been published ♡");
  }

  const body = cleanText(interaction.fields.getTextInputValue("body"), 1800);
  if (!body) return interaction.editReply("Please write something before submitting.");
  const parts = id.split(":");
  const mode = parts[1];
  const anonymous = mode === "anonymous";
  if (!validMode(mode)) return interaction.editReply("Invalid publication option.");

  if (isConfession) {
    const recipientId = parts[2] && parts[2] !== "none" ? parts[2] : null;
    if (recipientId && !/^\d{17,20}$/.test(recipientId)) {
      return interaction.editReply("The selected mention is invalid.");
    }
    const number = store.nextNumber(`confessions:${expectedChannel}`);
    const serial = String(number).padStart(3, "0");
    const embed = new EmbedBuilder()
      .setColor(COLOR)
      .setTitle(formatEmbedTitle(`Confession #${serial}`))
      .setDescription(body);
    if (!anonymous) {
      embed.setAuthor({
        name: interaction.member?.displayName ?? interaction.user.username,
        iconURL: interaction.user.displayAvatarURL(),
      });
    }
    const content = recipientId ? `<@${recipientId}> ♡` : undefined;
    const allowedMentions = { parse: [], users: recipientId ? [recipientId] : [] };
    const message = await channel.send({
      content,
      embeds: [embed],
      components: buildCommunityPostComponents("confession", "0"),
      allowedMentions,
    });
    await message.edit({ components: buildCommunityPostComponents("confession", message.id) });
    await refreshConfessionsPanel();
    return interaction.editReply("Your confession has been published ♡");
  }

  if (isLetter) {
    const recipientId = parts[2];
    if (!/^\d{17,20}$/.test(recipientId ?? "")) {
      return interaction.editReply("Please select a recipient before writing your letter.");
    }
    const embed = new EmbedBuilder()
      .setColor(COLOR)
      .setTitle(formatEmbedTitle(`Love Letter #${String(store.nextNumber(`letters:${expectedChannel}`)).padStart(3, "0")}`))
      .setDescription(body);
    if (!anonymous) {
      embed.setAuthor({
        name: interaction.member?.displayName ?? interaction.user.username,
        iconURL: interaction.user.displayAvatarURL(),
      });
    }
    const mentions = anonymous ? [recipientId] : [interaction.user.id, recipientId];
    const content = anonymous ? `<@${recipientId}> ♡` : `<@${interaction.user.id}> & <@${recipientId}> ♡`;
    const message = await channel.send({
      content,
      embeds: [embed],
      components: buildCommunityPostComponents("letter", "0"),
      allowedMentions: { parse: [], users: [...new Set(mentions)] },
    });
    await message.edit({ components: buildCommunityPostComponents("letter", message.id) });
    await refreshLoveLettersPanel();
    return interaction.editReply("Your love letter has been published ♡");
  }

  return interaction.editReply("Invalid submission.");
}

async function publishCommunityThreadMessageReply(interaction, kind, mode, targetId) {
  const thread = interaction.channel;
  const target = await thread.messages.fetch(targetId).catch(() => null);
  if (!target || target.author?.id !== interaction.client.user.id ||
      !hasThreadReplyButton(target, kind, targetId)) {
    return interaction.editReply("This reply is no longer available.");
  }
  const body = cleanText(interaction.fields.getTextInputValue("body"), 1800);
  if (!body) return interaction.editReply("Please write a reply before submitting.");
  const replyName = mode === "named"
    ? (interaction.member?.displayName ?? interaction.user.globalName ?? interaction.user.username)
    : null;
  const targetName = target.embeds?.[0]?.author?.name ?? null;
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(formatEmbedTitle(mode === "anonymous" ? "Anonymous Reply" : "Reply"))
    .setDescription(formatReplyDescription(body, replyName, targetName));
  if (replyName) {
    embed.setAuthor({
      name: replyName,
      iconURL: interaction.user.displayAvatarURL(),
    });
  }
  const components = buildCommunityThreadReplyComponents(kind, "0");
  const reply = await thread.send({
    embeds: [embed],
    components,
    allowedMentions: { parse: [] },
  });
  await reply.edit({ components: buildCommunityThreadReplyComponents(kind, reply.id) }).catch((error) => {
    console.error(`[community] thread reply buttons could not be refreshed (reply=${reply.id}):`, error);
  });
  return interaction.editReply("Your reply has been added to the thread ♡");
}

function formatReplyDescription(body, replyName, targetName) {
  if (replyName && targetName) {
    return `**@${replyName} replied to @${targetName}**\\n\\n${body}`;
  }
  return body;
}

async function publishThreadReply(interaction, channel, kind, mode, parentId) {
  try {
  const parent = await channel.messages.fetch(parentId).catch(() => null);
  if (!parent) return interaction.editReply("The original post could not be found.");
  const expectedReplyId = `${PREFIX}reply:${kind}:${parentId}`;
  const hasMatchingReplyButton = parent.components.some((row) =>
    row.components.some((component) => component.customId === expectedReplyId),
  );
  if (parent.author?.id !== interaction.client.user.id || !hasMatchingReplyButton || !parent.embeds.length) {
    return interaction.editReply("This message is not a replyable community post.");
  }
  // Fetch even when Discord reports no active thread: an archived thread may
  // already exist for this message, and trying to create a second one fails.
  let thread;
  try {
    thread = await channel.threads.fetch(parent.id, { force: true });
  } catch (error) {
    // Discord reports an unknown channel when no thread exists for this message.
    if (error?.code !== 10003 && error?.code !== 10008) throw error;
    thread = null;
  }
  if (thread?.locked) await thread.setLocked(false, "Reopening community replies");
  if (thread?.archived) await thread.setArchived(false, "Reopening community replies");
  if (!thread) {
    const botMember = interaction.guild.members.me ?? await interaction.guild.members.fetchMe();
    const permissions = channel.permissionsFor(botMember);
    if (!permissions?.has(PermissionFlagsBits.CreatePublicThreads)) {
      return interaction.editReply("Sugar needs permission to create public reply threads in this channel.");
    }
    thread = await parent.startThread({
      name: `${kind === "confession" ? "Confession" : "Love Letter"} replies`,
      autoArchiveDuration: 1440,
      reason: "Community post replies",
    });
  }
  const botMember = interaction.guild.members.me ?? await interaction.guild.members.fetchMe();
  if (!thread.permissionsFor(botMember)?.has(PermissionFlagsBits.SendMessagesInThreads)) {
    return interaction.editReply("Sugar needs permission to send messages in reply threads.");
  }
  const replyBody = cleanText(interaction.fields.getTextInputValue("body"), 1800);
  if (!replyBody) return interaction.editReply("Please write a reply before submitting.");
  const replyName = mode === "named"
    ? (interaction.member?.displayName ?? interaction.user.globalName ?? interaction.user.username)
    : null;
  const parentName = parent.embeds?.[0]?.author?.name ?? null;
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(formatEmbedTitle(mode === "anonymous" ? "Anonymous Reply" : "Reply"))
    .setDescription(formatReplyDescription(replyBody, replyName, parentName));
  if (replyName) {
    embed.setAuthor({
      name: replyName,
      iconURL: interaction.user.displayAvatarURL(),
    });
  }
  const reply = await thread.send({
    embeds: [embed],
    components: buildCommunityThreadReplyComponents(kind, "0"),
    allowedMentions: { parse: [] },
  });
  await reply.edit({
    components: buildCommunityThreadReplyComponents(kind, reply.id),
  }).catch((error) => {
    // The reply is already published; a button refresh failure must not report
    // the whole publication as failed.
    console.error(`[community] reply report button update failed (reply=${reply.id}):`, error);
  });
  return interaction.editReply("Your reply has been added to the thread ♡");
  } catch (error) {
    console.error(`[community] reply publish failed (guild=${interaction.guildId}, channel=${channel.id}, parent=${parentId}, code=${error?.code ?? "unknown"}):`, error);
    if (error?.code === 50013) {
      return interaction.editReply("Sugar needs permission to create or reopen the reply thread and send messages in it. Please ask a moderator to check Create Public Threads, Send Messages in Threads, and Manage Threads permissions.");
    }
    return interaction.editReply("Sugar couldn't open the reply thread or send your reply. Please ask a moderator to check Sugar's thread permissions and try again.");
  }
}

function buildReportModal(kind, messageId) {
  const modal = new ModalBuilder()
    .setCustomId(`${PREFIX}report:${kind}:${messageId}`)
    .setTitle("Report Community Post");
  const reason = new TextInputBuilder()
    .setCustomId("reason")
    .setLabel("Why are you reporting this?")
    .setPlaceholder("Tell the moderation team what happened...")
    .setStyle(TextInputStyle.Paragraph)
    .setMinLength(5)
    .setMaxLength(500)
    .setRequired(true);
  modal.addComponents(new ActionRowBuilder().addComponents(reason));
  return modal;
}

function validReportKind(kind) {
  return ["confession", "letter", "poll", "confession-reply", "letter-reply", "suggestion"].includes(kind);
}

function reportChannelForKind(kind) {
  if (kind === "confession" || kind === "poll" || kind === "confession-reply") return CONFESSIONS_CHANNEL_ID;
  if (kind === "letter" || kind === "letter-reply") return LOVE_LETTERS_CHANNEL_ID;
  if (kind === "suggestion") return SUGGESTIONS_CHANNEL_ID;
  return null;
}

function isExpectedCommunityLocation(interaction, expectedChannelId) {
  return interaction.channelId === expectedChannelId || interaction.channel?.parentId === expectedChannelId;
}

function hasThreadReplyButton(message, kind, messageId) {
  const expectedId = `${PREFIX}thread-reply:${kind}:${messageId}`;
  return message?.components?.some((row) =>
    row.components.some((component) => component.customId === expectedId),
  ) ?? false;
}

function hasReportButton(message, kind, messageId) {
  const expectedId = `${PREFIX}report:${kind}:${messageId}`;
  return message?.components?.some((row) =>
    row.components.some((component) => component.customId === expectedId),
  ) ?? false;
}

async function getConfiguredReportsChannel(interaction, settings) {
  const configuredId = settings?.get(interaction.guildId)?.reportsChannelId;
  if (/^\d{17,20}$/.test(configuredId ?? "") &&
      ![CONFESSIONS_CHANNEL_ID, LOVE_LETTERS_CHANNEL_ID, SUGGESTIONS_CHANNEL_ID].includes(configuredId)) {
    const configured = await interaction.guild.channels.fetch(configuredId).catch(() => null);
    if (configured?.type === ChannelType.GuildText) {
      const everyone = configured.permissionsFor(interaction.guild.roles.everyone);
      if (everyone && !everyone.has(PermissionFlagsBits.ViewChannel)) return configured;
    }
  }

  const existing = interaction.guild.channels.cache.find((channel) => {
    if (channel.type !== ChannelType.GuildText || channel.name !== "moderation-reports") return false;
    const everyone = channel.permissionsFor(interaction.guild.roles.everyone);
    return everyone && !everyone.has(PermissionFlagsBits.ViewChannel);
  });
  if (existing) {
    if (settings && typeof settings.set === "function") {
      settings.set(interaction.guildId, {
        ...settings.get(interaction.guildId),
        reportsChannelId: existing.id,
      });
    }
    return existing;
  }
  return null;
}

async function createPrivateReportsChannel(interaction, settings) {
  const guild = interaction.guild;
  const botMember = guild.members.me ?? await guild.members.fetch(interaction.client.user.id).catch(() => null);
  if (!botMember?.permissions.has(PermissionFlagsBits.ManageChannels)) {
    throw new Error("Sugar needs Manage Channels permission to create the private reports channel.");
  }

  const viewPermissions = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.EmbedLinks,
    PermissionFlagsBits.ReadMessageHistory,
  ];
  const permissionOverwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: interaction.client.user.id,
      allow: [...viewPermissions, PermissionFlagsBits.ManageChannels],
    },
  ];
  const moderatorRoleIds = settings?.get(guild.id)?.moderatorRoleIds ?? [];
  for (const roleId of moderatorRoleIds) {
    if (guild.roles.cache.has(roleId)) {
      permissionOverwrites.push({ id: roleId, allow: viewPermissions });
    }
  }

  const channel = await guild.channels.create({
    name: guild.channels.cache.some((channel) => channel.name === "moderation-reports")
      ? "moderation-reports-private"
      : "moderation-reports",
    type: ChannelType.GuildText,
    topic: "Private reports submitted through Sugar's community buttons.",
    permissionOverwrites,
    reason: "Create a private channel for Sugar community reports",
  });
  if (!settings || typeof settings.set !== "function") {
    throw new Error("The server settings store is unavailable.");
  }
  settings.set(guild.id, {
    ...settings.get(guild.id),
    reportsChannelId: channel.id,
  });
  return channel;
}

function hasSuggestionButtons(message, messageId) {
  const expected = new Set([
    `${PREFIX}suggestion-vote:${messageId}:up`,
    `${PREFIX}suggestion-vote:${messageId}:down`,
    `${PREFIX}report:suggestion:${messageId}`,
  ]);
  const actual = new Set(message?.components?.flatMap((row) =>
    row.components.map((component) => component.customId),
  ) ?? []);
  return [...expected].every((id) => actual.has(id));
}

async function publishSuggestion(interaction, suggestionStore, refreshSuggestionsPanel) {
  const body = cleanText(interaction.fields.getTextInputValue("body"), 1800);
  if (body.length < 5) return interaction.editReply("Please write a little more before submitting.");
  const channel = await interaction.guild.channels.fetch(SUGGESTIONS_CHANNEL_ID).catch(() => null);
  if (!channel || channel.type !== ChannelType.GuildText) {
    return interaction.editReply("The Suggestions channel is unavailable.");
  }
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(formatEmbedTitle("Suggestion"))
    .setDescription(body)
    .setAuthor({
      name: interaction.member?.displayName ?? interaction.user.globalName ?? interaction.user.username,
      iconURL: interaction.user.displayAvatarURL(),
    })
    .addFields(
      { name: "↑ Upvotes", value: "0", inline: true },
      { name: "↓ Downvotes", value: "0", inline: true },
    )
    .setTimestamp();
  const message = await channel.send({
    embeds: [embed],
    components: buildSuggestionComponents("0"),
    allowedMentions: { parse: [] },
  });
  await message.edit({ components: buildSuggestionComponents(message.id) });
  await refreshSuggestionsPanel?.();
  return interaction.editReply("Your suggestion has been published ♡");
}

async function handleSuggestionVote(interaction, { suggestionStore, messageId, direction }) {
  if (!suggestionStore || typeof suggestionStore.vote !== "function") {
    return replyEphemeral(interaction, "Suggestion voting is temporarily unavailable.");
  }
  const counts = suggestionStore.vote(messageId, interaction.user.id, direction);
  const original = interaction.message.embeds[0];
  const embed = EmbedBuilder.from(original);
  embed.setFields((original.fields ?? []).map((field) => {
    if (field.name === "↑ Upvotes") return { ...field, value: String(counts.up) };
    if (field.name === "↓ Downvotes") return { ...field, value: String(counts.down) };
    return field;
  }));
  return interaction.update({ embeds: [embed], components: buildSuggestionComponents(messageId) });
}

async function submitCommunityReport(interaction, { reportKind, messageId, settings }) {
  if (!validReportKind(reportKind) || !/^\d{17,20}$/.test(messageId ?? "")) {
    return interaction.editReply("This report is invalid.");
  }
  const target = await interaction.channel.messages.fetch(messageId).catch(() => null);
  const validTargetButton = reportKind === "suggestion"
    ? hasSuggestionButtons(target, messageId)
    : hasReportButton(target, reportKind, messageId);
  if (!target || target.author?.id !== interaction.client.user.id || !validTargetButton) {
    return interaction.editReply("This post can no longer be reported.");
  }
  let reportChannel = await getConfiguredReportsChannel(interaction, settings);
  if (!reportChannel) {
    try {
      reportChannel = await createPrivateReportsChannel(interaction, settings);
    } catch (error) {
      console.error(`[community] could not prepare the private reports channel: ${error.message}`);
      return interaction.editReply("Sugar couldn't access a private reports channel. Please ask a moderator to give Sugar Manage Channels permission or configure a reports channel in the server settings.");
    }
  }
  const everyonePermissions = reportChannel.permissionsFor(interaction.guild.roles.everyone);
  if (!everyonePermissions || everyonePermissions.has(PermissionFlagsBits.ViewChannel)) {
    return interaction.editReply("The moderation reports channel must be private. Please ask a moderator to restrict @everyone access.");
  }
  const reason = cleanText(interaction.fields.getTextInputValue("reason"), 500);
  if (reason.length < 5) return interaction.editReply("Please provide a little more detail for the report.");
  const targetEmbed = target.embeds[0];
  const report = new EmbedBuilder()
    .setColor(0xef4444)
    .setTitle(formatEmbedTitle("Community Report"))
    .setDescription(reason)
    .addFields(
      { name: "Type", value: reportKind.replaceAll("-", " "), inline: true },
      { name: "Reported by", value: `<@${interaction.user.id}>`, inline: true },
      { name: "Reported post", value: `[Jump to message](https://discord.com/channels/${interaction.guildId}/${target.channelId}/${target.id})` },
      ...(targetEmbed?.title ? [{ name: "Post title", value: cleanText(targetEmbed.title, 200) }] : []),
      ...(targetEmbed?.description ? [{ name: "Post content", value: cleanText(targetEmbed.description, 900) }] : []),
    )
    .setTimestamp();
  await reportChannel.send({ embeds: [report], allowedMentions: { parse: [] } });
  return interaction.editReply("Your report has been sent privately to the moderation team. Thank you.");
}

function validReplyKind(kind) {
  return kind === "confession" || kind === "letter";
}

function cleanText(value, maxLength) {
  return String(value ?? "").trim().slice(0, maxLength);
}

async function replyEphemeral(interaction, content) {
  const payload = { content, ephemeral: true };
  if (interaction.deferred) return interaction.editReply(payload);
  if (interaction.replied) return interaction.followUp(payload);
  return interaction.reply(payload);
}
