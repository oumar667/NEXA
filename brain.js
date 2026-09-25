// ============================================
// NEXA BRAIN - Orchestrateur Principal
// Routage intelligent : Outils Locaux ⇄ IA
// ============================================

const NexaBrain = {
    // ⚠️ COLLE TA CLÉ API OPENROUTER ENTRE LES GUILLEMETS CI-DESSOUS :
    API_KEY: "TA_CLE_API_OPENROUTER_ICI",

    async think(userText, attachment = null) {
        if (!userText && !attachment) return "Veuillez formuler une requête.";

        const textLower = userText.toLowerCase().trim();

        // ==========================================
        // 1. OUTILS LOCAUX (Priorité, Vitesse, Hors-ligne)
        // ==========================================

        // Routine du matin
        if (textLower === "bonjour" || textLower === "routine") {
            return NexaTools.getMorningRoutine();
        }

        // Chronomètre interactif
        if (textLower === "chrono" || textLower === "chronomètre") {
            return NexaTools.showChronometer();
        }

        // Heure et Date
        if (textLower.includes("quelle heure") || textLower === "date") {
            return NexaTools.getTimeAndDate();
        }

        // Météo (Ex: "météo paris")
        if (textLower.startsWith("météo")) {
            const city = textLower.replace("météo", "").trim() || "Paris"; // Paris par défaut
            return await NexaTools.getWeather(city);
        }

        // Wikipédia (Ex: "wiki IA" ou "qui est Alan Turing")
        if (textLower.startsWith("wiki ") || textLower.startsWith("qui est ") || textLower.startsWith("qu'est-ce que ")) {
            const query = textLower.replace(/wiki |qui est |qu'est-ce que |c'est quoi /g, "").trim();
            if (query) {
                return await NexaTools.searchWikipedia(query);
            }
        }

        // ==========================================
        // 2. GESTION DE LA MÉMOIRE (Tâches locales)
        // ==========================================

        if (textLower.startsWith("ajoute la tâche") || textLower.startsWith("rappel")) {
            const task = textLower.replace(/ajoute la tâche|rappel/g, "").trim();
            if (task) {
                // Nécessite memory.js fonctionnel
                if (typeof NexaMemory !== "undefined") {
                    NexaMemory.addTask(task);
                    return `Tâche ajoutée avec succès : **${task}**`;
                }
            }
        }

        if (textLower.includes("mes tâches") || textLower.includes("liste des tâches")) {
            if (typeof NexaMemory !== "undefined") {
                const tasks = NexaMemory.getTasks();
                if (tasks.length === 0) return "Tu n'as aucune tâche en cours.";
                return "**Voici tes tâches :**\n" + tasks.map((t, i) => `- ${t.text}`).join("\n");
            }
        }

        // ==========================================
        // 3. RÉFLEXION PROFONDE (Appel à l'IA OpenRouter)
        // ==========================================
        
        try {
            // Si aucune commande locale n'est détectée, on passe le relais à l'IA
            return await NexaAI.generateResponse(userText, attachment);
        } catch (error) {
            console.error("Erreur Brain -> AI :", error);
            return "Mon réseau neuronal est actuellement inaccessible. Vérifiez votre connexion ou la clé API.";
        }
    }
};
