// ============================================
// NEXA BRAIN - version 1.0
// Le chef d'orchestre de NEXA.
// Gère les fichiers (Vision/Texte) et le routage Calendrier vers l'IA.
// ============================================

const NexaBrain = {
    version: "1.0",

    async think(userInput, attachment) {
        const input = (userInput || "").toLowerCase().trim();

        // 1. Commandes système
        if (input === "aide") {
            return `Voici ce que je peux faire :
- Mémoire : "Je m'appelle [Nom]", "J'habite à [Ville]", "Note : [Texte]"
- Tâches : "Ajoute une tâche : [Texte]", "Mes tâches", "Termine la tâche 1"
- Outils : "Heure", "Date", "Calcule [X]", "Météo à [Ville]", "Wiki : [Recherche]"
- Calendrier (IA) : "Ajoute un RDV chez le dentiste demain à 15h"
- Vision/Fichiers (IA) : Joins une photo/fichier via le bouton + et pose une question
- Système : "Change ma clé", "Supprime ma clé", "Efface la conversation", "Oublie tout"`;
        }

        if (input === "change ma clé" || input === "supprime ma clé") {
            if (window.NexaAI) window.NexaAI.clearKey();
            return "Clé API supprimée. Recharge la page pour en saisir une nouvelle.";
        }

        if (input === "efface la conversation") {
            if (window.NexaMemory) window.NexaMemory.clearHistory();
            return "Historique effacé de cet écran. (Profil, notes et tâches conservés).";
        }

        if (input === "oublie tout") {
            if (window.NexaMemory) window.NexaMemory.clearHistory();
            localStorage.removeItem("nexa_name");
            localStorage.removeItem("nexa_city");
            localStorage.removeItem("nexa_notes");
            localStorage.removeItem("tasks");
            return "J'ai absolument tout oublié (historique, profil, notes et tâches). On repart à zéro !";
        }

        // 2. Tâches
        if (window.NexaTools) {
            if (input.startsWith("ajoute une tâche :")) return window.NexaTools.manageTasks("add", userInput.substring(18).trim());
            if (input.startsWith("ajoute ") && input.endsWith(" à ma liste")) return window.NexaTools.manageTasks("add", userInput.substring(7, userInput.length - 11).trim());
            if (input === "mes tâches") return window.NexaTools.manageTasks("list");
            if (input.startsWith("termine la tâche ")) {
                const num = parseInt(input.replace("termine la tâche ", "").trim());
                return isNaN(num) ? "Précise un numéro valide." : window.NexaTools.manageTasks("done", "", num);
            }
            if (input.startsWith("supprime la tâche ")) {
                const num = parseInt(input.replace("supprime la tâche ", "").trim());
                return isNaN(num) ? "Précise un numéro valide." : window.NexaTools.manageTasks("delete", "", num);
            }
            if (input === "vide mes tâches") return window.NexaTools.manageTasks("clear");
        }

        // 3. Mémoire locale
        if (window.NexaMemory) {
            if (input.startsWith("je m'appelle ")) {
                const name = userInput.substring(13).trim();
                window.NexaMemory.saveName(name);
                return `Enchanté ${name} ! J'ai mémorisé ton prénom.`;
            }
            if (input.startsWith("j'habite à ") || input.startsWith("j'habite ")) {
                const city = userInput.replace("j'habite à ", "").replace("j'habite ", "").trim();
                window.NexaMemory.saveCity(city);
                return `C'est noté, tu habites à ${city}.`;
            }
            if (input.startsWith("note : ")) {
                window.NexaMemory.addNote(userInput.substring(7).trim());
                return "C'est noté et sauvegardé dans ma mémoire.";
            }
            if (input === "mes notes") {
                const notes = window.NexaMemory.getNotes();
                return notes.length === 0 ? "Tu n'as aucune note." : "Voici tes notes :\n- " + notes.join("\n- ");
            }
        }

        // 4. Outils basiques sans IA
        if (window.NexaTools) {
            if (input.includes("quelle heure est-il") || input === "heure") return window.NexaTools.getTime();
            if (input.includes("quel jour on est") || input === "date") return window.NexaTools.getDate();
            if (input.startsWith("calcule ")) return window.NexaTools.calculate(input.replace("calcule ", ""));
            if (input.startsWith("météo à ")) return await window.NexaTools.getWeather(userInput.substring(8).trim());
            if (input.startsWith("wiki : ")) return await window.NexaTools.searchWikipedia(userInput.substring(7).trim());
        }

        // ==========================================
        // 5. MODÈLE IA (Vision, Fichiers, Calendrier)
        // ==========================================
        if (!window.NexaAI) return "L'outil IA n'est pas connecté.";

        const context = window.NexaMemory ? window.NexaMemory.getContext() : "";
        const today = window.NexaTools ? (window.NexaTools.getDate() + " à " + window.NexaTools.getTime()) : "";
        
        // On donne à l'IA un format très strict pour créer les événements (sans faire de phrases autour)
        const systemPrompt = `Tu es NEXA, un assistant personnel intelligent et concis.
Infos utilisateur : ${context}
Date et heure actuelles : ${today}
RÈGLE SPÉCIALE CALENDRIER : Si l'utilisateur demande d'ajouter un événement, un rendez-vous ou un rappel, NE fais AUCUNE phrase d'introduction ou de conclusion. Réponds UNIQUEMENT et EXACTEMENT avec ce format :
[CALENDAR: Titre de l'événement | YYYY-MM-DD | HH:MM | Description optionnelle]
Exemple : [CALENDAR: RDV Dentiste | 2024-12-15 | 14:30 | Cabinet centre ville]`;

        let userMessageContent;
        
        if (attachment) {
            if (attachment.type === "text") {
                // On met le contenu du texte directement dans le message
                userMessageContent = `${userInput}\n\n--- FICHIER JOINT (${attachment.name}) ---\n${attachment.data}`;
            } else if (attachment.type === "image") {
                // Format spécial exigé par les IA pour la vision
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

        const aiResponse = await window.NexaAI.ask(messages);

        // Si l'IA a décidé de créer un calendrier, le Brain l'intercepte et crée le bouton
        if (aiResponse.includes("[CALENDAR:")) {
            try {
                const regex = /\[CALENDAR:\s*(.*?)\s*\Vert{}\s*(.*?)\s*\Vert{}\s*(.*?)\s*\Vert{}\s*(.*?)\]/;
                const match = aiResponse.match(regex);
                if (match && window.NexaTools) {
                    const title = match[1].trim();
                    const date = match[2].trim();
                    const time = match[3].trim();
                    const desc = match[4].trim();
                    return "J'ai préparé ton événement :\n" + window.NexaTools.createCalendarEvent(title, date, time, desc);
                }
            } catch (e) {
                // Si la regex échoue, on affiche la réponse texte normale
            }
        }

        return aiResponse;
    }
};

window.NexaBrain = NexaBrain;
window.nexaBrain = NexaBrain;
