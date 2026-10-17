# ArcaneBook — Quiz Builder with Telegram Storage

No Supabase. No database. No sleep issues. Just Telegram.

Your quizzes are stored directly in a private Telegram channel. The bot sends each quiz as an HTML file — the channel is your database.

---

## How it works

```
Admin builds quiz → "Generate & Save" → HTML sent to Telegram channel
Students visit /mock-tests → App fetches file list from Telegram → Opens quiz
```

- **Index message**: A pinned message in your channel stores quiz metadata (title, question count, file_id). Listing quizzes is instant.
- **HTML files**: Each quiz is stored as a Telegram document message. Downloaded on demand.
- **Auth**: Simple password-based. No email, no Supabase auth. Passwords stored in localStorage.

---

## Setup (5 minutes)

### Step 1 — Create a Telegram Bot

1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot` and follow prompts
3. Copy the **bot token** (looks like `7123456789:AAHxyz...`)

### Step 2 — Create a Private Channel

1. Create a new private Telegram channel (any name, e.g. "ArcaneBook Quizzes")
2. Go to channel settings → Administrators → Add Administrator
3. Add your bot as admin with **Post Messages** permission
4. Get the channel ID:
   - Forward any message from your channel to [@userinfobot](https://t.me/userinfobot)
   - The ID starts with `-100` (e.g. `-1001234567890`)

### Step 3 — Deploy to Render

| Setting | Value |
|---|---|
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start` |
| **Node Version** | 20 |

**Environment Variables on Render:**

| Variable | Value |
|---|---|
| `VITE_TELEGRAM_BOT_TOKEN` | Your bot token from BotFather |
| `VITE_TELEGRAM_CHANNEL_ID` | Your channel ID (e.g. `-1001234567890`) |
| `VITE_MASTER_PASSWORD` | *(optional)* Master admin password. Default: `Air@2003` |

> ⚠️ VITE_ variables are baked in at build time. Set them before clicking Deploy.

---

## Admin passwords

| Type | Default | How to change |
|---|---|---|
| Regular access | `Air` | Log in with master password → change on screen |
| Master password | `Air@2003` | Set `VITE_MASTER_PASSWORD` env var and redeploy |

---

## Local development

```bash
git clone <your-repo>
cd arcanebook-quiz
npm install
cp .env.example .env
# Fill in your bot token and channel ID in .env
npm run dev
```

---

## Routes

| Path | Description |
|---|---|
| `/` | Student/Admin selector |
| `/mock-tests` | Student quiz listing (public) |
| `/password-protected` | Admin login |
| `/admin` | Quiz builder (protected) |

---

## Tech stack

- React 18 + TypeScript
- Vite
- Tailwind CSS + shadcn/ui
- Telegram Bot API (storage backend)
- `serve` (static file server for Render)
