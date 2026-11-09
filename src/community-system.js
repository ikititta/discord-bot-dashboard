import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  Events,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
} from "discord.js";

import { formatEmbedTitle } from "./embed-format.js";

export const CONFESSIONS_CHANNEL_ID = "1568179046209028106";
export const LOVE_LETTERS_CHANNEL_ID = "1568179044900409418";
const PREFIX = "sugar-community:";
const COLOR = 0xffd9ff;
const CONFESSION_PANEL_TITLE = "୨୧ 𝒄𝒐𝒏𝒇𝒆𝒔𝒔ions ♡";
const LOVE_PANEL_TITLE = "୨୧ Love Letters ♡";
const CONFESSION_REACTIONS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣"];

function button(id, label, style = ButtonStyle.Primary) {
  return new ButtonBuilder().setCustomId(`${PREFIX}${id}`).setLabel(label).setStyle(style);
}

export function buildConfessionsPanelPayload() {
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(CONFESSION_PANEL_TITLE)
    .setDescription("Share a confession or create a poll. Choose how you want your post to appear.");
  const row = new ActionRowBuilder().addComponents(
    button("confess:anonymous", "Submit a Confession ♡"),
    button("confess:named", "With My Name ♡", ButtonStyle.Secondary),
    button("poll", "Create a Poll ♡", ButtonStyle.Success),
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
  if (mode !== "anonymous" && mode !== "named") throw new Error("Invalid love letter mode.");
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

export function attachCommunitySystem(client, { store }) {
  if (!store || typeof store.nextNumber !== "function") {
    throw new Error("The community system requires a persistent community store.");
  }
  client.once(Events.ClientReady, () => {
    void ensureCommunityPanels(client).catch((error) => {
      console.error(`[community] panel setup failed: ${error.message}`);
    });
  });
  client.on(Events.InteractionCreate, (interaction) => {
    if (interaction.isButton() && interaction.customId.startsWith(PREFIX)) {
      void handleCommunityButton(interaction).catch(async (error) => {
        console.error(`[community] interaction failed: ${error.message}`);
        await replyEphemeral(interaction, "Something went wrong. Please try again.");
      });
    } else if (interaction.isUserSelectMenu() && interaction.customId.startsWith(`${PREFIX}letter-recipient:`)) {
      void handleLoveLetterRecipient(interaction).catch(async (error) => {
        console.error(`[community] recipient selection failed: ${error.message}`);
        await replyEphemeral(interaction, "Please choose a server member and try again.");
      });
    } else if (interaction.isModalSubmit() && interaction.customId.startsWith(PREFIX)) {
      void handleCommunityModal(interaction, { store }).catch(async (error) => {
        console.error(`[community] submission failed: ${error.message}`);
        await replyEphemeral(interaction, "Your post could not be published. Please try again.");
      });
    }
  });
}

export async function ensureCommunityPanels(client) {
  const confessions = await upsertPanel(client, CONFESSIONS_CHANNEL_ID, CONFESSION_PANEL_TITLE, buildConfessionsPanelPayload());
  const letters = await upsertPanel(client, LOVE_LETTERS_CHANNEL_ID, LOVE_PANEL_TITLE, buildLoveLettersPanelPayload());
  return { confessions, letters };
}

async function upsertPanel(client, channelId, title, payload) {
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
    return existing;
  }
  const message = await channel.send(payload);
  try { await message.pin(); } catch (error) {
    console.error(`[community] panel posted in ${channelId} but could not be pinned: ${error.message}`);
  }
  return message;
}

async function handleCommunityButton(interaction) {
  const [kind, mode] = interaction.customId.slice(PREFIX.length).split(":");
  const expectedChannel = kind === "confess" || kind === "poll"
    ? CONFESSIONS_CHANNEL_ID
    : kind === "letter" ? LOVE_LETTERS_CHANNEL_ID : null;
  if (!expectedChannel || !interaction.inGuild() || interaction.channelId !== expectedChannel) {
    return replyEphemeral(interaction, "Please use the panel in its designated channel.");
  }

  if (kind === "poll") return interaction.showModal(buildPollModal());
  if (kind === "letter") return interaction.reply(buildLoveLetterRecipientPicker(mode));

  const modal = new ModalBuilder()
    .setCustomId(`${PREFIX}confess:${mode}`)
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
  return interaction.showModal(modal);
}

async function handleLoveLetterRecipient(interaction) {
  if (!interaction.inGuild() || interaction.channelId !== LOVE_LETTERS_CHANNEL_ID) {
    return replyEphemeral(interaction, "Please use the Love Letters panel in its designated channel.");
  }
  const mode = interaction.customId.slice(`${PREFIX}letter-recipient:`.length);
  if (mode !== "anonymous" && mode !== "named") return replyEphemeral(interaction, "Invalid publication option.");
  const recipientId = interaction.values[0];
  if (!recipientId) return replyEphemeral(interaction, "Please choose someone first.");
  const member = await interaction.guild.members.fetch(recipientId).catch(() => null);
  if (!member) return replyEphemeral(interaction, "That user is not available in this server.");
  return interaction.showModal(buildLoveLetterModal(mode, recipientId));
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

function buildPollModal() {
  const modal = new ModalBuilder().setCustomId(`${PREFIX}poll`).setTitle("Create a Poll");
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

async function handleCommunityModal(interaction, { store }) {
  if (!interaction.inGuild()) return replyEphemeral(interaction, "This feature is only available in the server.");
  const id = interaction.customId.slice(PREFIX.length);
  const isPoll = id === "poll";
  const isConfession = id.startsWith("confess:");
  const isLetter = id.startsWith("letter:");
  const expectedChannel = isConfession || isPoll ? CONFESSIONS_CHANNEL_ID : isLetter ? LOVE_LETTERS_CHANNEL_ID : null;
  if (!expectedChannel || interaction.channelId !== expectedChannel) {
    return replyEphemeral(interaction, "Please submit this from the correct channel panel.");
  }

  await interaction.deferReply({ ephemeral: true });
  const channel = await interaction.guild.channels.fetch(expectedChannel);
  if (!channel || channel.type !== ChannelType.GuildText) {
    return interaction.editReply("The publication channel is unavailable.");
  }

  if (isPoll) {
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
      .setTitle(formatEmbedTitle("Community Poll"))
      .setDescription(`**${question}**\\n\\n${options.map((option, index) => `${CONFESSION_REACTIONS[index]}  ${option}`).join("\\n")}\\n\\n*React to vote!* `)
      .setFooter({ text: `Created by ${interaction.user.username}` });
    const message = await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
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
  if (mode !== "anonymous" && mode !== "named") return interaction.editReply("Invalid publication option.");

  if (isConfession) {
    const number = store.nextNumber(`confessions:${expectedChannel}`);
    const serial = String(number).padStart(3, "0");
    const title = anonymous ? `Anonymous Confession #(${serial})` : `Confession #(${serial})`;
    const embed = new EmbedBuilder().setColor(COLOR).setTitle(formatEmbedTitle(title)).setDescription(body);
    if (!anonymous) embed.setAuthor({ name: interaction.member?.displayName ?? interaction.user.username, iconURL: interaction.user.displayAvatarURL() });
    await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
    return interaction.editReply("Your confession has been published ♡");
  }

  if (isLetter) {
    const recipientId = parts[2];
    if (!/^\\d{17,20}$/.test(recipientId ?? "")) return interaction.editReply("Please select a recipient before writing your letter.");
    const embed = new EmbedBuilder()
      .setColor(COLOR)
      .setTitle(formatEmbedTitle("Love Letter"))
      .setDescription(body);
    if (!anonymous) embed.setAuthor({ name: interaction.member?.displayName ?? interaction.user.username, iconURL: interaction.user.displayAvatarURL() });
    await channel.send({
      content: `<@${recipientId}>`,
      embeds: [embed],
      allowedMentions: { parse: [], users: [recipientId] },
    });
    return interaction.editReply("Your love letter has been published ♡");
  }
  return interaction.editReply("Invalid submission.");
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
