require('dotenv').config();
const fs = require('fs');
const { Client, GatewayIntentBits } = require('discord.js');
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const REST_DAYS = {
  abominationVaults: [
    '2026-04-18',
    '2026-05-02',
    '2026-05-09',
    '2026-05-28'
  ],
  dungeonsOfDrakkenheim: [
    '2026-04-18',
    '2026-05-02',
    '2026-05-09'
  ],
};

function getParisOffsetMinutes(date) {
  const utc = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const paris = new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
  return (paris - utc) / 60000;
}

function getNextSaturdayParis(hour, restDays, minute = 0) {
  const now = new Date();
  const day = now.getDay();
  let daysUntilSat = (6 - day + 7) % 7;
  const candidate = new Date(now);
  candidate.setDate(now.getDate() + daysUntilSat);

  while (true) {
    const parisDateStr = candidate.toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });
    if (!restDays.includes(parisDateStr)) {
      const approxUTC = new Date(
        `${parisDateStr}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`
      );
      const offsetMinutes = getParisOffsetMinutes(approxUTC);
      const targetUTC = new Date(approxUTC.getTime() - offsetMinutes * 60000);
      if (targetUTC > now) return Math.floor(targetUTC.getTime() / 1000);
    }
    candidate.setDate(candidate.getDate() + 7);
  }
}

function generateMessage() {
  const tsAV  = getNextSaturdayParis(15, REST_DAYS.abominationVaults);
  const tsDoD = getNextSaturdayParis(19, REST_DAYS.dungeonsOfDrakkenheim);
  return [
    `Next **Abomination Vaults** session: <t:${tsAV}:F>`,
    `Next **Dungeons of Drakkenheim** session: <t:${tsDoD}:F>`,
  ].join('\n');
}

// ... rest of the code unchanged
