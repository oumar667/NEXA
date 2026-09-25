// ============================================
// NEXA AI - version 0.2
// Le lien entre NEXA et le modèle IA.
// Prise en charge des requêtes Vision (images)
// ============================================

const NexaAI = {
  version: "0.2",
  keyStorage: "nexa_openrouter_key",
  endpoint: "https://openrouter.ai/api/v1/chat/completions",

  // Modèle gratuit : OpenRouter choisit lui-même
  model: "openrouter/free",

  getKey() {
    try { return localStorage.getItem(this.keyStorage); }
    catch (e) { return null; }
  },

  setKey(key) {
    try {
      localStorage.setItem(this.keyStorage, key);
      return true;
    } catch (e) { return false; }
  },

  clearKey() {
    try { localStorage.removeItem(this.keyStorage); }
    catch (e) {}
  },

  ensureKey() {
    const existing = this.getKey();
    if (existing) return existing;
    
    const entered = window.prompt("Collez votre clé OpenRouter. Elle reste enregistrée uniquement sur cet appareil.");
    if (entered && entered.trim()) {
      const key = entered.trim();
      this.setKey(key);
      return key;
    }
    return null;
  },

  async ask(messages) {
    const key = this.ensureKey();
    if (!key) return "Je n'ai pas de clé OpenRouter, donc je ne peux pas utiliser l'IA pour l'instant.";

    // Sécurité : On passe à 60 secondes car l'analyse d'une image prend plus de temps
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);

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
      try { data = await response.json(); } catch (e) {}

      if (!response.ok) {
        const detail = data && data.error && data.error.message ? " Détail : " + data.error.message : "";
        
        if (response.status === 401) {
          this.clearKey();
          return "OpenRouter a refusé la clé. Je l'ai effacée : envoyez un nouveau message pour la redemander." + detail;
        }
        if (response.status === 429) {
          return "Limite gratuite atteinte. Réessayez dans une minute." + detail;
        }
        return "Erreur du service IA (code " + response.status + ")." + detail;
      }

      const content = data?.choices?.[0]?.message?.content;
      return (content && content.trim()) ? content.trim() : "Le modèle n'a pas renvoyé de réponse.";

    } catch (e) {
      if (e.name === "AbortError") return "L'IA a mis trop de temps à analyser la demande. Réessayez.";
      return "Impossible de joindre le modèle IA. Vérifiez votre connexion.";
    } finally {
      clearTimeout(timer);
    }
  }
};
