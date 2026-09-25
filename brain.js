// ============================================
// NEXA BRAIN - Orchestrateur central
// ============================================

const NexaBrain = {
  version: "0.9",

  async think(text, attachment) {
    const rawText = text || "";
    const query = rawText.toLowerCase().trim();
    const norm = typeof NexaTools !== "undefined" ? NexaTools.normalize(query) : query;

    // 1. Fichiers joints
    if (attachment) {
      return `J'ai bien reçu votre fichier « ${attachment.name} ». C'est enregistré dans le contexte !`;
    }

    // 2. Routine
    if (norm.includes("bonjour") || norm.includes("routine") || norm.includes("point du jour")) {
      const res = await NexaTools.run("routine", {});
      if (res.ok) return res.result;
    }

    // 3. Chronomètre
    if (norm.includes("chrono") || norm.includes("chronometre") || norm.includes("timer")) {
      const res = await NexaTools.run("chronometre", {});
      if (res.ok) return res.result;
    }

    // 4. Heure
    if (norm.includes("heure")) {
      const res = await NexaTools.run("heure", {});
      if (res.ok) return "Il est actuellement " + res.result + ".";
    }

    // 5. Date
    if (norm.includes("date") || norm.includes("jour")) {
      const res = await NexaTools.run("date", {});
      if (res.ok) return "Nous sommes le " + res.result + ".";
    }

    // 6. Météo
    if (norm.includes("meteo") || norm.includes("temps")) {
      let city = "Paris";
      const match = rawText.match(/(?:meteo|temps)\s+(?:a|à|sur|pour)?\s*(.+)/i);
      if (match) city = match[1].trim();
      const res = await NexaTools.run("meteo", { city: city });
      if (res.ok) return res.result;
    }

    // 7. Wikipédia
    if (norm.startsWith("wiki") || norm.startsWith("cherche") || norm.startsWith("qu est ce que")) {
      let q = rawText.replace(/^(wiki|cherche|qu'est-ce que|qu est ce que)\s*/i, "").trim();
      const res = await NexaTools.run("wikipedia", { query: q });
      if (res.ok) return res.result;
    }

    // 8. Calculs
    if (/^[0-9+\-*/().\s×÷,]+$/.test(rawText) && /[+\-*/×÷]/.test(rawText)) {
      const res = await NexaTools.run("calcul", { expression: rawText });
      if (res.ok && res.result !== null) {
        return "Résultat : " + res.result;
      }
    }

    // 9. Relais vers l'IA (OpenRouter / Mistral)
    if (typeof NexaAI !== "undefined" && NexaAI.generateResponse) {
      return await NexaAI.generateResponse(rawText, attachment);
    }

    return "J'ai bien compris : « " + rawText + " ». Que souhaitez-vous faire avec cela ?";
  }
};
