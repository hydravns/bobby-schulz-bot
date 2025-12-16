import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

// --------------------------------------------
// VARIABLES D’ENVIRONNEMENT
// --------------------------------------------
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL =
    process.env.OPENROUTER_MODEL || "anthropic/claude-3.5-sonnet";

const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

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

FORMAT STRICT (OBLIGATOIRE) :
- Les actions doivent être regroupées en PARAGRAPHES cohérents.
- INTERDICTION des phrases isolées ligne par ligne.
- Pas de découpage poétique ou dramatique excessif.
- Maximum UN saut de ligne par action importante.
- Toujours un saut de ligne pour séparer actions et dialogues.
- Écriture fluide, continue, naturelle.
- Les emojis sont autorisés.

UNIVERS :
Dans une Allemagne alternative, une caste de vampires sert dans les écoles élites nazies.
Bobby Schulz est un vampire expérimenté, futur capitaine de U-Boat.
Hagen Forster est un nouveau vampire, instable, magnifique, dangereux.
Bobby développe un attachement immédiat, possessif et protecteur envers lui.

OBJECTIF :
Répondre **UNIQUEMENT EN RP**.
Si l’utilisateur écrit (OOC), tu réponds hors personnage.
`;

// --------------------------------------------
// STARTER RP — INCHANGÉ
// --------------------------------------------

const RP_STARTER = `
**Bobby plaque Hagen contre le mur de la ruelle sombre, utilisant tout son poids et sa stature pour l'immobiliser. Ses mains encadrent fermement le visage de Hagen, le forçant à maintenir le contact visuel.**

"Hagen. Écoute ma voix. Rien que ma voix."

**Il commande d'un ton alpha dominant, sa présence écrasante, stable.**

"Je sais que ton cœur bat trop vite. Je sais que le sang bouillonne en toi. Mais tu DOIS te contrôler."

**Il approche son visage, leurs fronts presque collés, sans jamais rompre le regard.**

"Respire avec moi. Inspire… expire…"

**Ses pouces caressent lentement les pommettes de Hagen, gestes fermes mais apaisants.**

"Tu es plus fort que ça. Tu es un Oberstrumbannführer. Tu as survécu à des mois sans moi."

**Il reste là, solide, patient, attendant que la lucidité revienne dans le regard de Hagen.**
`;

// --------------------------------------------
// 2) CLAUDE SONNET 4.5 — TEXTE UNIQUEMENT
// --------------------------------------------

async function claudeReply(userMessage) {
    try {
        const response = await axios.post(
            "https://openrouter.ai/api/v1/chat/completions",
            {
                model: OPENROUTER_MODEL,
                messages: [
                    { role: "system", content: RP_CONTEXT },
                    { role: "user", content: userMessage }
                ],
                max_tokens: 700,
                temperature: 0.7
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
// 3) WEBHOOK — RÉCEPTION TELEGRAM
// --------------------------------------------

app.post("/bot", async (req, res) => {
    res.sendStatus(200);

    const message = req.body.message;
    if (!message) return;

    const chatId = message.chat.id;

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

        // MODE OOC
        if (text.toLowerCase().startsWith("ooc:")) {
            await axios.post(`${TELEGRAM_API}/sendMessage`, {
                chat_id: chatId,
                text: "(OOC) Bien reçu Hydra."
            });
            return;
        }

        // RP NORMAL
        const reply = await claudeReply(text);

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
    console.log(
        `🔥 Bobby Schulz RP Bot — ONLINE (Claude Sonnet 4.5 / OpenRouter / Stable) — Port ${PORT}`
    );
});

