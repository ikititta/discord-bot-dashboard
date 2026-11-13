import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, Events,
  ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits,
} from "discord.js";

export const COMMANDS_CATEGORY_ID = "1568179038625857576";
export const COMMANDS_CHANNEL_NAME = "⌨️｜୨୧・𝓬𝓸𝓶𝓶𝓪𝓷𝓭𝓼";
export const COMMANDS_CHANNEL_TOPIC = "Kittisugar interactive all-commands guide";
export const COMMANDS_INFO_CHANNEL_ID = "1570257241511170150";
export const RETIRED_COMMANDS_CHANNEL_ID = "1570860019799302294";
export const OBSOLETE_COMMANDS_CHANNEL_ID = "1570839239396958218";
export const COMMANDS_PANEL_TITLE = "୨୧ 𝓚𝓲𝓽𝓽𝓲𝓼𝓾𝓰𝓪𝓻 · 𝓒𝓸𝓶𝓶𝓪𝓷𝓭𝓼 ♡";
export const MODERATION_COMMANDS_CHANNEL_ID = "1570277294868660264";
export const MODERATION_PANEL_TITLE = "୨୧ 𝓜𝓸𝓭𝓮𝓻𝓪𝓽𝓲𝓸𝓷 · 𝓒𝓸𝓶𝓶𝓪𝓷𝓭𝓼 ♡";
export const REPUTATION_ONLY_CHANNEL_ID = "1569930648804925522";
const COLOR = 0xffd9ff;
const PREFIX = "sugar-commands:";
const categories = {
  solo: { label: "Solo", emoji: "🌷", description: "**Solo · SFW**\n`!cry` · `!laugh` · `!dance` · `!sleep` · `!happy` · `!blush` · `!smug` · `!wave` · `!facepalm` · `!wink` · `!shrug` · `!smile` · `!pout` · `!scream` · `!sing` · `!think`\n\nSolo actions; no member mention needed. There are currently no solo NSFW actions enabled." },
  couple: { label: "Couple", emoji: "💕", description: "**Two-person interactions · SFW**\n`!hug @member` · `!kiss @member` · `!cuddle @member` · `!pat @member` · `!handhold @member` · `!highfive @member` · `!slap @member` · `!bonk @member` · `!spank @member` · `!poke @member` · `!bite @member` · `!lick @member` · `!feet @member` · `!kick @member` · `!shoot @member` · `!kill @member` · `!funstyle` · `!tease @member` · `!seduce @member` · `!comfort @member` · `!noseboop @member`\n\n**VIP · NSFW**\n`!fuck @member` · `!masturbate @member` · `!oral @member` · `!anal @member` · `!choke @member` · `!spit @member`\n\nAll NSFW interactions are listed here under Couple, not in separate categories. VIP access is required from either participant. For `!masturbate @member`, the person running the command performs the action toward the mentioned member. `!shoot` and `!kill` use fictional reaction GIFs; choose anime or real/movie clips with `!funstyle`. `!kill` is a fictional interaction and does not timeout anyone." },
  relationship: { label: "Relationships", emoji: "💍", description: "`!couple @member` · `!propose @member` · `!marry @member` · `!breakup` · `!divorce`\n\nThe other member must accept a proposal. Both people need the Member role." },
  community: { label: "Community", emoji: "💌", description: "**Confessions, polls, love letters & suggestions**\nUse the buttons in their channel panels to submit a confession, create a poll, send a love letter, or submit a suggestion. Fun commands can also be used directly in Confessions and Love Letters.\n\n**Reputation**\n`!rep` · `!rep @member` · `!rep stats` · `!rep stats @member` · `!rep top` · `!rep comments [@member]`" },
  pets: { label: "Pets", emoji: "🐾", description: "**Adoption & profile**\n`!pet adopt` · `!pet commands` · `!pet` · `!pet status` · `!pet stats` · `!pet select <number>` · `!pet redraw`\n\n**Care & bonding**\n`!pet feed` · `!pet play` · `!pet cuddle` · `!pet talk` · `!pet story` · `!pet gif [happy|dance|sleep]`\n\n**Coins & items**\n`!pet daily` · `!pet shop` · `!pet buy <treat|toy|potion>` · `!pet use <item>` · `!pet inventory` · `!pet delete`\n\n**VIP extras**\n`!pet name <name>` · `!pet color <color>` · `!pet breed <breed>` · `!pet appearance <details>` · `!pet personality <traits>` · `!pet room redesign` · `!pet room delete` · `!pet outfit <name>` · `!pet slots` · `!pet minigame`" },
  functional: { label: "Functional", emoji: "🛠️", description: "**Messages**\n`/delete amount:<1-20>` — delete your own recent messages\n`/vip-delete amount:<1-100>` — VIP message deletion\n`/mod-delete amount:<1-100> [member]` — moderator-only cleanup\n`!quote` — reply to a message, then use `!quote` to create an image quote\n\n**Profiles & stats**\n`!profile [@member]` · `/stats` · `/vip stats [member]`\n\n**Private chats**\n`/priv-chat create` · `/priv-chat add` · `/priv-chat remove` · `/priv-chat rename` · `/priv-chat leave` · `/priv-chat delete` · `/priv-chat commands`" },
};

export function buildCommandsCategoryEmbed(category) {
  const item = categories[category];
  if (!item) throw new Error("Unknown commands category.");
  return new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(item.emoji + " ୨୧ " + item.label + " Commands ♡")
    .setDescription(item.description)
    .setFooter({ text: "Kittisugar · Commands guide ♡" });
}

export function buildModerationCommandsEmbed() {
  return new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(MODERATION_PANEL_TITLE)
    .setDescription(
      "Use the buttons below to moderate members. Actions are permission-checked and performed privately.\n\n" +
      "Choose **Ban**, **Timeout**, or **Warn** to enter a member ID and reason. Choose **Commands** to view the moderation command guide."
    )
    .setFooter({ text: "Kittisugar · Staff tools ♡" });
}

export function buildModerationCommandsPanelPayload() {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("sugar-moderation:ban").setLabel("Ban").setEmoji("🔨").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("sugar-moderation:timeout").setLabel("Timeout").setEmoji("🔇").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("sugar-moderation:warn").setLabel("Warn").setEmoji("⚠️").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("sugar-moderation:commands").setLabel("Commands").setEmoji("📖").setStyle(ButtonStyle.Primary),
  );
  return { embeds: [buildModerationCommandsEmbed()], components: [row] };
}

export async function ensureModerationCommandsPanel(guild, client) {
  const channel = await guild.channels.fetch(MODERATION_COMMANDS_CHANNEL_ID).catch(() => null);
  if (!channel || channel.type !== ChannelType.GuildText) {
    console.error("[commands] moderation channel " + MODERATION_COMMANDS_CHANNEL_ID + " was not found; no channel was created.");
    return null;
  }
  const recent = await channel.messages.fetch({ limit: 100 });
  const previous = [...recent.values()].filter((message) =>
    message.author?.id === client.user.id &&
    (message.embeds.some((embed) =>
      [MODERATION_PANEL_TITLE, "🛡️ ୨୧ Moderation ♡", "୨୧ 𝓢𝓽𝓪𝓯𝓯 · 𝓣𝓸𝓸𝓵𝓼 ♡"].includes(embed.title)) ||
      message.components.some((row) => row.components.some((component) =>
        ["sugar-moderation-commands", "sugar-moderation:ban", "sugar-moderation:commands"].includes(component.customId)))),
  ).sort((a, b) => b.createdTimestamp - a.createdTimestamp);

  const existing = previous.shift();
  const panel = existing
    ? await existing.edit(buildModerationCommandsPanelPayload())
    : await channel.send(buildModerationCommandsPanelPayload());

  for (const duplicate of previous) {
    await duplicate.delete().catch((error) => {
      if (error?.code !== 10008) throw error;
    });
  }
  console.info("[commands] single interactive moderation panel ready in #" + channel.name);
  return panel;
}

export function buildCommandsPanelPayload() {
  const rows = [];
  const buttons = Object.entries(categories).map(([key, item]) =>
    new ButtonBuilder()
      .setCustomId(PREFIX + key)
      .setLabel(item.label)
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(item.emoji),
  );
  for (let i = 0; i < buttons.length; i += 5) {
    rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
  }
  return {
    embeds: [new EmbedBuilder()
      .setColor(COLOR)
      .setTitle(COMMANDS_PANEL_TITLE)
      .setDescription("All Sugar commands, neatly organised ♡\n\nChoose a category below to see its commands and how to use them. Fun and relationship interactions require the Member role; VIP-only commands are marked.")
      .setFooter({ text: "Select a category to browse commands ♡" })],
    components: rows,
  };
}

export async function ensureCommandsChannel(guild, client) {
  // Commands content belongs only in the explicitly designated existing channel.
  // Never create a separate #commands channel.
  const channel = await guild.channels.fetch(COMMANDS_INFO_CHANNEL_ID).catch(() => null);
  if (!channel || channel.type !== ChannelType.GuildText) {
    console.warn("[commands] designated commands channel " + COMMANDS_INFO_CHANNEL_ID + " was not found; no channel was created.");
    return null;
  }
  await upsertCommandsPanel(channel, client, { sticky: true });
  console.info("[commands] commands guide kept in #" + channel.name);
  return channel;
}

async function upsertCommandsPanel(channel, client, { sticky = false } = {}) {
  const recent = await channel.messages.fetch({ limit: 100 });
  const matches = [...recent.values()].filter((message) =>
    message.author?.id === client.user.id &&
    message.embeds.some((embed) => embed.title === COMMANDS_PANEL_TITLE),
  ).sort((a, b) => b.createdTimestamp - a.createdTimestamp);
  const existing = matches.shift();
  const panel = existing
    ? await existing.edit(buildCommandsPanelPayload())
    : await channel.send(buildCommandsPanelPayload());
  if (sticky && !panel.pinned) {
    await panel.pin("Keep the Kittisugar commands guide visible in this channel").catch((error) => {
      console.error("[commands] could not pin the commands guide in #" + channel.name + ": " + error.message);
    });
  }
  for (const duplicate of matches) {
    await duplicate.delete().catch((error) => {
      if (error?.code !== 10008) throw error;
    });
  }
  return panel;
}

export async function ensureCommandsInfoPanel(guild, client) {
  const channel = await guild.channels.fetch(COMMANDS_INFO_CHANNEL_ID).catch(() => null);
  if (!channel || channel.type !== ChannelType.GuildText) {
    console.warn("[commands] additional commands channel " + COMMANDS_INFO_CHANNEL_ID + " was not found; no channel was created.");
    return null;
  }
  await upsertCommandsPanel(channel, client, { sticky: true });
  console.info("[commands] sticky commands guide updated in #" + channel.name);
  return channel;
}

export async function removeObsoleteCommandsChannel(guild) {
  let removed = false;
  const ids = [RETIRED_COMMANDS_CHANNEL_ID, OBSOLETE_COMMANDS_CHANNEL_ID];
  for (const id of ids) {
    const channel = await guild.channels.fetch(id).catch(() => null);
    if (!channel || channel.id === COMMANDS_INFO_CHANNEL_ID) continue;
    await channel.delete("Retire the duplicate commands channel; all commands content belongs in the designated commands channel");
    console.info("[commands] removed retired commands channel " + id);
    removed = true;
  }

  // Also clean up any duplicate created under the old channel name, but never
  // touch the designated channel even if its display name changes.
  const channels = await guild.channels.fetch().catch(() => null);
  for (const channel of channels?.values?.() ?? []) {
    if (channel.id !== COMMANDS_INFO_CHANNEL_ID &&
        channel.type === ChannelType.GuildText &&
        channel.name === "📖｜୨୧・commands") {
      await channel.delete("Remove duplicate commands channel; use the designated commands channel instead");
      console.info("[commands] removed duplicate commands channel " + channel.id);
      removed = true;
    }
  }
  return removed;
}

export function attachCommandsChannel(client) {
  client.on(Events.MessageCreate, async (message) => {
    if (!message.guild || message.author?.bot || message.webhookId ||
        message.channelId === REPUTATION_ONLY_CHANNEL_ID ||
        !/^!commands$/i.test(String(message.content ?? "").trim())) return;
    await message.reply({
      ...buildCommandsPanelPayload(),
      allowedMentions: { parse: [], repliedUser: false },
    }).catch((error) => console.error("[commands] !commands response failed: " + error.message));
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isButton?.() && interaction.customId.startsWith("sugar-moderation:")) {
      const action = interaction.customId.slice("sugar-moderation:".length);
      if (action === "commands") {
        await interaction.reply({
          embeds: [buildModerationCommandsEmbed().setDescription(
            "**/mod-delete amount:<1-100> [member:<member>]**\nDelete up to 100 recent messages in this channel. Add a member to target their messages; leave it empty to clean eligible messages from the channel.\n\nThis command is restricted to authorised moderators. Large deletions require confirmation."
          )],
          ephemeral: true,
        });
        return;
      }
      if (!["ban", "timeout", "warn"].includes(action)) return;
      const permitted = action === "ban"
        ? interaction.memberPermissions?.has(PermissionFlagsBits.BanMembers) || interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
        : interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers) || interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages) || interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
      if (!permitted) {
        await interaction.reply({ content: "You don't have permission to use this moderation action.", ephemeral: true });
        return;
      }
      const modal = new ModalBuilder()
        .setCustomId("sugar-moderation-modal:" + action)
        .setTitle(action === "ban" ? "Ban a member" : action === "timeout" ? "Timeout a member" : "Warn a member");
      const target = new TextInputBuilder()
        .setCustomId("target")
        .setLabel("Member ID")
        .setPlaceholder("Paste the Discord user ID")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(25);
      const reason = new TextInputBuilder()
        .setCustomId("reason")
        .setLabel("Reason")
        .setPlaceholder("Explain why this action is being taken")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(500);
      modal.addComponents(
        new ActionRowBuilder().addComponents(target),
        new ActionRowBuilder().addComponents(reason),
      );
      if (action === "timeout") {
        const duration = new TextInputBuilder()
          .setCustomId("duration")
          .setLabel("Duration in minutes (1–40320)")
          .setPlaceholder("e.g. 10")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(5);
        modal.addComponents(new ActionRowBuilder().addComponents(duration));
      }
      await interaction.showModal(modal);
      return;
    }

    if (interaction.isModalSubmit?.() && interaction.customId.startsWith("sugar-moderation-modal:")) {
      const action = interaction.customId.slice("sugar-moderation-modal:".length);
      const targetId = interaction.fields.getTextInputValue("target").trim();
      const reason = interaction.fields.getTextInputValue("reason").trim();
      if (!/^\\d{17,20}$/.test(targetId) || !reason) {
        await interaction.reply({ content: "Enter a valid Discord user ID and a reason.", ephemeral: true });
        return;
      }
      const permitted = action === "ban"
        ? interaction.memberPermissions?.has(PermissionFlagsBits.BanMembers) || interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
        : interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers) || interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages) || interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
      if (!permitted || !interaction.guild) {
        await interaction.reply({ content: "You don't have permission to use this moderation action.", ephemeral: true });
        return;
      }
      await interaction.deferReply({ ephemeral: true });
      try {
        const targetMember = await interaction.guild.members.fetch(targetId).catch(() => null);
        if (targetId === interaction.user.id || targetId === interaction.client.user.id) {
          await interaction.editReply("You cannot moderate yourself or Sugar.");
          return;
        }
        if (action !== "ban" && !targetMember) {
          await interaction.editReply("That member is not currently in this server.");
          return;
        }
        if (targetMember && action === "timeout" && !targetMember.moderatable) {
          await interaction.editReply("I cannot moderate that member. Check Sugar's role position and permissions.");
          return;
        }
        if (action === "ban") {
          if (targetMember && !targetMember.bannable) {
            await interaction.editReply("I cannot ban that member. Check Sugar's role position and Ban Members permission.");
            return;
          }
          await interaction.guild.members.ban(targetId, { reason: reason.slice(0, 500) });
          await interaction.editReply("🔨 Member banned successfully.");
        } else if (action === "timeout") {
          const minutes = Number(interaction.fields.getTextInputValue("duration"));
          if (!Number.isInteger(minutes) || minutes < 1 || minutes > 40320) {
            await interaction.editReply("Duration must be a whole number between 1 and 40320 minutes.");
            return;
          }
          await targetMember.timeout(minutes * 60_000, reason.slice(0, 500));
          await interaction.editReply("🔇 Member timed out for " + minutes + " minute(s).");
        } else if (action === "warn") {
          await targetMember.send("You received a warning in **" + interaction.guild.name + "**.\nReason: " + reason.slice(0, 500)).catch(() => null);
          await interaction.editReply("⚠️ Warning processed. Sugar attempted to DM the member.");
        }
      } catch (error) {
        console.error("[moderation-panel] " + action + " failed: " + error.message);
        await interaction.editReply("The action failed. Check Sugar's permissions, role hierarchy, and the target ID.");
      }
      return;
    }

    if (!interaction.isButton?.() || !interaction.customId.startsWith(PREFIX)) return;
    const category = interaction.customId.slice(PREFIX.length);
    if (!categories[category]) return;
    await interaction.reply({ embeds: [buildCommandsCategoryEmbed(category)], ephemeral: true }).catch((error) => {
      console.error("[commands] category response failed: " + error.message);
    });
  });

  const setupAll = (guild) => {
    void removeObsoleteCommandsChannel(guild).catch((error) =>
      console.error("[commands] obsolete channel removal failed in " + guild.id + ": " + error.message),
    );
    void ensureCommandsInfoPanel(guild, client).catch((error) =>
      console.error("[commands] designated guide setup failed in " + guild.id + ": " + error.message),
    );
    void ensureModerationCommandsPanel(guild, client).catch((error) =>
      console.error("[commands] moderation setup failed in " + guild.id + ": " + error.message),
    );
  };
  client.once(Events.ClientReady, () => {
    for (const guild of client.guilds.cache.values()) setupAll(guild);
  });
  client.on(Events.GuildCreate, setupAll);
}
