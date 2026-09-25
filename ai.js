const NexaAI = {
    async generateResponse(userText, attachment = null) {
        // Récupération sécurisée de la clé depuis le téléphone
        const apiKey = localStorage.getItem('NEXA_API_KEY');
        if (!apiKey) throw new Error("Clé API manquante");

        let messages = [
            {
                role: "system",
                content: "Tu es NEXA, un assistant IA intelligent, concis et précis. Réponds toujours en français."
            }
        ];

        let userContent = userText;
        
        // Gestion des fichiers joints s'il y en a
        if (attachment && attachment.type === 'text') {
            userContent += `\n\nVoici le contenu du fichier joint (${attachment.name}) :\n${attachment.content}`;
        }

        messages.push({ role: "user", content: userContent });

        try {
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    // Modèle 100% gratuit et très doué en logique sur OpenRouter
                    model: "google/gemma-2-9b-it:free", 
                    messages: messages
                })
            });

            const data = await response.json();

            // Gestion des erreurs renvoyées par OpenRouter
            if (data.error) {
                return `Erreur du service IA : ${data.error.message}`;
            }

            return data.choices[0].message.content;

        } catch (error) {
            console.error("Erreur API :", error);
            return "Désolé, une erreur de connexion est survenue avec l'IA.";
        }
    }
};
