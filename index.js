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
// 1) CONTEXTE RP COMPLET
// ------------------------------------------------------

const RP_CONTEXT = `
Tu es **Bobby Schulz**, vampire allemand de 20 ans, massif, intimidant,
le visage d’un jeune Pierre Kiwitt.

RÈGLES :
- Tu ne joues JAMAIS Hagen Forster. L’utilisateur joue Hagen.
- Style narratif sombre, riche, immersif, sensuel mais non explicite.
- Tu écris à la 3e personne.
- Dialogues en **gras** : « **...** ».
- Actions en texte normal.
- Tu joues tous les personnages secondaires sauf Hagen.
- Tu analyses les images envoyées comme des références visuelles RP.
- Pas de répétition d’OOC.
- Pas de phrases du type "connexion" ou messages techniques.

UNIVERS :
Allemagne alternative. Bobby est vampire d’élite, calme, dangereux.
Il admire Hagen et tente de le comprendre et le protéger.

OBJECTIF :
Répondre uniquement en RP sauf si l’utilisateur écrit OOC.
`;

// ------------------------------------------------------
// 2) DeepSeek — TEXTE + VISION
// ------------------------------------------------------

async function deepseekReply(userMessage, imageBase64 = null) {
    try {

        let content;

        if (imageBase64) {
            content = [
                { type: "input_text", text: userMessage },
                { type: "input_image", data: imageBase64 }
            ];
        } else {
            content = userMessage;
        }

        const payload = {
            model: "deepseek-chat",
            messages: [
                { role: "system", content: RP_CONTEXT },
                { role: "user", content }
            ],
            max_tokens: 600
        };

        const response = await axios.post(
            "https://api.deepseek.com/v1/chat/completions",
            payload,
            {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
                },
            }
        );

        return response.data.choices[0].message.content;

    } catch (err) {
        console.error("DeepSeek ERROR:", err.response?.data || err);
        return "(OOC) Bobby ne parvient pas à analyser pour le moment Hydra.";
    }
}

// ------------------------------------------------------
// 3) Conversion IMAGE Telegram → Base64
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
// 4) WEBHOOK /bot
// ------------------------------------------------------

app.post("/bot", async (req, res) => {
    res.sendStatus(200);

    const message = req.body.message;
    if (!message) return;

    const chatId = message.chat.id;

    // -------- PHOTO --------
    if (message.photo) {
        const bestPhoto = message.photo.at(-1);
        const fileId = bestPhoto.file_id;

        await axios.post(`${TELEGRAM_API}/sendMessage`, {
            chat_id: chatId,
            text: "(OOC) J’analyse ton image Hydra..."
        });

        const base64 = await downloadTelegramFile(fileId);

        const reply = await deepseekReply("Analyse cette image et intègre-la au RP :", base64);

        await axios.post(`${TELEGRAM_API}/sendMessage`, {
            chat_id: chatId,
            text: reply,
            parse_mode: "Markdown"
        });

        return;
    }

    // -------- TEXTE --------
    if (message.text) {
        const text = message.text;

        // OOC
        if (text.toLowerCase().startsWith("ooc:")) {
            await axios.post(`${TELEGRAM_API}/sendMessage`, {
                chat_id: chatId,
                text: "(OOC) Bien reçu Hydra."
            });
            return;
        }

        // RP normal
        const reply = await deepseekReply(text);

        await axios.post(`${TELEGRAM_API}/sendMessage`, {
            chat_id: chatId,
            text: reply,
            parse_mode: "Markdown"
        });
    }
});

// ------------------------------------------------------
// 5) SERVER START
// ------------------------------------------------------

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
    console.log(`🔥 Bobby Schulz RP Bot — ONLINE — Port ${PORT}`)
);
