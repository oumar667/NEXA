// ============================================
// NEXA AI - Version Corrigée & Sécurisée
// ============================================

const NexaAI = {
  async generateResponse(userPrompt, contextData = null, systemContext = "") {
    try {
      const apiKey = NexaAI.getApiKey();
      if (!apiKey) {
        return "Erreur : Clé API manquante. Veuillez vérifier sa configuration dans votre code.";
      }

      const systemInstruction = `Tu es NEXA, un assistant virtuel personnel ultra-rapide, intelligent et d'une précision absolue. 
Règles absolues :
1. Ne donne jamais d'informations fausses ou incertaines. Fais des vérifications logiques strictes.
2. Sois direct, concis et structuré. Pas de bavardage.
3. Utilise un formatage propre en gras (**texte**) pour les points clés.
${systemContext}`;

      let fullPrompt = `${systemInstruction}\n\nRequête : ${userPrompt}`;
      if (contextData) {
        fullPrompt += `\n\nFichier attaché (${contextData.name}) :\n${contextData.content}`;
      }

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: fullPrompt }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1000
          }
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error?.message || "Erreur API Gemini");
      }

      const data = await response.json();
      const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

      return textResponse || "Réponse vide reçue de l'IA.";

    } catch (error) {
      console.error("Erreur NexaAI:", error);
      return `Erreur du service IA : ${error.message}`;
    }
  },

  getApiKey() {
    // Récupération de la clé depuis brain.js ou variable globale
    if (typeof NexaBrain !== "undefined" && NexaBrain.API_KEY) {
      return NexaBrain.API_KEY;
    }
    if (window.NEXA_API_KEY) {
      return window.NEXA_API_KEY;
    }
    return "";
  }
};
