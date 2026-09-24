// ============================================
// NEXA TOOLS - version 0.5
// Registre des outils disponibles pour le Brain
// Nouveauté : recherche web instantanée
// ============================================

const NexaTools = {
  version: "0.5",

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
      case "recherche":
        return await this.webSearch(args.query);
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
      return {
        ok: true,
        result: `Météo à ${locationStr} : ${temp}°C (${desc.toLowerCase()}), ressenti ${feelsLike}°C. Vent : ${wind} km/h, humidité : ${humidity}%.`
      };
    } catch (err) {
      console.error(err);
      return { ok: false, error: "Erreur lors de la récupération de la météo." };
    }
  },

  // Outil de recherche Web
  async webSearch(query) {
    if (!query) {
      return { ok: false, error: "Veuillez préciser un sujet de recherche." };
    }

    try {
      const cleanQuery = encodeURIComponent(query.trim());
      const url = `https://fr.wikipedia.org/w/api.php?action=query&list=search&srsearch=${cleanQuery}&utf8=&format=json&origin=*`;
      const response = await fetch(url);

      if (!response.ok) {
        return { ok: false, error: "Erreur lors de la recherche en ligne." };
      }

      const data = await response.json();
      const results = data.query?.search;

      if (!results || results.length === 0) {
        return { ok: false, error: `Aucun résultat trouvé pour « ${query} ».` };
      }

      const summary = results.slice(0, 2).map(item => {
        const snippet = item.snippet.replace(/<[^>]*>/g, "");
        return `• ${item.title} : ${snippet}...`;
      }).join("\n");

      return { ok: true, result: summary };
    } catch (err) {
      console.error(err);
      return { ok: false, error: "Erreur réseau pendant la recherche." };
    }
  }
};
