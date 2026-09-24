const NexaAI = {
    async ask(messages) {
        try {
            // Récupère le dernier message envoyé par l'utilisateur
            const lastUserMessage = messages[messages.length - 1].content;
            
            // Réponse temporaire pour tester la connexion avec le Brain
            return `NEXA AI a bien reçu ton message : "${lastUserMessage}". Le modèle est connecté !`;
        } catch (error) {
            console.error("Erreur dans NexaAI:", error);
            return "Désolé, une erreur est survenue lors de la communication avec le modèle IA.";
        }
    }
};
