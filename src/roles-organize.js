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

export const KITTISUGAR_GUILD_ID = "1567093019377930363";
const COMMAND_NAME = "roles-organize";
const COLOR = 0xffd9ff;
const DIVIDERS = [
  "୨୧ ── 𝓐𝓓𝓜𝓘𝓝 ── ୨୧",
  "୨୧ ── 𝓒𝓞𝓛𝓞𝓡𝓔𝓢 ── ୨୧",
  "୨୧ ── 𝓒𝓞𝓜𝓤𝓝𝓘𝓓𝓐𝓓 ── ୨୧",
  "୨୧ ── 𝓔𝓓𝓐𝓓𝓔𝓢 ── ୨୧",
  "୨୧ ── 𝓘𝓓𝓔𝓝𝓣𝓘𝓓𝓐𝓓 ── ୨୧",
  "୨୧ ── 𝓐𝓒𝓒𝓔𝓢𝓞 ── ୨୧",
];

const ROLE_GROUPS = [
  {
    divider: DIVIDERS[0],
    roles: [
      ["1567796193268858950", "꒰ 𝒪𝓌𝓃𝑒𝓇 ! ꒱"],
      ["1568188570890403910", "꒰ 𝒶𝒹𝓂𝒾𝓃 ! ꒱"],
      ["1568188595171500123", "꒰ 𝓂ℴ𝒹 ! ꒱"],
      ["1569493295686746152", "꒰ 𝓈𝓉𝒶𝒻𝒻 ! ꒱"],
    ],
  },
  {
    divider: DIVIDERS[1],
    roles: [
      ["1569780848545235045", "꒰ 𝓅𝒾𝓃𝓀 ! ꒱"],
      ["1569807135775395941", "꒰ 𝓇ℯ𝒹 ! ꒱"],
      ["1569807145598329052", "꒰ ℴ𝓇𝒶𝓃𝑔ℯ ! ꒱"],
      ["1569807155253485708", "꒰ 𝓎ℯ𝓁𝓁ℴ𝓌 ! ꒱"],
      ["1569807169283686491", "꒰ 𝑔𝓇ℯℯ𝓃 ! ꒱"],
      ["1569807182415921174", "꒰ 𝒸𝓎𝒶𝓃 ! ꒱"],
      ["1569807196437356585", "꒰ 𝒷𝓁𝓊ℯ ! ꒱"],
      ["1569807215194415277", "꒰ 𝓅𝓊𝓇𝓅𝓁ℯ ! ꒱"],
      ["1569807243006705706", "꒰ 𝓌𝒽𝒾𝓉ℯ ! ꒱"],
      ["1569807253555388487", "꒰ 𝑔𝓇𝒶𝓎 ! ꒱"],
      ["1569807265060626653", "꒰ 𝒷𝓇ℴ𝓌𝓃 ! ꒱"],
      ["1569807276469129357", "꒰ 𝒷𝓁𝒶𝒸𝓀 ! ꒱"],
    ],
  },
  {
    divider: DIVIDERS[2],
    roles: [
      ["1568188492704522330", "꒰ 𝓃ℯ𝓌 ! ꒱"],
      ["1568188534836428812", "꒰ 𝓂ℯ𝓂𝒷ℯ𝓇 ! ꒱"],
      ["1568188714247524382", "꒰ 𝓋ℯ𝓇𝒾𝒻𝒾ℯ𝒹 ! ꒱"],
      ["1568188640113463437", "꒰ 𝒱ℐ𝒫 ! ꒱"],
      ["1569809500955738164", "꒰ 𝓑𝓸𝓸𝓼𝓽𝓮𝓻 ! ꒱"],
    ],
  },
  {
    divider: DIVIDERS[3],
    roles: [
      ["1569242096932622376", "꒰ 𝒜𝑔ℯ · 18- ! ꒱"],
      ["1569242097440260126", "꒰ 𝒜𝑔ℯ · 18 ! ꒱"],
      ["1569242100057378907", "꒰ 𝒜𝑔ℯ · 19 ! ꒱"],
      ["1569242100883525744", "꒰ 𝒜𝑔ℯ · 20 ! ꒱"],
      ["1569242101907193866", "꒰ 𝒜𝑔ℯ · 21 ! ꒱"],
      ["1569242102414573698", "꒰ 𝒜𝑔ℯ · 22 ! ꒱"],
      ["1569242103383597167", "꒰ 𝒜𝑔ℯ · 23 ! ꒱"],
      ["1569242104322854993", "꒰ 𝒜𝑔ℯ · 24 ! ꒱"],
      ["1569242104935354411", "꒰ 𝒜𝑔ℯ · 25 ! ꒱"],
      ["1569242105153331312", "꒰ 𝒜𝑔ℯ · 26 ! ꒱"],
      ["1569242106130731080", "꒰ 𝒜𝑔ℯ · 27 ! ꒱"],
      ["1569242106797629471", "꒰ 𝒜𝑔ℯ · 28 ! ꒱"],
      ["1569242107527430164", "꒰ 𝒜𝑔ℯ · 29 ! ꒱"],
      ["1569242107821170802", "꒰ 𝒜𝑔ℯ · 30 ! ꒱"],
      ["1569242109020733440", "꒰ 𝒜𝑔ℯ · 31 ! ꒱"],
      ["1569242109918052453", "꒰ 𝒜𝑔ℯ · 32 ! ꒱"],
      ["1569242110920499230", "꒰ 𝒜𝑔ℯ · 33 ! ꒱"],
      ["1569242111600107611", "꒰ 𝒜𝑔ℯ · 34 ! ꒱"],
      ["1569242112397017088", "꒰ 𝒜𝑔ℯ · 35 ! ꒱"],
      ["1569242112921313371", "꒰ 𝒜𝑔ℯ · 36 ! ꒱"],
      ["1569242113067978756", "꒰ 𝒜𝑔ℯ · 37 ! ꒱"],
      ["1569242114036994118", "꒰ 𝒜𝑔ℯ · 38 ! ꒱"],
      ["1569242114582249554", "꒰ 𝒜𝑔ℯ · 39 ! ꒱"],
      ["1569242115077177400", "꒰ 𝒜𝑔ℯ · 40 ! ꒱"],
    ],
  },
  {
    divider: DIVIDERS[4],
    roles: [
      ["1569638102949953567", "꒰ 𝒻ℯ𝓂𝒶𝓁ℯ ! ꒱"],
      ["1569807000278269983", "꒰ 𝓂𝒶𝓁ℯ ! ꒱"],
      ["1569807011217145948", "꒰ 𝓉𝓇𝒶𝓃𝓈 ! ꒱"],
      ["1569807020809396455", "꒰ 𝓃ℴ𝓃-𝒷𝒾𝓃𝒶𝓇𝓎 ! ꒱"],
      ["1569638169660489903", "꒰ 𝓈𝓉𝓇𝒶𝒾𝑔𝒽𝓉 ! ꒱"],
      ["1569807071765856307", "꒰ 𝑔𝒶𝓎-𝓁ℯ𝓈𝒷𝒾𝒶𝓃 ! ꒱"],
      ["1569807083769958422", "꒰ 𝒷𝒾𝓈ℯ𝓍𝓊𝒶𝓁 ! ꒱"],
      ["1569807093966438591", "꒰ 𝓅𝒶𝓃𝓈ℯ𝓍𝓊𝒶𝓁 ! ꒱"],
      ["1569807104917770284", "꒰ 𝒶𝓈ℯ𝓍𝓊𝒶𝓁 ! ꒱"],
      ["1569807116590649558", "꒰ 𝓅𝓇ℯ𝒻ℯ𝓇-𝓃ℴ𝓉-𝓉ℴ-𝓈𝒶𝓎 ! ꒱"],
    ],
  },
  {
    divider: DIVIDERS[5],
    roles: [
      ["1568483423608381600", "꒰ 𝓝𝓢𝓕𝓦 ! ꒱"],
      ["1569637397774340116", "꒰ 𝓃𝓈𝒻𝓌-𝒽𝒾𝒹𝒹ℯ𝓃 ! ꒱"],
    ],
  },
];

const EXPECTED_SPECIAL_ROLES = {
  sugarAi: "1567669697061724263",
  serverBooster: "1569802495792914593",
};

export function buildRoleOrganizationPlan(roles, guildId = KITTISUGAR_GUILD_ID) {
  if (guildId !== KITTISUGAR_GUILD_ID) throw new Error("This organizer is restricted to the Kittisugar server.");
  const byId = new Map(roles.map((role) => [role.id, role]));
  const missing = [];
  const ordered = [];
  const renames = [];

  const sugarAi = byId.get(EXPECTED_SPECIAL_ROLES.sugarAi);
  if (!sugarAi || !sugarAi.managed) missing.push("Sugar AI (managed role)");
  else ordered.push({ role: sugarAi, managed: true });

  for (const group of ROLE_GROUPS) {
    ordered.push({ dividerName: group.divider });
    for (const [id, name] of group.roles) {
      const role = byId.get(id);
      if (!role) {
        missing.push(id);
        continue;
      }
      if (role.managed || role.id === guildId) {
        missing.push(`${role.name} (unexpectedly managed or @everyone)`);
        continue;
      }
      ordered.push({ role });
      if (role.name !== name) renames.push({ role, name });
    }
  }

  const serverBooster = byId.get(EXPECTED_SPECIAL_ROLES.serverBooster);
  if (!serverBooster || !serverBooster.managed) missing.push("Server Booster (managed role)");
  // Discord owns this role. It is deliberately not renamed or moved.
  const everyone = byId.get(guildId);
  if (!everyone) missing.push("@everyone");
  if (missing.length) {
    const error = new Error("The live role inventory no longer matches the approved audit.");
    error.missing = missing;
    throw error;
  }

  return { ordered, renames, dividers: DIVIDERS, untouchedManaged: [sugarAi, serverBooster] };
}

export function buildRoleOrganizerCommand() {
  return new SlashCommandBuilder()
    .setName(COMMAND_NAME)
    .setDescription("Preview and safely organize Kittisugar roles")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles.toString())
    .toJSON();
}

async function registerForGuild({ token, applicationId }, guildId) {
  await registerApplicationCommands({
    token,
    applicationId,
    guildId,
    commands: [buildRoleOrganizerCommand()],
  });
}

export function attachRoleOrganizationSystem(client, { token, applicationId }) {
  let readyHandled = false;
  client.once(Events.ClientReady, () => {
    readyHandled = true;
    for (const guild of client.guilds.cache.values()) {
      void registerForGuild({ token, applicationId }, guild.id).catch((error) => {
        console.error(`[roles-organize] command registration failed in ${guild.id}: ${error.message}`);
      });
    }
  });
  client.on(Events.GuildCreate, (guild) => {
    if (!readyHandled) return;
    void registerForGuild({ token, applicationId }, guild.id).catch((error) => {
      console.error(`[roles-organize] command registration failed in ${guild.id}: ${error.message}`);
    });
  });
  client.on(Events.InteractionCreate, (interaction) => {
    if (!interaction.isChatInputCommand() || interaction.commandName !== COMMAND_NAME) return;
    void handleRoleOrganization(interaction).catch(async (error) => {
      console.error(`[roles-organize] failed in ${interaction.guildId ?? "unknown server"}: ${error.message}`);
      const content = "No pude preparar la organización. No se aplicaron cambios si el error ocurrió durante la revisión.";
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content, ephemeral: true }).catch(() => {});
      } else {
        await interaction.reply({ content, ephemeral: true }).catch(() => {});
      }
    });
  });
}

function hasManageRoles(interaction) {
  return Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles));
}

export async function handleRoleOrganization(interaction) {
  if (!interaction.inGuild()) {
    return interaction.reply({ content: "Este comando solo funciona dentro de Kittisugar.", ephemeral: true });
  }
  if (interaction.guildId !== KITTISUGAR_GUILD_ID) {
    return interaction.reply({ content: "Este comando está limitado al servidor Kittisugar.", ephemeral: true });
  }
  if (!hasManageRoles(interaction)) {
    return interaction.reply({ content: "Necesitas el permiso Manage Roles para usarlo.", ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });
  const guild = interaction.guild;
  await guild.roles.fetch();
  const plan = buildRoleOrganizationPlan([...guild.roles.cache.values()], guild.id);
  const me = await guild.members.fetchMe();
  if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return interaction.editReply({ content: "Sugar no tiene Manage Roles. No se modificó nada." });
  }

  const targetRoles = plan.ordered.filter((item) => item.role && !item.managed).map((item) => item.role);
  const notEditable = targetRoles.filter((role) => !role.editable);
  if (notEditable.length) {
    return interaction.editReply({
      content: `No haré cambios: Sugar no puede administrar estos roles por su jerarquía: ${notEditable.map((role) => role.name).join(", ")}.`,
    });
  }

  const dividerCollisions = DIVIDERS
    .map((name) => guild.roles.cache.find((role) => role.name === name))
    .filter(Boolean);
  const unsafeDividers = dividerCollisions.filter((role) =>
    role.managed || !role.editable || role.permissions.bitfield !== 0n || role.color !== 0,
  );
  if (unsafeDividers.length) {
    return interaction.editReply({
      content: `No haré cambios: ya existe un divisor con permisos, color o protección inesperados: ${unsafeDividers.map((role) => role.name).join(", ")}.`,
    });
  }

  const renameCount = plan.renames.length;
  const createCount = DIVIDERS.filter((name) => !dividerCollisions.some((role) => role.name === name)).length;
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle("୨୧ Organización de roles ♡")
    .setDescription(
      `Voy a organizar **${targetRoles.length} roles**, actualizar **${renameCount} nombres** y crear **${createCount} divisores**.\n\n` +
      "**Orden:** Administración → Colores → Comunidad (incluye Booster) → Edades → Identidad → Acceso.\n" +
      "Los colores quedarán por encima de los roles normales para que se vean en los nombres.\n\n" +
      "**No cambiaré** permisos, colores existentes, miembros asignados ni @everyone. Sugar AI y el rol administrado Server Booster quedarán intactos. Las edades no llevarán emojis.",
    )
    .setFooter({ text: "Vista previa privada · confirma solo si estás de acuerdo ♡" });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("roles-organize:confirm").setLabel("Aplicar organización").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("roles-organize:cancel").setLabel("Cancelar").setStyle(ButtonStyle.Secondary),
  );
  await interaction.editReply({ embeds: [embed], components: [row] });
  const message = await interaction.fetchReply();
  const collector = message.createMessageComponentCollector({ time: 90_000 });

  collector.on("collect", async (button) => {
    if (button.user.id !== interaction.user.id) {
      return button.reply({ content: "Solo quien inició esta vista previa puede confirmarla.", ephemeral: true });
    }
    if (button.customId === "roles-organize:cancel") {
      collector.stop("cancelled");
      return button.update({ content: "Organización cancelada. No se modificó nada.", embeds: [], components: [] });
    }
    if (button.customId !== "roles-organize:confirm") return;
    if (!button.memberPermissions?.has(PermissionFlagsBits.ManageRoles)) {
      return button.reply({ content: "Tu permiso Manage Roles ya no está disponible.", ephemeral: true });
    }
    collector.stop("confirmed");
    await button.update({ content: "Aplicando la organización de roles…", embeds: [], components: [] });
    try {
      const result = await applyRoleOrganization(guild, plan);
      await interaction.editReply({
        content: `Organización terminada: **${result.renamed} nombres**, **${result.created} divisores** y **${result.reordered} posiciones** actualizadas. No se tocaron permisos, colores ni miembros.${result.notes.length ? `\n\nOmitidos: ${result.notes.join("; ")}` : ""}`,
        embeds: [],
        components: [],
      });
    } catch (error) {
      console.error(`[roles-organize] apply failed in ${guild.id}: ${error.message}`);
      await interaction.editReply({
        content: `No pude completar la organización: ${error.message}. Revisa los roles en Discord antes de volver a intentarlo, porque un error de API durante la aplicación puede dejar cambios parciales.`,
        embeds: [],
        components: [],
      }).catch(() => {});
    }
  });

  collector.on("end", async (_collected, reason) => {
    if (reason === "time") {
      await interaction.editReply({ content: "La vista previa expiró. No se modificó nada.", embeds: [], components: [] }).catch(() => {});
    }
  });
}

export async function applyRoleOrganization(guild, plan) {
  await guild.roles.fetch();
  const me = await guild.members.fetchMe();
  if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) throw new Error("Sugar no longer has Manage Roles.");
  const currentById = guild.roles.cache;
  for (const item of plan.ordered) {
    if (!item.role) continue;
    const current = currentById.get(item.role.id);
    if (!current || current.managed || !current.editable) {
      throw new Error(`Role ${item.role.id} is missing or no longer editable; stopped before applying changes.`);
    }
  }

  let renamed = 0;
  for (const { role, name } of plan.renames) {
    const current = currentById.get(role.id);
    if (current.name !== name) {
      await current.setName(name, "Kittisugar approved role organization");
      renamed += 1;
    }
  }

  let created = 0;
  const dividerRoles = [];
  for (const name of plan.dividers) {
    let divider = guild.roles.cache.find((role) => role.name === name);
    if (!divider) {
      divider = await guild.roles.create({
        name,
        color: 0,
        permissions: [],
        hoist: false,
        mentionable: false,
        reason: "Kittisugar approved role category divider",
      });
      created += 1;
    }
    dividerRoles.push(divider);
  }

  const refreshed = await guild.roles.fetch();
  const orderedRoles = [];
  for (const item of plan.ordered) {
    if (item.dividerName) {
      orderedRoles.push(refreshed.find((role) => role.name === item.dividerName));
    } else if (item.role && !item.managed) {
      orderedRoles.push(refreshed.get(item.role.id));
    }
  }
  const validRoles = orderedRoles.filter(Boolean);
  const notes = [];
  const managedServerBooster = refreshed.get(EXPECTED_SPECIAL_ROLES.serverBooster);
  if (managedServerBooster) notes.push("Server Booster administrado por Discord (posición protegida)");
  // Discord owns managed roles; only editable roles are sent to setPositions.
  const highestBotPosition = me.roles.highest.position;
  const positions = validRoles.map((role, index) => ({
    role,
    // Keep every editable role strictly below Sugar's own highest role.
    position: Math.max(1, highestBotPosition - 1 - index),
  }));
  await guild.roles.setPositions(positions);

  return { renamed, created, reordered: positions.length, notes };
}
