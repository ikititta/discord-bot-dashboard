/**
 * Return command text only when the message explicitly addresses Sugar.
 * Accepted address forms: bot mention, the word "sugar", or the bot username.
 */
function escapeRegex(value) {
  return String(value).replace(/[.*+?^\${}()|[\]\\]/g, "\\$&");
}

export function extractAddressedCommand(message, botUser) {
  let content = String(message?.content ?? "").trim();
  if (!content) return null;

  let addressed = false;
  if (botUser?.id) {
    const mention = new RegExp("<@!?" + escapeRegex(botUser.id) + ">", "g");
    if (mention.test(content)) addressed = true;
    content = content.replace(mention, " ");
  }

  const aliases = [...new Set(["sugar", botUser?.username].filter(Boolean))];
  for (const alias of aliases) {
    const matcher = new RegExp("(^|[^\\p{L}\\p{N}_])" + escapeRegex(alias) + "(?=$|[^\\p{L}\\p{N}_])", "giu");
    if (matcher.test(content)) addressed = true;
    content = content.replace(matcher, "$1 ");
  }

  if (!addressed) return null;
  return content.replace(/^[\\s,:;.!?—-]+|[\\s,:;.!?—-]+$/g, "").replace(/\\s+/g, " ").trim();
}
