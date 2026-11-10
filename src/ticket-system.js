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
} from "discord.js";

import { formatEmbedTitle } from "./embed-format.js";

export const TICKET_PANEL_CHANNEL_ID = "1568492748732895313";
export const SUGGESTIONS_CHANNEL_ID = "1569164719309328455";
const PREFIX = "sugar-ticket:";
const PANEL_TITLE = formatEmbedTitle("Support");
const LEGACY_PANEL_TITLE = formatEmbedTitle("Kittisugar Support");
const PANEL_COLOR = 0xffd9ff;
const TICKET_CATEGORIES = new Map([
  ["general", "General"],
  ["report", "Report"],
  ["appeal", "Appeal"],
  ["partnership", "Partnership"],
  ["apply", "Apply"],
  ["error", "Error"],
  ["other", "Others"],
]);
const TICKET_BUTTON_STYLES = new Map([
  ["general", ButtonStyle.Primary],
  ["report", ButtonStyle.Danger],
  ["appeal", ButtonStyle.Danger],
  ["partnership", ButtonStyle.Success],
  ["apply", ButtonStyle.Success],
  ["error", ButtonStyle.Danger],
  ["other", ButtonStyle.Secondary],
]);
const MEMBER_PERMISSIONS = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.AttachFiles,
  PermissionFlagsBits.EmbedLinks,
];

export function buildTicketPanelPayload() {
  const embed = new EmbedBuilder()
    .setColor(PANEL_COLOR)
    .setTitle(PANEL_TITLE)
    .setDescription(
      "Need help with something? Choose the option that best matches your request to open a private ticket with our team.\n\n" +
      "**General Help** — Questions or general assistance.\n" +
      "**Report** — Report a user, message, or rule violation.\n" +
      "**Partnership** — Collaboration and server partnership inquiries.\n" +
      "**Apply** — Apply to become a member of our staff team.\n" +
      "**Appeal** — Appeal a warning, punishment, or restriction.\n" +
      "**Error** — Report bugs, errors, or technical problems.\n" +
      "**Others** — Requests that don't fit the other categories.\n\n" +
      `Have a suggestion? Share it in <#${SUGGESTIONS_CHANNEL_ID}>!`,
    );

  const buttons = [...TICKET_CATEGORIES].map(([value, label]) =>
    new ButtonBuilder()
      .setCustomId(`${PREFIX}category:${value}`)
      .setLabel(`${label} ♡`)
      .setStyle(TICKET_BUTTON_STYLES.get(value)),
  );
  const rows = [
    new ActionRowBuilder().addComponents(...buttons.slice(0, 5)),
    new ActionRowBuilder().addComponents(...buttons.slice(5)),
  ];

  return { embeds: [embed], components: rows };
}

export function buildTicketCreatedPayload(userId, category = "General Help") {
  const embed = new EmbedBuilder()
    .setColor(PANEL_COLOR)
    .setTitle(formatEmbedTitle("Support Ticket"))
    .setDescription(
      `Hello <@${userId}>! Your ticket is open. Please explain what you need help with and a moderator will assist you soon.\n\n` +
      `Category: **${category}**\nPlease keep all relevant details in this channel.`,
    );
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${PREFIX}close`)
      .setLabel("Close Ticket")
      .setStyle(ButtonStyle.Danger),
  );
  return { embeds: [embed], components: [row], allowedMentions: { parse: [], users: [userId] } };
}

export function buildTicketPermissionOverwrites({ guild, openerId, moderatorRoleIds, botId }) {
  const overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: openerId, allow: MEMBER_PERMISSIONS },
    {
      id: botId,
      allow: [...MEMBER_PERMISSIONS, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageMessages],
    },
  ];
  const staffRoleIds = new Set(moderatorRoleIds);
  for (const role of guild.roles.cache.values()) {
    if (role.permissions.has(PermissionFlagsBits.ManageChannels) || role.permissions.has(PermissionFlagsBits.ManageMessages)) {
      staffRoleIds.add(role.id);
    }
  }
  for (const roleId of staffRoleIds) {
    if (guild.roles.cache.has(roleId)) {
      overwrites.push({
        id: roleId,
        allow: [...MEMBER_PERMISSIONS, PermissionFlagsBits.ManageMessages],
      });
    }
  }
  return overwrites;
}

/** Attach the support-ticket panel and private ticket interactions to Sugar. */
export function attachTicketSystem(client, { settings, stickyPanels, panelChannelId = TICKET_PANEL_CHANNEL_ID }) {
  if (!settings) throw new Error("The ticket system requires the server settings store.");

  // The Help panel is a regular, static message: it is created or updated
  // once on startup and never moved, reposted, or recreated after member messages.
  client.once(Events.ClientReady, () => {
    void ensureTicketPanel(client, panelChannelId).catch((error) => {
      console.error(`[tickets] panel setup failed: ${error.message}`);
    });
  });

  client.on(Events.InteractionCreate, (interaction) => {
    if (interaction.isButton() && interaction.customId.startsWith(PREFIX)) {
      void handleTicketButton(interaction, { client, settings, panelChannelId }).catch(async (error) => {
        console.error(`[tickets] interaction failed: ${error.message}`);
        await replyEphemeral(interaction, error.message || "The ticket action failed. Please try again.");
      });
    } else if (interaction.isModalSubmit() && interaction.customId.startsWith(`${PREFIX}reason:`)) {
      void createTicketFromModal(interaction, { client, settings, panelChannelId }).catch(async (error) => {
        console.error(`[tickets] creation failed: ${error.message}`);
        await replyEphemeral(interaction, error.message || "The ticket could not be created. Please try again.");
      });
    }
  });
}

export async function ensureTicketPanel(client, panelChannelId = TICKET_PANEL_CHANNEL_ID) {
  const channel = await client.channels.fetch(panelChannelId);
  if (!channel || channel.type !== ChannelType.GuildText) {
    throw new Error(`Ticket panel channel ${panelChannelId} is not an accessible text channel.`);
  }

  const recent = await channel.messages.fetch({ limit: 50 });
  const existing = recent.find((message) =>
    message.author.id === client.user.id &&
    message.embeds.some((embed) => embed.title === PANEL_TITLE || embed.title === LEGACY_PANEL_TITLE),
  );
  if (existing) {
    await existing.edit(buildTicketPanelPayload());
    if (existing.pinned) await existing.unpin().catch((error) => {
      console.error(`[tickets] panel could not be unpinned: ${error.message}`);
    });
    return existing;
  }
  return channel.send(buildTicketPanelPayload());
}

async function handleTicketButton(interaction, { client, settings, panelChannelId }) {
  const action = interaction.customId.slice(PREFIX.length);
  if (action.startsWith("category:")) {
    return handleTicketCategory(interaction, panelChannelId, action.slice("category:".length));
  }
  if (action === "close") {
    if (!interaction.inGuild() || interaction.channel?.type !== ChannelType.GuildText) {
      return replyEphemeral(interaction, "This action is only available inside a ticket.");
    }
    const ticket = parseTicketTopic(interaction.channel.topic);
    if (!ticket || ticket.guildId !== interaction.guildId) {
      return replyEphemeral(interaction, "This channel is not an active Sugar support ticket.");
    }
    const config = settings.get(interaction.guildId);
    const isModerator = hasTicketStaffAccess(interaction.member, config.moderatorRoleIds);
    if (interaction.user.id !== ticket.openerId && !isModerator) {
      return replyEphemeral(interaction, "Only the ticket opener or a moderator can close this ticket.");
    }
    await interaction.deferReply({ ephemeral: true });
    await interaction.channel.permissionOverwrites.edit(ticket.openerId, {
      ViewChannel: false,
      SendMessages: false,
    });
    await interaction.channel.setTopic(`${PREFIX}closed:${ticket.openerId}:${ticket.guildId}`);
    await interaction.channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(PANEL_COLOR)
          .setTitle(formatEmbedTitle("Ticket Closed"))
          .setDescription(`This ticket was closed by <@${interaction.user.id}>. The channel is now read-only for the opener.`),
      ],
      allowedMentions: { parse: [] },
    });
    return interaction.editReply("Ticket closed. The channel has been locked.");
  }
}

async function handleTicketCategory(interaction, panelChannelId, category) {
  if (!interaction.inGuild() || interaction.channelId !== panelChannelId) return replyEphemeral(interaction, `Open tickets in <#${panelChannelId}>.`);
  const label = TICKET_CATEGORIES.get(category);
  if (!label) return replyEphemeral(interaction, "Please choose a valid ticket category.");
  const modal = new ModalBuilder().setCustomId(`${PREFIX}reason:${category}`).setTitle(label.slice(0, 45));
  const reason = new TextInputBuilder().setCustomId("reason").setLabel("How can our team help?")
    .setPlaceholder("Describe your question, issue, or appeal...").setStyle(TextInputStyle.Paragraph)
    .setMinLength(10).setMaxLength(1000).setRequired(true);
  modal.addComponents(new ActionRowBuilder().addComponents(reason));
  return interaction.showModal(modal);
}

async function createTicketFromModal(interaction, { client, settings, panelChannelId }) {
  if (!interaction.inGuild() || interaction.channelId !== panelChannelId) {
    return replyEphemeral(interaction, `Please open tickets in <#${panelChannelId}>.`);
  }
  await interaction.deferReply({ ephemeral: true });
  const guild = interaction.guild;
  const categoryKey = interaction.customId.slice(`${PREFIX}reason:`.length);
  const category = TICKET_CATEGORIES.get(categoryKey);
  if (!category) return interaction.editReply("Please choose a valid ticket category.");
  const reason = interaction.fields.getTextInputValue("reason").trim();
  if (reason.length < 10 || reason.length > 1000) {
    return interaction.editReply("Please provide at least 10 characters describing your request.");
  }

  await guild.channels.fetch();
  const existing = guild.channels.cache.find((channel) => {
    const ticket = parseTicketTopic(channel.topic);
    return channel.type === ChannelType.GuildText && ticket?.openerId === interaction.user.id && ticket.guildId === guild.id;
  });
  if (existing) return interaction.editReply(`You already have an open ticket: <#${existing.id}>.`);

  const config = settings.get(guild.id);
  const moderatorRoleIds = Array.isArray(config.moderatorRoleIds) ? config.moderatorRoleIds : [];
  const panelChannel = await client.channels.fetch(panelChannelId);
  const safeName = String(interaction.user.username ?? "member")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "member";

  const channel = await guild.channels.create({
    name: `ticket-${categoryKey}-${safeName}`.slice(0, 90),
    type: ChannelType.GuildText,
    parent: panelChannel.parentId ?? undefined,
    topic: `${PREFIX}open:${interaction.user.id}:${guild.id}`,
    permissionOverwrites: buildTicketPermissionOverwrites({
      guild,
      openerId: interaction.user.id,
      moderatorRoleIds,
      botId: client.user.id,
    }),
    reason: `Support ticket opened by ${interaction.user.id}`,
  });

  try {
    await channel.send({
      ...buildTicketCreatedPayload(interaction.user.id, category),
      content: `<@${interaction.user.id}>\n${reason}`,
    });
  } catch (error) {
    await channel.delete("Ticket setup failed; cleaning up the incomplete ticket").catch(() => {});
    throw error;
  }
  return interaction.editReply(`Your private ticket is ready: <#${channel.id}>.`);
}

function parseTicketTopic(topic) {
  const match = /^(sugar-ticket:)(open|closed):(\d{5,25}):(\d{5,25})$/.exec(String(topic ?? ""));
  if (!match) return null;
  return { status: match[2], openerId: match[3], guildId: match[4] };
}

function hasTicketStaffAccess(member, moderatorRoleIds) {
  if (member?.permissions?.has(PermissionFlagsBits.ManageChannels) ||
      member?.permissions?.has(PermissionFlagsBits.Administrator)) return true;
  const roles = member?.roles?.cache;
  return Boolean(roles && moderatorRoleIds.some((roleId) => roles.has(roleId)));
}

async function replyEphemeral(interaction, content) {
  const payload = { content, ephemeral: true };
  if (interaction.deferred) return interaction.editReply(payload);
  if (interaction.replied) return interaction.followUp(payload);
  return interaction.reply(payload);
}
