# Telegram Bot Setup Guide

This guide walks you through creating a Telegram bot and configuring it to receive contact form submissions routed by auto/moto inquiry type.

## Prerequisites

- Telegram account (mobile or desktop)
- Two separate chat groups or channels (one for auto, one for moto)
- Admin access to create bots via BotFather

---

## Step 1: Create a Telegram Bot

1. Open Telegram and search for **@BotFather** (official bot creation tool)
2. Start a chat with BotFather → Send `/newbot`
3. Follow the prompts:
   - **Bot name:** `OneCompany Contact Bot` (can be anything)
   - **Username:** Must end in `bot` (e.g., `onecompany_contact_bot`)
4. BotFather will reply with your **bot token**:
   ```
   1234567890:ABCdefGHIjklMNOpqrsTUVwxyz1234567
   ```
   **⚠️ Keep this token secret!** It's your API key.

5. Copy the token and add it to `.env.local`:
   ```env
   TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz1234567
   ```

---

## Step 2: Create Chat Groups for Auto & Moto Teams

### Option A: Private Groups (Recommended for Internal Teams)

1. Create two Telegram groups:
   - **OneCompany Auto Team** (for auto inquiries)
   - **OneCompany Moto Team** (for moto inquiries)
2. Add team members to each group
3. Add your bot to both groups:
   - Go to group settings → **Add members** → Search for your bot username (e.g., `@onecompany_contact_bot`)
   - Add the bot
4. **Promote the bot to admin** (optional but recommended):
   - Group settings → **Administrators** → Add bot
   - This ensures the bot can always send messages even if group settings change

### Option B: Channels (for Broadcast-Style Notifications)

1. Create two channels:
   - **Auto Inquiries**
   - **Moto Inquiries**
2. Add your bot as an admin to both channels:
   - Channel settings → **Administrators** → Add bot
   - Grant "Post messages" permission

---

## Step 3: Get Chat IDs for Each Group/Channel

To send messages, you need the unique **chat ID** for each group/channel.

### Method 1: Using @userinfobot (Easiest)

1. Add **@userinfobot** to your group/channel (temporarily)
2. Forward any message from the group to **@userinfobot**
3. The bot will reply with:
   ```
   Chat ID: -1001234567890
   ```
4. Copy the chat ID and add to `.env.local`:
   ```env
   TELEGRAM_AUTO_CHAT_ID=-1001234567890
   TELEGRAM_MOTO_CHAT_ID=-1009876543210
   ```
5. Remove @userinfobot from the group (no longer needed)

### Method 2: Using Telegram API (for Channels)

1. Send a test message to your channel (or have the bot send a message)
2. Use the API to get updates:
   ```bash
   curl https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
   ```
3. Look for `"chat":{"id":-1001234567890}` in the JSON response
4. Copy the chat ID

**Note:** Channel IDs start with `-100`, group IDs start with `-`.

---

## Step 4: Test the Bot

1. Send a test message from your API route:
   ```bash
   curl -X POST https://api.telegram.org/bot<YOUR_BOT_TOKEN>/sendMessage \
     -H "Content-Type: application/json" \
     -d '{
       "chat_id": "-1001234567890",
       "text": "Test message from OneCompany bot"
     }'
   ```
2. Verify the message appears in the correct group/channel
3. Repeat for both auto and moto chat IDs

---

## Step 5: Configure Environment Variables

Update your `.env.local` with all required values:

```env
# Telegram Bot Token (from BotFather)
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz1234567

# Chat IDs for auto and moto teams
TELEGRAM_AUTO_CHAT_ID=-1001234567890   # Auto team group/channel
TELEGRAM_MOTO_CHAT_ID=-1009876543210   # Moto team group/channel
```

**Security Notes:**
- Never commit `.env.local` to Git
- Use environment variables in production (Vercel, Netlify, Azure, etc.)
- Rotate bot token if accidentally exposed (via BotFather: `/token`)

---

## Step 6: Customize Bot Settings (Optional)

### Set Bot Profile Picture
1. Chat with @BotFather → `/mybots`
2. Select your bot → **Edit Bot** → **Edit Botpic**
3. Upload an image (e.g., your logo)

### Set Bot Description
1. @BotFather → `/mybots` → Your bot → **Edit Bot** → **Edit Description**
2. Add a description:
   ```
   OneCompany Contact Bot
   Receives and routes customer inquiries to auto and moto teams.
   ```

### Set Bot Commands (if interactive features planned)
1. @BotFather → `/mybots` → Your bot → **Edit Bot** → **Edit Commands**
2. Add commands (if needed):
   ```
   start - Start the bot
   help - Get help
   ```

---

## Step 7: Verify Contact Form Integration

1. Open your website contact form
2. Select **Auto** or **Moto** inquiry type
3. Fill in the form and submit
4. Verify the message appears in the correct Telegram group/channel:
   - **Auto** submission → Auto team chat
   - **Moto** submission → Moto team chat

---

## Webhook vs Polling (Optional Advanced Setup)

By default, your bot sends messages via API (no incoming message handling).

**If you want to respond to user messages (e.g., /start command):**

### Option A: Polling (Simpler, for Development)
- Use a library like `node-telegram-bot-api`:
  ```typescript
  import TelegramBot from 'node-telegram-bot-api';
  const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!, { polling: true });
  bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, 'Welcome to OneCompany!');
  });
  ```

### Option B: Webhook (Recommended for Production)
1. Set up a public endpoint (e.g., `/api/telegram-webhook`)
2. Register webhook with Telegram:
   ```bash
   curl -X POST https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook \
     -H "Content-Type: application/json" \
     -d '{"url": "https://onecompany.com/api/telegram-webhook"}'
   ```
3. Handle incoming messages in your API route

**For contact form only (one-way notifications), webhooks are not required.**

---

## Troubleshooting

**Bot not sending messages:**
- Verify `TELEGRAM_BOT_TOKEN` is correct (no extra spaces)
- Ensure bot is added to the group/channel and has admin rights
- Check chat IDs are correct (including the `-` prefix)
- Use `getUpdates` API to debug:
  ```bash
  curl https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
  ```

**Messages not appearing in group:**
- Ensure bot has "Send messages" permission
- Try removing and re-adding the bot to the group
- Check if group privacy settings block bots

**HTML formatting not working:**
- Use `parse_mode: 'HTML'` in API request
- Escape special characters: `<`, `>`, `&`
- Supported tags: `<b>`, `<i>`, `<a href="">`, `<code>`, `<pre>`

---

## Security Best Practices

1. **Never expose bot token in client-side code** (only use in server-side API routes)
2. **Rotate token if leaked**:
   - Chat with @BotFather → `/mybots` → Your bot → **API Token** → `/revoke`
   - Update `.env.local` with new token
3. **Use environment variables** in production (Vercel, Netlify, etc.)
4. **Limit bot permissions** in groups/channels (only "Send messages" needed)

---

## Verification Checklist

- [ ] Bot created via @BotFather
- [ ] Bot token saved in `.env.local`
- [ ] Two groups/channels created (auto & moto)
- [ ] Bot added to both groups/channels as admin
- [ ] Chat IDs obtained and saved in `.env.local`
- [ ] Test message sent successfully to both chats
- [ ] Contact form submissions route correctly to auto/moto chats
- [ ] Bot profile picture and description set (optional)

---

## Additional Resources

- [Telegram Bot API Documentation](https://core.telegram.org/bots/api)
- [BotFather Commands](https://core.telegram.org/bots#6-botfather)
- [HTML Formatting in Messages](https://core.telegram.org/bots/api#html-style)
- [Node Telegram Bot API Library](https://github.com/yagop/node-telegram-bot-api)
- [Webhook Setup Guide](https://core.telegram.org/bots/api#setwebhook)
