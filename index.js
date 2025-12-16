import express from "express";
import axios from "axios";
import Redis from "ioredis";

const app = express();
app.use(express.json());

// --------------------------------------------
// VARIABLES D’ENVIRONNEMENT
// --------------------------------------------
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;
const REDIS_URL = process.env.REDIS_URL;

const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
const DEEPSEEK_API = "https://api.deepseek.com/v1/chat/completions";

// --------------------------------------------
// REDIS CLIENT
// --------------------------------------------

const redis = new Redis(REDIS_URL);
const MEMORY_LIMIT = 10;

// --------------------------------------------
// 1) CONTEXTE RP — VERROUILLÉ
// --------------------------------------------

const RP_CONTEXT = `
Tu es **Bobby Schulz**, vampire allemand de 20 ans, massif, intimidant, calme,
le visage d’un jeune Pierre Kiwitt. Élève d’une académie d’élite du Reich.

RÈGLES INCONTOURNABLES :
- TU NE JOUES **JAMAIS** HAGEN FORSTER. L’utilisateur joue Hagen.
- Tu écris **TOUJOURS À LA TROISIÈME PERSONNE**.
- **LES ACTIONS SONT EN GRAS.**
- Les dialogues sont en texte normal entre guillemets.
- Style narratif direct, maîtrisé, sombre et sensuel.
- Tu joues TOUS les personnages secondaires sauf Hagen.
- Bobby parle peu, mais intensément, gestes lents et dominants.
- Le RP est romantique, violent, tendu, jamais pornographique.
- Les réponses doivent être longues et immersives.

FORMAT STRICT :
- Les actions doivent être regroupées en paragraphes cohérents.
- Interdiction des phrases isolées ligne par ligne.
- Maximum un saut de ligne par action importante.
- Toujours un saut de ligne pour séparer actions et dialogues.
- Écriture fluide et continue.
- Emojis autorisés.

UNIVERS :
Dans une Allemagne alternative, une caste de vampires sert dans les écoles élites nazies.
Bobby Schulz est un vampire expérimenté, futur capitaine de U-Boat.
Hagen Forster est un nouveau vampire, instable, magnifique, dangereux.
Bobby développe un attachement immédiat, possessif et protecteur envers lui.

OBJECTIF :
Répondre uniquement en RP.
`;

// --------------------------------------------
// STARTER RP — ORIGINAL (RESTAURÉ)
// --------------------------------------------

const RP_STARTER = `
Bobby plaque Hagen contre le mur de la ruelle sombre, utilisant tout son poids et sa stature pour l'immobiliser. Ses mains encadrent fermement le visage de Hagen, le forçant à maintenir le contact visuel.

**Hagen. Écoute ma voix. Rien que ma voix.**

il commande d'un ton alpha dominant.

**Je sais que ton cœur bat trop vite. Je sais que le sang bouillonne en toi. Mais tu DOIS te contrôler.**

Il approche son visage tout près, leurs fronts se touchant presque.

**Respire avec moi. Inspire... expire…**

Il fait une démonstration lente, exagérée.

**Tu es plus fort que ça. Tu es un Oberstrumbannführer. Tu as survécu à des mois sans moi.**

Ses pouces caressent les pommettes de Hagen en cercles apaisants.

**Maintenant, on va chasser ensemble. Comme avant. Mais tu dois ralentir ton rythme cardiaque d'abord, sinon tu vas perdre complètement le contrôle.**

Il attend, patient mais ferme, que les yeux de Hagen montrent un signe de lucidité.
`;

// --------------------------------------------
// MÉMOIRE — REDIS
// --------------------------------------------

async function getMemory(chatId) {
    const data = await redis.get(`memory:${chatId}`);
    return data ? JSON.parse(data) : [];
}

async function saveMemory(chatId, messages) {
    const trimmed = messages.slice(-MEMORY_LIMIT);
    await redis.set(`memory:${chatId}`, JSON.stringify(trimmed));
}

// --------------------------------------------
// 2) DEEPSEEK — AVEC MÉMOIRE
// --------------------------------------------

async function deepseekReply(chatId, userMessage) {
    try {
        const memory = await getMemory(chatId);

        const messages = [
            { role: "system", content: RP_CONTEXT },
            ...memory,
            { role: "user", content: userMessage }
        ];

        const response = await axios.post(
            DEEPSEEK_API,
            {
                model: "deepseek-chat",
                messages,
                max_tokens: 700,
                temperature: 0.7
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${DEEPSEEK_KEY}`
                }
            }
        );

        const assistantReply = response.data.choices[0].message.content;

        await saveMemory(chatId, [
            ...memory,
            { role: "user", content: userMessage },
            { role: "assistant", content: assistantReply }
        ]);

        return assistantReply;

    } catch (err) {
        console.error("DEEPSEEK ERROR:", err.response?.data || err);
        return "(OOC) Une erreur est survenue Hydra. Réessaie.";
    }
}

// --------------------------------------------
// 3) WEBHOOK TELEGRAM
// --------------------------------------------

app.post("/bot", async (req, res) => {
    res.sendStatus(200);

    const message = req.body.message;
    if (!message) return;

    const chatId = message.chat.id;

    if (message.text) {
        const text = message.text;

        // STARTER (reset mémoire)
        if (text === "/start") {
            await redis.del(`memory:${chatId}`);

            await axios.post(`${TELEGRAM_API}/sendMessage`, {
                chat_id: chatId,
                text: RP_STARTER,
                parse_mode: "Markdown"
            });
            return;
        }

        // OOC
        if (text.toLowerCase().startsWith("ooc:")) {
            await axios.post(`${TELEGRAM_API}/sendMessage`, {
                chat_id: chatId,
                text: "(OOC) Bien reçu Hydra."
            });
            return;
        }

        // RP AVEC MÉMOIRE
        const reply = await deepseekReply(chatId, text);

        await axios.post(`${TELEGRAM_API}/sendMessage`, {
            chat_id: chatId,
            text: reply,
            parse_mode: "Markdown"
        });
    }
});

// --------------------------------------------
// 4) SERVER START
// --------------------------------------------

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("🔥 Bobby Schulz RP Bot — ONLINE (DeepSeek + Redis + Starter OK)");
});
