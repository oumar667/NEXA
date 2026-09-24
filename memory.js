// ============================================
// NEXA MEMORY - version 0.1
// La mémoire de NEXA : elle retient des
// informations, même après fermeture de la page.
// Stockage : dans le navigateur (gratuit, privé).
// ============================================

const NexaMemory = {
  version: "0.1",
  storageKey: "nexa_memory",

  // Lit la mémoire enregistrée
  load() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      // En cas de problème, on repart d'une mémoire vide
    }
    return { facts: {}, history: [] };
  },

  // Enregistre la mémoire
  save(data) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  },

  // Retenir une information (ex : remember("prenom", "Oumar"))
  remember(key, value) {
    const data = this.load();
    data.facts[key] = value;
    return this.save(data);
  },

  // Retrouver une information (ex : recall("prenom"))
  recall(key) {
    const data = this.load();
    return data.facts[key] || null;
  },

  // Oublier une information
  forget(key) {
    const data = this.load();
    delete data.facts[key];
    return this.save(data);
  },

  // Ajouter un message à l'historique (garde les 50 derniers)
  addToHistory(role, text) {
    const data = this.load();
    data.history.push({
      role: role,
      text: text,
      time: new Date().toISOString()
    });
    if (data.history.length > 50) {
      data.history = data.history.slice(-50);
    }
    return this.save(data);
  },

  // Lire l'historique
  getHistory() {
    return this.load().history;
  },

  // Tout effacer
  clear() {
    return this.save({ facts: {}, history: [] });
  }
};
