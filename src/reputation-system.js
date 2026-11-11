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
  getTop(guildId, limit = 10) {
    const totals = new Map();
    for (const item of this.data.guilds[guildId] ?? []) totals.set(item.targetId, (totals.get(item.targetId) ?? 0) + 1);
    return [...totals].map(([userId, reputation]) => ({ userId, reputation }))
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
function makePanelPayload() {
  const embed = new EmbedBuilder().setColor(COLOR).setTitle("୨୧ 𝓡𝓮𝓹𝓾𝓽𝓪𝓽𝓲𝓸𝓷 ♡")
    .setDescription("Leave a kind, genuine comment about another member and help celebrate the people who make Kittisugar special.\n\n" +
      "**How it works**\n" +
      "♡ Press **Leave a Comment** and choose a member.\n" +
      "♡ Read and accept the warning before writing.\n" +
      "♡ Members publish with their name. VIP may choose named or anonymous.\n" +
      "♡ Each approved comment gives the recipient **+1 reputation**. One comment per author/member pair every 24 hours.\n" +
      "♡ Be respectful. Harassment, fake reviews, threats, private information, and spam are not allowed. Staff may review anonymous submissions.\n\n" +
      "**Commands**\n" +
      "`!rep` — your reputation.\n`!rep @member` — view a member.\n`!rep top` — show the ranking.\n`!rep comments @member` — read their comments.")
    .setFooter({ text: "Kindness looks good on everyone ♡" });
  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(PREFIX + "start").setLabel("Leave a Comment ♡").setStyle(ButtonStyle.Primary),
  )] };
}
function buildTopEmbed(store, guild) {
  const top = store.getTop(guild.id, 10);
  const description = top.length
    ? top.map((item, i) => `**${i + 1}.** <@${item.userId}> — **${item.reputation}** rep`).join("\n")
    : "No reputation comments yet. Be the first to spread some kindness ♡";
  return { embeds: [new EmbedBuilder().setColor(COLOR).setTitle("୨୧ 𝓣𝓸𝓹 𝓡𝓮𝓹𝓾𝓽𝓪𝓽𝓲𝓸𝓷 ♡")
    .setDescription(description).setFooter({ text: "Updated whenever a new comment is published ♡" })] };
}
async function upsert(channel, client, title, payload) {
  const recent = await channel.messages.fetch({ limit: 50 });
  const old = recent.find((m) => m.author.id === client.user.id && m.embeds.some((e) => e.title === title));
  const message = old ? await old.edit(payload) : await channel.send(payload);
  await message.pin().catch((error) => console.error("[reputation] could not pin sticky panel: " + error.message));
  return message;
}
async function ensureTextChannel(guild, name) {
  let channel = guild.channels.cache.find((c) => c.type === ChannelType.GuildText && c.name === name);
  if (channel) return channel;
  return guild.channels.create({ name, type: ChannelType.GuildText, reason: "Create Kittisugar community channel" });
}
async function setup(guild, client, store) {
  const welcomes = await ensureTextChannel(guild, "welcomes");
  const reputation = await ensureTextChannel(guild, "reputation");
  for (const channel of [welcomes, reputation]) {
    await channel.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: true, SendMessages: false },
      "Keep Kittisugar welcome and reputation channels read-only");
    await channel.permissionOverwrites.edit(client.user.id, {
      ViewChannel: true, SendMessages: true, EmbedLinks: true, ReadMessageHistory: true, ManageMessages: true,
    }, "Allow Sugar to maintain welcome and reputation panels");
  }
  await upsert(reputation, client, "୨୧ 𝓣𝓸𝓹 𝓡𝓮𝓹𝓾𝓽𝓪𝓽𝓲𝓸𝓷 ♡", buildTopEmbed(store, guild));
  await upsert(reputation, client, "୨୧ 𝓡𝓮𝓹𝓾𝓽𝓪𝓽𝓲𝓸𝓷 ♡", makePanelPayload());
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
      const channel = newMember.guild.channels.cache.find((c) => c.type === ChannelType.GuildText && c.name === "welcomes")
        ?? await ensureTextChannel(newMember.guild, "welcomes");
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
    if (interaction.isUserSelectMenu() && interaction.customId === PREFIX + "target") {
      if (!interaction.inGuild() || !member(interaction.member)) return ephemeral(interaction, "Complete verification first.");
      const targetId = interaction.values[0];
      const target = await interaction.guild.members.fetch(targetId).catch(() => null);
      if (!target || target.id === interaction.user.id || target.user.bot) return ephemeral(interaction, "Choose another server member.");
      return interaction.reply(warningPayload(target.id));
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
      if (args[0]?.toLowerCase() === "top") {
        const top = store.getTop(message.guild.id, 10);
        const embed = new EmbedBuilder().setColor(COLOR).setTitle("୨୧ 𝓣𝓸𝓹 𝓡𝓮𝓹𝓾𝓽𝓪𝓽𝓲𝓸𝓷 ♡")
          .setDescription(top.length ? top.map((x, i) => `**${i + 1}.** <@${x.userId}> — **${x.reputation}** rep`).join("\n") : "No comments yet ♡");
        return message.reply({ embeds: [embed], allowedMentions: { parse: [] } });
      }
      if (args[0]?.toLowerCase() === "comments" && mentioned) {
        const entries = store.getForUser(message.guild.id, mentioned.id).slice(-5).reverse();
        const embed = new EmbedBuilder().setColor(COLOR).setTitle("୨୧ Reputation Comments ♡")
          .setDescription(entries.length ? entries.map((x) => `**${x.anonymous ? "Anonymous VIP" : "<@" + x.authorId + ">"}** · <t:${Math.floor(Date.parse(x.createdAt) / 1000)}:R>\n${x.text}`).join("\n\n").slice(0, 4000) : "No comments for this member yet ♡");
        return message.reply({ embeds: [embed], allowedMentions: { parse: [] } });
      }
      const target = mentioned ?? message.author;
      const count = store.getForUser(message.guild.id, target.id).length;
      const embed = new EmbedBuilder().setColor(COLOR).setTitle("୨୧ Reputation ♡")
        .setDescription(`<@${target.id}> has **${count}** reputation point(s).\nUse ` + "`!rep comments @member`" + ` to read their latest comments.`);
      return message.reply({ embeds: [embed], allowedMentions: { parse: [] } });
    } catch (error) { console.error("[reputation] command failed: " + error.message); }
  });
}
