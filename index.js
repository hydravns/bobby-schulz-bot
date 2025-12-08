import express from "express";
import axios from "axios";
import FormData from "form-data";

const app = express();
app.use(express.json());

// --------------------------------------------
// VARIABLES D’ENVIRONNEMENT
// --------------------------------------------
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const MISTRAL_KEY = process.env.MISTRAL_API_KEY;

const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
const FILE_API = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}`;

// --------------------------------------------
// 1) CONTEXTE RP – EXACTEMENT CELUI QUE TU AVAIS
// --------------------------------------------

const RP_CONTEXT = `
Tu es **Bobby Schulz**, vampire allemand de 20 ans, massif, intimidant, calme,
le visage d’un jeune Pierre Kiwitt. Élève d’une académie d’élite du Reich.

RÈGLES INCONTOURNABLES :
- TU NE JOUES **JAMAIS** HAGEN FORSTER. L’utilisateur joue Hagen.
- Tu écris **toujours à la troisième personne**.
- Dialogues en **gras** (« **…** »).
- Actions sous forme normale avec sauts de ligne.
- Style narratif riche, immersif, sombre et sensuel.
- Tu joues TOUS les personnages secondaires sauf Hagen.
- Le bot doit analyser les images envoyées et les décrire dans le RP.
- Bobby parle peu, mais intensément, regard froid et gestes mesurés.
- Le RP est romantique, violent, tendu, mais jamais pornographique.
- Les scènes doivent être longues, détaillées, très immersives.

UNIVERS :
Dans une Allemagne alternative, une caste de vampires sert dans les écoles élites nazies.
Bobby Schulz est un vampire expérimenté, futur capitaine de U-Boat.
Hagen Forster est un nouveau vampire, instable, magnifique, dangereux.
Bobby développe un crush immédiat pour lui et veut le protéger.

OBJECTIF :
Répondre **uniquement en RP**, sauf si l’utilisateur écrit (OOC),
dans ce cas tu parles hors personnage.
`;

// --------------------------------------------
// 2) MISTRAL VISION + CHAT
// --------------------------------------------

async function mistralReply(userMessage, imageBase64 = null) {
    try {
        const payload = {
            model: "mistral-large-latest",
            messages: [
                { role: "system", content: RP_CONTEXT },
                imageBase64
                    ? {
                          role: "user",
                          content: [
                              { type: "text", text: userMessage },
                              {
                                  type: "image_url",
                                  image_url: `data:image/jpeg;base64,${imageBase64}`
                              }
                          ]
                      }
                    : {
                          role: "user",
                          content: userMessage
                      }
            ],
            max_tokens: 500
        };

        const response = await axios.post(
            "https://api.mistral.ai/v1/chat/completions",
            payload,
            {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${MISTRAL_KEY}`
                }
            }
        );

        return response.data.choices[0].message.content;

    } catch (err) {
        console.error("MISTRAL ERROR:", err.response?.data || err);
        return "(OOC) Une erreur est survenue Hydra. Réessaie.";
    }
}

// --------------------------------------------
// 3) Télécharger une image Telegram → Base64
// --------------------------------------------

async function downloadTelegramFile(fileId) {
    try {
        const fileRes = await axios.get(
            `${TELEGRAM_API}/getFile?file_id=${fileId}`
        );

        const filePath = fileRes.data.result.file_path;
        const fileUrl = `${FILE_API}/${filePath}`;

        const imgRes = await axios.get(fileUrl, {
            responseType: "arraybuffer",
        });

        return Buffer.from(imgRes.data, "binary").toString("base64");

    } catch (err) {
        console.error("PHOTO ERROR:", err);
        return null;
    }
}

// --------------------------------------------
// 4) WEBHOOK — Réception des messages Telegram
// --------------------------------------------

app.post("/bot", async (req, res) => {
    res.sendStatus(200);

    const message = req.body.message;
    if (!message) return;

    const chatId = message.chat.id;

    // -------------------------
    // PHOTO
    // -------------------------
    if (message.photo) {
        const bestPhoto = message.photo[message.photo.length - 1];
        const fileId = bestPhoto.file_id;

        await axios.post(`${TELEGRAM_API}/sendMessage`, {
            chat_id: chatId,
            text: "(OOC) J’analyse ton image Hydra…"
        });

        const base64 = await downloadTelegramFile(fileId);

        if (!base64) {
            await axios.post(`${TELEGRAM_API}/sendMessage`, {
                chat_id: chatId,
                text: "(OOC) Impossible d’analyser l’image Hydra."
            });
            return;
        }

        const reply = await mistralReply("Analyse cette image pour le RP :", base64);

        await axios.post(`${TELEGRAM_API}/sendMessage`, {
            chat_id: chatId,
            text: reply,
            parse_mode: "Markdown"
        });

        return;
    }

    // -------------------------
    // TEXTE
    // -------------------------
    if (message.text) {
        const text = message.text;

        // Mode OOC
        if (text.toLowerCase().startsWith("ooc:")) {
            await axios.post(`${TELEGRAM_API}/sendMessage`, {
                chat_id: chatId,
                text: "(OOC) Bien reçu Hydra."
            });
            return;
        }

        // RP
        const reply = await mistralReply(text);

        await axios.post(`${TELEGRAM_API}/sendMessage`, {
            chat_id: chatId,
            text: reply,
            parse_mode: "Markdown"
        });
    }
});

// --------------------------------------------
// 5) SERVER START
// --------------------------------------------

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🔥 Bobby Schulz RP Bot — ONLINE (Mistral Vision + No Hagen) — Port ${PORT}`);
});
