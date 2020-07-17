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
app.get("/", (request, response) => {
  console.log(Date.now() + " Ping Received");
  main(); // Subsequent call
  response.sendStatus(200);
});
app.listen(process.env.PORT);
setInterval(() => {
  http.get(`http://${process.env.PROJECT_DOMAIN}.glitch.me/`);
}, 60000);

// Initialize the bot
client.on("ready", async () => {
  client.user.setPresence({game: {name: "BrutalMagicianKZ's PO Monitor", type: 0}});
  writeChannel = client.channels.get(process.env.writeChannelId);
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
      await sendMessage();
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
  const messages = await writeChannel.fetchMessages();
  if (messages.array().length === 0) {
    try {
      message = await writeChannel.send({embed: new Discord.RichEmbed()});
    } catch (err) {
      console.log(err);
    }
  } else {
    if (messages.first().embeds.length === 0) {
      await messages.first().delete();
      message = await writeChannel.send({embed: new Discord.RichEmbed()});
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
    if (p < now) p.setDate(p.getDate() + 1);
    mate.timeUntilPayout = p.getTime() - now.getTime();
    let dif = new Date(mate.timeUntilPayout);
    const round = dif.getTime() % 60000;
    if (round < 30000) {
      dif.setTime(dif.getTime() - round);
    } else {
      dif.setTime(dif.getTime() + 60000 - round);
    }
    mate.time = `${String(dif.getUTCHours()).padStart(2, '00')}:${String(dif.getUTCMinutes()).padStart(2, '00')}`;
  }
  mates.sort((a, b) => {
    return a.timeUntilPayout - b.timeUntilPayout;
  })
}

async function sendMessage () {
  let embed = new Discord.RichEmbed();  
  embed.setTitle('Fleet PO Monitor. Updates every 1 min. Next in:');
  let desc = 'Changed PO time? Pls contact to <@443487478091874324>.  Thnx';
  for (let i in mates) {    
    let fieldName = String(mates[i].time) + " - (UTC " + String(mates[i].po.hours).padStart(2, '00') + ":" + String(mates[i].po.minutes).padStart(2, '00') + ")";
    let fieldText = '';
    for (const mate of mates[i].mates) {
      fieldText += `${mate.flag} [${mate.name}](${mate.swgoh})\n`; // Discord automatically trims messages
    }
    embed.addField(fieldName, fieldText, true);    
  }  
  embed.setDescription(desc);  
  embed.setFooter('Last refresh', 'https://swgoh.gg/game-asset/u/CHOPPERS3/');
  embed.setTimestamp();
  await message.edit({embed});
  console.log('Message send');
}