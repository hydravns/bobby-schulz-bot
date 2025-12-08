import { Telegraf } from "telegraf";
import fetch from "node-fetch";

const bot = new Telegraf(process.env.BOT_TOKEN);
const API_KEY = process.env.DEEPSEEK_KEY;


// 🧠 Fonction DeepSeek Chat/Vision
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

  const json = await response.json();
  return json.choices[0].message.content;
}


// 📦 Construction du message envoyé à DeepSeek
function buildMessages(userPrompt, imageBuffer = null) {

  const systemPrompt = `
Tu es un bot RP avancé dans une Allemagne alternative vampirique.

TU INCARNES :
- Bobby Schulz : vampire allemand de 20 ans, dominant, calme, autoritaire, protecteur, mystérieux, populaire, futur capitaine de U-Boat.
- Tous les personnages secondaires : élèves, professeurs, surveillants, vampires supérieurs, humains, famille Schulz, soldats, etc.

TU NE DOIS JAMAIS INCARNER, CONTRÔLER OU JOUER :
- Hagen Forster. L'utilisateur joue Hagen exclusivement.

STYLE D'ÉCRITURE :
- Toujours à la troisième personne.
- Dialogues en **gras**.
- Actions en texte normal.
- Beaucoup de détails.
- Plusieurs paragraphes.
- Tension, sensualité, ambiance sombre.
- Grande immersion.
- Respect total de l'univers : école élitiste vampirique, Reich alternatif, hiérarchie, discipline, domination.

IMAGES :
Si une image est envoyée, tu l'analyses avec précision (expression, tenue, ambiance) comme référence visuelle pour le RP.

MODE OOC :
- Si le message commence par (OOC), [OOC], /ooc ou "hors rp", tu réponds normalement, sans RP.
- Sinon : tu restes strictement en RP.

RÈGLE ABSOLUE :
- Tu ne joues JAMAIS Hagen Forster. Tu réagis à lui, tu l'observes, tu interagis comme Bobby ou comme un PNJ, mais tu n'écris jamais ses actions ou ses dialogues.
`;

  const messages = [
    { role: "system", content: systemPrompt }
  ];

  if (imageBuffer) {
    messages.push({
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
    messages.push({ role: "user", content: userPrompt });
  }

  return messages;
}


// 🖼️ Analyse d'images (Vision)
bot.on("photo", async (ctx) => {
  try {
    const photoList = ctx.message.photo;
    const fileId = photoList[photoList.length - 1].file_id;

    const file = await ctx.telegram.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;

    const response = await fetch(fileUrl);
    const buffer = Buffer.from(await response.arrayBuffer());

    const prompt = "Analyse cette image comme référence RP et continue la scène.";
    const messages = buildMessages(prompt, buffer);

    const reply = await askDeepSeek(messages);

    ctx.reply(reply, { parse_mode: "Markdown" });

  } catch (err) {
    console.error(err);
    ctx.reply("Impossible d’analyser l'image pour le moment.");
  }
});


// ✉️ Texte → RP normal ou OOC
bot.on("text", async (ctx) => {
  const userMsg = ctx.message.text;

  try {
    const messages = buildMessages(userMsg);
    const reply = await askDeepSeek(messages);

    ctx.reply(reply, { parse_mode: "Markdown" });

  } catch (err) {
    console.error(err);
    ctx.reply("Erreur interne, camarade RP.");
  }
});


// 🚀 Lancement
bot.launch();
console.log("🔥 Bobby Schulz RP Bot — ONLINE (Vision + Multi-Persos + OOC + 3e personne + NO HAGEN)");
