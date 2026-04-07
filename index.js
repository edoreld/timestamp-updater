require('dotenv').config();
const fs = require('fs');
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

// Get the UTC offset for Europe/Paris (handles CET/CEST automatically)
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

// Generate the message content from scratch
function generateMessage() {
  const tsAV  = getNextSaturdayParis(15); // 15:00 Paris
  const tsDoD = getNextSaturdayParis(19); // 19:00 Paris

  return [
    `Next **Abomination Vaults** session: <t:${tsAV}:F>`,
    `Next **Dungeons of Drakkenheim** session: <t:${tsDoD}:F>`,
  ].join('\n');
}

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  try {
    const channel = await client.channels.fetch(process.env.CHANNEL_ID);
    const messageId = process.env.MESSAGE_ID;
    let targetMessage = null;

    // 1. Try to fetch the existing message (ignore if dummy '1' or 'null')
    if (messageId && messageId !== "1" && messageId !== "null") {
      try {
        targetMessage = await channel.messages.fetch(messageId);
        console.log('Existing message found. Updating...');
      } catch (err) {
        console.log('Saved message ID not found on Discord. Creating fresh...');
      }
    }

    const content = generateMessage();

    // 2. Edit or Send
    if (targetMessage) {
      await targetMessage.edit(content);
    } else {
      targetMessage = await channel.send(content);
      console.log('New message sent.');
    }

    // 3. ALWAYS output the ID back to GitHub Actions
    // This ensures the workflow has the ID to "patch" into the repository variable
    const output = process.env.GITHUB_OUTPUT;
    if (output) {
      fs.appendFileSync(output, `new_message_id=${targetMessage.id}\n`);
      console.log(`Exported ID ${targetMessage.id} to GitHub Actions.`);
    }

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }

  client.destroy();
});

client.login(process.env.DISCORD_TOKEN);