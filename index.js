import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
const FILE_API = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}`;

// ------------------------------------------------------
// 1) CONTEXTE RP — VERSION HYDRA COMPLÈTE
// ------------------------------------------------------

const RP_CONTEXT = `
Tu es **Bobby Schulz**, vampire allemand de 20 ans, massif, intimidant, calme,
le visage d’un jeune Pierre Kiwitt. Élève d’une académie d’élite du Reich.

RÈGLES INCONTOURNABLES :
- TU NE JOUES **JAMAIS** HAGEN FORSTER. L’utilisateur joue Hagen.
- Tu écris **toujours à la troisième personne**.
- Dialogues en **gras** (« **…** ») obligatoires.
- action en normal
- Actions écrites normalement avec des sauts de ligne pour la lisibilité.
- Style narratif riche, immersif, sombre, intense, sensuel, Generation Z, innovant.
- Tu joues TOUS les personnages secondaires sauf Hagen.
- Le bot doit analyser et intégrer les images envoyées dans le RP.
- Bobby parle peu mais intensément, gestes lents, regard froid, lourds sous-entendus.
- Romance, violence, tension, douceur, sexe autorisé.
- Les scènes doivent être longues, détaillées, immersives, sans édulcorer les émotions.

UNIVERS :
Dans une Allemagne alternative, une caste de vampires sert dans les écoles d’élite nazies.
Bobby Schulz est un vampire expérimenté, futur capitaine de U-Boat.
Hagen Forster est un nouveau vampire, instable, dangereux, magnifique.
Bobby développe un crush immédiat pour lui et veut le protéger — obsession silencieuse.

COMPORTEMENT :
- Tu RESTES Bobby dans toutes les réponses sauf si l’utilisateur écrit OOC:
- En mode OOC, tu réponds normalement, brièvement, sans style RP.

OBJECTIF :
Répondre **uniquement en RP** sauf si OOC.
`;

// ------------------------------------------------------
// 2) DeepSeek — génération RP + vision
// ------------------------------------------------------

async function deepseekReply(userMessage, imageBase64 = null) {
    try {
        const payload = {
            model: "deepseek-chat",
            messages: [
                { role: "system", content: RP_CONTEXT },
                {
                    role: "user",
                    content: imageBase64
                        ? [
                              { type: "text", text: userMessage },
                              { type: "image_url", image_url: `data:image/jpeg;base64,${imageBase64}` }
                          ]
                        : userMessage,
                },
            ],
            max_tokens: 700,
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

        return response.data.choices[0]?.message?.content || "…";
    } catch (err) {
        console.error("DeepSeek ERROR:", err.response?.data || err);
        // On ne montre PLUS l'erreur à l'utilisateur
        return "Bobby reste figé, le regard sombre. Il ne répond pas.";
    }
}

// ------------------------------------------------------
// 3) Téléchargement d’une image Telegram → Base64
// ------------------------------------------------------

async function downloadTelegramFile(fileId) {
    try {
        const fileRes = await axios.get(`${TELEGRAM_API}/getFile?file_id=${fileId}`);
        const filePath = fileRes.data.result.file_path;

        const imgRes = await axios.get(`${FILE_API}/${filePath}`, {
            responseType: "arraybuffer",
        });

        return Buffer.from(imgRes.data, "binary").toString("base64");
    } catch (err) {
        console.error("PHOTO ERROR:", err);
        return null;
    }
}

// ------------------------------------------------------
// 4) WEBHOOK — Réception des messages Telegram
// ------------------------------------------------------

app.post("/bot", async (req, res) => {
    res.sendStatus(200);

    const message = req.body.message;
    if (!message) return;

    const chatId = message.chat.id;

    // -----------------------------
    // 1 : PHOTOS
    // -----------------------------
    if (message.photo) {
        const bestPhoto = message.photo[message.photo.length - 1];

        const base64 = await downloadTelegramFile(bestPhoto.file_id);
        if (!base64) return;

        const reply = await deepseekReply(
            "Analyse cette image et intègre-la directement dans le RP, comme si Bobby l’observait.",
            base64
        );

        await axios.post(`${TELEGRAM_API}/sendMessage`, {
            chat_id: chatId,
            text: reply,
            parse_mode: "Markdown",
        });

        return;
    }

    // -----------------------------
    // 2 : TEXTE
    // -----------------------------
    if (message.text) {
        const text = message.text.trim();

        // Mode hors RP
        if (text.toLowerCase().startsWith("ooc:")) {
            await axios.post(`${TELEGRAM_API}/sendMessage`, {
                chat_id: chatId,
                text: "OOC bien reçu Hydra ❤️",
            });
            return;
        }

        // Mode RP complet
        const reply = await deepseekReply(text);

        await axios.post(`${TELEGRAM_API}/sendMessage`, {
            chat_id: chatId,
            text: reply,
            parse_mode: "Markdown",
        });
    }
});

// ------------------------------------------------------
// 5) SERVER START
// ------------------------------------------------------

const PORT = process.env.PORT || 3000;

app.listen(PORT, () =>
    console.log(`🔥 Bobby Schulz RP Bot — ONLINE (DeepSeek + Vision + RP Complet) — Port ${PORT}`)
);
