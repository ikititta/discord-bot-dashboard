import {
  ActionRowBuilder,
  AttachmentBuilder,
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
} from "discord.js";

import { formatEmbedTitle } from "./embed-format.js";
import { startRoleOnboarding } from "./role-onboarding.js";

export const TICKET_PANEL_CHANNEL_ID = "1568492748732895313";
export const SUGGESTIONS_CHANNEL_ID = "1569164719309328455";
export const TICKET_CATEGORY_ID = "1569529041017503784";
export const TICKET_TRANSCRIPTS_CHANNEL_ID = "1569529377102766131";
const PREFIX = "sugar-ticket:";
const PANEL_TITLE = formatEmbedTitle("Support");
const LEGACY_PANEL_TITLE = formatEmbedTitle("Kittisugar Support");
const PANEL_COLOR = 0xffd9ff;
const TICKET_CATEGORIES = new Map([
  ["general", "General"],
  ["buy-vip", "Buy VIP"],
  ["partnership", "Partnership"],
  ["apply", "Apply"],
  ["report", "Report"],
  ["appeal", "Appeal"],
  ["error", "Error"],
  ["other", "Others"],
]);
const TICKET_BUTTON_STYLES = new Map([
  ["general", ButtonStyle.Primary],
  ["buy-vip", ButtonStyle.Primary],
  ["partnership", ButtonStyle.Success],
  ["apply", ButtonStyle.Success],
  ["report", ButtonStyle.Danger],
  ["appeal", ButtonStyle.Danger],
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
      "**General** — Questions or general assistance.\n" +
      "**Buy VIP** — Questions about purchasing VIP or getting VIP access.\n" +
      "**Partnership** — Collaboration and server partnership inquiries.\n" +
      "**Apply** — Apply to become a member of our staff team.\n" +
      "**Get Verified** — Complete the verification steps to unlock member access to the server.\n" +
      "**Report** — Report a user, message, or rule violation.\n" +
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
  buttons.splice(4, 0,
    new ButtonBuilder()
      .setCustomId(`${PREFIX}get-verified`)
      .setLabel("Get Verified ♡")
      .setStyle(ButtonStyle.Success),
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
      `Category: **${category}**`,
    );
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${PREFIX}close`)
      .setLabel("Close Ticket ♡")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`${PREFIX}add-people`)
      .setLabel("Add People ♡")
      .setStyle(ButtonStyle.Primary),
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
  const staffRoleIds = new Set(getStaffRoleIds(guild, moderatorRoleIds));
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
  let activePanelChannelId = panelChannelId;

  client.once(Events.ClientReady, async () => {
    try {
      const channel = await ensureTicketPanel(client, activePanelChannelId);
      activePanelChannelId = channel.id;
    } catch (error) {
      console.error(`[tickets] panel setup failed: ${error.message}`);
    }
  });

  client.on(Events.InteractionCreate, (interaction) => {
    if (interaction.isButton() && interaction.customId.startsWith(PREFIX)) {
      void handleTicketButton(interaction, { client, settings, panelChannelId: activePanelChannelId }).catch(async (error) => {
        console.error(`[tickets] interaction failed: ${error.message}`);
        await replyEphemeral(interaction, error.message || "The ticket action failed. Please try again.");
      });
    } else if (interaction.isModalSubmit() && interaction.customId.startsWith(`${PREFIX}reason:`)) {
      void createTicketFromModal(interaction, { client, settings, panelChannelId: activePanelChannelId }).catch(async (error) => {
        console.error(`[tickets] creation failed: ${error.message}`);
        await replyEphemeral(interaction, error.message || "The ticket could not be created. Please try again.");
      });
    } else if (interaction.isUserSelectMenu() && interaction.customId === `${PREFIX}add-person`) {
      void addPersonToTicket(interaction, { settings }).catch(async (error) => {
        console.error(`[tickets] add-person failed: ${error.message}`);
        await replyEphemeral(interaction, error.message || "The member could not be added. Please try again.");
      });
    }
  });
}

export async function ensureTicketPanel(client, panelChannelId = TICKET_PANEL_CHANNEL_ID) {
  let channel = await client.channels.fetch(panelChannelId).catch(() => null);
  const guild = channel?.guild ?? client.guilds.cache.first();
  if (!channel && guild) {
    channel = guild.channels.cache.find((item) =>
      item.type === ChannelType.GuildText && /support/i.test(item.name.replace(/[^a-z]/gi, "")),
    ) ?? null;
  }
  if (!channel && guild) {
    channel = await guild.channels.create({
      name: "💗｜୨୧•𝓼𝓾𝓹𝓹𝓸𝓻𝓽",
      type: ChannelType.GuildText,
      reason: "Create the Kittisugar Support channel because it was missing",
    });
  }
  if (!channel || channel.type !== ChannelType.GuildText) {
    throw new Error("The Support panel channel could not be found or created.");
  }
  await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
    ViewChannel: true, SendMessages: false, ReadMessageHistory: true,
  });
  const newRole = channel.guild.roles.cache.find((role) => role.name.toLowerCase() === "new");
  if (newRole) await channel.permissionOverwrites.edit(newRole, {
    ViewChannel: true, SendMessages: false, ReadMessageHistory: true,
  });
  await channel.permissionOverwrites.edit(client.user.id, {
    ViewChannel: true, SendMessages: true, EmbedLinks: true, ReadMessageHistory: true,
    ManageMessages: true, ManageChannels: true,
  });

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
  if (action === "get-verified") {
    if (!interaction.inGuild() || interaction.channelId !== panelChannelId) {
      return replyEphemeral(interaction, `Use Get Verified in <#${panelChannelId}>.`);
    }
    return startRoleOnboarding(interaction);
  }
  if (action.startsWith("category:")) {
    return handleTicketCategory(interaction, panelChannelId, action.slice("category:".length));
  }
  if (action === "add-people") {
    if (!interaction.inGuild() || interaction.channel?.type !== ChannelType.GuildText || !parseTicketTopic(interaction.channel.topic)) return replyEphemeral(interaction, "This action is only available inside an active ticket.");
    const config = settings.get(interaction.guildId);
    if (!hasTicketStaffAccess(interaction.member, getStaffRoleIds(interaction.guild, config.moderatorRoleIds))) return replyEphemeral(interaction, "Only the staff team can add people to a ticket.");
    const selector = new UserSelectMenuBuilder().setCustomId(`${PREFIX}add-person`).setPlaceholder("Choose a person to add").setMinValues(1).setMaxValues(1);
    return interaction.reply({ content: "Select the member who should have access to this ticket:", components: [new ActionRowBuilder().addComponents(selector)], ephemeral: true });
  }
  if (action === "close-confirm" || action === "close-cancel") {
    if (!interaction.inGuild() || interaction.channel?.type !== ChannelType.GuildText) return replyEphemeral(interaction, "This action is only available inside a ticket.");
    const ticket = parseTicketTopic(interaction.channel.topic);
    if (!ticket || ticket.status !== "open" || ticket.guildId !== interaction.guildId) return replyEphemeral(interaction, "This is not an active ticket.");
    const config = settings.get(interaction.guildId);
    const staffRoleIds = getStaffRoleIds(interaction.guild, config.moderatorRoleIds);
    if (interaction.user.id !== ticket.openerId && !hasTicketStaffAccess(interaction.member, staffRoleIds)) return replyEphemeral(interaction, "Only the ticket opener or a moderator can close this ticket.");
    if (action === "close-cancel") return interaction.update({ content: "Ticket closure cancelled.", embeds: [], components: [] });
    await interaction.update({ content: "Saving the transcript and deleting this ticket…", embeds: [], components: [] });
    const transcriptChannel = await client.channels.fetch(TICKET_TRANSCRIPTS_CHANNEL_ID);
    if (!transcriptChannel || transcriptChannel.type !== ChannelType.GuildText) throw new Error(`Transcript channel ${TICKET_TRANSCRIPTS_CHANNEL_ID} is not accessible.`);
    await interaction.channel.send({ embeds: [new EmbedBuilder().setColor(PANEL_COLOR).setTitle(formatEmbedTitle("Ticket Closed")).setDescription(`This ticket was closed by <@${interaction.user.id}>.`)], allowedMentions: { parse: [] } });
    const transcript = await buildTicketTranscript(interaction.channel);
    await transcriptChannel.send({
      embeds: [new EmbedBuilder().setColor(PANEL_COLOR).setTitle(formatEmbedTitle("Ticket Transcript")).setDescription(`**Ticket:** ${interaction.channel.name}\n**Category:** ${ticketCategoryFromChannel(interaction.channel.name)}\n**Opened by:** <@${ticket.openerId}>\n**Closed by:** <@${interaction.user.id}>`)],
      files: [new AttachmentBuilder(Buffer.from(transcript, "utf8"), { name: `${interaction.channel.name}-transcript.txt` })],
      allowedMentions: { parse: [] },
    });
    await interaction.channel.delete(`Ticket closed by ${interaction.user.id}; transcript archived`);
    return;
  }
  if (action === "close") {
    if (!interaction.inGuild() || interaction.channel?.type !== ChannelType.GuildText) return replyEphemeral(interaction, "This action is only available inside a ticket.");
    const ticket = parseTicketTopic(interaction.channel.topic);
    if (!ticket || ticket.guildId !== interaction.guildId || ticket.status !== "open") return replyEphemeral(interaction, "This channel is not an active Sugar support ticket.");
    const config = settings.get(interaction.guildId);
    const isModerator = hasTicketStaffAccess(interaction.member, getStaffRoleIds(interaction.guild, config.moderatorRoleIds));
    if (interaction.user.id !== ticket.openerId && !isModerator) return replyEphemeral(interaction, "Only the ticket opener or a moderator can close this ticket.");
    const confirmRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`${PREFIX}close-confirm`).setLabel("Confirm ♡").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`${PREFIX}close-cancel`).setLabel("Cancel ♡").setStyle(ButtonStyle.Secondary),
    );
    return interaction.reply({ content: "Are you sure you want to close and permanently delete this ticket? A transcript will be saved first.", components: [confirmRow], ephemeral: true });
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
    parent: TICKET_CATEGORY_ID,
    topic: `${PREFIX}open:${interaction.user.id}:${guild.id}`,
    permissionOverwrites: buildTicketPermissionOverwrites({
      guild,
      openerId: interaction.user.id,
      moderatorRoleIds: getStaffRoleIds(guild, moderatorRoleIds),
      botId: client.user.id,
    }),
    reason: `Support ticket opened by ${interaction.user.id}`,
  });

  try {
    const staffRoleIds = getStaffRoleIds(guild, moderatorRoleIds);
    await channel.send({
      ...buildTicketCreatedPayload(interaction.user.id, category),
      content: `<@${interaction.user.id}>${staffRoleIds.length ? ` ${staffRoleIds.map((id) => `<@&${id}>`).join(" ")}` : ""}\n${reason}`,
      allowedMentions: { parse: [], users: [interaction.user.id], roles: staffRoleIds },
    });
  } catch (error) {
    await channel.delete("Ticket setup failed; cleaning up the incomplete ticket").catch(() => {});
    throw error;
  }
  return interaction.editReply(`Your private ticket is ready: <#${channel.id}>.`);
}

async function addPersonToTicket(interaction, { settings }) {
  if (!interaction.inGuild() || interaction.channel?.type !== ChannelType.GuildText) return replyEphemeral(interaction, "This action is only available inside a ticket.");
  const ticket = parseTicketTopic(interaction.channel.topic);
  if (!ticket || ticket.guildId !== interaction.guildId || ticket.status !== "open") return replyEphemeral(interaction, "This is not an active Sugar support ticket.");
  const config = settings.get(interaction.guildId);
  if (!hasTicketStaffAccess(interaction.member, getStaffRoleIds(interaction.guild, config.moderatorRoleIds))) return replyEphemeral(interaction, "Only the staff team can add people to a ticket.");
  const memberId = interaction.values?.[0];
  if (!memberId) return replyEphemeral(interaction, "Please select a member.");
  await interaction.deferReply({ ephemeral: true });
  const member = await interaction.guild.members.fetch(memberId).catch(() => null);
  if (!member) return interaction.editReply("That member could not be found in this server.");
  await interaction.channel.permissionOverwrites.edit(member.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true, EmbedLinks: true });
  await interaction.channel.send({ content: `<@${member.id}> has been added to this ticket.`, allowedMentions: { users: [member.id] } });
  return interaction.editReply(`<@${member.id}> has been added to the ticket.`);
}

function getStaffRoleIds(guild, configuredRoleIds = []) {
  const ids = new Set(configuredRoleIds.filter((id) => guild.roles.cache.has(id)));
  for (const role of guild.roles.cache.values()) if (/^staff(?:\b|\s)/i.test(role.name)) ids.add(role.id);
  return [...ids];
}

async function buildTicketTranscript(channel) {
  const collected = [];
  let before;
  for (let page = 0; page < 10; page += 1) {
    const batch = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
    if (!batch.size) break;
    collected.push(...batch.values());
    before = batch.last().id;
    if (batch.size < 100) break;
  }
  return collected.reverse().map((message) => {
    const timestamp = new Date(message.createdTimestamp).toISOString();
    const author = `${message.author?.tag ?? "Unknown user"} (${message.author?.id ?? "unknown"})`;
    const body = message.content || "[no text content]";
    const attachments = [...message.attachments.values()].map((file) => file.url).join("\n");
    const embeds = message.embeds.length ? `[${message.embeds.length} embed(s)]` : "";
    return `[${timestamp}] ${author}: ${body}${attachments ? `\nAttachments: ${attachments}` : ""}${embeds ? `\n${embeds}` : ""}`;
  }).join("\n\n");
}

function ticketCategoryFromChannel(channelName) {
  const key = /^ticket-([a-z]+)-/.exec(channelName)?.[1];
  return TICKET_CATEGORIES.get(key) ?? "Unknown";
}

function parseTicketTopic(topic) {
  const match = /^(sugar-ticket:)(open|closed):(\d{5,25}):(\d{5,25})$/.exec(String(topic ?? ""));
  if (!match) return null;
  return { status: match[2], openerId: match[3], guildId: match[4] };
}

function hasTicketStaffAccess(member, staffRoleIds) {
  if (member?.permissions?.has(PermissionFlagsBits.ManageChannels) ||
      member?.permissions?.has(PermissionFlagsBits.Administrator)) return true;
  const roles = member?.roles?.cache;
  return Boolean(roles && staffRoleIds.some((roleId) => roles.has(roleId)));
}

async function replyEphemeral(interaction, content) {
  const payload = { content, ephemeral: true };
  if (interaction.deferred) return interaction.editReply(payload);
  if (interaction.replied) return interaction.followUp(payload);
  return interaction.reply(payload);
}
