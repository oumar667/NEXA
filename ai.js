// ============================================
// NEXA AI - Version OpenRouter (Llama 3.1)
// Prompt analytique strict & correction comportement
// ============================================

const NexaAI = {
  async generateResponse(userPrompt, contextData = null, systemContext = "") {
    try {
      const apiKey = NexaAI.getApiKey();
      if (!apiKey) {
        return "Erreur : Clé API OpenRouter manquante. Vérifiez la configuration.";
      }

      // Le Prompt Système est durci pour forcer la résolution de problèmes
      const systemInstruction = `Tu es NEXA, une IA analytique avancée.
Ton rôle est de RÉPONDRE aux questions, d'analyser et de RÉSOUDRE les problèmes (mathématiques, logiques, culturels) posés par l'utilisateur.

Règles absolues :
1. Ne demande JAMAIS "Que souhaitez-vous faire avec cela ?". Donne directement la solution ou l'explication.
2. Pour les problèmes de logique ou de maths, réfléchis étape par étape et donne la bonne réponse exacte.
3. Sois direct, concis et utilise le gras (**texte**) pour mettre en évidence la réponse finale.
${systemContext}`;

      let userContent = userPrompt;
      if (contextData) {
        userContent += `\n\nFichier attaché (${contextData.name}) :\n${contextData.content}`;
      }

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "HTTP-Referer": "https://oumar667.github.io/NEXA/",
          "X-Title": "NEXA"
        },
        body: JSON.stringify({
          model: "meta-llama/llama-3.1-8b-instruct:free", 
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: userContent }
          ],
          temperature: 0.1, // Baissée à 0.1 pour être encore plus robotique et mathématique
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
    if (typeof NexaBrain !== "undefined" && NexaBrain.API_KEY) {
      return NexaBrain.API_KEY;
    }
    if (window.NEXA_API_KEY) {
      return window.NEXA_API_KEY;
    }
    return ""; 
  }
};
