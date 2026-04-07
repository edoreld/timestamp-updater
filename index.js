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
    const messageId = process.env.MESSAGE_ID;
    const content = generateMessage();
    let targetMessage = null;

    // 1. Try to fetch the existing message to edit
    if (messageId && messageId !== "1" && messageId !== "null") {
      try {
        targetMessage = await channel.messages.fetch(messageId);
        await targetMessage.edit(content);
        console.log('Existing message edited successfully.');
      } catch (err) {
        console.log('Message ID found in variables, but message no longer exists in Discord.');
      }
    }

    // 2. If no message was edited, send a fresh one
    if (!targetMessage) {
      targetMessage = await channel.send(content);
      console.log('New message sent.');

      // 3. Export the NEW ID to GitHub Actions so it can be edited next time
      const output = process.env.GITHUB_OUTPUT;
      if (output) {
        fs.appendFileSync(output, `new_message_id=${targetMessage.id}\n`);
        console.log(`Sent new ID ${targetMessage.id} to GitHub Actions output.`);
      }
    }

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  client.destroy();
});

client.login(process.env.DISCORD_TOKEN);