// ============================================
// NEXA BRAIN - version 1.1
// Correction du lien avec les outils et l'IA.
// ============================================

const NexaBrain = {
    version: "1.1",

    // Ces fonctions récupèrent tes outils de manière sécurisée
    getTools() { try { return NexaTools; } catch(e) { try { return nexaTools; } catch(e2) { return null; } } },
    getMemory() { try { return NexaMemory; } catch(e) { try { return nexaMemory; } catch(e2) { return null; } } },
    getAI() { try { return NexaAI; } catch(e) { try { return nexaAI; } catch(e2) { return null; } } },

    async think(userInput, attachment) {
        const input = (userInput || "").toLowerCase().trim();
        
        const tools = this.getTools();
        const memory = this.getMemory();
        const ai = this.getAI();

        // 1. Commandes système
        if (input === "aide") {
            return `Voici ce que je peux faire :
- Mémoire : "Je m'appelle [Nom]", "J'habite à [Ville]", "Note : [Texte]"
- Tâches : "Ajoute une tâche : [Texte]", "Mes tâches", "Termine la tâche 1"
- Outils : "Heure", "Date", "Calcule [X]", "Météo à [Ville]", "Wiki : [Recherche]"
- Calendrier (IA) : "Ajoute un RDV chez le dentiste demain à 15h"
- Vision/Fichiers (IA) : Joins une photo/fichier via le bouton + et pose une question
- Système : "Change ma clé", "Efface la conversation", "Oublie tout"`;
        }

        // On accepte "changer" ou "change" et "clé" ou "cle" (sans accent)
        if (input.includes("change ma cl") || input.includes("changer ma cl") || input.includes("supprime ma cl")) {
            if (ai) ai.clearKey();
            else localStorage.removeItem("nexa_openrouter_key"); // Secours
            return "Clé API supprimée. Recharge la page pour en saisir une nouvelle.";
        }

        if (input === "efface la conversation") {
            if (memory) memory.clearHistory();
            return "Historique effacé de cet écran. (Profil, notes et tâches conservés).";
        }

        if (input === "oublie tout") {
            if (memory) memory.clearHistory();
            localStorage.removeItem("nexa_name");
            localStorage.removeItem("nexa_city");
            localStorage.removeItem("nexa_notes");
            localStorage.removeItem("tasks");
            return "J'ai absolument tout oublié (historique, profil, notes et tâches). On repart à zéro !";
        }

        // 2. Tâches
        if (tools) {
            if (input.startsWith("ajoute une tâche :")) return tools.manageTasks("add", userInput.substring(18).trim());
            if (input.startsWith("ajoute ") && input.endsWith(" à ma liste")) return tools.manageTasks("add", userInput.substring(7, userInput.length - 11).trim());
            if (input === "mes tâches") return tools.manageTasks("list");
            if (input.startsWith("termine la tâche ")) {
                const num = parseInt(input.replace("termine la tâche ", "").trim());
                return isNaN(num) ? "Précise un numéro valide." : tools.manageTasks("done", "", num);
            }
            if (input.startsWith("supprime la tâche ")) {
                const num = parseInt(input.replace("supprime la tâche ", "").trim());
                return isNaN(num) ? "Précise un numéro valide." : tools.manageTasks("delete", "", num);
            }
            if (input === "vide mes tâches") return tools.manageTasks("clear");
        }

        // 3. Mémoire locale
        if (memory) {
            if (input.startsWith("je m'appelle ")) {
                const name = userInput.substring(13).trim();
                memory.saveName(name);
                return `Enchanté ${name} ! J'ai mémorisé ton prénom.`;
            }
            if (input.startsWith("j'habite à ") || input.startsWith("j'habite ")) {
                const city = userInput.replace("j'habite à ", "").replace("j'habite ", "").trim();
                memory.saveCity(city);
                return `C'est noté, tu habites à ${city}.`;
            }
            if (input.startsWith("note : ")) {
                memory.addNote(userInput.substring(7).trim());
                return "C'est noté et sauvegardé dans ma mémoire.";
            }
            if (input === "mes notes") {
                const notes = memory.getNotes();
                return (!notes || notes.length === 0) ? "Tu n'as aucune note." : "Voici tes notes :\n- " + notes.join("\n- ");
            }
        }

        // 4. Outils basiques sans IA
        if (tools) {
            if (input.includes("quelle heure est-il") || input === "heure") return tools.getTime();
            if (input.includes("quel jour on est") || input === "date") return tools.getDate();
            if (input.startsWith("calcule ")) return tools.calculate(input.replace("calcule ", ""));
            if (input.startsWith("météo à ")) return await tools.getWeather(userInput.substring(8).trim());
            if (input.startsWith("wiki : ")) return await tools.searchWikipedia(userInput.substring(7).trim());
        }

        // ==========================================
        // 5. MODÈLE IA (Vision, Fichiers, Calendrier)
        // ==========================================
        if (!ai) return "L'outil IA n'est pas connecté. (Le fichier ai.js est introuvable)";

        const context = memory ? memory.getContext() : "";
        const today = tools ? (tools.getDate() + " à " + tools.getTime()) : "";
        
        const systemPrompt = `Tu es NEXA, un assistant personnel intelligent et concis.
Infos utilisateur : ${context}
Date et heure actuelles : ${today}
RÈGLE SPÉCIALE CALENDRIER : Si l'utilisateur demande d'ajouter un événement, un rendez-vous ou un rappel, NE fais AUCUNE phrase d'introduction ou de conclusion. Réponds UNIQUEMENT et EXACTEMENT avec ce format :
[CALENDAR: Titre de l'événement | YYYY-MM-DD | HH:MM | Description optionnelle]
Exemple : [CALENDAR: RDV Dentiste | 2024-12-15 | 14:30 | Cabinet centre ville]`;

        let userMessageContent;
        
        if (attachment) {
            if (attachment.type === "text") {
                userMessageContent = `${userInput}\n\n--- FICHIER JOINT (${attachment.name}) ---\n${attachment.data}`;
            } else if (attachment.type === "image") {
                userMessageContent = [
                    { type: "text", text: userInput || "Que vois-tu sur cette image ?" },
                    { type: "image_url", image_url: { url: attachment.data } }
                ];
            }
        } else {
            userMessageContent = userInput;
        }

        const messages = [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessageContent }
        ];

        const aiResponse = await ai.ask(messages);

        if (aiResponse.includes("[CALENDAR:")) {
            try {
                const regex = /\[CALENDAR:\s*(.*?)\s*\Vert{}\s*(.*?)\s*\Vert{}\s*(.*?)\s*\Vert{}\s*(.*?)\]/;
                const match = aiResponse.match(regex);
                if (match && tools) {
                    const title = match[1].trim();
                    const date = match[2].trim();
                    const time = match[3].trim();
                    const desc = match[4].trim();
                    return "J'ai préparé ton événement :\n" + tools.createCalendarEvent(title, date, time, desc);
                }
            } catch (e) {}
        }

        return aiResponse;
    }
};

window.NexaBrain = NexaBrain;
