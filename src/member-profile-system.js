import { EmbedBuilder, Events } from "discord.js";

const COLOR = 0xffd9ff;

export function petSummary(profile) {
  if (!profile) return "No pet adopted yet ♡";
  const pet = profile.activePetIndex > 0
    ? profile.additionalPets?.[profile.activePetIndex - 1]
    : profile;
  if (!pet) return "No active pet selected ♡";
  return [
    `**${pet.name}** the ${pet.species}`,
    `Level ${Number(pet.level) || 1} · ${Number(pet.xp) || 0} XP`,
    `Hunger ${Number(pet.hunger) || 0}/100 · Happiness ${Number(pet.happiness) || 0}/100 · Bond ${Number(pet.bond) || 0}/100`,
    `Color: ${pet.visualIdentity?.palette ?? "not customized"} · Personality: ${pet.visualIdentity?.personality ?? "not set"}`,
    `Breed: ${pet.visualIdentity?.breed ?? "not specified"}`,
    `Coins: ${Number.isFinite(Number(profile.coins)) ? Number(profile.coins) : Number(pet.coins) || 0} · Pets owned: ${1 + (profile.additionalPets?.length ?? 0)}`,
  ].join("\n");
}

function relationshipSummary(funStore, guildId, userId) {
  const relation = funStore.getRelationship(guildId, userId);
  if (!relation) return "Single ♡";
  const kind = relation.type === "marriage" ? "Married to" : "In a relationship with";
  return `${kind} <@${relation.partnerId}> ♡`;
}

function buildProfileEmbed({ user, member, petStore, funStore, reputationStore, guildId }) {
  const pet = petStore.get(guildId, user.id);
  const stats = funStore.getStats(guildId, user.id);
  const score = reputationStore.getScore(guildId, user.id);
  const votes = reputationStore.getVoteBreakdown(guildId, user.id);
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setAuthor({ name: `${member?.displayName ?? user.globalName ?? user.username}'s Kittisugar profile`, iconURL: user.displayAvatarURL({ size: 128 }) })
    .setThumbnail(user.displayAvatarURL({ size: 256 }))
    .addFields(
      { name: "୨୧ Pet", value: petSummary(pet), inline: false },
      { name: "୨୧ Reputation", value: `**Score:** ${score}\n♡ Positive votes: ${votes.positive}\n♡ Negative votes: ${votes.negative}`, inline: true },
      { name: "୨୧ Fun stats", value: `**Used:** ${stats.total}\n**Received:** ${stats.receivedTotal}\n**Partners:** ${Object.keys(stats.partners).length}`, inline: true },
      { name: "୨୧ Relationship", value: relationshipSummary(funStore, guildId, user.id), inline: false },
    )
    .setFooter({ text: "Your Kittisugar information stays saved with Sugar ♡" });
  return embed;
}

export function attachMemberProfileSystem(client, { petStore, funStore, reputationStore }) {
  if (!petStore || !funStore || !reputationStore) {
    throw new Error("All persistent stores are required for member profiles.");
  }

  client.on(Events.MessageCreate, async (message) => {
    if (!message.guild || message.author?.bot || !/^!profile(?:\s|$)/i.test(message.content.trim())) return;
    const targetUser = message.mentions.users.first() ?? message.author;
    const targetMember = await message.guild.members.fetch(targetUser.id).catch(() => null);
    if (!targetMember) {
      await message.reply({ content: "I couldn't find that member in Kittisugar ♡", allowedMentions: { repliedUser: false } });
      return;
    }
    try {
      const embed = buildProfileEmbed({
        user: targetUser,
        member: targetMember,
        petStore,
        funStore,
        reputationStore,
        guildId: message.guild.id,
      });
      await message.reply({ embeds: [embed], allowedMentions: { parse: [] , repliedUser: false } });
    } catch (error) {
      console.error("[profile] could not build member profile: " + error.message);
      await message.reply({ content: "Sugar couldn't load this profile right now ♡", allowedMentions: { repliedUser: false } }).catch(() => {});
    }
  });
}
