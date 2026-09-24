// ============================================
// NEXA TOOLS - version 0.2
// Les capacités de NEXA.
// Nouveauté : un REGISTRE d'outils (chaque outil
// se déclare) et un premier outil externe : la météo.
// ============================================

const NexaTools = {
  version: "0.2",

  // --------------------------------------------
  // LE REGISTRE : la liste des outils disponibles
  // --------------------------------------------
  registry: {},

  // Déclare un outil : nom, description, fonction
  register(name, description, handler) {
    this.registry[name] = {
      name: name,
      description: description,
      handler: handler
    };
  },

  // Lance un outil par son nom.
  // Renvoie { ok: true, result: ... } ou { ok: false, error: ... }
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

  // Décrit les outils (utile plus tard pour le modèle IA)
  describe() {
    return Object.values(this.registry).map(function (t) {
      return { name: t.name, description: t.description };
    });
  },

  // Liste des noms d'outils
  list() {
    return Object.keys(this.registry);
  },

  // --------------------------------------------
  // OUTIL : l'heure
  // --------------------------------------------
  getTime() {
    const now = new Date();
    return now.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit"
    });
  },

  // --------------------------------------------
  // OUTIL : la date
  // --------------------------------------------
  getDate() {
    const now = new Date();
    return now.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  },

  // --------------------------------------------
  // OUTIL : les calculs (ex : "12 * 5 + 3")
  // Renvoie le résultat, ou null si invalide
  // --------------------------------------------
  calculate(expression) {
    // On accepte les symboles × et ÷, et la virgule française
    let expr = expression
      .replace(/×/g, "*")
      .replace(/÷/g, "/")
      .replace(/,/g, ".")
      .trim();

    // Sécurité : on n'autorise que des chiffres et des opérateurs
    if (!/^[0-9+\-*/().\s]+$/.test(expr)) {
      return null;
    }

    try {
      const result = Function('"use strict"; return (' + expr + ");")();
      if (typeof result === "number" && isFinite(result)) {
        // On arrondit pour éviter 0.1 + 0.2 = 0.30000000000000004
        return Math.round(result * 1000000) / 1000000;
      }
    } catch (e) {
      // Calcul invalide
    }
    return null;
  },

  // --------------------------------------------
  // OUTIL : la météo (Open-Meteo, gratuit, sans clé)
  // Renvoie une phrase prête à afficher
  // --------------------------------------------
  weatherCodes: {
    0: "ciel dégagé",
    1: "plutôt dégagé",
    2: "partiellement nuageux",
    3: "ciel couvert",
    45: "brouillard",
    48: "brouillard givrant",
    51: "bruine légère",
    53: "bruine",
    55: "bruine forte",
    56: "bruine verglaçante",
    57: "bruine verglaçante forte",
    61: "pluie faible",
    63: "pluie modérée",
    65: "pluie forte",
    66: "pluie verglaçante",
    67: "pluie verglaçante forte",
    71: "neige faible",
    73: "neige modérée",
    75: "neige forte",
    77: "grains de neige",
    80: "averses faibles",
    81: "averses",
    82: "averses violentes",
    85: "averses de neige",
    86: "fortes averses de neige",
    95: "orage",
    96: "orage avec grêle",
    99: "orage violent avec grêle"
  },

  async getWeather(city) {
    const name = (city || "").trim();
    if (!name) {
      return "Pour quelle ville voulez-vous la météo ?";
    }

    try {
      // 1) On trouve les coordonnées de la ville
      const geoUrl =
        "https://geocoding-api.open-meteo.com/v1/search?name=" +
        encodeURIComponent(name) +
        "&count=1&language=fr&format=json";

      const geoResponse = await fetch(geoUrl);
      if (!geoResponse.ok) {
        return "Je n'arrive pas à joindre le service météo pour le moment.";
      }
      const geo = await geoResponse.json();

      if (!geo.results || geo.results.length === 0) {
        return "Je n'ai pas trouvé la ville « " + name + " ».";
      }

      const place = geo.results[0];

      // 2) On demande la météo à ces coordonnées
      const weatherUrl =
        "https://api.open-meteo.com/v1/forecast" +
        "?latitude=" + place.latitude +
        "&longitude=" + place.longitude +
        "&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m" +
        "&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max" +
        "&timezone=auto&forecast_days=1";

      const weatherResponse = await fetch(weatherUrl);
      if (!weatherResponse.ok) {
        return "Je n'arrive pas à joindre le service météo pour le moment.";
      }
      const w = await weatherResponse.json();

      const current = w.current;
      const daily = w.daily;

      if (!current) {
        return "Le service météo n'a pas renvoyé de données.";
      }

      const place_name = place.name + (place.country ? " (" + place.country + ")" : "");
      const condition = this.weatherCodes[current.weather_code] || "conditions variables";

      let text =
        "Météo à " + place_name + " : " +
        Math.round(current.temperature_2m) + " °C" +
        " (ressenti " + Math.round(current.apparent_temperature) + " °C), " +
        condition + ". Vent : " + Math.round(current.wind_speed_10m) + " km/h.";

      if (daily && daily.temperature_2m_min && daily.temperature_2m_max) {
        text +=
          " Aujourd'hui : min " + Math.round(daily.temperature_2m_min[0]) +
          " °C, max " + Math.round(daily.temperature_2m_max[0]) + " °C";
        if (
          daily.precipitation_probability_max &&
          daily.precipitation_probability_max[0] !== null &&
          daily.precipitation_probability_max[0] !== undefined
        ) {
          text += ", risque de pluie " + daily.precipitation_probability_max[0] + " %";
        }
        text += ".";
      }

      return text;
    } catch (e) {
      return "Impossible de joindre le service météo. Vérifiez votre connexion.";
    }
  }
};

// --------------------------------------------
// On déclare les outils dans le registre
// --------------------------------------------
NexaTools.register("heure", "Donne l'heure actuelle.", function () {
  return NexaTools.getTime();
});

NexaTools.register("date", "Donne la date d'aujourd'hui.", function () {
  return NexaTools.getDate();
});

NexaTools.register("calcul", "Fait un calcul mathématique (argument : expression).", function (args) {
  return NexaTools.calculate(args.expression || "");
});

NexaTools.register("meteo", "Donne la météo d'une ville (argument : city).", function (args) {
  return NexaTools.getWeather(args.city || "");
});
