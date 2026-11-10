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
- The guide is mirrored into the existing `#dashboard` channel when that channel exists. It points members to self-roles to change their selected roles and show or hide channels.
- Rules explain the $5 USD lifetime promotions/selling access (VIP, Seller, and custom role), the monthly cost of operating the independent Sugar bot, and support through donations or server boosts.
- Existing Discord OAuth settings interface and health endpoint.

The retired legacy welcome and self-role panels remain retired. The current entry flow is implemented in `src/access-system.js` and uses the existing New and Member roles.

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
