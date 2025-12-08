import express from "express";
import axios from "axios";
import FormData from "form-data";

const app = express();
app.use(express.json());

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
const FILE_API = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}`;

// ------------------------------------------------------
// CONTEXTE RP COMPLET
// ------------------------------------------------------

const RP_CONTEXT = `
Tu es **Bobby Schulz**, vampire allemand de 20 ans,
massif, froid, intimidant, interprété par Pierre Kiwitt jeune.

RÈGLES FIXES :
- Tu n’incarnes JAMAIS Hagen Forster.
- Hydra joue Hagen.
- Tu écris TOUJOURS à la troisième personne.
- Dialogues en **gras** avec guillemets français (« **…** »).
- Actions normales, avec sauts de lignes.
- Style : sombre, sensuel, intense, très immersif.
- Tu joues tous les personnages secondaires.
- Tu analyses TOUTES les images envoyées.
- Jamais de pornographie.
- Réponses longues et détaillées.

UNIVERS :
Académie militaire élite du Reich, caste de vampires soldats.
Bobby est un vampire discipliné, dangereux, protecteur.
Hagen est magnifique, instable, et Bobby en tombe amoureux.

MODE OOC :
Si l’utilisateur écrit "ooc:" → tu parles hors RP, proprement,
mais TU ANALYSES QUAND MÊME LES IMAGES.
`;

// ------------------------------------------------------
// DeepSeek (vision + texte)
// ------------------------------------------------------

async function deepseekReply(userMsg, imageBase64 = null, isOOC = false) {
    try {
        const payload = {
            model: "deepseek-chat",
            messages: [
                { role: "system", content: RP_CONTEXT },
                {
                    role: "user",
                    content: imageBase64
                        ? [
                              { type: "text", text: userMsg },
                              { type: "image_url", image_url: `data:image/jpeg;base64,${imageBase64}` }
                          ]
                        : userMsg
                }
            ],
            max_tokens: 500
        };

        const response = await axios.post(
            "https://api.deepseek.com/v1/chat/completions",
            payload,
            {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${DEEPSEEK_API_KEY}`
                }
            }
        );

        return response.data.choices[0].message.content;

    } catch (err) {
        console.error("DeepSeek ERROR:", err.response?.data || err);
        return "(OOC) Impossible d’analyser pour le moment Hydra.";
    }
}

// ------------------------------------------------------
// Téléchargement d’image Telegram
// ------------------------------------------------------

async function downloadTelegramFile(fileId) {
    try {
        const fileRes = await axios.get(`${TELEGRAM_API}/getFile?file_id=${fileId}`);
        const filePath = fileRes.data.result.file_path;
        const fileUrl = `${FILE_API}/${filePath}`;

        const imgRes = await axios.get(fileUrl, { responseType: "arraybuffer" });
        return Buffer.from(imgRes.data, "binary").toString("base64");
    } catch (err) {
        console.error("PHOTO ERROR:", err);
        return null;
    }
}

// ------------------------------------------------------
// Webhook
// ------------------------------------------------------

app.post("/bot", async (req, res) => {
    res.sendStatus(200);

    const message = req.body.message;
    if (!message) return;

    const chatId = message.chat.id;
    const text = message.text || "";
    const isOOC = text.toLowerCase().startsWith("ooc:");

    // ------- PHOTO reçue -------
    if (message.photo) {
        const bestPhoto = message.photo[message.photo.length - 1];
        const fileId = bestPhoto.file_id;

        const base64 = await downloadTelegramFile(fileId);

        const reply = await deepseekReply(
            isOOC ? "Analyse cette image en mode OOC, sans RP." : "Analyse cette image pour le RP :",
            base64,
            isOOC
        );

        await axios.post(`${TELEGRAM_API}/sendMessage`, {
            chat_id: chatId,
            text: reply,
            parse_mode: "Markdown"
        });

        return;
    }

    // ------- Message texte -------
    if (text) {
        // Mode OOC
        if (isOOC) {
            await axios.post(`${TELEGRAM_API}/sendMessage`, {
                chat_id: chatId,
                text: "(OOC) Bien reçu Hydra.",
                parse_mode: "Markdown"
            });
            return;
        }

        // Mode RP
        const reply = await deepseekReply(text);

        await axios.post(`${TELEGRAM_API}/sendMessage`, {
            chat_id: chatId,
            text: reply,
            parse_mode: "Markdown"
        });
    }
});

// ------------------------------------------------------
// Start server
// ------------------------------------------------------

const PORT = process.env.PORT || 3000;

app.listen(PORT, () =>
    console.log(`🔥 Bobby Schulz RP Bot — ONLINE — Port ${PORT}`)
);
