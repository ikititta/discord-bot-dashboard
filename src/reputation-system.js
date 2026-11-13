import fs from "node:fs";
import path from "node:path";
import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder,
  Events, ModalBuilder, TextInputBuilder, TextInputStyle, UserSelectMenuBuilder,
} from "discord.js";

const COLOR = 0xffd9ff;
const VIP_ROLE_ID = "1568188640113463437";
const MEMBER_ROLE_ID = "1568188534836428812";
const PREFIX = "sugar-reputation:";
const MAX_COMMENTS = 5000;
const MAX_COMMENT_LENGTH = 800;
const REPUTATION_CHANNEL_ID = "1570221195222057150";\nexport const REPUTATION_COMMANDS_CHANNEL_ID = "1569930648804925522";\nexport const REPUTATION_COMMANDS_TITLE = "୨୧ 𝓡𝓮𝓹𝓾𝓽𝓪𝓽𝓲𝓸𝓷 · 𝓒𝓸𝓶𝓶𝓪𝓷𝓭𝓼 ♡";

export class ReputationStore {
  constructor(dataDir) {
    this.file = path.join(dataDir, "reputation-state.json");
    this.data = this.#read();
  }
  add({ guildId, authorId, targetId, text, anonymous }) {
    if (![guildId, authorId, targetId].every((id) => /^\d{17,20}$/.test(id ?? "")) ||
        typeof text !== "string" || !text.trim() || text.length > MAX_COMMENT_LENGTH ||
        typeof anonymous !== "boolean" || authorId === targetId) throw new Error("Invalid reputation entry.");
    const entries = this.data.guilds[guildId] ??= [];
    if (entries.some((item) => item.authorId === authorId && item.targetId === targetId &&
        Date.now() - Date.parse(item.createdAt) < 24 * 60 * 60 * 1000)) {
      throw new Error("You can leave one reputation comment for the same member every 24 hours.");
    }
    entries.push({ id: String(Date.now()) + "-" + Math.random().toString(36).slice(2, 8), authorId, targetId,
      text: text.trim(), anonymous, createdAt: new Date().toISOString() });
    if (entries.length > MAX_COMMENTS) entries.splice(0, entries.length - MAX_COMMENTS);
    this.#write();
    return this.getForUser(guildId, targetId);
  }
  getForUser(guildId, userId) {
    return (this.data.guilds[guildId] ?? []).filter((item) => item.targetId === userId).map((item) => ({ ...item }));
  }
  vote({ guildId, authorId, targetId, value, comment = "" }) {
    if (![guildId, authorId, targetId].every((id) => /^\d{17,20}$/.test(id ?? "")) ||
        authorId === targetId || ![-1, 1].includes(value) ||
        typeof comment !== "string" || comment.length > MAX_COMMENT_LENGTH) throw new Error("Invalid reputation vote.");
    const file = path.join(path.dirname(this.file), "reputation-votes.json");
    let data = { version: 1, guilds: {} };
    try { data = JSON.parse(fs.readFileSync(file, "utf8")); } catch (error) { if (error?.code !== "ENOENT") throw error; }
    const votes = data.guilds[guildId] ??= [];
    const existing = votes.find((item) => item.authorId === authorId && item.targetId === targetId);
    if (existing) {
      existing.value = value;
      existing.comment = comment.trim();
      existing.createdAt = new Date().toISOString();
    } else votes.push({ authorId, targetId, value, comment: comment.trim(), createdAt: new Date().toISOString() });
    const temp = file + ".tmp";
    fs.writeFileSync(temp, JSON.stringify(data, null, 2), { mode: 0o600 });
    fs.chmodSync(temp, 0o600);
    fs.renameSync(temp, file);
    return this.getScore(guildId, targetId);
  }
  getCommentsForUser(guildId, userId) {
    const comments = this.getForUser(guildId, userId);
    const file = path.join(path.dirname(this.file), "reputation-votes.json");
    let votes = [];
    try { votes = JSON.parse(fs.readFileSync(file, "utf8")).guilds[guildId] ?? []; }
    catch (error) { if (error?.code !== "ENOENT") throw error; }
    const voteComments = votes.filter((item) => item.targetId === userId && item.comment?.trim())
      .map((item) => ({ authorId: item.authorId, targetId: item.targetId, text: item.comment,
        anonymous: false, createdAt: item.createdAt, vote: item.value }));
    return [...comments, ...voteComments].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  }
  getScore(guildId, userId) {
    const comments = this.getForUser(guildId, userId).length;
    const file = path.join(path.dirname(this.file), "reputation-votes.json");
    let votes = [];
    try { votes = JSON.parse(fs.readFileSync(file, "utf8")).guilds[guildId] ?? []; } catch (error) { if (error?.code !== "ENOENT") throw error; }
    return comments + votes.filter((item) => item.targetId === userId).reduce((sum, item) => sum + item.value, 0);
  }
  getVoteBreakdown(guildId, userId) {
    const file = path.join(path.dirname(this.file), "reputation-votes.json");
    let votes = [];
    try { votes = JSON.parse(fs.readFileSync(file, "utf8")).guilds[guildId] ?? []; }
    catch (error) { if (error?.code !== "ENOENT") throw error; }
    const userVotes = votes.filter((item) => item.targetId === userId);
    return {
      positive: userVotes.filter((item) => item.value > 0).length,
      negative: userVotes.filter((item) => item.value < 0).length,
    };
  }
  getTop(guildId, limit = 10) {
    const ids = new Set((this.data.guilds[guildId] ?? []).map((item) => item.targetId));
    const file = path.join(path.dirname(this.file), "reputation-votes.json");
    try { for (const item of JSON.parse(fs.readFileSync(file, "utf8")).guilds[guildId] ?? []) ids.add(item.targetId); }
    catch (error) { if (error?.code !== "ENOENT") throw error; }
    return [...ids].map((userId) => ({ userId, reputation: this.getScore(guildId, userId) }))
      .sort((a, b) => b.reputation - a.reputation || a.userId.localeCompare(b.userId)).slice(0, limit);
  }
  #write() {
    const temp = this.file + ".tmp";
    fs.writeFileSync(temp, JSON.stringify(this.data, null, 2), { mode: 0o600 });
    fs.chmodSync(temp, 0o600);
    fs.renameSync(temp, this.file);
  }
  #read() {
    let raw;
    try { raw = fs.readFileSync(this.file, "utf8"); }
    catch (error) { if (error?.code === "ENOENT") return { version: 1, guilds: {} }; throw error; }
    const parsed = JSON.parse(raw);
    if (parsed?.version !== 1 || !parsed.guilds || typeof parsed.guilds !== "object" || Array.isArray(parsed.guilds)) {
      throw new Error("reputation-state.json has an invalid structure; refusing to overwrite it.");
    }
    for (const [guildId, entries] of Object.entries(parsed.guilds)) {
      if (!/^\d{17,20}$/.test(guildId) || !Array.isArray(entries) || entries.length > MAX_COMMENTS ||
          entries.some((item) => !/^\d{17,20}$/.test(item.authorId ?? "") ||
            !/^\d{17,20}$/.test(item.targetId ?? "") || typeof item.text !== "string" ||
            typeof item.anonymous !== "boolean" || typeof item.createdAt !== "string")) {
        throw new Error("reputation-state.json contains invalid entries; refusing to overwrite it.");
      }
    }
    return parsed;
  }
}

function vip(member) { return member?.roles?.cache?.has(VIP_ROLE_ID) === true; }
function member(memberObj) { return memberObj?.roles?.cache?.has(MEMBER_ROLE_ID) === true; }
export function makePanelPayload() {
  const embed = new EmbedBuilder().setColor(COLOR).setTitle("୨୧ 𝓡𝓮𝓹𝓾𝓽𝓪𝓽𝓲𝓸𝓷 ♡")
    .setDescription("Give another member a positive or negative reputation vote.\n\n" +
      "**How it works**\n" +
      "♡ Choose **Give Positive** or **Give Negative**, then select a member.\n" +
      "♡ Each member has one active vote per person and may change it later.\n" +
      "♡ Vote honestly and respectfully. Harassment, threats, private information, and vote manipulation are not allowed.\n\n" +
      "Use the buttons below to vote. Type `!rep` to view your reputation, `!rep @member` to view another member, `!rep stats [@member]` for vote totals, `!rep comments [@member]` for comments, or `!rep top` for the rankings.")
    .setFooter({ text: "Kindness looks good on everyone ♡" });
  return { embeds: [embed], components: [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(PREFIX + "vote-positive").setLabel("Give Positive").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(PREFIX + "vote-negative").setLabel("Give Negative").setStyle(ButtonStyle.Danger),
    ),
  ] };
}
export function buildTopEmbed(store, guild) {
  const ranking = store.getTop(guild.id, 1000);
  const positive = ranking.filter((item) => item.reputation > 0).sort((a, b) => b.reputation - a.reputation).slice(0, 10);
  const negative = ranking.filter((item) => item.reputation < 0).sort((a, b) => a.reputation - b.reputation).slice(0, 10);
  const positiveText = positive.length
    ? positive.map((item, i) => `**${i + 1}.** <@${item.userId}> — **+${item.reputation}** rep`).join("\n")
    : "No positive scores yet ♡";
  const negativeText = negative.length
    ? negative.map((item, i) => `**${i + 1}.** <@${item.userId}> — **${item.reputation}** rep`).join("\n")
    : "No negative scores yet ♡";
  const description = `**♡ Positive Reputation**\n${positiveText}\n\n**♡ Negative Reputation**\n${negativeText}`;
  return { embeds: [new EmbedBuilder().setColor(COLOR).setTitle("୨୧ 𝓣𝓸𝓹 𝓡𝓮𝓹𝓾𝓽𝓪𝓽𝓲𝓸𝓷 ♡")
    .setDescription(description).setFooter({ text: "Updated whenever a new comment is published ♡" })] };
}
async function upsert(channel, client, title, payload) {
  const recent = await channel.messages.fetch({ limit: 50 });
  const old = recent.find((m) => m.author.id === client.user.id && m.embeds.some((e) => e.title === title));
  return old ? old.edit(payload) : channel.send(payload);
}
async function ensureTextChannel(guild, name) {
  return guild.channels.cache.find((c) => c.type === ChannelType.GuildText && c.name === name) ?? null;
}
const TOP_TITLE = "୨୧ 𝓣𝓸𝓹 𝓡𝓮𝓹𝓾𝓽𝓪𝓽𝓲𝓸𝓷 ♡";
const PANEL_TITLE = "୨୧ 𝓡𝓮𝓹𝓾𝓽𝓪𝓽𝓲𝓸𝓷 ♡";

async function ensureStickyReputationPanels(channel, client, store, guild) {
  const recent = await channel.messages.fetch({ limit: 100 });
  for (const [title, payload] of [[TOP_TITLE, buildTopEmbed(store, guild)], [PANEL_TITLE, makePanelPayload()]]) {
    const matches = [...recent.values()].filter((message) => message.author?.id === client.user.id && message.embeds.some((embed) => embed.title === title)).sort((a, b) => a.createdTimestamp - b.createdTimestamp);
    const existing = matches.shift();
    if (existing) await existing.edit(payload); else await channel.send(payload);
    for (const duplicate of matches) await duplicate.delete().catch((error) => { if (error?.code !== 10008) console.error("[reputation] duplicate panel could not be removed: " + error.message); });
  }
}

export function buildReputationCommandsEmbed() {
  return new EmbedBuilder().setColor(COLOR).setTitle(REPUTATION_COMMANDS_TITLE)
    .setDescription([
      "**Reputation commands**",
      "`!rep` — view your own reputation score, votes and recent comments.",
      "`!rep @member` — view another member's reputation.",
      "`!rep stats [@member]` — view total reputation, positive and negative votes, and comments received.",
      "`!rep comments [@member]` — view recent reputation comments.",
      "`!rep top` — view the positive and negative reputation rankings.",
      "",
      "**Reputation panel**",
      "Use the Give Positive and Give Negative buttons in the reputation panel to vote. Each member has one active vote per person and may change it later.",
    ].join("\\n"))
    .setFooter({ text: "Only reputation commands are listed here ♡" });
}

async function ensureReputationCommandsPanel(guild, client) {
  const channel = await guild.channels.fetch(REPUTATION_COMMANDS_CHANNEL_ID).catch(() => null);
  if (!channel || channel.type !== ChannelType.GuildText) {
    console.warn("[reputation] commands-only channel " + REPUTATION_COMMANDS_CHANNEL_ID + " was not found; no channel was created.");
    return null;
  }
  const recent = await channel.messages.fetch({ limit: 100 });
  const matches = [...recent.values()].filter((message) =>
    message.author?.id === client.user.id && message.embeds.some((embed) => embed.title === REPUTATION_COMMANDS_TITLE),
  ).sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  const existing = matches.shift();
  if (existing) await existing.edit({ embeds: [buildReputationCommandsEmbed()] });
  else await channel.send({ embeds: [buildReputationCommandsEmbed()] });
  for (const duplicate of matches) await duplicate.delete().catch((error) => {
    if (error?.code !== 10008) console.error("[reputation] duplicate commands panel could not be removed: " + error.message);
  });
  return channel;
}

async function setup(guild, client, store) {
  const reputation = await guild.channels.fetch(REPUTATION_CHANNEL_ID).catch(() => null);
  if (!reputation || reputation.type !== ChannelType.GuildText) throw new Error("Configured reputation channel " + REPUTATION_CHANNEL_ID + " was not found; no channel was created.");
  const welcomes = null;
  for (const channel of [reputation]) {
    await channel.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: true, SendMessages: false },
      "Keep Kittisugar welcome and reputation channels read-only");
    await channel.permissionOverwrites.edit(client.user.id, {
      ViewChannel: true, SendMessages: true, EmbedLinks: true, ReadMessageHistory: true, ManageMessages: true,
    }, "Allow Sugar to maintain welcome and reputation panels");
  }
  await ensureStickyReputationPanels(reputation, client, store, guild);
  return { welcomes, reputation };
}
function warningPayload(targetId) {
  return { content: `Before continuing: reputation comments are public and should be honest, respectful, and based on genuine interactions. Harassment, insults, private information, and fake comments are not allowed. Staff can review anonymous posts. Do you agree to these rules before commenting about <@${targetId}>?`,
    ephemeral: true, components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(PREFIX + "accept:" + targetId).setLabel("I Agree ♡").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(PREFIX + "cancel").setLabel("Cancel").setStyle(ButtonStyle.Secondary),
    )] };
}
function modePayload(targetId, canAnon) {
  const buttons = [new ButtonBuilder().setCustomId(PREFIX + "mode:named:" + targetId).setLabel("With My Name ♡").setStyle(ButtonStyle.Primary)];
  if (canAnon) buttons.push(new ButtonBuilder().setCustomId(PREFIX + "mode:anonymous:" + targetId).setLabel("Anonymous ♡").setStyle(ButtonStyle.Secondary));
  return { content: "Choose how your comment will be published:",
    components: [new ActionRowBuilder().addComponents(...buttons)] };
}
function voteModal(targetId, value) {
  const modal = new ModalBuilder()
    .setCustomId(PREFIX + "vote-submit:" + targetId + ":" + value)
    .setTitle(value > 0 ? "Give Positive Reputation" : "Give Negative Reputation");
  modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("comment")
    .setLabel("Comment (optional)").setPlaceholder("Add a short explanation, or leave blank...")
    .setStyle(TextInputStyle.Paragraph).setMaxLength(MAX_COMMENT_LENGTH).setRequired(false)));
  return modal;
}
function commentModal(targetId, anonymous) {
  const modal = new ModalBuilder().setCustomId(PREFIX + "submit:" + targetId + ":" + (anonymous ? "anonymous" : "named"))
    .setTitle("Leave a Reputation Comment");
  modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("body")
    .setLabel("Your comment").setPlaceholder("Write something kind and genuine...")
    .setStyle(TextInputStyle.Paragraph).setMinLength(3).setMaxLength(MAX_COMMENT_LENGTH).setRequired(true)));
  return modal;
}
async function ephemeral(interaction, content) {
  if (interaction.deferred || interaction.replied) return interaction.followUp({ content, ephemeral: true });
  return interaction.reply({ content, ephemeral: true });
}
export function attachReputationSystem(client, store) {
  client.once(Events.ClientReady, async () => {
    for (const guild of client.guilds.cache.values()) {
      try { await setup(guild, client, store); }
      catch (error) { console.error("[reputation] setup failed: " + error.message); }
    }
  });
  client.on(Events.GuildCreate, (guild) => { void setup(guild, client, store).catch((e) => console.error("[reputation] setup failed: " + e.message)); });
  client.on(Events.GuildMemberAdd, async (newMember) => {
    try {
      const channel = newMember.guild.channels.cache.find((c) => c.type === ChannelType.GuildText && c.name === "welcomes");
      if (!channel) return;
      const guideChannel = newMember.guild.channels.cache.find((c) => c.type === ChannelType.GuildText && /guide/i.test(c.name));
      const embed = new EmbedBuilder().setColor(COLOR).setTitle("୨୧ 𝓦𝓮𝓵𝓬𝓸𝓶𝓮 𝓽𝓸 𝓚𝓲𝓽𝓽𝓲𝓼𝓾𝓰𝓪𝓻 ♡")
        .setDescription(`Welcome, <@${newMember.id}>! We're so happy you're here.\n\nTake a little moment to read the rules and visit ${guideChannel ? `<#${guideChannel.id}>` : "**Guide**"} to find your way around. We hope Kittisugar feels like a sweet place to call home. ♡\n\nYou're member **#${newMember.guild.memberCount}**.`)
        .setThumbnail(newMember.user.displayAvatarURL({ size: 256 })).setFooter({ text: "Make yourself at home ♡" }).setTimestamp();
      await channel.send({ embeds: [embed], allowedMentions: { users: [newMember.id] } });
    } catch (error) { console.error("[welcome] could not send welcome card: " + error.message); }
  });
  client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isButton() && interaction.customId.startsWith(PREFIX)) {
      const parts = interaction.customId.slice(PREFIX.length).split(":");
      const [action, value, targetId] = parts;
      try {
        if (!interaction.inGuild()) return ephemeral(interaction, "This only works inside Kittisugar.");
        if (action === "vote-positive" || action === "vote-negative") {
          if (!member(interaction.member)) return ephemeral(interaction, "Complete Kittisugar verification first to use reputation.");
          const value = action === "vote-positive" ? 1 : -1;
          const picker = new UserSelectMenuBuilder().setCustomId(PREFIX + "vote-target:" + value).setPlaceholder("Choose a member...").setMinValues(1).setMaxValues(1);
          return interaction.reply({ content: value > 0 ? "Who should receive positive reputation?" : "Who should receive negative reputation?", ephemeral: true, components: [new ActionRowBuilder().addComponents(picker)] });
        }
        if (action === "start") {
          if (!member(interaction.member)) return ephemeral(interaction, "Complete Kittisugar verification first to use reputation.");
          const picker = new UserSelectMenuBuilder().setCustomId(PREFIX + "target").setPlaceholder("Choose a member...")
            .setMinValues(1).setMaxValues(1);
          return interaction.reply({ content: "Who would you like to leave a comment for?", ephemeral: true,
            components: [new ActionRowBuilder().addComponents(picker)] });
        }
        if (action === "cancel") return interaction.update({ content: "No comment was published.", components: [] });
        if (action === "accept") {
          if (!member(interaction.member)) return ephemeral(interaction, "Complete verification first.");
          const target = await interaction.guild.members.fetch(value).catch(() => null);
          if (!target || target.id === interaction.user.id || target.user.bot) return ephemeral(interaction, "Choose another server member.");
          return interaction.update(modePayload(target.id, vip(interaction.member)));
        }
        if (action === "mode") {
          const anonymous = value === "anonymous";
          const target = await interaction.guild.members.fetch(targetId).catch(() => null);
          if (!target || target.id === interaction.user.id || (anonymous && !vip(interaction.member))) return ephemeral(interaction, "That publication option is not available.");
          return interaction.showModal(commentModal(target.id, anonymous));
        }
      } catch (error) { console.error("[reputation] button failed: " + error.message); return ephemeral(interaction, "Something went wrong. Please try again."); }
    }
    if (interaction.isUserSelectMenu() && interaction.customId.startsWith(PREFIX + "vote-target:")) {
      try {
        if (!interaction.inGuild() || !member(interaction.member)) return ephemeral(interaction, "Complete verification first.");
        const value = Number(interaction.customId.slice((PREFIX + "vote-target:").length));
        const targetId = interaction.values[0];
        const target = await interaction.guild.members.fetch(targetId).catch(() => null);
        if (!target || target.id === interaction.user.id || target.user.bot) return ephemeral(interaction, "Choose another server member.");
        return interaction.showModal(voteModal(targetId, value));
      } catch (error) { console.error("[reputation] vote failed: " + error.message); return ephemeral(interaction, "I couldn't record that vote. Please try again."); }
    }
    if (interaction.isUserSelectMenu() && interaction.customId === PREFIX + "target") {
      if (!interaction.inGuild() || !member(interaction.member)) return ephemeral(interaction, "Complete verification first.");
      const targetId = interaction.values[0];
      const target = await interaction.guild.members.fetch(targetId).catch(() => null);
      if (!target || target.id === interaction.user.id || target.user.bot) return ephemeral(interaction, "Choose another server member.");
      return interaction.reply(warningPayload(target.id));
    }
    if (interaction.isModalSubmit() && interaction.customId.startsWith(PREFIX + "vote-submit:")) {
      const [, targetId, rawValue] = interaction.customId.slice(PREFIX.length).split(":");
      try {
        if (!interaction.inGuild() || !member(interaction.member)) return ephemeral(interaction, "Complete verification first.");
        const target = await interaction.guild.members.fetch(targetId).catch(() => null);
        const value = Number(rawValue);
        if (!target || target.id === interaction.user.id || target.user.bot || ![-1, 1].includes(value)) {
          return ephemeral(interaction, "Choose another server member.");
        }
        const comment = interaction.fields.getTextInputValue("comment").trim();
        const score = store.vote({ guildId: interaction.guildId, authorId: interaction.user.id, targetId, value, comment });
        const channel = interaction.guild.channels.cache.get(REPUTATION_CHANNEL_ID);
        if (channel) {
          if (comment) {
            const embed = new EmbedBuilder().setColor(COLOR)
              .setTitle(value > 0 ? "୨୧ 𝓟𝓸𝓼𝓲𝓽𝓲𝓿𝓮 𝓡𝓮𝓹𝓾𝓽𝓪𝓽𝓲𝓸𝓷 ♡" : "୨୧ 𝓝𝓮𝓰𝓪𝓽𝓲𝓿𝓮 𝓡𝓮𝓹𝓾𝓽𝓪𝓽𝓲𝓸𝓷 ♡")
              .setDescription(`**For:** <@${targetId}>\n**From:** <@${interaction.user.id}>\n\n${comment}`)
              .setFooter({ text: "Kittisugar Reputation ♡" }).setTimestamp();
            await channel.send({ embeds: [embed], allowedMentions: { parse: [], users: [targetId, interaction.user.id] } });
          }
          await upsert(channel, client, "୨୧ 𝓣𝓸𝓹 𝓡𝓮𝓹𝓾𝓽𝓪𝓽𝓲𝓸𝓷 ♡", buildTopEmbed(store, interaction.guild));
        }
        return interaction.reply({ content: `${value > 0 ? "Positive" : "Negative"} reputation recorded for <@${targetId}>. Their score is now **${score}**${comment ? " and your comment was published" : ""} ♡`, ephemeral: true, allowedMentions: { users: [targetId] } });
      } catch (error) {
        console.error("[reputation] vote submission failed: " + error.message);
        return ephemeral(interaction, "I couldn't record that vote. Please try again.");
      }
    }
    if (interaction.isModalSubmit() && interaction.customId.startsWith(PREFIX + "submit:")) {
      const [, targetId, mode] = interaction.customId.slice(PREFIX.length).split(":");
      try {
        if (!interaction.inGuild() || !member(interaction.member)) return ephemeral(interaction, "Complete verification first.");
        const anonymous = mode === "anonymous";
        if (anonymous && !vip(interaction.member)) return ephemeral(interaction, "Anonymous comments are VIP-only.");
        const target = await interaction.guild.members.fetch(targetId).catch(() => null);
        if (!target || target.id === interaction.user.id || target.user.bot) return ephemeral(interaction, "Choose another server member.");
        const text = interaction.fields.getTextInputValue("body");
        store.add({ guildId: interaction.guildId, authorId: interaction.user.id, targetId, text, anonymous });
        const channel = interaction.guild.channels.cache.find((c) => c.type === ChannelType.GuildText && c.name === "reputation");
        if (channel) {
          const embed = new EmbedBuilder().setColor(COLOR).setTitle("୨୧ 𝓝𝓮𝔀 𝓡𝓮𝓹𝓾𝓽𝓪𝓽𝓲𝓸𝓷 ♡")
            .setDescription(`**For:** <@${targetId}>\n**From:** ${anonymous ? "Anonymous VIP" : "<@" + interaction.user.id + ">"}\n\n${text.slice(0, 3500)}`)
            .setFooter({ text: "Kittisugar Reputation ♡" }).setTimestamp();
          await channel.send({ embeds: [embed], allowedMentions: { parse: [], users: [targetId, ...(anonymous ? [] : [interaction.user.id])] } });
          await upsert(channel, client, "୨୧ 𝓣𝓸𝓹 𝓡𝓮𝓹𝓾𝓽𝓪𝓽𝓲𝓸𝓷 ♡", buildTopEmbed(store, interaction.guild));
        }
        return interaction.reply({ content: "Your reputation comment has been published ♡", ephemeral: true });
      } catch (error) {
        if (error.message.includes("24 hours")) return ephemeral(interaction, error.message);
        console.error("[reputation] submission failed: " + error.message);
        return ephemeral(interaction, "I couldn't publish that comment. Please try again.");
      }
    }
  });
  client.on(Events.MessageCreate, async (message) => {
    if (!message.guild || message.author.bot || !/^!rep(?:\s|$)/i.test(message.content.trim())) return;
    const args = message.content.trim().split(/\s+/).slice(1);
    const mentioned = message.mentions.users.first();
    try {
      if (args[0]?.toLowerCase() === "stats") {
        const target = mentioned ?? message.author;
        const score = store.getScore(message.guild.id, target.id);
        const votes = store.getVoteBreakdown(message.guild.id, target.id);
        const comments = store.getCommentsForUser(message.guild.id, target.id).length;
        const embed = new EmbedBuilder().setColor(COLOR).setTitle("୨୧ Reputation Stats ♡")
          .setDescription(`**Member:** <@${target.id}>\n**Total reputation:** ${score}\n**Positive votes:** ${votes.positive}\n**Negative votes:** ${votes.negative}\n**Comments received:** ${comments}`);
        return message.reply({ embeds: [embed], allowedMentions: { parse: [] } });
      }
      if (args[0]?.toLowerCase() === "comments") {
        if (args.length > 1 && !mentioned) return message.reply("Select a member mention. Usage: !rep comments @member ♡");
        const target = mentioned ?? message.author;
        const entries = store.getCommentsForUser(message.guild.id, target.id).slice(-10).reverse();
        const body = entries.length ? entries.map((item) => `**${item.anonymous ? "Anonymous VIP" : "<@" + item.authorId + ">"}** · <t:${Math.floor(Date.parse(item.createdAt) / 1000)}:R>\n${item.text}`).join("\n\n").slice(0, 3800) : "No comments yet ♡";
        const embed = new EmbedBuilder().setColor(COLOR).setTitle("୨୧ Reputation Comments ♡").setDescription(`**Member:** <@${target.id}>\n\n${body}`);
        return message.reply({ embeds: [embed], allowedMentions: { parse: [] } });
      }
      if (args[0]?.toLowerCase() === "top") {
        const top = store.getTop(message.guild.id, 1000);
        const embed = new EmbedBuilder().setColor(COLOR).setTitle("୨୧ 𝓣𝓸𝓹 𝓡𝓮𝓹𝓾𝓽𝓪𝓽𝓲𝓸𝓷 ♡")
          .setDescription(top.length ? [
            "**♡ Positive Reputation**",
            ...top.filter((x) => x.reputation > 0).slice(0, 10).map((x, i) => `**${i + 1}.** <@${x.userId}> — **+${x.reputation}** rep`),
            "",
            "**♡ Negative Reputation**",
            ...top.filter((x) => x.reputation < 0).sort((a, b) => a.reputation - b.reputation).slice(0, 10).map((x, i) => `**${i + 1}.** <@${x.userId}> — **${x.reputation}** rep`),
          ].join("\n") : "No reputation votes yet ♡");
        return message.reply({ embeds: [embed], allowedMentions: { parse: [] } });
      }
      if (args[0]?.startsWith("@") && !mentioned) {
        return message.reply("Please select a member mention from Discord's suggestions. Usage: `!rep @member` ♡");
      }
      const target = mentioned ?? message.author;
      const count = store.getScore(message.guild.id, target.id);
      const votes = store.getVoteBreakdown(message.guild.id, target.id);
      const entries = store.getCommentsForUser(message.guild.id, target.id).slice(-5).reverse();
      const comments = entries.length
        ? entries.map((x) => `**${x.anonymous ? "Anonymous VIP" : "<@" + x.authorId + ">"}** · <t:${Math.floor(Date.parse(x.createdAt) / 1000)}:R>\n${x.text}`).join("\n\n").slice(0, 2500)
        : "No comments yet ♡";
      const embed = new EmbedBuilder().setColor(COLOR).setTitle("୨୧ Reputation ♡")
        .setDescription(
          `**Member:** <@${target.id}>\n**Total reputation:** ${count}\n\n` +
          `**♡ Positive votes:** ${votes.positive}\n**♡ Negative votes:** ${votes.negative}\n\n` +
          `**Comments**\n${comments}`
        );
      return message.reply({ embeds: [embed], allowedMentions: { parse: [] } });
    } catch (error) { console.error("[reputation] command failed: " + error.message); }
  });
}
