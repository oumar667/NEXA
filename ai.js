// ============================================
// NEXA AI - version 0.3
// Le lien entre NEXA et le modèle IA (Mistral 7B)
// ============================================

const NexaAI = {
  version: "0.3",
  keyStorage: "NEXA_API_KEY",
  endpoint: "https://openrouter.ai/api/v1/chat/completions",
  model: "mistralai/mistral-7b-instruct:free",

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

  async ask(userText) {
    const key = this.getKey();
    if (!key) return "🚨 ERREUR : Clé API manquante. Configure-la via le bouton ⋯ en haut à droite.";

    const messages = [
      {
        role: "system",
        content: "Tu es NEXA, un assistant IA intelligent, direct et utile."
      },
      {
        role: "user",
        content: userText
      }
    ];

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + key,
          "HTTP-Referer": "https://oumar667.github.io/NEXA/",
          "X-Title": "NEXA"
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
        const errDetail = data && data.error && data.error.message ? data.error.message : response.statusText;
        return `🚨 ERREUR RÉSEAU (${response.status}) : ${errDetail}`;
      }

      const content = data?.choices?.[0]?.message?.content;
      return (content && content.trim()) ? content.trim() : "L'IA n'a renvoyé aucune réponse.";

    } catch (e) {
      if (e.name === "AbortError") return "🚨 L'IA a mis trop de temps à répondre.";
      return `🚨 ERREUR SYSTÈME : ${e.message}`;
    } finally {
      clearTimeout(timer);
    }
  }
};
