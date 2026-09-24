// ============================================
// NEXA TOOLS - version 0.1
// Les capacités de NEXA : de petites fonctions
// que le Brain peut utiliser.
// ============================================

const NexaTools = {
  version: "0.1",

  // Donne l'heure actuelle
  getTime() {
    const now = new Date();
    return now.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit"
    });
  },

  // Donne la date d'aujourd'hui
  getDate() {
    const now = new Date();
    return now.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  },

  // Fait un calcul (ex : "12 * 5 + 3")
  // Renvoie le résultat, ou null si le calcul est invalide
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

  // Liste des tools disponibles
  list() {
    return ["getTime", "getDate", "calculate"];
  }
};
