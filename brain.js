// ============================================
// NEXA BRAIN - version 0.3
// Le cerveau de NEXA : il reçoit un message,
// utilise la Memory et les Tools, et décide
// quoi répondre.
// ============================================

const NexaBrain = {
  version: "0.3",

  // Fonction principale : reçoit le texte de l'utilisateur
  // et renvoie la réponse de NEXA.
  async think(message) {
    const text = message.trim();
    const reply = this.decide(text);

    // On garde une trace de la conversation dans la Memory
    if (typeof NexaMemory !== "undefined") {
      NexaMemory.addToHistory("user", text);
      NexaMemory.addToHistory("nexa", reply);
    }

    return reply;
  },

  // Décide de la réponse selon le message
  decide(text) {
    // On remplace les apostrophes de l'iPhone (’) par des normales (')
    const clean = text.replace(/[’‘`]/g, "'");
    const lower = clean.toLowerCase();
    const hasMemory = typeof NexaMemory !== "undefined";
    const hasTools = typeof NexaTools !== "undefined";

    // --- Retrouver le prénom ---
    if (
      lower.includes("comment je m'appelle") ||
      lower.includes("quel est mon prénom") ||
      lower.includes("quel est mon prenom")
    ) {
      if (!hasMemory) {
        return "Ma mémoire n'est pas encore connectée.";
      }
      const name = NexaMemory.recall("prenom");
      if (name) {
        return "Vous vous appelez " + name + ".";
      }
      return "Je ne connais pas encore votre prénom. Dites-moi : « Je m'appelle ... ».";
    }

    // --- Oublier ---
    if (lower.includes("oublie tout")) {
      if (!hasMemory) {
        return "Ma mémoire n'est pas encore connectée.";
      }
      NexaMemory.clear();
      return "C'est fait. J'ai tout oublié.";
    }

    if (lower.includes("oublie mon prénom") || lower.includes("oublie mon prenom")) {
      if (!hasMemory) {
        return "Ma mémoire n'est pas encore connectée.";
      }
      NexaMemory.forget("prenom");
      return "C'est fait. J'ai oublié votre prénom.";
    }

    // --- Retenir le prénom ---
    const nameMatch = clean.match(
      /(?:je m'appelle|moi c'est|mon prénom est|mon prenom est)\s+([^\s.,!?]+)/i
    );
    if (nameMatch) {
      if (!hasMemory) {
        return "Ma mémoire n'est pas encore connectée.";
      }
      const raw = nameMatch[1];
      const name = raw.charAt(0).toUpperCase() + raw.slice(1);
      NexaMemory.remember("prenom", name);
      return "Enchanté " + name + ". Je m'en souviendrai.";
    }

    // --- Tool : l'heure ---
    if (lower.includes("quelle heure") || lower.includes("l'heure")) {
      if (!hasTools) {
        return "Mes outils ne sont pas encore connectés.";
      }
      return "Il est " + NexaTools.getTime() + ".";
    }

    // --- Tool : la date ---
    if (
      lower.includes("quelle date") ||
      lower.includes("quel jour") ||
      lower.includes("date d'aujourd")
    ) {
      if (!hasTools) {
        return "Mes outils ne sont pas encore connectés.";
      }
      return "Nous sommes le " + NexaTools.getDate() + ".";
    }

    // --- Tool : les calculs ---
    const calcMatch = clean.match(
      /(?:calcule|calcul|combien font|combien fait|combien vaut)\s*:?\s*(.+)/i
    );
    const looksLikeMath =
      /^[0-9+\-*/().,\s×÷x]+$/i.test(clean) &&
      /[0-9]/.test(clean) &&
      /[+\-*/×÷x]/i.test(clean);

    if (calcMatch || looksLikeMath) {
      if (!hasTools) {
        return "Mes outils ne sont pas encore connectés.";
      }
      const expression = (calcMatch ? calcMatch[1] : clean)
        .replace(/\?/g, "")
        .replace(/(\d)\s*x\s*(\d)/gi, "$1*$2")
        .trim();

      const result = NexaTools.calculate(expression);

      if (result !== null) {
        // On affiche la virgule à la française (3,5 au lieu de 3.5)
        return "Le résultat est " + String(result).replace(".", ",") + ".";
      }
      if (calcMatch) {
        return "Je n'ai pas réussi à faire ce calcul. Essayez par exemple : « calcule 12 * 5 + 3 ».";
      }
    }

    // --- Salutations ---
    if (
      lower.startsWith("bonjour") ||
      lower.startsWith("salut") ||
      lower.startsWith("coucou") ||
      lower.startsWith("hello")
    ) {
      const known = hasMemory ? NexaMemory.recall("prenom") : null;
      if (known) {
        return "Bonjour " + known + ". Ravi de vous retrouver.";
      }
      return "Bonjour. Je suis NEXA. Mon cerveau est en construction, mais je vous écoute.";
    }

    // --- Identité ---
    if (lower.includes("qui es-tu") || lower.includes("qui es tu")) {
      return "Je suis NEXA, votre système intelligent personnel. Je suis construit étape par étape.";
    }

    // --- Réponse par défaut ---
    return (
      "Mon Brain a bien reçu : « " + text + " ». " +
      "Je n'ai pas encore de modèle IA connecté."
    );
  }
};
