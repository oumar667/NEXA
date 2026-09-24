// ============================================
// NEXA BRAIN - version 0.8
// L'orchestrateur central : analyse l'intention
// et déléguer aux Tools ou à l'IA.
// ============================================

const NexaBrain = {
  version: "0.8",

  async think(text, attachment) {
    const rawText = text || "";
    const query = rawText.toLowerCase().trim();
    const norm = typeof NexaTools !== "undefined" ? NexaTools.normalize(query) : query;

    // 1. Gestion des fichiers joints
    if (attachment) {
      return `J'ai bien reçu votre fichier « ${attachment.name} ». C'est enregistré dans le contexte !`;
    }

    // 2. Intention : Routine / Bonjour / Point du jour
    if (norm.includes("bonjour") || norm.includes("routine") || norm.includes("point du jour")) {
      const res = await NexaTools.run("routine", {});
      if (res.ok) return res.result;
    }

    // 3. Intention : Chronomètre
    if (norm.includes("chrono") || norm.includes("chronometre") || norm.includes("timer")) {
      const res = await NexaTools.run("chronometre", {});
      if (res.ok) return res.result;
    }

    // 4. Intention : Heure
    if (norm.includes("heure")) {
      const res = await NexaTools.run("heure", {});
      if (res.ok) return "Il est actuellement " + res.result + ".";
    }

    // 5. Intention : Date
    if (norm.includes("date") || norm.includes("jour")) {
      const res = await NexaTools.run("date", {});
      if (res.ok) return "Nous sommes le " + res.result + ".";
    }

    // 6. Intention : Météo
    if (norm.includes("meteo") || norm.includes("temps")) {
      let city = "Paris";
      const match = rawText.match(/(?:meteo|temps)\s+(?:a|à|sur|pour)?\s*(.+)/i);
      if (match) city = match[1].trim();
      const res = await NexaTools.run("meteo", { city: city });
      if (res.ok) return res.result;
    }

    // 7. Intention : Wikipédia
    if (norm.startsWith("wiki") || norm.startsWith("cherche") || norm.startsWith("qu est ce que")) {
      let q = rawText.replace(/^(wiki|cherche|qu'est-ce que|qu est ce que)\s*/i, "").trim();
      const res = await NexaTools.run("wikipedia", { query: q });
      if (res.ok) return res.result;
    }

    // 8. Intention : Calculs mathématiques
    if (/^[0-9+\-*/().\s×÷,]+$/.test(rawText) && /[+\-*/×÷]/.test(rawText)) {
      const res = await NexaTools.run("calcul", { expression: rawText });
      if (res.ok && res.result !== null) {
        return "Résultat : " + res.result;
      }
    }

    // 9. Relais vers l'IA Cloud (OpenRouter) si disponible
    if (typeof NexaAI !== "undefined" && NexaAI.ask) {
      try {
        return await NexaAI.ask(rawText);
      } catch (e) {
        return "J'ai tenté de contacter mon modèle d'IA, mais une erreur est survenue.";
      }
    }

    // 10. Fallback par défaut
    return "J'ai bien compris : « " + rawText + " ». Que souhaitez-vous faire avec cela ?";
  }
};
