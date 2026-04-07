require('dotenv').config();
const fs = require('fs');
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

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

  const parisDateStr = candidate.toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });

  const approxUTC = new Date(
    `${parisDateStr}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`
  );
  const offsetMinutes = getParisOffsetMinutes(approxUTC);
  const targetUTC = new Date(approxUTC.getTime() - offsetMinutes * 60000);

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

// Get or create the bot message
async function getOrCreateMessage(channel) {
  const messageId = process.env.MESSAGE_ID;

  if (messageId) {
    try {
      const existing = await channel.messages.fetch(messageId);
      if (existing) {
        return existing;
      }
    } catch {
      console.log('Saved message not found, creating a new one...');
    }
  }

  // Send new message if MESSAGE_ID is missing or invalid
  const newMessage = await channel.send('Initializing...');

  // Write new ID to GITHUB_OUTPUT so the workflow can save it
  const output = process.env.GITHUB_OUTPUT;
  if (output) {
    fs.appendFileSync(output, `new_message_id=${newMessage.id}\n`);
  }

  console.log('Created new message with ID:', newMessage.id);
  return newMessage;
}

// Main bot execution
client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const channel = await client.channels.fetch(process.env.CHANNEL_ID);
  const message = await getOrCreateMessage(channel);

  // Edit the message with new content
  await message.edit(generateMessage());
  console.log('Message updated, shutting down.');

  client.destroy();
});

client.login(process.env.DISCORD_TOKEN);