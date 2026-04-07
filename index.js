require('dotenv').config();
const fs = require('fs');
const { Client, GatewayIntentBits } = require('discord.js');
const cron = require('node-cron');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const MESSAGE_FILE = './message.json';

// Get the UTC offset for Europe/Paris at a given date (handles CET/CEST automatically)
function getParisOffsetMinutes(date) {
  const utc = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const paris = new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
  return (paris - utc) / 60000;
}

// Compute Unix timestamp of the next Saturday at a given Paris local time
function getNextSaturdayParis(hour, minute = 0) {
  const now = new Date();
  const day = now.getDay();
  let daysUntilSat = (6 - day + 7) % 7;

  const candidate = new Date(now);
  candidate.setDate(now.getDate() + daysUntilSat);

  // Get the date string in Paris timezone (YYYY-MM-DD)
  const parisDateStr = candidate.toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });

  // Build an approximate UTC time as if Paris == UTC, then correct for the offset
  const approxUTC = new Date(
    `${parisDateStr}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`
  );
  const offsetMinutes = getParisOffsetMinutes(approxUTC);
  const targetUTC = new Date(approxUTC.getTime() - offsetMinutes * 60000);

  // If that moment has already passed, push to next Saturday
  if (targetUTC <= now) {
    targetUTC.setDate(targetUTC.getDate() + 7);
  }

  return Math.floor(targetUTC.getTime() / 1000);
}

// Generate the message content with both campaigns
function generateMessage() {
  const tsAV  = getNextSaturdayParis(15); // 15:00 Paris — Abomination Vaults
  const tsDoD = getNextSaturdayParis(19); // 19:00 Paris — Dungeons of Drakkenheim

  return [
    `Next **Abomination Vaults** session: <t:${tsAV}:F>`,
    `Next **Dungeons of Drakkenheim** session: <t:${tsDoD}:F>`,
  ].join('\n');
}

// Get or create the pinned bot message
async function getOrCreateMessage(channel) {
  let messageId;

  if (fs.existsSync(MESSAGE_FILE)) {
    const data = JSON.parse(fs.readFileSync(MESSAGE_FILE));
    messageId = data.messageId;
  }

  if (messageId) {
    try {
      return await channel.messages.fetch(messageId);
    } catch {
      console.log('Saved message not found, creating a new one...');
    }
  }

  const newMessage = await channel.send('Initializing...');

  fs.writeFileSync(MESSAGE_FILE, JSON.stringify({ messageId: newMessage.id }));
  console.log('Created new message with ID:', newMessage.id);

  return newMessage;
}

client.once('clientReady', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const channel = await client.channels.fetch(process.env.CHANNEL_ID);
  const message = await getOrCreateMessage(channel);

  // Update immediately on startup
  await message.edit(generateMessage());

  // Re-update every day at midnight UTC (safe against restarts)
  cron.schedule('0 0 * * *', async () => {
    try {
      await message.edit(generateMessage());
      console.log('Message updated');
    } catch (err) {
      console.error('Update failed:', err);
    }
  });
});

client.login(process.env.DISCORD_TOKEN);