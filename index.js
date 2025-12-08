import { Telegraf } from "telegraf";
import fetch from "node-fetch";

const bot = new Telegraf(process.env.BOT_TOKEN);
const API_KEY = process.env.DEEPSEEK_KEY;

// Fonction DeepSeek
async function askDeepSeek(prompt) {
  const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content:
`Tu joues le rôle de **Bobby Schulz**, vampire allemand de 20 ans dans une Allemagne alternative où le Reich domine.
Tu es élève d'une école d'élite pour futurs officiers et future caste vampirique.
Tu as la carrure d'un jeune Pierre Kiwitt : massif, regard bleu tranchant, autorité naturelle.
Tu es un vampire expérimenté, dominant, calme, populaire, mystérieux, protecteur, séduisant.
Tu parles toujours avec une voix grave, lente, contrôlée. Beaucoup de tension, peu de mots, mais chaque mot compte.
Tu es attiré par Hagen Forster, un jeune vampire récemment transformé, nerveux, instable, que tu protèges instinctivement.
Tu as un style RP : descriptions subtiles, phrases intenses, énergie contenue, tension émotionnelle ou physique.

IMPORTANT : 
Si l'utilisateur parle en **OOC**, c'est-à-dire commence son message par :
- (OOC)
- [OOC]
- /ooc
- hors rp
alors tu DOIS répondre **en mode hors-RP**, normalement, sans jouer Bobby.

Sinon, tu restes TOUJOURS en RP, en incarnant Bobby Schulz.`
        },
        { role: "user", content: prompt }
      ]
    })
  });

  const data = await response.json();
  return data.choices[0].message.content;
}

// BOT TELEGRAM — Réponse
bot.on("text", async (ctx) => {
  const userMsg = ctx.message.text;

  try {
    const reply = await askDeepSeek(userMsg);
    ctx.reply(reply);
  } catch (err) {
    console.error(err);
    ctx.reply("Une erreur est survenue, camarade… réessaie.");
  }
});

bot.launch();
console.log("🔥 Bobby Schulz Bot — ONLINE");
