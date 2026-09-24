// brain.js - Version 0.9

window.NEXABrain = {
  version: "v0.9",

  init() {
    const statusEl = document.getElementById("brain-status") || document.querySelector(".status-badge");
    if (statusEl) {
      statusEl.textContent = "BRAIN v0.9 • ONLINE";
    }
  },

  async process(input) {
    const text = input.trim();
    const lower = text.toLowerCase();

    // 1. Commandes système & Aide
    if (lower === "aide") {
      return `🤖 **Aide NEXA (v0.9)**\n\n` +
             `• **Météo** : "Météo à Paris, France"\n` +
             `• **Recherche** : "Wikipédia Eiffel"\n` +
             `• **Calcul** : "Combien font 12 * 4 ?"\n` +
             `• **Heure/Date** : "Quelle heure est-il ?"\n` +
             `• **Tâches** :\n` +
             `  - "Ajoute une tâche : [texte]"\n` +
             `  - "Ajoute [texte] à ma liste"\n` +
             `  - "Mes tâches"\n` +
             `  - "Termine la tâche [N]"\n` +
             `  - "Supprime la tâche [N]"\n` +
             `  - "Vide mes tâches"\n` +
             `• **Mémoire** : "Je m'appelle [Nom]", "J'habite à [Ville]", "Note : [Texte]"\n` +
             `• **Clé API** : "Change ma clé", "Supprime ma clé"\n` +
             `• **Nettoyage** : "Efface la conversation", "Oublie tout"`;
    }

    if (lower === "change ma clé") {
      localStorage.removeItem("openrouter_api_key");
      return "Clé API supprimée. Recharge la page pour en saisir une nouvelle.";
    }

    if (lower === "supprime ma clé") {
      localStorage.removeItem("openrouter_api_key");
      return "Clé API supprimée avec succès.";
    }

    if (lower === "efface la conversation") {
      if (window.NEXAMemory && typeof window.NEXAMemory.clearHistory === "function") {
        window.NEXAMemory.clearHistory();
      }
      return "Historique de la conversation effacé (tes tâches et données en mémoire sont conservées).";
    }

    if (lower === "oublie tout") {
      if (window.NEXAMemory && typeof window.NEXAMemory.clearAll === "function") {
        window.NEXAMemory.clearAll();
      }
      return "J'ai tout oublié : mémoire, historique et tâches ont été réinitialisés.";
    }

    // 2. Gestion des Tâches (Tools)
    if (lower.startsWith("ajoute une tâche :") || lower.startsWith("ajoute une tache :")) {
      const taskText = text.replace(/^ajoute une t[âa]che\s*:\s*/i, "").trim();
      if (!taskText) return "Précise la tâche à ajouter.";
      return window.NEXATools ? window.NEXATools.execute("tasks.add", { text: taskText }) : "Outil tâches indisponible.";
    }

    const addMatch = text.match(/^ajoute\s+(.+)\s+à\s+ma\s+liste$/i);
    if (addMatch) {
      const taskText = addMatch[1].trim();
      return window.NEXATools ? window.NEXATools.execute("tasks.add", { text: taskText }) : "Outil tâches indisponible.";
    }

    if (lower === "mes tâches" || lower === "mes taches" || lower === "liste mes tâches") {
      return window.NEXATools ? window.NEXATools.execute("tasks.list", {}) : "Outil tâches indisponible.";
    }

    const doneMatch = text.match(/^termine\s+la\s+t[âa]che\s+(\d+)$/i);
    if (doneMatch) {
      const index = parseInt(doneMatch[1], 10);
      return window.NEXATools ? window.NEXATools.execute("tasks.done", { index }) : "Outil tâches indisponible.";
    }

    const deleteMatch = text.match(/^supprime\s+la\s+t[âa]che\s+(\d+)$/i);
    if (deleteMatch) {
      const index = parseInt(deleteMatch[1], 10);
      return window.NEXATools ? window.NEXATools.execute("tasks.delete", { index }) : "Outil tâches indisponible.";
    }

    if (lower === "vide mes tâches" || lower === "vide mes taches") {
      return window.NEXATools ? window.NEXATools.execute("tasks.clear", {}) : "Outil tâches indisponible.";
    }

    // 3. Mémoire Personnelle (Prénom, Ville, Notes)
    const nameMatch = text.match(/^je\s+m'appelle\s+(.+)$/i);
    if (nameMatch) {
      const name = nameMatch[1].trim();
      if (window.NEXAMemory) window.NEXAMemory.set("firstname", name);
      return `C'est noté, enchanté ${name} !`;
    }

    const cityMatch = text.match(/^j'habite\s+à\s+(.+)$/i) \vert{}\vert{} text.match(/^j'habite\s+(.+)$/i);
    if (cityMatch) {
      const city = cityMatch[1].trim();
      if (window.NEXAMemory) window.NEXAMemory.set("city", city);
      return `C'est noté, tu habites à ${city}.`;
    }

    const noteMatch = text.match(/^note\s*:\s*(.+)$/i);
    if (noteMatch) {
      const noteContent = noteMatch[1].trim();
      if (window.NEXAMemory && typeof window.NEXAMemory.addNote === "function") {
        window.NEXAMemory.addNote(noteContent);
      }
      return `Note enregistrée : "${noteContent}".`;
    }

    // 4. Heure / Date
    if (lower.includes("heure") && (lower.includes("quelle") || lower.includes("est-il"))) {
      return window.NEXATools ? window.NEXATools.execute("time", {}) : new Date().toLocaleTimeString("fr-FR");
    }
    if (lower.includes("date") && (lower.includes("quelle") || lower.includes("aujourd'hui"))) {
      return window.NEXATools ? window.NEXATools.execute("date", {}) : new Date().toLocaleDateString("fr-FR");
    }

    // 5. Calculs
    if (lower.startsWith("combien font") || lower.startsWith("calcul :") || lower.startsWith("calcule :")) {
      const expr = text.replace(/^(combien font|calcul\s*:|calcule\s*:)\s*/i, "").trim();
      return window.NEXATools ? window.NEXATools.execute("calc", { expression: expr }) : "Outil calcul non disponible.";
    }

    // 6. Météo
    const weatherMatch = text.match(/^météo\s+à\s+(.+)$/i) \vert{}\vert{} text.match(/^meteo\s+a\s+(.+)$/i);
    if (weatherMatch) {
      const location = weatherMatch[1].trim();
      return window.NEXATools ? await window.NEXATools.execute("weather", { location }) : "Outil météo indisponible.";
    }

    // 7. Wikipédia
    const wikiMatch = text.match(/^wikipédia\s+(.+)$/i) \vert{}\vert{} text.match(/^wikipedia\s+(.+)$/i);
    if (wikiMatch) {
      const query = wikiMatch[1].trim();
      return window.NEXATools ? await window.NEXATools.execute("wikipedia", { query }) : "Outil Wikipédia indisponible.";
    }

    // 8. Modèle IA (Secours)
    if (window.NEXAAI && typeof window.NEXAAI.ask === "function") {
      return await window.NEXAAI.ask(text);
    }

    return "Désolé, je ne comprends pas cette demande.";
  }
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => window.NEXABrain.init());
} else {
  window.NEXABrain.init();
}
