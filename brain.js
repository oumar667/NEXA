// ============================================
// NEXA BRAIN - version 0.5
// Le cerveau de NEXA : il reçoit un message,
// utilise la Memory, les Tools et le modèle IA,
// et décide quoi répondre.
// Nouveauté : notes libres ("Retiens que ...").
// ============================================

const NexaBrain = {
  version: "0.5",

  // Fonction principale : reçoit le texte de l'utilisateur
  // et renvoie la réponse de NEXA.
  async think(message) {
    const text = message.trim();

    // 1) Les règles du Brain (prénom, notes, heure, calcul...)
    let reply = this.decide(text);

    // 2) Si aucune règle ne correspond, on demande au modèle IA
    if (reply === null) {
      reply = await this.askAI(text);
    }

    // On garde une trace de la conversation dans la Memory
    if (typeof NexaMemory !== "undefined") {
      NexaMemory.addToHistory("user", text);
      NexaMemory.addToHistory("nexa", reply);
    }

    return reply;
  },

  // Renvoie la liste des notes enregistrées
  getNotes() {
    if (typeof NexaMemory === "undefined") return [];
    const facts = NexaMemory.load().facts;
    const notes = [];
    for (const key of Object.keys(facts)) {
      if (key.startsWith("note_")) {
        notes.push({ key: key, text: facts[key] });
      }
    }
    return notes;
  },

  // Envoie la question au modèle IA, avec du contexte
  async askAI(text) {
    if (typeof NexaAI === "undefined") {
      return (
        "Mon Brain a bien reçu : « " + text + " ». " +
        "Le module IA n'est pas encore connecté."
      );
    }

    const hasMemory = typeof NexaMemory !== "undefined";

    // Les consignes données au modèle
    let system =
      "Tu es NEXA, l'assistant personnel de l'utilisateur. " +
      "Tu réponds toujours en français, de façon claire, simple et courte, " +
      "car l'écran est celui d'un iPhone. " +
      "Si tu ne sais pas, tu le dis honnêtement. " +
      "Tu n'as pas accès à Internet et tu ne connais pas l'heure exacte.";

    const name = hasMemory ? NexaMemory.recall("prenom") : null;
    if (name) {
      system += " L'utilisateur s'appelle " + name + ".";
    }

    // Les notes que l'utilisateur t'a demandé de retenir
    const notes = this.getNotes();
    if (notes.length > 0) {
      system += " Voici ce que l'utilisateur t'a demandé de retenir :";
      for (const n of notes) {
        system += " - " + n.text + ".";
      }
      system += " Utilise ces informations quand c'est pertinent.";
    }

    const messages = [{ role: "system", content: system }];

    // Les derniers messages, pour que NEXA suive la conversation
    if (hasMemory) {
      const recent = NexaMemory.getHistory()
        .filter(function (m) {
          return !(m.role === "nexa" && m.text.startsWith("Mon Brain a bien reçu"));
        })
        .slice(-6);

      for (const m of recent) {
        messages.push({
          role: m.role === "nexa" ? "assistant" : "user",
          content: m.text
        });
      }
    }

    messages.push({ role: "user", content: text });

    return await NexaAI.ask(messages);
  },

  // Décide de la réponse selon le message.
  // Renvoie null si aucune règle ne correspond.
  decide(text) {
    // On remplace les apostrophes de l'iPhone (’) par des normales (')
    const clean = text.replace(/[’‘`]/g, "'");
    const lower = clean.toLowerCase();
    const hasMemory = typeof NexaMemory !== "undefined";
    const hasTools = typeof NexaTools !== "undefined";

    // --- Retenir une note libre ---
    const noteMatch = clean.match(
      /(?:retiens|retenir|souviens-toi|souviens toi|n'oublie pas)\s+(?:que|qu')\s*(.+)/i
    );
    if (noteMatch) {
      if (!hasMemory) {
        return "Ma mémoire n'est pas encore connectée.";
      }
      const note = noteMatch[1].trim().slice(0, 300);
      if (!note) {
        return "Que dois-je retenir ? Dites par exemple : « Retiens que j'aime le café ».";
      }
      NexaMemory.remember("note_" + Date.now(), note);
      return "C'est noté : « " + note + " ». Je m'en souviendrai.";
    }

    // --- Afficher ce que NEXA retient ---
    if (
      lower.includes("que retiens-tu") ||
      lower.includes("que retiens tu") ||
      lower.includes("qu'est-ce que tu retiens") ||
      lower.includes("que sais-tu sur moi") ||
      lower.includes("que sais tu sur moi") ||
      lower.includes("que sais-tu de moi") ||
      lower.includes("que sais tu de moi") ||
      lower.includes("mes notes")
    ) {
      // "oublie mes notes" est traité plus bas
      if (!lower.includes("oublie")) {
        if (!hasMemory) {
          return "Ma mémoire n'est pas encore connectée.";
        }
        const name = NexaMemory.recall("prenom");
        const notes = this.getNotes();

        if (!name && notes.length === 0) {
          return "Je ne retiens rien pour le moment. Dites-moi par exemple : « Retiens que j'aime le café ».";
        }

        let answer = "Voici ce que je retiens :";
        if (name) {
          answer += "\n- Prénom : " + name;
        }
        for (const n of notes) {
          answer += "\n- " + n.text;
        }
        return answer;
      }
    }

    // --- Oublier les notes ---
    if (lower.includes("oublie mes notes") || lower.includes("efface mes notes")) {
      if (!hasMemory) {
        return "Ma mémoire n'est pas encore connectée.";
      }
      const notes = this.getNotes();
      for (const n of notes) {
        NexaMemory.forget(n.key);
      }
      return "C'est fait. J'ai oublié vos notes (" + notes.length + ").";
    }

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

    // --- Oublier tout ---
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

    // --- Aucune règle ne correspond : on laisse le modèle IA répondre ---
    return null;
  }
};
