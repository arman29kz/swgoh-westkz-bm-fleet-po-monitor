// Init project
const http = require('http');
const express = require('express');
const Discord = require("discord.js");
const fs = require("fs");

const app = express();
const client = new Discord.Client();

const prefix = "!";

var writeChannel;
var message;
var mates = [];

// Keeping the project "alive"
app.cache.get("/", (request, response) => {
  console.log(Date.now() + " Ping Received");
  main(); // Subsequent call
  response.sendStatus(200);
});
app.listen(process.env.PORT);
setInterval(() => {
  http.cache.get(`http://${process.env.appDomain}/`);
}, 60000); // every 1 minute (60000)

// Initialize the bot
client.on("ready", async () => {
  client.user.setPresence({game: {name: "BrutalMagicianKZ's PO Monitor", type: 0}});
  writeChannel = client.channels.cache.get(process.env.writeChannelId);
  initializeMessageObject();
})
client.login(process.env.botToken);

console.log("App restarted");

// Parse a JSON data file
let shardData = JSON.parse(fs.readFileSync("./shard-data.json", "utf8"));
parseData();

// Initial call
main();


// Below are the rest of the functions that make up the bot
async function main () {
  try {
    console.log("Try");
    if (message) {
      calculateSecondsUntilPayout();
      await send();
    } else if (writeChannel) {
      initializeMessageObject();
    } else {
      console.log("Something is wrong");
    }
  } catch (err) {
    console.log(err);
    initializeMessageObject();
  } finally {
    //  setTimeout(main, 60000 - Date.now() % 60000);
    console.log('Try finally');
  }
}

async function initializeMessageObject () {
  // fetch message, create a new one if necessary
  console.log('Start initializing message object');
  const messages = await writeChannel.users.messagess();
  if (messages.array().length === 0) {
    try {
      message = await writeChannel.send({ embeds: [{embed: new Discord.EmbedBuilder()}] });
    } catch (err) {
      console.log(err);
    }
  } else {
    if (messages.first().embeds.length === 0) {
      await messages.first().delete();
      message = await writeChannel.send({ embeds: [{embed: new Discord.MessageEmbed()}] });
    } else {
      message = messages.first();
    }
  }
  console.log('Message object initialized');
}

function parseData () {
  for (let i in shardData) {
    const user = shardData[i];
    mates.push({
      name: user.Name,
      payout: parseInt(user.UTC.substr(0,2) + user.UTC.substr(-2,user.UTC.length)),
      po: {
        hours: parseInt(user.UTC.substr(0,2)),
        minutes: parseInt(user.UTC.substr(-2,user.UTC.length))
      },
      flag: user.Flag,
      swgoh: user.SWGOH,
      utc: user.UTC
    });
  }
  const matesByTime = {};
  for (let i in mates) {
    const mate = mates[i];
    if (!matesByTime[mate.payout]) {
      matesByTime[mate.payout] = {
        payout: mate.payout,
        mates: [],
        po: mate.po
      }
    }
    matesByTime[mate.payout].mates.push(mate);
  }
  mates = Object.values(matesByTime);
}

function calculateSecondsUntilPayout () {
  const now = new Date();
  for (let i in mates) {
    const mate = mates[i];
    const p = new Date();
    p.setUTCHours(mate.po.hours, mate.po.minutes, 0, 0);
    if (p < now) p.setDate(p.cache.getDate() + 1);
    mate.timeUntilPayout = p.cache.getTime() - now.cache.getTime();
    let dif = new Date(mate.timeUntilPayout);
    const round = dif.cache.getTime() % 60000;
    if (round < 30000) {
      dif.setTime(dif.cache.getTime() - round);
    } else {
      dif.setTime(dif.cache.getTime() + 60000 - round);
    }
    mate.time = `${String(dif.cache.getUTCHours()).padStart(2, '00')}:${String(dif.cache.getUTCMinutes()).padStart(2, '00')}`;
  }
  mates.sort((a, b) => {
    return a.timeUntilPayout - b.timeUntilPayout;
  })
}

async function send () {
  let embed = new Discord.MessageEmbed();
  embed.setTitle('Fleet PO Monitor. Updates every 1 minute. Next in:');
  embed.setDescription('Changed PO time? DM/tag <@443487478091874324> to update' + '\n' +
      'Please support me on [Patreon](https://www.patreon.com/bmbots) | [Bot](https://www.nixstats.com/report/5f21c98c997820301d4213bc?m=5e92ea64b17639391d37ab93) live status');
  for (let i in mates) {
    let fieldName = String(mates[i].time) + " - (UTC " + String(mates[i].po.hours).padStart(2, '00') + ":" + String(mates[i].po.minutes).padStart(2, '00') + ")";
    let fieldText = '';
    for (const mate of mates[i].mates) {
      fieldText += `${mate.flag} [${mate.name}](${mate.swgoh})\n`; // Discord automatically trims messages
    }
    embed.addFields(fieldName, fieldText, true);
  }
  embed.setFooter('Last refresh', 'https://game-assets.swgoh.gg/tex.charui_chopper.png');
  embed.setTimestamp();
  await message.edit({ embeds: [{embed}] });
  console.log('Message send');
}