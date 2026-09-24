// ============================================
// NEXA BRAIN - version 0.6
// Le cerveau de NEXA : il reçoit un message,
// utilise la Memory, les Tools (via le registre)
// et le modèle IA, et décide quoi répondre.
// Nouveautés : météo, ville mémorisée.
// ============================================

const NexaBrain = {
  version: "0.6",

  // Sert à se souvenir qu'on attend une réponse
  // (ex : "Pour quelle ville ?")
  pending: null,

  // Fonction principale : reçoit le texte de l'utilisateur
  // et renvoie la réponse de NEXA.
  async think(message) {
    const text = message.trim();

    // 1) Les règles du Brain (prénom, notes, outils...)
    let reply = await this.decide(text);

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

  // Utilise un outil du registre.
  // Renvoie toujours { ok: true/false, result / error }
  async useTool(name, args) {
    if (typeof NexaTools === "undefined" || typeof NexaTools.run !== "function") {
      return { ok: false, error: "Mes outils ne sont pas encore connectés." };
    }
    return await NexaTools.run(name, args);
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

  // Nettoie un texte pour ne garder que le nom de la ville
  cleanCity(str) {
    const stopStart = [
      "fait-il", "fait", "il", "est-il", "à", "a", "de", "du", "des",
      "pour", "sur", "en", "au", "aux", "d'", "ici", "actuellement",
      "aujourd'hui", "maintenant", "dehors", "quelle", "que", "qu'il"
    ];
    const stopEnd = [
      "aujourd'hui", "maintenant", "actuellement", "svp", "stp",
      "dehors", "ce", "matin", "soir", "s'il", "te", "plaît", "plait",
      "vous", "merci"
    ];

    let words = str
      .replace(/[?!.,;:]/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    while (words.length > 0 && stopStart.includes(words[0].toLowerCase())) {
      words.shift();
    }
    if (words.length > 0 && /^d'/i.test(words[0])) {
      words[0] = words[0].slice(2);
      words = words.filter(Boolean);
    }
    while (words.length > 0 && stopEnd.includes(words[words.length - 1].toLowerCase())) {
      words.pop();
    }
    return words.join(" ").trim();
  },

  // Trouve la ville dans une phrase sur la météo
  extractCity(clean) {
    const match = clean.match(
      /(?:il fait quel temps|quel temps|m[ée]t[ée]o(?![a-zà-ÿ])|temp[ée]rature)(.*)$/i
    );
    if (!match) return "";
    return this.cleanCity(match[1]);
  },

  // Demande la météo à l'outil et renvoie la phrase
  async weatherReply(city) {
    const r = await this.useTool("meteo", { city: city });
    if (!r.ok) return r.error;
    return r.result;
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

    const ville = hasMemory ? NexaMemory.recall("ville") : null;
    if (ville) {
      system += " Sa ville est " + ville + ".";
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
  async decide(text) {
    // On remplace les apostrophes de l'iPhone (’) par des normales (')
    const clean = text.replace(/[’‘`]/g, "'");
    const lower = clean.toLowerCase();
    const hasMemory = typeof NexaMemory !== "undefined";

    // --- Réponse à "Pour quelle ville ?" ---
    if (this.pending === "meteo") {
      this.pending = null;
      const shortAnswer =
        clean.split(/\s+/).length <= 4 && !clean.includes("?");
      if (shortAnswer) {
        const city = this.cleanCity(clean);
        if (city) {
          return await this.weatherReply(city);
        }
      }
      // Sinon, on continue normalement avec les autres règles
    }

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
        const ville = NexaMemory.recall("ville");
        const notes = this.getNotes();

        if (!name && !ville && notes.length === 0) {
          return "Je ne retiens rien pour le moment. Dites-moi par exemple : « Retiens que j'aime le café ».";
        }

        let answer = "Voici ce que je retiens :";
        if (name) {
          answer += "\n- Prénom : " + name;
        }
        if (ville) {
          answer += "\n- Ville : " + ville;
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

    // --- Oublier la ville ---
    if (lower.includes("oublie ma ville")) {
      if (!hasMemory) {
        return "Ma mémoire n'est pas encore connectée.";
      }
      NexaMemory.forget("ville");
      return "C'est fait. J'ai oublié votre ville.";
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

    // --- Retenir la ville ---
    const villeMatch =
      clean.match(/(?:j'habite|je vis|je suis basé|je suis basée)\s+(?:à|a|en|au|aux)\s+([^.,!?]+)/i) ||
      clean.match(/ma ville (?:est|c'est)\s+([^.,!?]+)/i);
    if (villeMatch) {
      if (!hasMemory) {
        return "Ma mémoire n'est pas encore connectée.";
      }
      const raw = villeMatch[1].trim();
      const ville = raw.charAt(0).toUpperCase() + raw.slice(1);
      NexaMemory.remember("ville", ville);
      return "C'est noté : votre ville est " + ville + ".";
    }

    // --- Tool : la météo ---
    const asksWeather =
      /m[ée]t[ée]o(?![a-zà-ÿ])|quel temps|quelle temp[ée]rature fait/i.test(clean);

    if (asksWeather) {
      if (/demain|semaine|week-end|weekend/i.test(lower)) {
        return "Pour l'instant, je sais seulement donner la météo du jour.";
      }

      let city = this.extractCity(clean);

      if (!city && hasMemory) {
        city = NexaMemory.recall("ville") || "";
      }

      if (!city) {
        this.pending = "meteo";
        return "Pour quelle ville ? Vous pouvez aussi me dire « J'habite à ... » pour que je m'en souvienne.";
      }

      return await this.weatherReply(city);
    }

    // --- Tool : l'heure ---
    if (lower.includes("quelle heure") || lower.includes("l'heure")) {
      const r = await this.useTool("heure");
      if (!r.ok) return r.error;
      return "Il est " + r.result + ".";
    }

    // --- Tool : la date ---
    if (
      lower.includes("quelle date") ||
      lower.includes("quel jour") ||
      lower.includes("date d'aujourd")
    ) {
      const r = await this.useTool("date");
      if (!r.ok) return r.error;
      return "Nous sommes le " + r.result + ".";
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
      const expression = (calcMatch ? calcMatch[1] : clean)
        .replace(/\?/g, "")
        .replace(/(\d)\s*x\s*(\d)/gi, "$1*$2")
        .trim();

      const r = await this.useTool("calcul", { expression: expression });

      if (!r.ok) return r.error;

      if (r.result !== null) {
        // On affiche la virgule à la française (3,5 au lieu de 3.5)
        return "Le résultat est " + String(r.result).replace(".", ",") + ".";
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
