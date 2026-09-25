// ============================================
// NEXA BRAIN - Orchestrateur Principal (Sécurisé)
// Routage intelligent : Outils Locaux ⇄ IA
// ============================================

const NexaBrain = {
    // La clé est lue de manière sécurisée depuis le stockage du navigateur
    get API_KEY() {
        return localStorage.getItem('NEXA_API_KEY') || "";
    },

    async think(userText, attachment = null) {
        if (!userText && !attachment) return "Veuillez formuler une requête.";

        const textLower = userText.toLowerCase().trim();

        // ==========================================
        // 1. OUTILS LOCAUX (Priorité, Vitesse, Hors-ligne)
        // ==========================================

        if (textLower === "bonjour" || textLower === "routine") {
            return NexaTools.getMorningRoutine();
        }

        if (textLower === "chrono" || textLower === "chronomètre") {
            return NexaTools.showChronometer();
        }

        if (textLower.includes("quelle heure") || textLower === "date") {
            return NexaTools.getTimeAndDate();
        }

        if (textLower.startsWith("météo")) {
            const city = textLower.replace("météo", "").trim() || "Paris";
            return await NexaTools.getWeather(city);
        }

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
            if (task && typeof NexaMemory !== "undefined") {
                NexaMemory.addTask(task);
                return `Tâche ajoutée avec succès : **${task}**`;
            }
        }

        if (textLower.includes("mes tâches") || textLower.includes("liste des tâches")) {
            if (typeof NexaMemory !== "undefined") {
                const tasks = NexaMemory.getTasks();
                if (tasks.length === 0) return "Tu n'as aucune tâche en cours.";
                return "**Voici tes tâches :**\n" + tasks.map(t => `- ${t.text}`).join("\n");
            }
        }

        // ==========================================
        // 3. RÉFLEXION PROFONDE (Appel à l'IA OpenRouter)
        // ==========================================
        
        // Sécurité : Si la clé n'a pas été rentrée, on bloque l'appel et on prévient l'utilisateur
        if (!this.API_KEY) {
            return "🔒 **Clé API manquante.**\nClique sur le bouton Options (⋯) en haut à droite pour ajouter ta clé OpenRouter en toute sécurité. Elle restera sur ce téléphone.";
        }

        try {
            return await NexaAI.generateResponse(userText, attachment);
        } catch (error) {
            console.error("Erreur Brain -> AI :", error);
            return "Mon réseau neuronal est actuellement inaccessible. Vérifiez votre connexion.";
        }
    }
};
