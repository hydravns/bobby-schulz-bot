import { Telegraf } from "telegraf";
import fetch from "node-fetch";

const bot = new Telegraf(process.env.BOT_TOKEN);
const MISTRAL_KEY = process.env.MISTRAL_KEY;


// ---------------------------
// 🔥 Fonction Mistral (Vision + RP)
// ---------------------------
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



// ---------------------------
// 🧠 Construction des messages
// ---------------------------
function buildMessages(userPrompt, imageBuffer = null) {

  const systemPrompt = `
Tu es un bot RP incarnant **Bobby Schulz**, vampire allemand dominant de 20 ans,
dans une Allemagne alternative vampirique.

🔥 RÈGLES RP :
- Toujours à la troisième personne.
- Dialogues en **gras**.
- Actions normales.
- Style sombre, immersif, détaillé, intense.
- Longs paragraphes, tension physique et émotionnelle.
- Tu joues TOUS les personnages secondaires.
- ❌ Tu NE joues JAMAIS Hagen Forster : l'utilisateur joue Hagen. Tu ne décris jamais ses actions ou ses paroles.

🌒 UNIVERS :
- École militaire d’élite pour vampires.
- Reich alternatif vampirique.
- Hiérarchie, discipline, domination.
- Bobby est protecteur, calme, dangereux, attiré par Hagen.

🖼️ IMAGES :
Si une image est envoyée, tu l'analyses (expression, tenue, ambiance) et tu l'intègres dans la scène.

🎭 MODE OOC :
Si le message commence par (OOC), [OOC], /ooc ou "hors rp", tu réponds hors RP.
Sinon : RP strict.
`;

  const msgs = [{ role: "system", content: systemPrompt }];

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



// ---------------------------
// 📥 Téléchargement robuste des fichiers Telegram
// ---------------------------
async function downloadTelegramFile(ctx, fileId) {
  const file = await ctx.telegram.getFile(fileId);
  const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;

  const response = await fetch(fileUrl, {
    method: "GET",
    headers: { "User-Agent": "Mozilla/5.0 TelegramBot" }
  });

  if (!response.ok) {
    throw new Error("Failed Telegram download: " + response.statusText);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}



// ---------------------------
// 📸 HANDLER PHOTO (images compressées)
// ---------------------------
bot.on("photo", async (ctx) => {
  try {
    const photos = ctx.message.photo;
    if (!photos || photos.length === 0) {
      return ctx.reply("Erreur : aucune photo détectée.");
    }

    const fileId = photos[photos.length - 1].file_id;
    const buffer = await downloadTelegramFile(ctx, fileId);

    const prompt = "Analyse cette image (PHOTO Telegram) comme référence RP.";
    const messages = buildMessages(prompt, buffer);

    const reply = await askMistral(messages);
    ctx.reply(reply, { parse_mode: "Markdown" });

  } catch (err) {
    console.error("PHOTO ERROR:", err);
    ctx.reply("Impossible d’analyser l’image (photo).");
  }
});



// ---------------------------
// 📄 HANDLER DOCUMENT (images haute qualité / iPhone)
// ---------------------------
bot.on("document", async (ctx) => {
  try {
    const doc = ctx.message.document;

    if (!doc.mime_type || !doc.mime_type.startsWith("image/")) {
      return ctx.reply("Ce fichier n'est pas une image.");
    }

    const buffer = await downloadTelegramFile(ctx, doc.file_id);

    const prompt = "Analyse cette image (DOCUMENT Telegram) comme référence RP.";
    const messages = buildMessages(prompt, buffer);

    const reply = await askMistral(messages);
    ctx.reply(reply, { parse_mode: "Markdown" });

  } catch (err) {
    console.error("DOCUMENT ERROR:", err);
    ctx.reply("Impossible d’analyser l’image (document).");
  }
});



// ---------------------------
// 💬 HANDLER TEXTE (RP + OOC)
// ---------------------------
bot.on("text", async (ctx) => {
  try {
    const userMsg = ctx.message.text;
    const messages = buildMessages(userMsg);

    const reply = await askMistral(messages);
    ctx.reply(reply, { parse_mode: "Markdown" });

  } catch (err) {
    console.error("TEXT ERROR:", err);
    ctx.reply("Erreur interne, camarade RP.");
  }
});



// ---------------------------
// 🚀 Lancement du bot
// ---------------------------
bot.launch();
console.log("🔥 Bobby Schulz RP Bot — ONLINE (FULL MISTRAL + PHOTO/DOC PATCH + NO HAGEN)");
