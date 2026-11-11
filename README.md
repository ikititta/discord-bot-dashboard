# Sugar

Sugar is the single Discord bot for Kittisugar. GitHub is the canonical source, FadeHost is the production runtime, Discord is the community interface, and DeepSeek provides optional AI replies. Replit is development-only and is not required for production operation.

## Run

```bash
npm ci
npm start
```

Use Node.js 20 or newer. Configure secrets through the hosting platform's secure environment-variable manager.

| Variable | Required | Purpose |
|---|---|---|
| `DISCORD_TOKEN` | yes | Existing Discord bot token |
| `DISCORD_CLIENT_ID` | yes | Discord application ID |
| `DISCORD_CLIENT_SECRET` | yes | OAuth client secret for the existing settings interface |
| `SESSION_SECRET` | yes | Random signing secret, at least 16 characters |
| `DEEPSEEK_API_KEY` | no | Enables Sugar AI replies |
| `APP_URL` | no | Public app URL |
| `PORT` | no | HTTP port; supplied by FadeHost |
| `DATA_DIR` | no | Existing writable persistent directory; production defaults to `/data` |
| `NODE_ENV` | no | Use `development` for local data-directory fallback |

The application reads secrets from its process environment and does not load local `.env` files. Never commit or paste credentials into source code, issues, pull requests, or chat.

## Current features

- Sugar AI replies through DeepSeek only when a local detector recognizes a direct mention or address to Sugar.
- Private Discord chats, with ownership and access managed through Discord permissions.
- Join, leave, edited-message, and deleted-message logs.
- Message-deletion commands with configurable VIP and moderator role IDs.
- New-member access flow: assigns the New role on join, provides concise rules and a compact server guide, and grants Member after the member confirms they have read the rules and are 18 or older.
- Automatic moderation: detects message flooding, repeated messages, mass mentions, and unauthorized promotions/invite links; removes violating messages, records persistent strikes, applies a timeout at strike 2, and kicks at strike 3. Moderators bypass these checks.
- Anti-raid protection: detects bursts of 8 joins within 10 seconds and temporarily times out recently-created accounts in that burst for 10 minutes. A moderation notice is sent to the configured reports channel or a recognized moderation-log channel.
- The guide is mirrored into the existing `#dashboard` channel when that channel exists. It points members to self-roles to change their selected roles and show or hide channels.
- Rules explain that promotions/selling are for VIP members only and only in the assigned promotions channel; VIP access costs $5 USD once for life and includes VIP, Seller, and a custom role. NSFW content should stay in the Porn category unless the member is VIP. Three violations result in removal. The rules also explain monthly Sugar hosting costs and support through donations or boosts.
- Persistent moderation strikes are stored in `automod-state.json` under the existing data directory.
- Existing Discord OAuth settings interface and health endpoint.

The retired legacy welcome and self-role panels remain retired. The current entry flow is implemented in `src/access-system.js` and uses the existing New and Member roles.

## Fun commands

The Kittisugar fun-command module uses the existing `Member` role as its 18+ access gate and does not restrict commands by channel. Two-person actions require a member mention; solo reactions do not.

Two-person commands: `!slap`, `!bonk`, `!spank`, `!hug`, `!kiss`, `!cuddle`, `!pat`, `!poke`, `!bite`, `!kick`, `!kill`, `!highfive`, and `!handhold`.

Solo commands: `!cry`, `!laugh`, `!dance`, `!sleep`, `!happy`, `!blush`, `!smug`, `!wave`, `!facepalm`, `!wink`, `!shrug`, `!smile`, and `!pout`.

- `!stats` shows a member's own basic statistics.
- `!vip stats` shows the caller's full statistics for VIP members.
- `!vip stats @member` lets VIP members view another member's full statistics. Non-VIP callers receive: `Get VIP to see everyone's stats.`
- `!rape` and `!fuck` are intentionally unavailable; Sugar responds with a consent reminder.
- The initial GIF adapter uses Nekos.best's no-key anime reaction GIF endpoints. That service is SFW-only and does not offer gender-pair filtering or NSFW GIFs. `!spank` currently uses its non-explicit slap reaction as a playful substitute. The existing gender role IDs are mapped and tested, but the returned GIFs are generic until a gender-pair GIF catalogue is supplied.

Fun-command statistics are stored atomically in `fun-command-state.json` under the existing persistent data directory. The store validates its schema and bounds retained guild/member/partner records.

## Discord role management

- Role names, colors, permissions, member assignments, and hierarchy are managed directly in Discord.
- Sugar does not provide automated role-audit or role-reordering commands.

## Persistent data

Production uses an existing writable persistent directory (normally `/data`). Preserve existing files when deploying or migrating. Current application data includes:

- `settings.json` — per-server log and role settings
- `memory.json` — bounded AI conversation history
- `private-chats.json` — private-chat owners, invitees, and lobby guide IDs
- `moderation-logs.json` — moderation deletion records

Older installations may still contain settings and data from retired modules. The runtime ignores retired settings fields and preserves them when unrelated settings are saved. Keep legacy data files in backups until you explicitly decide they can be archived or removed. Startup never resets persistent data.

## Backup and recovery

Create a backup outside the project directory:

```bash
bash scripts/backup.sh
```

Restore only into a new, empty directory:

```bash
bash scripts/restore.sh /path/to/sugar-ai-backup.tar.gz
```

The restore script does not overwrite the live installation. Review restored files before recovering any data.

## Tests

```bash
npm test
```

Tests use Node's built-in test runner and stubs for Discord and provider interactions; they do not require production credentials or send real community messages.
