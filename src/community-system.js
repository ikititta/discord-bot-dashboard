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

import { formatEmbedTitle, toRoyalBold } from "./embed-format.js";
import { attachStickyPanel } from "./sticky-panels.js";

export const CONFESSIONS_CHANNEL_ID = "1568179046209028106";
export const LOVE_LETTERS_CHANNEL_ID = "1568179044900409418";
export const SUGGESTIONS_CHANNEL_ID = "1569164719309328455";
export const REPORTS_CHANNEL_ID = "1569479283133382787";
export const REPORT_NOTIFICATION_ROLE_IDS = [
  "1567796193268858950",
  "1568188570890403910",
  "1568188595171500123",
];
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
  if (!validReplyKind(kind) || !/^(?:0|\d{17,20})$/.test(messageId ?? "")) {
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
    .setDescription("Have an idea to make the server better? Share it with everyone. Suggestions can receive upvotes and downvotes from the community ♡");
  return {
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(
      button("suggestion-start", "Submit a Suggestion ♡"),
    )],
  };
}

export function buildSuggestionComponents() {
  return [];
}

export function buildSuggestionModePicker() {
  return {
    content: "Would you like to publish anonymously or with your name?",
    components: [new ActionRowBuilder().addComponents(
      button("suggestion-mode:anonymous", "Anonymously ♡", ButtonStyle.Secondary),
      button("suggestion-mode:named", "With My Name ♡", ButtonStyle.Primary),
    )],
    ephemeral: true,
  };
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
  if (stickyPanels) {
    const legacyPanelMessageId = stickyPanels.get("suggestences");
    if (legacyPanelMessageId && !stickyPanels.get("suggestions")) {
      stickyPanels.set("suggestions", legacyPanelMessageId);
    }
    if (legacyPanelMessageId) stickyPanels.set("suggestences", null);
    attachStickyPanel(client, {
      store: stickyPanels,
      key: "confessions",
      channelId: CONFESSIONS_CHANNEL_ID,
      titles: [CONFESSION_PANEL_TITLE],
      buildPayload: buildConfessionsPanelPayload,
      pinOnCreate: false,
      logger: "community",
    });
    attachStickyPanel(client, {
      store: stickyPanels,
      key: "love-letters",
      channelId: LOVE_LETTERS_CHANNEL_ID,
      titles: [LOVE_PANEL_TITLE],
      buildPayload: buildLoveLettersPanelPayload,
      pinOnCreate: false,
      logger: "community",
    });
    client.once(Events.ClientReady, () => {
      void renameSuggestionsChannel(client).catch((error) => {
        console.error(`[community] suggestions channel rename failed: ${error.message}`);
      });
    });
    attachStickyPanel(client, {
      store: stickyPanels,
      key: "suggestions",
      channelId: SUGGESTIONS_CHANNEL_ID,
      titles: [SUGGESTIONS_PANEL_TITLE, LEGACY_SUGGESTIONS_PANEL_TITLE],
      buildPayload: buildSuggestionsPanelPayload,
      pinOnCreate: false,
      logger: "community",
    });
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
        store, settings, suggestionStore,
      }).catch(async (error) => {
        console.error("[community] submission failed:", error);
        await replyEphemeral(interaction, "Sugar couldn't publish that reply. Please try again, or contact a moderator if it keeps happening.");
      });
    }
  });
  client.on(Events.MessageReactionAdd, (reaction, user) => {
    void handleSuggestionReaction(reaction, user, { suggestionStore, settings }, true).catch((error) => {
      console.error(`[community] suggestion reaction add failed: ${error.message}`);
    });
  });
  client.on(Events.MessageReactionRemove, (reaction, user) => {
    void handleSuggestionReaction(reaction, user, { suggestionStore, settings }, false).catch((error) => {
      console.error(`[community] suggestion reaction remove failed: ${error.message}`);
    });
  });
}

async function renameSuggestionsChannel(client) {
  const channel = await client.channels.fetch(SUGGESTIONS_CHANNEL_ID).catch(() => null);
  if (!channel || channel.type !== ChannelType.GuildText) return;

  // Migrate older suggestion posts from buttons to native Discord reactions.
  await migrateSuggestionReactions(channel, client.user?.id);
}

export async function ensureCommunityPanels(client) {
  const confessions = await upsertPanel(client, CONFESSIONS_CHANNEL_ID, CONFESSION_PANEL_TITLE, buildConfessionsPanelPayload(), { pinOnCreate: false });
  const letters = await upsertPanel(client, LOVE_LETTERS_CHANNEL_ID, LOVE_PANEL_TITLE, buildLoveLettersPanelPayload(), { pinOnCreate: false });
  const suggestionsChannel = await client.channels.fetch(SUGGESTIONS_CHANNEL_ID).catch(() => null);
  if (suggestionsChannel?.type === ChannelType.GuildText) {
    await migrateSuggestionReactions(suggestionsChannel, client.user?.id);
  }
  const suggestions = await upsertPanel(client, SUGGESTIONS_CHANNEL_ID, SUGGESTIONS_PANEL_TITLE, buildSuggestionsPanelPayload(), {
    pinOnCreate: false,
    legacyTitles: [LEGACY_SUGGESTIONS_PANEL_TITLE],
  });
  return { confessions, letters, suggestions };
}

async function upsertPanel(client, channelId, title, payload, { pinOnCreate = true, legacyTitles = [] } = {}) {
  const channel = await client.channels.fetch(channelId);
  if (!channel || channel.type !== ChannelType.GuildText) {
    throw new Error(`Community panel channel ${channelId} is not an accessible text channel.`);
  }
  const recent = await channel.messages.fetch({ limit: 50 });
  const existing = recent.find((message) =>
    message.author.id === client.user.id && message.embeds.some((embed) => [title, ...legacyTitles].includes(embed.title)),
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
    return interaction.reply(buildSuggestionModePicker());
  }

  if (id.startsWith("suggestion-mode:")) {
    const mode = id.slice("suggestion-mode:".length);
    if (!validMode(mode) || !interaction.inGuild() || interaction.channelId !== SUGGESTIONS_CHANNEL_ID) {
      return replyEphemeral(interaction, "Please choose a valid publication option.");
    }
    return interaction.showModal(buildSuggestionModal(mode));
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
    if (!validReplyKind(kind) || !/^\d{17,20}$/.test(messageId ?? "") ||
        interaction.message?.id !== messageId || !interaction.inGuild() ||
        !isPublicRepliesChannel(interaction.channel, kind) ||
        !hasThreadReplyButton(interaction.message, kind, messageId)) {
      return replyEphemeral(interaction, "This reply button is no longer valid.");
    }
    return interaction.reply(buildThreadReplyModePicker(kind, messageId));
  }

  if (id.startsWith("thread-reply-mode:")) {
    const [, kind, mode, messageId] = id.split(":");
    if (!validReplyKind(kind) || !validMode(mode) || !/^\d{17,20}$/.test(messageId ?? "") ||
        !interaction.inGuild() || !isPublicRepliesChannel(interaction.channel, kind)) {
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

function buildSuggestionModal(mode) {
  if (!validMode(mode)) throw new Error("Invalid suggestion publication mode.");
  const modal = new ModalBuilder()
    .setCustomId(`${PREFIX}suggestion:submit:${mode}`)
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

async function handleCommunityModal(interaction, { store, settings, suggestionStore }) {
  if (!interaction.inGuild()) return replyEphemeral(interaction, "This feature is only available in the server.");
  const id = interaction.customId.slice(PREFIX.length);
  const isPoll = id.startsWith("poll:");
  const isConfession = id.startsWith("confess:");
  const isLetter = id.startsWith("letter:");
  const isSuggestion = id.startsWith("suggestion:submit:");
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
    isPublicRepliesChannel(interaction.channel, threadReplyKind);
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
    const mode = id.split(":")[2];
    if (!validMode(mode)) return interaction.editReply("Invalid suggestion publication option.");
    return publishSuggestion(interaction, suggestionStore, mode);
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
      .setTitle(formatEmbedTitle(anonymous ? `Anonymous Confession #(${serial})` : `Confession #(${serial})`))
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
    return interaction.editReply("Your love letter has been published ♡");
  }

  return interaction.editReply("Invalid submission.");
}

async function publishCommunityThreadMessageReply(interaction, kind, mode, targetId) {
  const repliesChannel = interaction.channel;
  const target = await repliesChannel.messages.fetch(targetId).catch(() => null);
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
  const reply = await repliesChannel.send({
    embeds: [embed],
    components,
    allowedMentions: { parse: [] },
  });
  await reply.edit({ components: buildCommunityThreadReplyComponents(kind, reply.id) }).catch((error) => {
    console.error(`[community] thread reply buttons could not be refreshed (reply=${reply.id}):`, error);
  });
  return interaction.editReply("Your reply has been added ♡");
}

export function formatReplyDescription(body, replyName, targetName) {
  if (replyName && targetName) {
    return `**@${replyName} replied to @${targetName}**\n\n${body}`;
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
    const serial = /#\(?([0-9]{3})\)?/.exec(parent.embeds[0].title ?? "")?.[1];
    if (!serial) return interaction.editReply("The original post number could not be identified.");
    const topic = `sugar-community-replies:${kind}:${parentId}`;
    let repliesChannel = interaction.guild.channels.cache.find((item) =>
      item.type === ChannelType.GuildText && item.topic === topic,
    );
    if (!repliesChannel) {
      await interaction.guild.channels.fetch();
      repliesChannel = interaction.guild.channels.cache.find((item) =>
        item.type === ChannelType.GuildText && item.topic === topic,
      );
    }
    if (!repliesChannel) {
      const permissionOverwrites = [
        {
          id: interaction.guild.roles.everyone.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        },
        {
          id: interaction.client.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.ManageMessages,
          ],
        },
      ];
      repliesChannel = await interaction.guild.channels.create({
        name: buildCommunityRepliesChannelName(kind, serial),
        type: ChannelType.GuildText,
        ...(channel.parentId ? { parent: channel.parentId } : {}),
        topic,
        permissionOverwrites,
        reason: `Create public replies for ${kind} #${serial}`,
      });
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
    const reply = await repliesChannel.send({
      embeds: [embed],
      components: buildCommunityThreadReplyComponents(kind, "0"),
      allowedMentions: { parse: [] },
    });
    await reply.edit({
      components: buildCommunityThreadReplyComponents(kind, reply.id),
    }).catch((error) => {
      console.error(`[community] reply report button update failed (reply=${reply.id}):`, error);
    });
    return interaction.editReply(`Your reply has been added: <#${repliesChannel.id}> ♡`);
  } catch (error) {
    console.error(`[community] public reply channel failed (guild=${interaction.guildId}, channel=${channel.id}, parent=${parentId}, code=${error?.code ?? "unknown"}):`, error);
    if (error?.code === 50013) {
      return interaction.editReply("Sugar needs Manage Channels and permission to send messages in public replies channels. Please ask a moderator to check Sugar's permissions.");
    }
    return interaction.editReply("Sugar couldn't open the public replies channel or send your reply. Please try again or ask a moderator to check Sugar's permissions.");
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
  const kind = expectedChannelId === CONFESSIONS_CHANNEL_ID ? "confession"
    : expectedChannelId === LOVE_LETTERS_CHANNEL_ID ? "letter" : null;
  return interaction.channelId === expectedChannelId ||
    interaction.channel?.parentId === expectedChannelId ||
    (kind !== null && isPublicRepliesChannel(interaction.channel, kind));
}

function isPublicRepliesChannel(channel, kind) {
  return validReplyKind(kind) &&
    channel?.type === ChannelType.GuildText &&
    channel.topic?.startsWith(`sugar-community-replies:${kind}:`) === true;
}

export function buildCommunityRepliesChannelName(kind, serial) {
  if (!validReplyKind(kind) || !/^\d{3}$/.test(String(serial ?? ""))) {
    throw new Error("Invalid community replies channel name.");
  }
  const label = kind === "confession"
    ? `confession-${serial}-replies`
    : `love-letter-${serial}-replies`;
  const emoji = kind === "confession" ? "🤫" : "💌";
  return `${emoji}｜୨୧・${toRoyalBold(label)}`;
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
  const designatedReportsChannel = await interaction.guild.channels.fetch(REPORTS_CHANNEL_ID).catch(() => null);
  if (designatedReportsChannel?.type === ChannelType.GuildText) return designatedReportsChannel;

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
  const moderatorRoleIds = new Set([
    ...(settings?.get(guild.id)?.moderatorRoleIds ?? []),
    ...REPORT_NOTIFICATION_ROLE_IDS,
  ]);
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

function hasSuggestionReportButton(message, messageId) {
  return hasReportButton(message, "suggestion", messageId);
}

async function publishSuggestion(interaction, suggestionStore, mode) {
  if (!validMode(mode)) return interaction.editReply("Invalid suggestion publication option.");
  const body = cleanText(interaction.fields.getTextInputValue("body"), 1800);
  if (body.length < 5) return interaction.editReply("Please write a little more before submitting.");
  const channel = await interaction.guild.channels.fetch(SUGGESTIONS_CHANNEL_ID).catch(() => null);
  if (!channel || channel.type !== ChannelType.GuildText) {
    return interaction.editReply("The Suggestions channel is unavailable.");
  }
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(formatEmbedTitle("Suggestion"))
    .setDescription(body);
  if (mode === "named") {
    embed.setAuthor({
      name: interaction.member?.displayName ?? interaction.user.globalName ?? interaction.user.username,
      iconURL: interaction.user.displayAvatarURL(),
    });
  }
  const message = await channel.send({
    embeds: [embed],
    allowedMentions: { parse: [] },
  });
  await addSuggestionReactions(message);
  return interaction.editReply("Your suggestion has been published ♡");
}

async function handleSuggestionReaction(reaction, user, { suggestionStore, settings }, added) {
  if (user?.bot) return;
  if (reaction.partial) await reaction.fetch();
  const message = reaction.message;
  if (message.partial) await message.fetch();
  if (!message.guild || message.channelId !== SUGGESTIONS_CHANNEL_ID ||
      message.author?.id !== message.client.user?.id || !isSuggestionMessage(message)) return;
  const emoji = reaction.emoji.name;
  const direction = emoji === "⬆️" ? "up" : emoji === "⬇️" ? "down" : null;
  if (direction && suggestionStore) {
    if (added) {
      suggestionStore.setVote(message.id, user.id, direction);
      const oppositeEmoji = direction === "up" ? "⬇️" : "⬆️";
      const opposite = message.reactions.cache.find((item) => item.emoji.name === oppositeEmoji);
      if (opposite) await opposite.users.remove(user.id).catch((error) => {
        console.warn(`[community] could not remove a member's previous suggestion vote: ${error.message}`);
      });
    } else {
      suggestionStore.removeVote(message.id, user.id, direction);
    }
    return;
  }
  if (emoji === "⚠️" && added) await sendSuggestionReactionReport(message, user, settings);
}

async function addSuggestionReactions(message) {
  for (const emoji of ["⬆️", "⬇️", "⚠️"]) {
    const existing = message.reactions?.cache?.find((item) => item.emoji.name === emoji);
    if (!existing) await message.react(emoji);
  }
}

async function migrateSuggestionReactions(channel, botUserId) {
  const recent = await channel.messages.fetch({ limit: 100 });
  for (const message of recent.values()) {
    if (message.author?.id !== botUserId || !isSuggestionMessage(message)) continue;
    if (message.components?.length) {
      await message.edit({ components: [] }).catch((error) => {
        console.error(`[community] could not remove old suggestion buttons for ${message.id}: ${error.message}`);
      });
    }
    await addSuggestionReactions(message).catch((error) => {
      console.error(`[community] could not add suggestion reactions for ${message.id}: ${error.message}`);
    });
  }
}

async function sendSuggestionReactionReport(message, user, settings) {
  const guild = message.guild;
  const context = { guild, guildId: guild.id, client: message.client };
  let reportChannel = await getConfiguredReportsChannel(context, settings);
  if (!reportChannel) {
    try {
      reportChannel = await createPrivateReportsChannel(context, settings);
    } catch (error) {
      console.error("[community] suggestion report could not access a private reports channel: " + error.message);
      return;
    }
  }
  const everyone = reportChannel.permissionsFor(guild.roles.everyone);
  if (!everyone || everyone.has(PermissionFlagsBits.ViewChannel)) {
    console.warn("[community] suggestion reaction report channel is not private; report was not forwarded.");
    return;
  }
  const embed = new EmbedBuilder()
    .setColor(0xef4444)
    .setTitle(formatEmbedTitle("Suggestion Report"))
    .setDescription("A member reported this suggestion using the ⚠️ reaction.")
    .addFields(
      { name: "Reported by", value: `<@${user.id}>`, inline: true },
      { name: "Reported post", value: `[Jump to suggestion](https://discord.com/channels/${guild.id}/${message.channelId}/${message.id})` },
      ...(message.embeds?.[0]?.description ? [{ name: "Suggestion", value: cleanText(message.embeds[0].description, 900) }] : []),
    )
    .setTimestamp();
  await reportChannel.send(buildReportNotificationPayload(embed));
}

function isSuggestionMessage(message) {
  const embed = message.embeds?.[0];
  const fields = embed?.fields ?? [];
  return embed?.title === formatEmbedTitle("Suggestion") ||
    (fields.some((field) => field.name === "⬆️ Upvotes") &&
     fields.some((field) => field.name === "⬇️ Downvotes"));
}

async function handleSuggestionVote(interaction, { suggestionStore, messageId, direction }) {
  if (!suggestionStore || typeof suggestionStore.vote !== "function") {
    return replyEphemeral(interaction, "Suggestion voting is temporarily unavailable.");
  }
  const counts = suggestionStore.vote(messageId, interaction.user.id, direction);
  const original = interaction.message.embeds[0];
  const embed = EmbedBuilder.from(original);
  embed.setFields((original.fields ?? []).map((field) => {
    if (field.name === "↑ Upvotes" || field.name === "⬆️ Upvotes") {
      return { ...field, name: "⬆️ Upvotes", value: String(counts.up) };
    }
    if (field.name === "↓ Downvotes" || field.name === "⬇️ Downvotes") {
      return { ...field, name: "⬇️ Downvotes", value: String(counts.down) };
    }
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
    ? hasSuggestionReportButton(target, messageId)
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
  await reportChannel.send(buildReportNotificationPayload(report));
  return interaction.editReply("Your report has been sent privately to the moderation team. Thank you.");
}

export function buildReportNotificationPayload(embed) {
  return {
    content: REPORT_NOTIFICATION_ROLE_IDS.map((roleId) => `<@&${roleId}>`).join(" "),
    embeds: [embed],
    allowedMentions: { parse: [], roles: REPORT_NOTIFICATION_ROLE_IDS },
  };
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
