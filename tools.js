// ============================================
// NEXA TOOLS - version 0.3
// Registre des outils disponibles pour le Brain
// ============================================

const NexaTools = {
  version: "0.3",

  // Exécute un outil par son nom
  async run(name, args = {}) {
    switch (name) {
      case "heure":
        return { ok: true, result: this.getTime() };
      case "date":
        return { ok: true, result: this.getDate() };
      case "calcul":
        return { ok: true, result: this.calculate(args.expression) };
      case "meteo":
        return await this.getWeather(args.city);
      default:
        return { ok: false, error: "Outil inconnu : " + name };
    }
  },

  // 1) L'heure actuelle
  getTime() {
    const now = new Date();
    return now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  },

  // 2) La date du jour
  getDate() {
    const now = new Date();
    return now.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  },

  // 3) Calculateur mathématique sécurisé
  calculate(expression) {
    if (!expression) return null;
    try {
      const cleanExp = expression.replace(/[^0-9+\-*/().,]/g, "").replace(",", ".");
      if (!cleanExp) return null;
      const result = Function('"use strict"; return (' + cleanExp + ')')();
      return isNaN(result) || !isFinite(result) ? null : result;
    } catch (e) {
      return null;
    }
  },

  // 4) Météo en temps réel (wttr.in)
  async getWeather(city) {
    if (!city) {
      return { ok: false, error: "Veuillez préciser une ville." };
    }

    try {
      const cleanCity = encodeURIComponent(city.trim());
      // Requête au service météo gratuit en français
      const response = await fetch(`https://wttr.in/${cleanCity}?format=j1&lang=fr`);

      if (!response.ok) {
        return { ok: false, error: `Impossible de trouver la météo pour « ${city} ».` };
      }

      const data = await response.json();
      const current = data.current_condition[0];
      const temp = current.temp_C;
      const desc = current.lang_fr ? current.lang_fr[0].value : current.weatherDesc[0].value;
      const feelsLike = current.FeelsLikeC;

      const result = `À ${city}, il fait actuellement ${temp}°C (${desc.toLowerCase()}), ressenti ${feelsLike}°C.`;
      return { ok: true, result: result };
    } catch (err) {
      console.error(err);
      return { ok: false, error: "Erreur lors de la récupération de la météo." };
    }
  }
};
