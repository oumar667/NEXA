const NexaAI = {
  // Service d'IA gratuit pour le traitement des messages
  apiUrl: "https://text.pollinations.ai/",

  /**
   * Transmet l'historique des messages au modèle IA et renvoie sa réponse
   * @param {Array} messages - Liste des messages de la conversation
   * @returns {Promise<string>} - Réponse texte générée par l'IA
   */
  async ask(messages) {
    try {
      const response = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messages: messages,
          model: "openai"
        })
      });

      if (!response.ok) {
        throw new Error(`Erreur réseau : ${response.status}`);
      }

      const textResponse = await response.text();
      return textResponse;
    } catch (error) {
      console.error("Erreur dans NexaAI :", error);
      return "Désolé, je rencontre des difficultés pour joindre le serveur IA pour le moment.";
    }
  }
};
