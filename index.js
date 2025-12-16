import express from "express";
import axios from "axios";
import FormData from "form-data";

const app = express();
app.use(express.json());

// --------------------------------------------
// VARIABLES D’ENVIRONNEMENT
// --------------------------------------------
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL =
    process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-4.5";

const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
const FILE_API = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}`;

// --------------------------------------------
// 1) CONTEXTE RP – INCHANGÉ
// --------------------------------------------

const RP_CONTEXT = `
Tu es **Bobby Schulz**, vampire allemand de 20 ans, massif, intimidant, calme,
le visage d’un jeune Pierre Kiwitt. Élève d’une académie d’élite du Reich.

RÈGLES INCONTOURNABLES :
- TU NE JOUES **JAMAIS** HAGEN FORSTER. L’utilisateur joue Hagen.
- Tu écris **TOUJOURS À LA TROISIÈME PERSONNE**.
- **LES ACTIONS SONT EN GRAS.**
- Les dialogues sont en texte normal entre guillemets.
- Toujours des sauts de ligne pour la lisibilité.
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
// STARTER RP — INCHANGÉ
// --------------------------------------------

const RP_STARTER = `
**Bobby plaque Hagen contre le mur de la ruelle sombre, utilisant tout son poids et sa stature pour l'immobiliser. Ses mains encadrent fermement le visage de Hagen, le forçant à maintenir le contact visuel.**

"Hagen. Écoute ma voix. Rien que ma voix."

**Il commande d'un ton alpha dominant.**

"Je sais que ton cœur bat trop vite. Je sais que le sang bouillonne en toi. Mais tu DOIS te contrôler."

**Il approche son visage tout près, leurs fronts se touchant presque.**

"Respire avec moi. Inspire... expire…"

**Il fait une démonstration lente, exagérée.**

"Tu es plus fort que ça. Tu es un Oberstrumbannführer. Tu as survécu à des mois sans moi."

**Ses pouces caressent les pommettes de Hagen en cercles apaisants.**

"Maintenant, on va chasser ensemble. Comme avant. Mais tu dois ralentir ton rythme cardiaque d'abord, sinon tu vas perdre complètement le contrôle."

**Il attend, patient mais ferme, que les yeux de Hagen montrent un signe de lucidité.**
`;

// --------------------------------------------
// 2) CLAUDE SONNET 4.5 — OPENROUTER
// --------------------------------------------

async function claudeReply(userMessage, imageBase64 = null) {
    try {
        const messages = [
            { role: "system", content: RP_CONTEXT }
        ];

        if (imageBase64) {
            messages.push({
                role: "user",
                content: [
                    { type: "text", text: userMessage },
                    {
                        type: "image_url",
                        image_url: `data:image/jpeg;base64,${imageBase64}`
                    }
                ]
            });
        } else {
            messages.push({
                role: "user",
                content: userMessage
            });
        }

        const response = await axios.post(
            "https://openrouter.ai/api/v1/chat/completions",
            {
                model: OPENROUTER_MODEL,
                messages,
                max_tokens: 700,
                temperature: 0.8
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${OPENROUTER_KEY}`,
                    "HTTP-Referer": "https://localhost",
                    "X-Title": "Bobby-Schulz-Telegram-RP"
                }
            }
        );

        return response.data.choices[0].message.content;

    } catch (err) {
        console.error("OPENROUTER ERROR:", err.response?.data || err);
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

        const reply = await claudeReply("Analyse cette image pour le RP :", base64);

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

        // STARTER
        if (text === "/start") {
            await axios.post(`${TELEGRAM_API}/sendMessage`, {
                chat_id: chatId,
                text: RP_STARTER,
                parse_mode: "Markdown"
            });
            return;
        }

        // Mode OOC
        if (text.toLowerCase().startsWith("ooc:")) {
            await axios.post(`${TELEGRAM_API}/sendMessage`, {
                chat_id: chatId,
                text: "(OOC) Bien reçu Hydra."
            });
            return;
        }

        // RP
        const reply = await claudeReply(text);

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
    console.log(
        `🔥 Bobby Schulz RP Bot — ONLINE (Claude Sonnet 4.5 / OpenRouter) — Port ${PORT}`
    );
});
