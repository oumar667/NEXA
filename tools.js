// ============================================
// NEXA TOOLS - version 0.8
// Module central d'exécution des outils locaux
// ============================================

const NexaTools = {
  version: "0.8",

  normalize(text) {
    if (!text) return "";
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  },

  async run(toolName, params) {
    try {
      switch (toolName) {
        case "heure":
          return { ok: true, result: this.getTime() };
        case "date":
          return { ok: true, result: this.getDate() };
        case "meteo":
          return { ok: true, result: await this.getWeather(params.city) };
        case "wikipedia":
          return { ok: true, result: await this.searchWiki(params.query) };
        case "calcul":
          return { ok: true, result: this.calculate(params.expression) };
        case "routine":
          return { ok: true, result: await this.getMorningRoutine() };
        case "chronometre":
          return { ok: true, result: this.createChronometer() };
        default:
          return { ok: false, error: "Outil inconnu : " + toolName };
      }
    } catch (e) {
      return { ok: false, error: e.message };
    }
  },

  getTime() {
    const now = new Date();
    return now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  },

  getDate() {
    const now = new Date();
    return now.toLocaleDateString("fr-FR", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  },

  async getWeather(city = "Paris") {
    try {
      const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=%C+%t&lang=fr`);
      if (!res.ok) throw new Error("Météo injoignable");
      const text = await res.text();
      return `Météo à ${city} : ${text.trim()}.`;
    } catch (e) {
      return `Impossible de récupérer la météo pour ${city}.`;
    }
  },

  async searchWiki(query) {
    if (!query) return "Que souhaitez-vous chercher sur Wikipédia ?";
    try {
      const url = `https://fr.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.query && data.query.search.length > 0) {
        const firstResult = data.query.search[0];
        const snippet = firstResult.snippet.replace(/<\/?[^>]+(>|$)/g, "");
        return `**${firstResult.title}**\n${snippet}...\n_(Source Wikipédia)_`;
      }
      return "Aucun résultat trouvé sur Wikipédia pour : " + query;
    } catch (e) {
      return "Erreur lors de la recherche Wikipédia.";
    }
  },

  calculate(expression) {
    try {
      const sanitized = expression.replace(/×/g, "*").replace(/÷/g, "/").replace(/[^0-9+\-*/().\s]/g, "");
      if (!sanitized.trim()) return null;
      const result = Function('"use strict";return (' + sanitized + ')')();
      return result;
    } catch (e) {
      return "Expression invalide";
    }
  },

  async getMorningRoutine() {
    const dateStr = this.getDate();
    const timeStr = this.getTime();
    const weather = await this.getWeather("Paris");
    let taskCount = 0;
    if (typeof NexaMemory !== "undefined" && NexaMemory.getTasks) {
      const tasks = NexaMemory.getTasks();
      taskCount = tasks.filter(t => !t.done).length;
    }
    return `✨ **Bonjour ! Voici ton point du jour :**\n\n📅 Nous sommes le **${dateStr}** (${timeStr}).\n☀️ ${weather}\n📝 Tu as **${taskCount} tâche(s)** en attente dans ta liste.\n\nComment puis-je t'aider à démarrer cette journée ?`;
  },

  createChronometer() {
    const id = "chrono_" + Date.now();
    return `
      <div style="background:rgba(255,255,255,0.05); padding:12px 16px; border-radius:14px; border:1px solid rgba(255,255,255,0.1); margin-top:8px; display:inline-block; text-align:center;">
        ⏱️ <b>Chronomètre NEXA</b><br>
        <span id="${id}" style="font-size:1.4rem; font-weight:bold; font-family:monospace; color:#a78bfa;">00:00:00</span><br>
        <div style="margin-top:8px; display:flex; gap:6px; justify-content:center;">
          <button onclick="startChrono('${id}')" style="padding:4px 10px; background:#4ade80; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">Start</button>
          <button onclick="stopChrono('${id}')" style="padding:4px 10px; background:#f87171; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">Stop</button>
          <button onclick="resetChrono('${id}')" style="padding:4px 10px; background:#9ca3af; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">Reset</button>
        </div>
      </div>
    `;
  },

  async processLocalFile(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      const ext = file.name.split('.').pop().toLowerCase();

      if (['txt', 'json', 'js', 'html', 'css'].includes(ext)) {
        reader.onload = (e) => resolve({ name: file.name, type: 'text', content: e.target.result });
        reader.readAsText(file);
      } else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
        reader.onload = (e) => resolve({ name: file.name, type: 'image', content: e.target.result });
        reader.readAsDataURL(file);
      } else {
        resolve({ error: "Format de fichier non pris en charge." });
      }
    });
  }
};
