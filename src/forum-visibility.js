import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  Events,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
} from "discord.js";

export const FORUM_VISIBILITY_PANEL_CHANNEL_ID = "1569611281453949019";
export const FORUM_VISIBILITY_CATEGORY_ID = "1568680126294663330";
const PREFIX = "sugar-forum-visibility:";
const OPEN_ID = `${PREFIX}open`;
const APPLY_ID = `${PREFIX}apply`;
const PANEL_TITLE = "୨୧ Forum Visibility ♡";
const COLOR = 0xffd9ff;

export function buildForumVisibilityPanelPayload() {
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(PANEL_TITLE)
    .setDescription(
      "Customize which forums appear in your channel list. Choose the forums you want to hide from yourself, and change your selection anytime. This only affects your own view ♡",
    )
    .setFooter({ text: "Your choices are personal and can be changed whenever you like ♡" });

  const button = new ButtonBuilder()
    .setCustomId(OPEN_ID)
    .setLabel("Customize Forums ♡")
    .setStyle(ButtonStyle.Primary);

  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(button)] };
}

export function getCategoryForums(guild) {
  return [...guild.channels.cache.values()]
    .filter((channel) => channel.type === ChannelType.GuildForum && channel.parentId === FORUM_VISIBILITY_CATEGORY_ID)
    .sort((a, b) => a.rawPosition - b.rawPosition);
}

export function buildForumVisibilityPickerPayload(guild, userId) {
  const forums = getCategoryForums(guild);
  if (!forums.length) return null;

  // Discord string selects support at most 25 options. Kittisugar's forum
  // category currently fits in one picker; fail clearly rather than silently
  // offering an incomplete list if that changes.
  if (forums.length > 25) {
    throw new Error("This category has more than 25 forums, so the selector needs pagination.");
  }

  const options = forums.map((channel) => {
    const overwrite = channel.permissionOverwrites.cache.get(userId);
    const hidden = Boolean(overwrite?.deny?.has(PermissionFlagsBits.ViewChannel));
    return {
      label: channel.name.slice(0, 100),
      description: hidden ? "Currently hidden from you" : "Currently visible to you",
      value: channel.id,
      default: hidden,
    };
  });

  const picker = new StringSelectMenuBuilder()
    .setCustomId(APPLY_ID)
    .setPlaceholder("Select the forums you want to hide ♡")
    .setMinValues(0)
    .setMaxValues(Math.max(1, forums.length))
    .addOptions(options);

  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle("୨୧ Choose Your Forums ♡")
    .setDescription(
      "Select the forums you want to hide. Selected options will be hidden only for you; deselect them to show them again.",
    );

  return {
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(picker)],
    ephemeral: true,
  };
}

async function upsertPanel(channel, client) {
  const recent = await channel.messages.fetch({ limit: 50 });
  const existing = recent.find((message) =>
    message.author?.id === client.user.id && message.embeds.some((embed) => embed.title === PANEL_TITLE),
  );
  if (existing) return existing.edit(buildForumVisibilityPanelPayload());
  return channel.send(buildForumVisibilityPanelPayload());
}

async function openPicker(interaction) {
  if (!interaction.inGuild()) {
    return interaction.reply({ content: "This selector only works inside Kittisugar.", ephemeral: true });
  }
  const payload = buildForumVisibilityPickerPayload(interaction.guild, interaction.user.id);
  if (!payload) {
    return interaction.reply({ content: "There are no forum channels in this category yet ♡", ephemeral: true });
  }
  return interaction.reply(payload);
}

async function applySelection(interaction) {
  if (!interaction.inGuild()) {
    return interaction.reply({ content: "This selector only works inside Kittisugar.", ephemeral: true });
  }

  const guild = interaction.guild;
  const botMember = guild.members.me;
  if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return interaction.reply({
      content: "Sugar needs the Manage Roles permission to update your personal forum visibility. Please contact a moderator ♡",
      ephemeral: true,
    });
  }

  const forums = getCategoryForums(guild);
  const validIds = new Set(forums.map((channel) => channel.id));
  const selected = new Set(interaction.values.filter((id) => validIds.has(id)));

  await interaction.deferUpdate();
  let changed = 0;
  let failed = 0;

  for (const channel of forums) {
    const overwrite = channel.permissionOverwrites.cache.get(interaction.user.id);
    const currentlyDenied = Boolean(overwrite?.deny?.has(PermissionFlagsBits.ViewChannel));
    const shouldHide = selected.has(channel.id);

    if (shouldHide === currentlyDenied) continue;
    try {
      if (shouldHide) {
        await channel.permissionOverwrites.edit(
          interaction.user.id,
          { ViewChannel: false },
          "Member customized their personal forum visibility",
        );
      } else if (currentlyDenied) {
        // Clear only ViewChannel; preserve any other explicit permissions.
        await channel.permissionOverwrites.edit(
          interaction.user.id,
          { ViewChannel: null },
          "Member restored personal forum visibility",
        );
      }
      changed += 1;
    } catch (error) {
      failed += 1;
      console.error(`[forum-visibility] could not update channel ${channel.id} for member ${interaction.user.id}: ${error.message}`);
    }
  }

  const next = buildForumVisibilityPickerPayload(guild, interaction.user.id);
  if (next) {
    const editPayload = { embeds: next.embeds, components: next.components };
    editPayload.content = failed
      ? `Updated ${changed} forum(s). ${failed} could not be changed; check with a moderator ♡`
      : "Your forum visibility has been updated ♡";
    await interaction.editReply(editPayload);
  } else {
    await interaction.editReply({ content: "There are no forum channels in this category yet ♡", embeds: [], components: [] });
  }
}

export function attachForumVisibilitySystem(client) {
  client.once(Events.ClientReady, async () => {
    for (const guild of client.guilds.cache.values()) {
      const channel = guild.channels.cache.get(FORUM_VISIBILITY_PANEL_CHANNEL_ID);
      if (!channel?.isTextBased?.() || typeof channel.messages?.fetch !== "function") {
        console.warn(`[forum-visibility] panel channel ${FORUM_VISIBILITY_PANEL_CHANNEL_ID} was not found in guild ${guild.id}`);
        continue;
      }
      try {
        await upsertPanel(channel, client);
      } catch (error) {
        console.error(`[forum-visibility] could not set up panel in guild ${guild.id}: ${error.message}`);
      }
    }
  });

  client.on(Events.InteractionCreate, (interaction) => {
    if (interaction.isButton() && interaction.customId === OPEN_ID) {
      void openPicker(interaction).catch(async (error) => {
        console.error(`[forum-visibility] could not open selector: ${error.message}`);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: "I couldn't open the forum selector. Please try again ♡", ephemeral: true }).catch(() => {});
        }
      });
      return;
    }
    if (interaction.isStringSelectMenu() && interaction.customId === APPLY_ID) {
      void applySelection(interaction).catch(async (error) => {
        console.error(`[forum-visibility] could not save selection: ${error.message}`);
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp({ content: "I couldn't save your forum settings. Please try again ♡", ephemeral: true }).catch(() => {});
        } else {
          await interaction.reply({ content: "I couldn't save your forum settings. Please try again ♡", ephemeral: true }).catch(() => {});
        }
      });
    }
  });
}
