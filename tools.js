// ============================================
// NEXA TOOLS - version 0.8
// Les capacités de NEXA.
// Registre, météo, wiki, tâches, calendrier, chronomètre, routine.
// ============================================

const NexaTools = {
  version: "0.8",

  registry: {},

  register(name, description, handler) {
    this.registry[name] = {
      name: name,
      description: description,
      handler: handler
    };
  },

  async run(name, args) {
    const tool = this.registry[name];
    if (!tool) {
      return { ok: false, error: "Outil inconnu : " + name };
    }
    try {
      const result = await tool.handler(args || {});
      return { ok: true, result: result };
    } catch (e) {
      return { ok: false, error: "L'outil « " + name + " » a échoué." };
    }
  },

  describe() {
    return Object.values(this.registry).map(function (t) {
      return { name: t.name, description: t.description };
    });
  },

  list() {
    return Object.keys(this.registry);
  },

  getTime() {
    const now = new Date();
    return now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  },

  getDate() {
    const now = new Date();
    return now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  },

  calculate(expression) {
    let expr = expression.replace(/×/g, "*").replace(/÷/g, "/").replace(/,/g, ".").trim();
    if (!/^[0-9+\-*/().\s]+$/.test(expr)) return null;
    try {
      const result = Function('"use strict"; return (' + expr + ");")();
      if (typeof result === "number" && isFinite(result)) {
        return Math.round(result * 1000000) / 1000000;
      }
    } catch (e) {}
    return null;
  },

  weatherCodes: {
    0: "ciel dégagé", 1: "plutôt dégagé", 2: "partiellement nuageux", 3: "ciel couvert",
    45: "brouillard", 48: "brouillard givrant", 51: "bruine légère", 53: "bruine",
    61: "pluie faible", 63: "pluie modérée", 65: "pluie forte", 71: "neige faible",
    73: "neige modérée", 95: "orage"
  },

  normalize(str) {
    return (str || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[-'’]/g, " ").replace(/\s+/g, " ").trim();
  },

  splitPlace(input) {
    const text = (input || "").trim();
    if (text.includes(",")) {
      const parts = text.split(",");
      return { city: parts[0].trim(), hint: parts.slice(1).join(" ").trim() };
    }
    const match = text.match(/^(.+)\s+(?:en|au|aux|dans)\s+(?:(?:le|la|les)\s+|l')?(.+)$/i);
    if (match) return { city: match[1].trim(), hint: match[2].trim() };
    return { city: text, hint: "" };
  },

  placeMatchesHint(place, hint) {
    const h = this.normalize(hint);
    if (!h) return true;
    if (h.length === 2 && this.normalize(place.country_code) === h) return true;
    if (h.length < 3) return false;
    const fields = [place.country, place.admin1, place.admin2].filter(Boolean).map(this.normalize.bind(this));
    return fields.some(function (f) { return f === h || f.includes(h); });
  },

  async findPlaces(name, count) {
    const response = await fetch("https://geocoding-api.open-meteo.com/v1/search?name=" + encodeURIComponent(name) + "&count=" + count + "&language=fr&format=json");
    const data = await response.json();
    return data.results || [];
  },

  async getWeather(city) {
    const name = (city || "").trim() || "Paris"; // Ville par défaut si non précisée
    try {
      const parts = this.splitPlace(name);
      let place = null;
      if (parts.hint) {
        const results = await this.findPlaces(parts.city, 50);
        const self = this;
        place = results.find(function (r) { return self.placeMatchesHint(r, parts.hint); }) || null;
      }
      if (!place) {
        const results = await this.findPlaces(name, 10);
        place = results[0] || null;
      }
      if (!place) return "Je n'ai pas trouvé la ville « " + name + " ».";

      const weatherResponse = await fetch("https://api.open-meteo.com/v1/forecast?latitude=" + place.latitude + "&longitude=" + place.longitude + "&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=auto");
      const w = await weatherResponse.json();
      const current = w.current;
      
      const where = [place.admin1, place.country].filter(Boolean).join(", ");
      const condition = this.weatherCodes[current.weather_code] || "conditions variables";

      return "Météo à " + place.name + " (" + where + ") : " + Math.round(current.temperature_2m) + " °C, " + condition + ".";
    } catch (e) {
      return "Impossible de joindre le service météo.";
    }
  },

  async searchWikipedia(query) {
    const q = (query || "").trim();
    if (!q) return "Que chercher sur Wikipédia ?";
    try {
      const searchResponse = await fetch("https://fr.wikipedia.org/w/api.php?action=query&list=search&srlimit=1&format=json&formatversion=2&utf8=1&origin=*&srsearch=" + encodeURIComponent(q));
      const searchData = await searchResponse.json();
      const hits = searchData.query && searchData.query.search;
      if (!hits || hits.length === 0) return "Rien trouvé sur Wikipédia pour « " + q + " ».";

      const title = hits[0].title;
      const summaryResponse = await fetch("https://fr.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&exsentences=3&redirects=1&format=json&formatversion=2&origin=*&titles=" + encodeURIComponent(title));
      const summaryData = await summaryResponse.json();
      const page = summaryData.query.pages[0];
      let extract = page.extract ? page.extract.trim() : "";
      const link = "https://fr.wikipedia.org/wiki/" + encodeURIComponent(title.replace(/ /g, "_"));

      if (extract.length > 700) extract = extract.slice(0, 700).trim() + "…";
      return "Wikipédia — " + title + " :\n" + extract + "\n\nSource : <a href=\"" + link + "\" target=\"_blank\">Lien</a>";
    } catch (e) {
      return "Impossible de joindre Wikipédia.";
    }
  },

  tasksKey: "tasks",
  loadTasks() {
    if (typeof NexaMemory === "undefined") return null;
    const list = NexaMemory.recall(this.tasksKey);
    return Array.isArray(list) ? list : [];
  },
  saveTasks(list) {
    if (typeof NexaMemory === "undefined") return false;
    return NexaMemory.remember(this.tasksKey, list);
  },
  formatTasks(list) {
    return list.map(function (t, i) { return (i + 1) + ". " + (t.done ? "✅" : "☐") + " " + t.text; }).join("\n");
  },
  manageTasks(action, text, number) {
    const list = this.loadTasks();
    if (list === null) return "Ma mémoire n'est pas connectée.";
    
    if (action === "add") {
      let t = (text || "").trim().slice(0, 200);
      if (!t) return "Quelle tâche ?";
      list.push({ text: t, done: false });
      this.saveTasks(list);
      return "C'est ajouté : « " + t + " ».";
    }
    if (action === "list") {
      if (list.length === 0) return "Votre liste est vide.";
      return "Vos tâches :\n" + this.formatTasks(list);
    }
    if (action === "clear") {
      this.saveTasks([]);
      return "Liste vidée.";
    }
    if (action === "done" || action === "delete") {
      const n = Number(number);
      if (!Number.isInteger(n) || n < 1 || n > list.length) return "Tâche introuvable.";
      const task = list[n - 1];
      if (action === "done") {
        task.done = true;
        this.saveTasks(list);
        return "Tâche " + n + " terminée : « " + task.text + " ».";
      }
      list.splice(n - 1, 1);
      this.saveTasks(list);
      return "Supprimé : « " + task.text + " ».";
    }
    return "Action inconnue.";
  },

  createCalendarEvent(title, dateStr, timeStr, desc) {
    try {
      const d = new Date(dateStr + "T" + (timeStr || "12:00"));
      const dtstart = d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
      
      d.setHours(d.getHours() + 1);
      const dtend = d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

      const ics = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//NEXA//FR\nBEGIN:VEVENT\n" +
        "SUMMARY:" + (title || "Événement NEXA") + "\n" +
        "DESCRIPTION:" + (desc || "") + "\n" +
        "DTSTART:" + dtstart + "\nDTEND:" + dtend + "\n" +
        "END:VEVENT\nEND:VCALENDAR";

      const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
      const url = URL.createObjectURL(blob);

      return `<a href="${url}" download="${encodeURIComponent(title || 'rendez-vous')}.ics" style="display:inline-block; margin-top:8px; padding:10px 14px; background:#292e39; color:#4ade80; border-radius:10px; text-decoration:none; font-weight:500;">📅 Ajouter « ${title} » au calendrier</a>`;
    } catch(e) {
      return "Erreur lors de la création de l'événement.";
    }
  },

  // --------------------------------------------
  // NOUVEAU OUTIL : Chronomètre interactif
  // --------------------------------------------
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
      <script>
        if (!window.chronoTimers) window.chronoTimers = {};
        function startChrono(id) {
          if (window.chronoTimers[id]) return;
          let [h, m, s] = document.getElementById(id).textContent.split(':').map(Number);
          let totalSeconds = h * 3600 + m * 60 + s;
          window.chronoTimers[id] = setInterval(() => {
            totalSeconds++;
            let hh = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
            let mm = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
            let ss = String(totalSeconds % 60).padStart(2, '0');
            const el = document.getElementById(id);
            if(el) el.textContent = \`\${hh}:\${mm}:\${ss}\`;
          }, 1000);
        }
        function stopChrono(id) {
          clearInterval(window.chronoTimers[id]);
          window.chronoTimers[id] = null;
        }
        function resetChrono(id) {
          stopChrono(id);
          const el = document.getElementById(id);
          if(el) el.textContent = "00:00:00";
        }
      </script>
    `;
  },

  // --------------------------------------------
  // NOUVEAU OUTIL : Routine quotidienne ("Bonjour")
  // --------------------------------------------
  async getDailyRoutine() {
    const dateText = this.getDate();
    const timeText = this.getTime();
    const weatherText = await this.getWeather("Paris"); // Ou ville par défaut
    const tasks = this.loadTasks();
    const taskCount = tasks ? tasks.filter(t => !t.done).length : 0;
    
    let routineSummary = `✨ **Bonjour ! Voici ton point du jour :**\n\n`;
    routineSummary += `📅 Nous sommes le **${dateText}** (${timeText}).\n`;
    routineSummary += `🌤️ ${weatherText}\n`;
    routineSummary += `📝 Tu as **${taskCount} tâche(s)** en attente dans ta liste.\n`;
    if (taskCount > 0) {
      routineSummary += `\n*Aperçu :*\n` + this.formatTasks(tasks.slice(0, 3));
    }
    routineSummary += `\n\nComment puis-je t'aider à démarrer cette journée ?`;
    return routineSummary;
  },

  processLocalFile(file) {
    return new Promise(function(resolve) {
      if (!file) return resolve({ error: "Aucun fichier" });
      const reader = new FileReader();

      if (file.type.startsWith("image/")) {
        reader.onload = function(e) { resolve({ name: file.name, type: "image", data: e.target.result }); };
        reader.onerror = function() { resolve({ error: "Impossible de lire l'image" }); };
        reader.readAsDataURL(file);
      } else {
        reader.onload = function(e) { resolve({ name: file.name, type: "text", data: e.target.result }); };
        reader.onerror = function() { resolve({ error: "Impossible de lire le fichier" }); };
        reader.readAsText(file);
      }
    });
  }
};

// --------------------------------------------
// Déclarations dans le registre
// --------------------------------------------
NexaTools.register("heure", "Donne l'heure.", () => NexaTools.getTime());
NexaTools.register("date", "Donne la date.", () => NexaTools.getDate());
NexaTools.register("calcul", "Calcule (args: expression).", (args) => NexaTools.calculate(args.expression));
NexaTools.register("meteo", "Météo (args: city).", (args) => NexaTools.getWeather(args.city));
NexaTools.register("wikipedia", "Wiki (args: query).", (args) => NexaTools.searchWikipedia(args.query));
NexaTools.register("taches", "Tâches (args: action, text, number).", (args) => NexaTools.manageTasks(args.action, args.text, args.number));
NexaTools.register("calendrier", "Crée un événement (args: title, date (YYYY-MM-DD), time (HH:MM), desc).", (args) => NexaTools.createCalendarEvent(args.title, args.date, args.time, args.desc));
NexaTools.register("chronometre", "Lance un chronomètre interactif.", () => NexaTools.createChronometer());
NexaTools.register("routine", "Affiche le point du jour (météo, date, tâches).", async () => await NexaTools.getDailyRoutine());
