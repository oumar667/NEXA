// ============================================
// NEXA AI - version 0.1
// Le lien entre NEXA et le modèle IA.
// Service : OpenRouter (modèles gratuits uniquement)
// La clé reste sur ton iPhone, jamais dans le code.
// ============================================

const NexaAI = {
  version: "0.1",
  keyStorage: "nexa_openrouter_key",
  endpoint: "https://openrouter.ai/api/v1/chat/completions",

  // Modèle gratuit : OpenRouter choisit lui-même
  // un modèle gratuit disponible.
  model: "openrouter/free",

  // Lit la clé enregistrée sur cet appareil
  getKey() {
    try {
      return localStorage.getItem(this.keyStorage);
    } catch (e) {
      return null;
    }
  },

  // Enregistre la clé sur cet appareil
  setKey(key) {
    try {
      localStorage.setItem(this.keyStorage, key);
      return true;
    } catch (e) {
      return false;
    }
  },

  // Supprime la clé de cet appareil
  clearKey() {
    try {
      localStorage.removeItem(this.keyStorage);
    } catch (e) {
      // rien à faire
    }
  },

  // Vérifie qu'une clé existe, sinon la demande
  // dans une fenêtre de saisie.
  ensureKey() {
    const existing = this.getKey();
    if (existing) {
      return existing;
    }
    const entered = window.prompt(
      "Collez votre clé OpenRouter. Elle reste enregistrée uniquement sur cet appareil."
    );
    if (entered && entered.trim()) {
      const key = entered.trim();
      this.setKey(key);
      return key;
    }
    return null;
  },

  // Envoie une conversation au modèle et renvoie sa réponse.
  // "messages" est une liste, par exemple :
  // [{ role: "system", content: "..." }, { role: "user", content: "Bonjour" }]
  async ask(messages) {
    const key = this.ensureKey();
    if (!key) {
      return "Je n'ai pas de clé OpenRouter, donc je ne peux pas utiliser le modèle IA pour l'instant.";
    }

    // Sécurité : on abandonne si la réponse dépasse 40 secondes
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 40000);

    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + key
        },
        body: JSON.stringify({
          model: this.model,
          messages: messages
        }),
        signal: controller.signal
      });

      let data = null;
      try {
        data = await response.json();
      } catch (e) {
        // réponse illisible
      }

      if (!response.ok) {
        const detail =
          data && data.error && data.error.message
            ? " Détail : " + data.error.message
            : "";

        if (response.status === 401) {
          // Clé refusée : on l'oublie pour la redemander
          this.clearKey();
          return "OpenRouter a refusé la clé. Je l'ai effacée : envoyez un nouveau message et je vous la redemanderai." + detail;
        }
        if (response.status === 429) {
          return "Limite gratuite atteinte (trop de messages). Réessayez dans une minute, ou demain si la limite du jour est atteinte." + detail;
        }
        if (response.status === 402) {
          return "OpenRouter indique un problème de crédit pour ce modèle." + detail;
        }
        return "Erreur du service IA (code " + response.status + ")." + detail;
      }

      const content =
        data &&
        data.choices &&
        data.choices[0] &&
        data.choices[0].message &&
        data.choices[0].message.content;

      if (content && content.trim()) {
        return content.trim();
      }
      return "Le modèle n'a pas renvoyé de réponse. Réessayez.";

    } catch (e) {
      if (e.name === "AbortError") {
        return "Le modèle a mis trop de temps à répondre. Réessayez.";
      }
      return "Impossible de joindre le modèle IA. Vérifiez votre connexion.";
    } finally {
      clearTimeout(timer);
    }
  }
};
