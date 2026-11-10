import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Events,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { registerApplicationCommands } from "./command-registry.js";

const COMMAND = "roles-organize";
const PREFIX = "sugar-roles-organize:";
const COLOR = 0xffd9ff;
const pending = new Map();

const DIVIDERS = [
  ["colors", "୨୧ ── 𝓒𝓞𝓛𝓞𝓡𝓔𝓢 ── ୨୧"],
  ["staff", "୨୧ ── 𝓐𝓓𝓜𝓘𝓝𝓘𝓢𝓣𝓡𝓐𝓒𝓘Ó𝓝 ── ୨୧"],
  ["community", "୨୧ ── 𝓒𝓞𝓜𝓤𝓝𝓘𝓓𝓐𝓓 ── ୨୧"],
  ["ages", "୨୧ ── 𝓔𝓓𝓐𝓓𝓔𝓢 ── ୨୧"],
  ["identity", "୨୧ ── 𝓘𝓓𝓔𝓝𝓣𝓘𝓓𝓐𝓓 ── ୨୧"],
  ["access", "୨୧ ── 𝓐𝓒𝓒𝓔𝓢𝓞 ── ୨୧"],
];

export function normalizeRoleName(value) {
  return String(value ?? "").normalize("NFKD").toLowerCase().replace(/\p{M}/gu, "").replace(/[^a-z0-9]/g, "");
}

function findRole(roles, aliases) {
  const wanted = new Set(aliases.map(normalizeRoleName));
  return roles.find((role) => wanted.has(normalizeRoleName(role.name))) ?? null;
}

function findAgeRoles(roles) {
  return roles
    .map((role) => ({ role, match: normalizeRoleName(role.name).match(/^age(18-|\d{1,2})$/u) }))
    .filter((item) => item.match)
    .sort((a, b) => {
      const value = (item) => item.match[1] === "18-" ? 17 : Number(item.match[1]);
      return value(a) - value(b);
    })
    .map((item) => item.role);
}

function requireRole(roles, aliases, label) {
  const role = findRole(roles, aliases);
  if (!role) throw new Error("Couldn't find the existing " + label + " role. No roles were changed.");
  return role;
}

export function buildRoleOrganizationPlan(roles) {
  if (!Array.isArray(roles)) throw new Error("A role list is required.");
  const editable = roles.filter((role) => !role.managed && !role.everyone && role.id !== role.guild?.id);
  const byName = editable;
  const owner = requireRole(byName, ["owner"], "Owner");
  const colors = ["pink", "red", "orange", "yellow", "green", "cyan", "blue", "purple", "white", "gray", "brown", "black"]
    .map((name) => requireRole(byName, ["color-" + name, name], "color " + name));
  const admin = requireRole(byName, ["admin"], "Admin");
  const mod = requireRole(byName, ["mod"], "Mod");
  const staff = requireRole(byName, ["staff"], "Staff");
  const community = [
    requireRole(byName, ["new"], "New"),
    requireRole(byName, ["member"], "Member"),
    requireRole(byName, ["verified"], "Verified"),
    requireRole(byName, ["vip"], "VIP"),
    requireRole(byName, ["booster", "serverbooster"], "Booster"),
  ];
  const ages = findAgeRoles(byName);
  const gender = ["female", "male", "trans", "nonbinary"].map((name) => findRole(byName, ["gender-" + name, name])).filter(Boolean);
  const sexuality = ["straight", "gaylesbian", "bisexual", "pansexual", "asexual", "prefernottosay"]
    .map((name) => findRole(byName, ["sexuality-" + name, name])).filter(Boolean);
  const nsfw = [
    findRole(byName, ["nsfw"]),
    findRole(byName, ["nsfwhidden"]),
  ].filter(Boolean);

  if (!ages.length || !gender.length || !sexuality.length || nsfw.length !== 2) {
    throw new Error("The role inventory is incomplete. No roles were changed.");
  }

  const groups = [
    { divider: "colors", roles: colors },
    { divider: "staff", roles: [admin, mod, staff] },
    { divider: "community", roles: community },
    { divider: "ages", roles: ages },
    { divider: "identity", roles: [...gender, ...sexuality] },
    { divider: "access", roles: nsfw },
  ];
  return { owner, groups, orderedRoles: [owner, ...groups.flatMap((group) => group.roles)] };
}

export function buildRoleOrganizationCommand() {
  return new SlashCommandBuilder()
    .setName(COMMAND)
    .setDescription("Preview and safely organize Kittisugar server roles")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles.toString())
    .toJSON();
}

async function registerGuild({ token, applicationId }, guildId) {
  await registerApplicationCommands({ token, applicationId, guildId, commands: [buildRoleOrganizationCommand()] });
}

export function attachRoleOrganizationSystem(client, { token, applicationId }) {
  let ready = false;
  client.once(Events.ClientReady, () => {
    ready = true;
    for (const guild of client.guilds.cache.values()) {
      void registerGuild({ token, applicationId }, guild.id).catch((error) => console.error("[roles-organize] command registration failed: " + error.message));
    }
  });
  client.on(Events.GuildCreate, (guild) => {
    if (ready) void registerGuild({ token, applicationId }, guild.id).catch((error) => console.error("[roles-organize] command registration failed: " + error.message));
  });
  client.on(Events.InteractionCreate, (interaction) => {
    if (interaction.isChatInputCommand() && interaction.commandName === COMMAND) {
      void previewOrganization(interaction).catch((error) => fail(interaction, error));
    } else if (interaction.isButton() && interaction.customId.startsWith(PREFIX)) {
      void handleOrganizationButton(interaction).catch((error) => fail(interaction, error));
    }
  });
}

async function previewOrganization(interaction) {
  if (!interaction.inGuild()) return interaction.reply({ content: "Use this command inside Kittisugar.", ephemeral: true });
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles)) return interaction.reply({ content: "You need Manage Roles permission.", ephemeral: true });
  const me = interaction.guild.members.me;
  if (!me?.permissions.has(PermissionFlagsBits.ManageRoles)) return interaction.reply({ content: "Sugar needs Manage Roles permission to do this.", ephemeral: true });
  await interaction.deferReply({ ephemeral: true });
  const fetched = await interaction.guild.roles.fetch();
  const roles = [...fetched.values()];
  const plan = buildRoleOrganizationPlan(roles);
  if (plan.orderedRoles.some((role) => !role.editable)) {
    throw new Error("Sugar cannot manage one or more roles in the proposed order. Raise Sugar's role above them first; no roles were changed.");
  }
  const id = interaction.id;
  pending.set(id, { guildId: interaction.guildId, userId: interaction.user.id, expiresAt: Date.now() + 5 * 60_000 });
  const summary = [
    "**COLORES** — Pink → Red → Orange → Yellow → Green → Cyan → Blue → Purple → White → Gray → Brown → Black",
    "**ADMINISTRACIÓN** — Admin → Mod → Staff",
    "**COMUNIDAD** — New → Member → Verified → VIP → Booster",
    "**EDADES** — 18− → 18–40",
    "**IDENTIDAD** — Género → Sexualidad",
    "**ACCESO** — NSFW → NSFW-hidden",
  ].join("\n\n");
  const embed = new EmbedBuilder().setColor(COLOR).setTitle("୨୧ Kittisugar Role Organization ♡")
    .setDescription("This will reorder the existing roles and create six neutral divider roles. **Colors will sit above Admin/Mod/Staff**, while Booster stays in Community.\n\n" + summary +
      "\n\nNo existing role permissions or colors will be changed. Sugar AI, Owner, Discord-managed roles, and @everyone will not be edited. The action is limited to this server.")
    .setFooter({ text: "Only you can see this preview · expires in 5 minutes ♡" });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(PREFIX + "apply:" + id).setLabel("Apply organization ♡").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(PREFIX + "cancel:" + id).setLabel("Cancel").setStyle(ButtonStyle.Secondary),
  );
  return interaction.editReply({ embeds: [embed], components: [row] });
}

async function handleOrganizationButton(interaction) {
  const [, action, id] = interaction.customId.split(":");
  const request = pending.get(id);
  if (!request || request.guildId !== interaction.guildId || request.expiresAt < Date.now()) {
    pending.delete(id);
    return interaction.reply({ content: "This preview expired. Run /roles-organize again.", ephemeral: true });
  }
  if (request.userId !== interaction.user.id) return interaction.reply({ content: "Only the person who opened this preview can confirm it.", ephemeral: true });
  if (action === "cancel") {
    pending.delete(id);
    return interaction.update({ content: "Organization cancelled. No roles were changed.", embeds: [], components: [] });
  }
  if (action !== "apply") return;
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles)) return interaction.reply({ content: "You need Manage Roles permission.", ephemeral: true });
  await interaction.deferUpdate();
  pending.delete(id);
  const guild = interaction.guild;
  const me = guild.members.me;
  if (!me?.permissions.has(PermissionFlagsBits.ManageRoles)) throw new Error("Sugar no longer has Manage Roles permission.");
  const fetched = await guild.roles.fetch();
  const plan = buildRoleOrganizationPlan([...fetched.values()]);
  if (plan.orderedRoles.some((role) => !role.editable)) throw new Error("Sugar cannot manage every role in this organization. No roles were moved.");
  const dividerRoles = [];
  for (const [key, name] of DIVIDERS) {
    let divider = fetched.find((role) => normalizeRoleName(role.name) === normalizeRoleName(name));
    if (!divider) {
      divider = await guild.roles.create({
        name,
        permissions: [],
        color: 0,
        hoist: false,
        mentionable: false,
        reason: "Create a neutral Kittisugar role category divider",
      });
    }
    if (!divider.editable) throw new Error("Sugar cannot manage the " + key + " divider role.");
    dividerRoles.push({ key, role: divider });
  }
  const ordered = [];
  for (const group of plan.groups) {
    const divider = dividerRoles.find((item) => item.key === group.divider)?.role;
    if (divider) ordered.push(divider);
    ordered.push(...group.roles);
  }
  // Owner remains above every reorganized role. Discord-managed integration roles are untouched.
  ordered.push(plan.owner);
  const updates = ordered.reverse().map((role, index) => ({ role: role.id, position: index + 1 }));
  await guild.roles.setPositions(updates, "Apply the confirmed Kittisugar role organization");
  return interaction.editReply({ content: "୨୧ Role organization applied ♡ The colors are above staff and community, and Booster is in Community. No existing permissions or role colors were changed.", embeds: [], components: [] });
}

async function fail(interaction, error) {
  console.error("[roles-organize] " + error.message);
  const content = "Sugar couldn't organize the roles: " + error.message;
  if (interaction.deferred || interaction.replied) await interaction.followUp({ content, ephemeral: true }).catch(() => {});
  else await interaction.reply({ content, ephemeral: true }).catch(() => {});
}
