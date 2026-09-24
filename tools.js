// ============================================
// NEXA TOOLS - version 0.4
// Registre des outils disponibles pour le Brain
// ============================================

const NexaTools = {
  version: "0.4",

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

  getTime() {
    const now = new Date();
    return now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  },

  getDate() {
    const now = new Date();
    return now.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  },

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

  async getWeather(city) {
    if (!city) {
      return { ok: false, error: "Veuillez préciser une ville." };
    }

    try {
      const cleanCity = encodeURIComponent(city.trim());
      const response = await fetch(`https://wttr.in/${cleanCity}?format=j1&lang=fr`);

      if (!response.ok) {
        return { ok: false, error: `Impossible de trouver la météo pour « ${city} ».` };
      }

      const data = await response.json();
      const current = data.current_condition[0];
      const area = data.nearest_area ? data.nearest_area[0] : null;

      const exactCity = area && area.areaName ? area.areaName[0].value : city;
      const country = area && area.country ? area.country[0].value : "";
      const temp = current.temp_C;
      const desc = current.lang_fr ? current.lang_fr[0].value : current.weatherDesc[0].value;
      const feelsLike = current.FeelsLikeC;
      const humidity = current.humidity;
      const wind = current.windspeedKmph;

      const locationStr = country ? `${exactCity} (${country})` : exactCity;
      const result = `Météo à ${locationStr} : ${temp}°C (${desc.toLowerCase()}), ressenti ${feelsLike}°C. Vent : ${wind} km/h, humidité : ${humidity}%.`;

      return { ok: true, result: result };
    } catch (err) {
      console.error(err);
      return { ok: false, error: "Erreur lors de la récupération de la météo." };
    }
  }
};
