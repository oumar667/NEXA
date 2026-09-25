const NexaAI = {
    async generateResponse(userText, attachment = null) {
        const apiKey = localStorage.getItem('NEXA_API_KEY');
        if (!apiKey) return "🚨 ERREUR : Clé API manquante dans l'iPhone.";

        let messages = [
            {
                role: "system",
                content: "Tu es NEXA, un assistant IA intelligent. Résous les calculs et réponds directement."
            },
            { role: "user", content: userText }
        ];

        try {
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://oumar667.github.io/NEXA/",
                    "X-Title": "NEXA"
                },
                body: JSON.stringify({
                    model: "mistralai/mistral-7b-instruct:free",
                    messages: messages
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                return `🚨 ERREUR RÉSEAU (${response.status}) : ${errText}`;
            }

            const data = await response.json();

            if (data.error) {
                return `🚨 ERREUR OPENROUTER : ${data.error.message}`;
            }

            if (!data.choices || !data.choices[0]) {
                return `🚨 ERREUR FORMAT : Réponse inattendue de l'IA : ${JSON.stringify(data)}`;
            }

            return data.choices[0].message.content;

        } catch (error) {
            return `🚨 ERREUR SYSTÈME (Safari/JS) : ${error.name} - ${error.message}`;
        }
    }
};
