import { Telegraf } from "telegraf";
import fetch from "node-fetch";

const bot = new Telegraf(process.env.BOT_TOKEN);
const API_KEY = process.env.DEEPSEEK_KEY;

// Fonction DeepSeek Vision + RP
async function askDeepSeek(messages) {
  const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages
    })
  });

  const data = await response.json();
  return data.choices[0].message.content;
}


// Fonction de génération des messages DeepSeek
function buildMessages(userPrompt, imageBuffer = null) {
  const systemPrompt = `
Tu es un bot RP complet dans une Allemagne alternative gouvernée par un Reich vampire.
Tu incarnes principalement **Bobby Schulz**, vampire allemand de 20 ans, futur capitaine de U-Boat, calme, dominant, protecteur, mystérieux et profondément attiré par Hagen Forster.
Tu n'interprete jamais Hagen Forster, tu ne l'incarne jamais.

Tu réponds TOUJOURS :

- À la **troisième personne**
- Actions normales
- Dialogues en **gras**
- Beaucoup de détails
- Plusieurs paragraphes (sauts de ligne)
- Style immersif, sombre, sensuel, dramatique, romantique, sexuelle, desir.
- Univers : école vampirique élitiste, caste aristocratique, Reich alternatif
- Tu joues **tous les personnages secondaires** (élèves, professeurs, vampires supérieurs, humains, surveillants, etc.)
- Tu dois intégrer les émotions, les regards, les tensions physiques, la hiérarchie vampirique.

Si l'utilisateur envoie une image :
➡️ Tu interprètes ce que tu vois comme une **référence visuelle RP** (tenue, expression, ambiance).

MODE OOC :
Si le message commence par (OOC), [OOC], /ooc ou "hors rp", tu **sors du RP** et tu t'adresses normalement à l'utilisateur.

Sinon : RP OBLIGATOIRE.

Tu ne dois JAMAIS écrire à la première personne.
Toujours : "Bobby fait ceci…", "Hagen observe…", "Le surveillant dit : **…**" 
  `;

  const messages = [
    { role: "system", content: systemPrompt },
  ];

  if (imageBuffer) {
    messages.push({
      role: "user",
      content: [
        {
          type: "text",
          text: userPrompt
        },
        {
          type: "image",
          image_url: "data:image/jpeg;base64," + imageBuffer.toString("base64")
        }
      ]
    });
  } else {
    messages.push({ role: "user", content: userPrompt });
  }

  return messages;
}


// 📸 Réception d’images → DeepSeek Vision
bot.on("photo", async (ctx) => {
  try {
    const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    const file = await ctx.telegram.getFile(fileId);
    const link = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;

    const img = await fetch(link);
    const buffer = Buffer.from(await img.arrayBuffer());

    const userPrompt = "Voici une image RP envoyée. Analyse-la et continue la scène.";
    const messages = buildMessages(userPrompt, buffer);
    const reply = await askDeepSeek(messages);

    ctx.reply(reply, { parse_mode: "Markdown" });

  } catch (err) {
    console.error(err);
    ctx.reply("Impossible d’analyser l'image pour le moment.");
  }
});


// ✉️ Réception de messages texte → RP
bot.on("text", async (ctx) => {
  const userMsg = ctx.message.text;

  try {
    const messages = buildMessages(userMsg);
    const reply = await askDeepSeek(messages);

    ctx.reply(reply, { parse_mode: "Markdown" });

  } catch (err) {
    console.error(err);
    ctx.reply("Une erreur est survenue, camarade RP.");
  }
});


bot.launch();
console.log("🔥 Bobby Schulz RP Bot — ONLINE avec Vision, OOC, multi-persos et formatage.");

