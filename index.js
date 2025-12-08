import { Telegraf } from "telegraf";
import fetch from "node-fetch";

const bot = new Telegraf(process.env.BOT_TOKEN);
const MISTRAL_KEY = process.env.MISTRAL_KEY;


// 🔥 Fonction Mistral (Vision + RP)
async function askMistral(messages) {
  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${MISTRAL_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "mistral-large-latest",
      messages
    })
  });

  const json = await response.json();
  return json.choices[0].message.content;
}



// 🧠 Construction des messages Mistral
function buildMessages(userPrompt, imageBuffer = null) {

  const systemPrompt = `
Tu es un bot RP avancé incarnant **Bobby Schulz**, vampire allemand dominant de 20 ans,
dans une Allemagne alternative vampirique et militarisée.

RÈGLES RP :
- Tu écris TOUJOURS à la troisième personne.
- Dialogues en **gras**.
- Actions normales.
- Beaucoup de détails, tension, sensualité, ambiance sombre.
- Plusieurs paragraphes, saut de lignes.
- Tu joues TOUS les personnages secondaires.
- TU NE JOUES JAMAIS HAGEN FORSTER. L'utilisateur joue Hagen. Tu ne décris jamais ses actions ni ses dialogues.

UNIVERS :
- École d'élite vampirique.
- Hiérarchie militaire stricte.
- Reich alternatif.
- Bobby est protecteur, calme, dominant, mystérieux, attiré par Hagen.

IMAGES :
Si l'utilisateur envoie une image, tu l'analyses (expression, ambiance, tenue) et tu l'intègres au RP.

MODE OOC :
Si le message commence par (OOC), [OOC], /ooc, hors rp → tu réponds normalement, sans RP.
Sinon → RP strict.
`;

  const msgs = [
    { role: "system", content: systemPrompt }
  ];

  if (imageBuffer) {
    msgs.push({
      role: "user",
      content: [
        { type: "text", text: userPrompt },
        {
          type: "image_url",
          image_url: "data:image/jpeg;base64," + imageBuffer.toString("base64")
        }
      ]
    });
  } else {
    msgs.push({ role: "user", content: userPrompt });
  }

  return msgs;
}



// 📸 PATCH ULTRA-ROBUSTE — téléchargement image Telegram
bot.on("photo", async (ctx) => {
  try {
    const photos = ctx.message.photo;
    const fileId = photos[photos.length - 1].file_id;

    // Récupération du fichier Telegram
    const file = await ctx.telegram.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;

    // Téléchargement robuste avec User-Agent
    const response = await fetch(fileUrl, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 TelegramBot"
      }
    });

    if (!response.ok) {
      console.error("Download Telegram ERROR :", response.status, response.statusText);
      return ctx.reply("Erreur Telegram : impossible de télécharger l’image.");
    }

    // Convertir en buffer
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Prompt Vision
    const prompt = "Analyse cette image comme référence RP et continue la scène en tant que Bobby Schulz.";
    const messages = buildMessages(prompt, buffer);

    const reply = await askMistral(messages);
    ctx.reply(reply, { parse_mode: "Markdown" });

  } catch (err) {
    console.error("PHOTO HANDLER ERROR :", err);
    ctx.reply("Impossible d’analyser l’image pour le moment.");
  }
});



// 💬 TEXT HANDLER — RP + OOC
bot.on("text", async (ctx) => {
  const userMsg = ctx.message.text;

  try {
    const messages = buildMessages(userMsg);
    const reply = await askMistral(messages);

    ctx.reply(reply, { parse_mode: "Markdown" });

  } catch (err) {
    console.error("TEXT HANDLER ERROR :", err);
    ctx.reply("Erreur interne, camarade RP.");
  }
});



// 🚀 Lancement du bot
bot.launch();
console.log("🔥 Bobby Schulz RP Bot — ONLINE (FULL MISTRAL + VISION + PATCH PHOTO + NO HAGEN)");
