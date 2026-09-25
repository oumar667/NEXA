// ============================================
// NEXA AI - Version OpenRouter (IA Open-Source)
// Optimisé pour la haute précision et vitesse
// ============================================

const NexaAI = {
  async generateResponse(userPrompt, contextData = null, systemContext = "") {
    try {
      const apiKey = NexaAI.getApiKey();
      if (!apiKey) {
        return "Erreur : Clé API OpenRouter manquante. Vérifiez la configuration.";
      }

      const systemInstruction = `Tu es NEXA, un assistant virtuel personnel ultra-rapide, intelligent et d'une précision absolue. 
Règles absolues :
1. Ne donne jamais d'informations fausses ou incertaines. Fais des vérifications logiques strictes.
2. Sois direct, concis et structuré. Pas de bavardage.
3. Utilise un formatage propre en gras (**texte**) pour les points clés.
${systemContext}`;

      let userContent = userPrompt;
      if (contextData) {
        userContent += `\n\nFichier attaché (${contextData.name}) :\n${contextData.content}`;
      }

      // Appel à l'API OpenRouter
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "HTTP-Referer": "https://oumar667.github.io/NEXA/", // Recommandé par OpenRouter
          "X-Title": "NEXA"
        },
        body: JSON.stringify({
          // Modèle open-source gratuit, rapide et très performant.
          // Tu peux le changer par "google/gemma-2-9b-it:free" ou autre modèle de ton choix.
          model: "meta-llama/llama-3.1-8b-instruct:free", 
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: userContent }
          ],
          temperature: 0.2, // Rigueur maximale
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error?.message || "Erreur de communication avec OpenRouter");
      }

      const data = await response.json();
      const textResponse = data.choices?.[0]?.message?.content;

      return textResponse || "Réponse vide reçue de l'IA.";

    } catch (error) {
      console.error("Erreur NexaAI:", error);
      return `Erreur du service IA : ${error.message}`;
    }
  },

  getApiKey() {
    // Récupération de ta clé API depuis brain.js
    if (typeof NexaBrain !== "undefined" && NexaBrain.API_KEY) {
      return NexaBrain.API_KEY;
    }
    if (window.NEXA_API_KEY) {
      return window.NEXA_API_KEY;
    }
    // Si tu préfères la coller directement ici, mets-la entre les guillemets ci-dessous :
    return ""; 
  }
};
