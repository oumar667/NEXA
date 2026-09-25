// ============================================
// NEXA AI - Version Haute Précision & Vitesse
// Gestion des appels API et rigueur analytique
// ============================================

const NexaAI = {
  // Remplace par ta clé API Gemini si ce n'est pas déjà fait dans ton environnement
  apiKey: "", // Si tu utilises une clé en dur ou gérée par ton Brain, laisse l'appel dynamique

  async generateResponse(userPrompt, contextData = null, systemContext = "") {
    try {
      // Prompt système strict axé sur la rigueur, la concision et la vérité
      const systemInstruction = `Tu es NEXA, un assistant virtuel personnel ultra-rapide, intelligent et d'une précision absolue. 
Règles absolues :
1. Ne donne jamais d'informations fausses ou incertaines. Si tu n'es pas sûr à 100%, signale-le ou fais une double vérification logique.
2. Sois direct, concis, structuré et performant. Pas de bavardage inutile.
3. Utilise un formatage propre en gras (**texte**) pour les points clés.
${systemContext}`;

      let fullPrompt = `${systemInstruction}\n\nRequête de l'utilisateur : ${userPrompt}`;
      if (contextData) {
        fullPrompt += `\n\nDonnées contextuelles / Fichier attaché (${contextData.name}) :\n${contextData.content}`;
      }

      // Appel optimisé pour la vitesse avec une température basse (0.2) pour maximiser la précision
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.getApiKey()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: {
            temperature: 0.2, // Température basse = réponses factuelles, rigoureuses et sans invention
            maxOutputTokens: 1000,
          }
        })
      });

      if (!response.ok) throw new Error("Erreur de communication avec le réseau neuronal de NEXA.");

      const data = await response.json();
      const candidate = data.candidates?.[0];

      if (candidate && candidate.content?.parts?.[0]?.text) {
        return candidate.content.parts[0].text;
      } else {
        return "Je n'ai pas pu générer de réponse claire. Veuillez reformuler.";
      }

    } catch (error) {
      console.error("Erreur NexaAI:", error);
      return "Erreur de traitement. Vérifiez votre connexion.";
    }
  },

  getApiKey() {
    // Récupération sécurisée de la clé (depuis brain.js ou localStorage si configuré)
    if (typeof NexaBrain !== "undefined" && NexaBrain.API_KEY) {
      return NexaBrain.API_KEY;
    }
    // Clé de secours si définie globalement
    return window.NEXA_API_KEY || "";
  }
};
