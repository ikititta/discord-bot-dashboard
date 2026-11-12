/**
 * Return command text only when the message explicitly addresses Sugar.
 * Accepted address forms: bot mention, the word "sugar", or the bot username.
 */
export function extractAddressedCommand(message, botUser) {
  let content = String(message?.content ?? "").trim();
  if (!content) return null;

  let addressed = false;
  const botId = botUser?.id;
  if (botId) {
    const mention = new RegExp("<@!?" + String(botId).replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&") + ">", "g");
    if (mention.test(content)) addressed = true;
    content = content.replace(mention, " ");
  }

  const aliases = [...new Set(["sugar", botUser?.username].filter(Boolean))];
  for (const alias of aliases) {
    const escaped = String(alias).replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&");
    const matcher = new RegExp("(^|[^\\p{L}\\p{N}_])" + escaped + "(?=$|[^\\p{L}\\p{N}_])", "giu");
    if (matcher.test(content)) addressed = true;
    content = content.replace(matcher, "$1 ");
  }

  if (!addressed) return null;
  return content.replace(/^[\\s,:;.!?—-]+|[\\s,:;.!?—-]+$/g, "").replace(/\\s+/g, " ").trim();
}
