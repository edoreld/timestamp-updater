require('dotenv').config();
const fs = require('fs');
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

function getParisOffsetMinutes(date) {
  const utc = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const paris = new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
  return (paris - utc) / 60000;
}

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

function generateMessage() {
  const tsAV  = getNextSaturdayParis(15);
  const tsDoD = getNextSaturdayParis(19);

  return [
    `Next **Abomination Vaults** session: <t:${tsAV}:F>`,
    `Next **Dungeons of Drakkenheim** session: <t:${tsDoD}:F>`,
  ].join('\n');
}

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  try {
    const channel = await client.channels.fetch(process.env.CHANNEL_ID);
    const oldMessageId = process.env.MESSAGE_ID;

    // 1. Delete the old message if it exists
    if (oldMessageId && oldMessageId !== "1" && oldMessageId !== "null") {
      try {
        const oldMsg = await channel.messages.fetch(oldMessageId);
        await oldMsg.delete();
        console.log('Old message deleted.');
      } catch (err) {
        console.log('Could not find old message to delete (it might already be gone).');
      }
    }

    // 2. Send the brand new message
    const newMessage = await channel.send(generateMessage());
    console.log('New message sent.');

    // 3. Export the new ID to GitHub Actions so it can be deleted next time
    const output = process.env.GITHUB_OUTPUT;
    if (output) {
      fs.appendFileSync(output, `new_message_id=${newMessage.id}\n`);
    }

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  client.destroy();
});

client.login(process.env.DISCORD_TOKEN);