// ============================================
// NEXA BRAIN - version 1.3
// Le cerveau de NEXA : il reçoit un message,
// utilise la Memory, les Tools, le modèle IA
// et maintenant le Agent/Planner/Executor/Verifier.
// ============================================
const NexaBrain = {
  version: "1.3",
  // Sert à se souvenir qu'on attend une réponse
  // (ex : "Pour quelle ville ?")
  pending: null,
  // Pays reconnus à la fin d'un nom de ville
  countries: [
    "france", "belgique", "suisse", "canada", "luxembourg", "maroc",
    "algerie", "tunisie", "senegal", "mali", "cameroun", "gabon",
    "congo", "madagascar", "mauritanie", "guinee", "benin", "togo",
    "niger", "tchad", "comores", "djibouti", "haiti", "liban",
    "egypte", "turquie", "espagne", "italie", "allemagne", "portugal",
    "angleterre", "royaume-uni", "etats-unis", "usa"
  ],
  // Fonction principale : reçoit le texte de l'utilisateur,
  // et éventuellement un fichier joint.
  async think(message, attachment) {
    const text = (message || "").trim();
    // ============================================
    // CONNEXION AU AGENT
    // Les demandes multi-étapes passent maintenant
    // par le cycle :
    // Planner → Executor → Verifier → Finalizer
    //
    // Les demandes simples continuent d'utiliser
    // le Brain existant.
    // ============================================
    if (
      !attachment &&
      text &&
      typeof NexaAgent !== "undefined" &&
      typeof NexaAgent.prepare === "function" &&
      typeof NexaAgent.run === "function"
    ) {
      const agentContext = NexaAgent.prepare(text);
      if (
        agentContext &&
        Array.isArray(agentContext.plan) &&
        agentContext.plan.length > 1
      ) {
        try {
          const execution = await NexaAgent.run(text);
          if (
            execution &&
            typeof execution.finalAnswer === "string" &&
            execution.finalAnswer.trim()
          ) {
            return execution.finalAnswer;
          }
          if (
            execution &&
            execution.context &&
            typeof execution.context.finalAnswer === "string" &&
            execution.context.finalAnswer.trim()
          ) {
            return execution.context.finalAnswer;
          }
          return (
            "J'ai exécuté les différentes étapes de votre demande, " +
            "mais je n'ai pas encore pu construire la réponse finale."
          );
        } catch (error) {
          console.error("NexaAgent.run error:", error);
          return (
            "J'ai rencontré un problème pendant l'exécution du plan. " +
            "Les fonctions classiques de NEXA restent disponibles."
          );
        }
      }
    }
    if (attachment) {
      const ack =
        "J'ai bien reçu votre fichier « " + attachment.name + " ». " +
        "Je ne sais pas encore l'analyser en détail, mais c'est noté.";
      if (typeof NexaMemory !== "undefined") {
        NexaMemory.addToHistory(
          "user",
          text
            ? text + " [fichier : " + attachment.name + "]"
            : "[fichier : " + attachment.name + "]"
        );
        NexaMemory.addToHistory("nexa", ack);
      }
      return ack;
    }
    // 1) Les règles du Brain (prénom, notes, outils...)
    let reply = await this.decide(text);
    // 2) Si aucune règle ne correspond, le modèle IA choisit l'outil
    if (reply === null) {
      reply = await this.routeWithAI(text);
    }
    if (typeof NexaMemory !== "undefined") {
      NexaMemory.addToHistory("user", text);
      NexaMemory.addToHistory("nexa", reply);
    }
    return reply;
  },
  async useTool(name, args) {
    if (
      typeof NexaTools === "undefined" ||
      typeof NexaTools.run !== "function"
    ) {
      return {
        ok: false,
        error: "Mes outils ne sont pas encore connectés."
      };
    }
    return await NexaTools.run(name, args);
  },
  getNotes() {
    if (typeof NexaMemory === "undefined") return [];
    const facts = NexaMemory.load().facts;
    const notes = [];
    for (const key of Object.keys(facts)) {
      if (key.startsWith("note_")) {
        notes.push({
          key: key,
          text: facts[key]
        });
      }
    }
    return notes;
  },
  helpText() {
    return (
      "Voici ce que je sais faire :\n" +
      "- Prénom : « Je m'appelle ... »\n" +
      "- Ville : « J'habite ... »\n" +
      "- Notes : « Retiens que ... », « Que retiens-tu ? », « Oublie mes notes »\n" +
      "- Tâches : « Ajoute une tâche : ... », « Mes tâches », « Termine la tâche 2 », « Supprime la tâche 2 », « Vide mes tâches »\n" +
      "- Météo : « Météo à Paris » ou « Quelle est la météo ? »\n" +
      "- Recherche : « Cherche sur Wikipédia ... »\n" +
      "- Calcul : « Calcule 12 * 5 + 3 »\n" +
      "- Heure et date : « Quelle heure est-il ? »\n" +
      "- Chronomètre : « Chrono » ou « Lance un chronomètre »\n" +
      "- Fichier : touchez le bouton + pour en joindre un\n" +
      "- Clé IA : « Change ma clé » ou « Supprime ma clé »\n" +
      "- Conversation : « Efface la conversation »\n" +
      "- Question naturelle : posez-la simplement (ex : « où joue Cherki ? »), je choisirai moi-même l'outil adapté."
    );
  },
  formatPlace(str) {
    const text = (str || "").trim();
    if (!text) return text;
    if (/,|\s(?:en|au|aux|dans)\s/i.test(text)) {
      return text;
    }
    const words = text.split(/\s+/);
    if (words.length < 2) return text;
    const last = words[words.length - 1];
    const lastNorm = last
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    if (this.countries.includes(lastNorm)) {
      return words.slice(0, -1).join(" ") + ", " + last;
    }
    return text;
  },
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
    while (
      words.length > 0 &&
      stopStart.includes(words[0].toLowerCase())
    ) {
      words.shift();
    }
    if (words.length > 0 && /^d'/i.test(words[0])) {
      words[0] = words[0].slice(2);
      words = words.filter(Boolean);
    }
    while (
      words.length > 0 &&
      stopEnd.includes(words[words.length - 1].toLowerCase())
    ) {
      words.pop();
    }
    return words.join(" ").trim();
  },
  extractCity(clean) {
    const match = clean.match(
      /(?:il fait quel temps|quel temps|m[ée]t[ée]o(?![a-zà-ÿ])|temp[ée]rature)(.*)$/i
    );
    if (!match) return "";
    return this.cleanCity(match[1]);
  },
  cleanTopic(str) {
    const stopStart = [
      "cherche", "chercher", "recherche", "rechercher", "trouve", "trouver",
      "sur", "dans", "que", "qu'est-ce", "qu'est", "dit", "dis", "dis-moi",
      "moi", "me", "à", "propos", "de", "du", "des", "peux-tu", "peux", "tu",
      "donne", "donner", "explique", "parle", "parler", "regarde", "va",
      "svp", "stp", "concernant", "sujet", "info", "infos", "information",
      "informations", "au", "aux", "ce"
    ];
    const stopEnd = [
      "sur", "dans", "svp", "stp", "s'il", "te", "plaît", "plait",
      "vous", "merci"
    ];
    let words = str
      .replace(/[?!.,;:]/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    let removed = 0;
    while (
      words.length > 0 &&
      stopStart.includes(words[0].toLowerCase())
    ) {
      words.shift();
      removed++;
    }
    if (removed > 0 && words.length > 0 && /^d'./i.test(words[0])) {
      words[0] = words[0].slice(2);
    }
    while (
      words.length > 0 &&
      stopEnd.includes(words[words.length - 1].toLowerCase())
    ) {
      words.pop();
    }
    return words.join(" ").trim();
  },
  extractWikiQuery(clean) {
    return this.cleanTopic(
      clean.replace(/wikip[ée]dia/gi, " ")
    );
  },
  async weatherReply(city) {
    const place = this.formatPlace(city);
    const r = await this.useTool("meteo", { city: place });
    if (!r.ok) return r.error;
    return r.result;
  },
  async wikiReply(topic) {
    const r = await this.useTool("wikipedia", {
      query: topic
    });
    if (!r.ok) return r.error;
    return r.result;
  },
  async taskCall(args) {
    const r = await this.useTool("taches", args);
    if (!r.ok) return r.error;
    return r.result;
  },
  async handleTasks(clean) {
    if (
      /(?:vide|vider|efface|effacer|supprime|supprimer|nettoie|nettoyer|r[ée]initialise)\s+(?:toutes?\s+)?(?:mes|les|ma)\s+(?:t[âa]ches|liste)/i.test(clean)
    ) {
      return await this.taskCall({
        action: "clear"
      });
    }
    const deleteMatch = clean.match(
      /(?:supprime|supprimer|retire|retirer|enl[eè]ve|enlever|efface|effacer)\s+(?:la\s+)?t[âa]che\s*(?:num[ée]ro\s*|n[°o]\s*)?(\d+)/i
    );
    if (deleteMatch) {
      return await this.taskCall({
        action: "delete",
        number: parseInt(deleteMatch[1], 10)
      });
    }
    const doneMatch =
      clean.match(
        /(?:termine|terminer|finis|finir|coche|cocher|valide|valider)\s+(?:la\s+)?t[âa]che\s*(?:num[ée]ro\s*|n[°o]\s*)?(\d+)/i
      ) ||
      clean.match(
        /j'ai\s+(?:fini|termin[ée]|fait)\s+(?:la\s+)?t[âa]che\s*(?:num[ée]ro\s*|n[°o]\s*)?(\d+)/i
      ) ||
      clean.match(
        /t[âa]che\s*(?:num[ée]ro\s*|n[°o]\s*)?(\d+)\s+(?:est\s+)?(?:termin[ée]e|faite|finie|coch[ée]e)/i
      );
    if (doneMatch) {
      return await this.taskCall({
        action: "done",
        number: parseInt(doneMatch[1], 10)
      });
    }
    if (
      /(?:supprime|supprimer|retire|retirer|enl[eè]ve|enlever|termine|terminer|finis|finir|coche|cocher)\s+(?:la\s+)?t[âa]che\s*[?!.]*$/i.test(clean)
    ) {
      return "Quel est le numéro de la tâche ? Écrivez « Mes tâches » pour voir la liste.";
    }
    const addMatch = clean.match(
      /(?:ajoute|ajouter|rajoute|rajouter|nouvelle|cr[ée]e|cr[ée]er)\s+(?:une\s+|la\s+)?t[âa]che(?:\s*[:\-]\s*|\s+)?(.*)$/i
    );
    if (addMatch) {
      return await this.taskCall({
        action: "add",
        text: addMatch[1].trim()
      });
    }
    const addListMatch = clean.match(
      /(?:ajoute|ajouter|rajoute|rajouter|mets|mettre)\s+(.+?)\s+(?:à|a|sur|dans)\s+ma\s+(?:liste|to-?do|todo)(?:\s+de\s+t[âa]ches)?\s*[.!]*$/i
    );
    if (addListMatch) {
      return await this.taskCall({
        action: "add",
        text: addListMatch[1].trim()
      });
    }
    if (
      /mes\s+t[âa]ches/i.test(clean) ||
      /^(?:(?:affiche|afficher|montre|montrer|donne|donner|voir|vois|lis)[-\s]*(?:moi\s+)?)?ma\s+(?:liste|to-?do|todo)(?:\s+de\s+t[âa]ches)?\s*[?!.]*$/i.test(clean)
    ) {
      return await this.taskCall({
        action: "list"
      });
    }
    return null;
  },
  // --------------------------------------------
  // Le modèle IA choisit l'outil à utiliser
  // quand aucune règle du Brain ne reconnaît la phrase.
  // --------------------------------------------
  async routeWithAI(text) {
    if (typeof NexaAI === "undefined") {
      return (
        "Mon Brain a bien reçu : « " + text + " ». " +
        "Le module IA n'est pas encore connecté."
      );
    }
    const hasMemory = typeof NexaMemory !== "undefined";
    let system =
      "Tu es NEXA, l'assistant personnel de l'utilisateur, et aussi son routeur d'intentions. " +
      "Pour CHAQUE message reçu, réponds UNIQUEMENT avec un objet JSON valide, sans aucun texte autour, sans balises de code, au format exact : " +
      '{"tool": "...", "argument": "...", "reply": "..."} ' +
      "Le champ tool doit être une de ces valeurs exactes : " +
      '"meteo" si l\'utilisateur veut la météo d\'un lieu (mets le nom de la ville dans argument, laisse reply vide) ; ' +
      '"wikipedia" si l\'utilisateur pose une question factuelle sur une personne, un lieu, une chose ou un évènement, y compris une question courte comme « où joue X » ou « qui est X » (mets le sujet en quelques mots dans argument, laisse reply vide) ; ' +
      '"calcul" pour un calcul mathématique (mets l\'expression dans argument, laisse reply vide) ; ' +
      '"chat" pour tout le reste, comme une discussion, une salutation, une opinion, une blague ou une explication que tu connais déjà (laisse argument vide et écris ta réponse complète en français dans reply). ' +
      "Dans reply, réponds toujours en français, de façon claire, simple et courte, car l'écran est celui d'un iPhone, sans Markdown (pas d'astérisques ni de titres). " +
      "Si tu ne sais pas, dis-le honnêtement dans reply plutôt que d'inventer. Tu n'as pas accès à Internet toi-même et tu ne connais pas l'heure exacte. " +
      "Tu ne peux rien enregistrer toi-même : si l'utilisateur veut que tu retiennes quelque chose, dans reply dis-lui d'écrire « Retiens que ... ». " +
      "Pour une liste de tâches, dans reply dis-lui d'écrire « Ajoute une tâche : ... » ou « Mes tâches ». " +
      "Pour un chronomètre, dans reply dis-lui d'écrire « Chrono ». " +
      "S'il demande ce que tu sais faire, dans reply dis-lui d'écrire « Aide ».";
    const name = hasMemory
      ? NexaMemory.recall("prenom")
      : null;
    if (name) {
      system += " L'utilisateur s'appelle " + name + ".";
    }
    const ville = hasMemory
      ? NexaMemory.recall("ville")
      : null;
    if (ville) {
      system += " Sa ville est " + ville + ".";
    }
    const notes = this.getNotes();
    if (notes.length > 0) {
      system += " Voici ce que l'utilisateur t'a demandé de retenir:";
      for (const n of notes) {
        system += " - " + n.text + ".";
      }
      system += " Utilise ces informations quand c'est pertinent.";
    }
    const messages = [
      {
        role: "system",
        content: system
      }
    ];
    if (hasMemory) {
      const recent = NexaMemory
        .getHistory()
        .filter(function (m) {
          return !(
            m.role === "nexa" &&
            m.text.startsWith("Mon Brain a bien reçu")
          );
        })
        .slice(-6);
      for (const m of recent) {
        messages.push({
          role: m.role === "nexa"
            ? "assistant"
            : "user",
          content: m.text
        });
      }
    }
    messages.push({
      role: "user",
      content: text
    });
    const raw = await NexaAI.ask(messages);
    const decision = this.parseRouterJSON(raw);
    if (!decision) {
      return raw;
    }
    if (decision.tool === "meteo") {
      const city =
        (decision.argument || "").trim() ||
        (hasMemory ? NexaMemory.recall("ville") : "") ||
        "";
      if (!city) {
        this.pending = "meteo";
        return "Pour quelle ville ? Vous pouvez aussi me dire « J'habite à ... » pour que je m'en souvienne.";
      }
      return await this.weatherReply(city);
    }
    if (decision.tool === "wikipedia") {
      const topic = (decision.argument || "").trim();
      if (!topic) {
        this.pending = "wikipedia";
        return "Que voulez-vous que je cherche sur Wikipédia ?";
      }
      return await this.wikiReply(topic);
    }
    if (decision.tool === "calcul") {
      const expr = (decision.argument || "").trim();
      if (!expr) {
        return "Quel calcul voulez-vous faire ?";
      }
      const r = await this.useTool(
        "calcul",
        {
          expression: expr
        }
      );
      if (!r.ok) return r.error;
      if (r.result !== null) {
        return "Le résultat est " +
          String(r.result).replace(".", ",") +
          ".";
      }
      return "Je n'ai pas réussi à faire ce calcul.";
    }
    const reply = (decision.reply || "").trim();
    return (
      reply ||
      raw ||
      "Je n'ai pas de réponse à vous donner pour l'instant."
    );
  },
  // Essaie de lire un JSON renvoyé par le modèle,
  // même si le modèle a ajouté du texte ou des balises.
  parseRouterJSON(raw) {
    if (!raw) return null;
    let text = raw.trim();
    text = text
      .replace(/^```json/i, "")
      .replace(/^```/, "")
      .replace(/```$/, "")
      .trim();
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1 || end < start) {
      return null;
    }
    text = text.slice(start, end + 1);
    try {
      const data = JSON.parse(text);
      if (
        data &&
        typeof data === "object" &&
        typeof data.tool === "string"
      ) {
        return data;
      }
    } catch (e) {
      // JSON invalide, on laisse tomber
    }
    return null;
  },
  // Décide de la réponse selon le message.
  // Renvoie null si aucune règle ne correspond.
  async decide(text) {
    const clean = text.replace(/[’‘`]/g, "'");
    const lower = clean.toLowerCase();
    const hasMemory = typeof NexaMemory !== "undefined";
    if (
      this.pending &&
      /t[âa]ches?|ma\s+liste|(^|\s)aide(\s|$)/i.test(clean)
    ) {
      this.pending = null;
    }
    if (this.pending === "meteo") {
      this.pending = null;
      const shortAnswer =
        clean.split(/\s+/).length <= 4 &&
        !clean.includes("?");
      if (shortAnswer) {
        const city = this.cleanCity(clean);
        if (city) {
          return await this.weatherReply(city);
        }
      }
    } else if (this.pending === "wikipedia") {
      this.pending = null;
      const shortAnswer =
        clean.split(/\s+/).length <= 6 &&
        !clean.includes("?");
      if (shortAnswer) {
        const topic = this.cleanTopic(clean);
        if (topic) {
          return await this.wikiReply(topic);
        }
      }
    }
    // --- Aide : liste des commandes ---
    if (
      /^(aide|help|menu|commandes)\s*[?!.]*$/i.test(clean) ||
      lower.includes("que sais-tu faire") ||
      lower.includes("que sais tu faire") ||
      lower.includes("que peux-tu faire") ||
      lower.includes("que peux tu faire") ||
      lower.includes("quelles sont tes commandes") ||
      lower.includes("qu'est-ce que tu sais faire")
    ) {
      return this.helpText();
    }
    // --- Gestion de la clé du modèle IA ---
    const mentionsKey =
      /(^|[^a-zà-ÿ])cl[ée]([^a-zà-ÿ]|$)/i.test(clean);
    if (mentionsKey) {
      if (typeof NexaAI === "undefined") {
        return "Mon module IA n'est pas connecté.";
      }
      if (
        /supprim|efface|oublie|retire|enl[eè]ve/i.test(lower)
      ) {
        NexaAI.clearKey();
        return "C'est fait. J'ai supprimé la clé enregistrée sur cet iPhone. Pour en remettre une, écrivez « Change ma clé ».";
      }
      if (
        /chang|modifi|nouvelle|remplac|ajoute|saisi|entre|mets/i.test(lower)
      ) {
        const oldKey = NexaAI.getKey();
        NexaAI.clearKey();
        const newKey = NexaAI.ensureKey();
        if (newKey) {
          return "C'est fait. Votre nouvelle clé est enregistrée sur cet iPhone.";
        }
        if (oldKey) {
          NexaAI.setKey(oldKey);
          return "Aucune nouvelle clé saisie : je garde l'ancienne.";
        }
        return "Aucune clé saisie. Écrivez « Change ma clé » quand vous voulez en enregistrer une.";
      }
    }
    // --- Effacer la conversation ---
    if (
      /(efface|supprime|vide|nettoie|oublie|r[ée]initialise)\s+(?:toute\s+|tout\s+)?(?:la\s+|notre\s+|cette\s+|l')\s*(?:conversation|historique)/i.test(lower)
    ) {
      if (!hasMemory) {
        return "Ma mémoire n'est pas encore connectée.";
      }
      const data = NexaMemory.load();
      data.history = [];
      NexaMemory.save(data);
      return "C'est fait. J'ai effacé l'historique de la conversation. Votre prénom, votre ville, vos notes et vos tâches sont conservés. Rechargez la page pour vider l'écran.";
    }
    // --- Tool : chronomètre ---
    if (/chronom[eè]tre|\bchrono\b|\btimer\b/i.test(lower)) {
      const r = await this.useTool("chronometre");
      if (!r.ok) return r.error;
      return r.result;
    }
    // --- Tool : liste de tâches ---
    const taskReply = await this.handleTasks(clean);
    if (taskReply !== null) {
      return taskReply;
    }
    // --- Retenir la ville ---
    const villeMatch =
      clean.match(
        /j'habite\s+(?:(?:à|a|en|au|aux|dans)\s+)?([^.,!?]+)/i
      ) ||
      clean.match(
        /(?:je vis|je réside|je suis basée?)\s+(?:à|en|au|aux|dans)\s+([^.,!?]+)/i
      ) ||
      clean.match(
        /ma ville (?:est|c'est)\s+([^.,!?]+)/i
      );
    if (villeMatch && !clean.includes("?")) {
      if (!hasMemory) {
        return "Ma mémoire n'est pas encore connectée.";
      }
      let raw = villeMatch[1]
        .split(/\s+(?:et|mais|car)\s+/i)[0]
        .trim()
        .slice(0, 60);
      if (raw) {
        raw = this.formatPlace(raw);
        const ville =
          raw.charAt(0).toUpperCase() +
          raw.slice(1);
        NexaMemory.remember("ville", ville);
        return "C'est noté : votre ville est " +
          ville +
          ".";
      }
    }
    // --- Retenir une note libre ---
    const noteMatch = clean.match(
      /(?:retiens|retenir|souviens-toi|souviens toi|n'oublie pas)\s+(?:que|qu')\s*(.+)/i
    );
    if (noteMatch) {
      if (!hasMemory) {
        return "Ma mémoire n'est pas encore connectée.";
      }
      const note = noteMatch[1]
        .trim()
        .slice(0, 300);
      if (!note) {
        return "Que dois-je retenir ? Dites par exemple : « Retiens que j'aime le café ».";
      }
      NexaMemory.remember(
        "note_" + Date.now(),
        note
      );
      return "C'est noté : « " +
        note +
        " ». Je m'en souviendrai.";
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
    if (
      lower.includes("oublie mes notes") ||
      lower.includes("efface mes notes")
    ) {
      if (!hasMemory) {
        return "Ma mémoire n'est pas encore connectée.";
      }
      const notes = this.getNotes();
      for (const n of notes) {
        NexaMemory.forget(n.key);
      }
      return "C'est fait. J'ai oublié vos notes (" +
        notes.length +
        ").";
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
        return "Vous vous appelez " +
          name +
          ".";
      }
      return "Je ne connais pas encore votre prénom. Dites-moi : « Je m'appelle ... ».";
    }
    // --- Oublier tout ---
    if (lower.includes("oublie tout")) {
      if (!hasMemory) {
        return "Ma mémoire n'est pas encore connectée.";
      }
      NexaMemory.clear();
      return "C'est fait. J'ai tout oublié (prénom, ville, notes et tâches).";
    }
    if (
      lower.includes("oublie mon prénom") ||
      lower.includes("oublie mon prenom")
    ) {
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
      const name =
        raw.charAt(0).toUpperCase() +
        raw.slice(1);
      NexaMemory.remember("prenom", name);
      return "Enchanté " +
        name +
        ". Je m'en souviendrai.";
    }
    // --- Tool : Wikipédia (formulation explicite) ---
    if (/wikip[ée]dia/i.test(clean)) {
      const topic = this.extractWikiQuery(clean);
      if (!topic) {
        this.pending = "wikipedia";
        return "Que voulez-vous que je cherche sur Wikipédia ?";
      }
      return await this.wikiReply(topic);
    }
    // --- Tool : la météo (formulation explicite) ---
    const asksWeather =
      /m[ée]t[ée]o(?![a-zà-ÿ])|quel temps|quelle temp[ée]rature fait/i.test(clean);
    if (asksWeather) {
      if (
        /demain|semaine|week-end|weekend/i.test(lower)
      ) {
        return "Pour l'instant, je sais seulement donner la météo du jour.";
      }
      let city = this.extractCity(clean);
      if (!city && hasMemory) {
        city =
          NexaMemory.recall("ville") ||
          "";
      }
      if (!city) {
        this.pending = "meteo";
        return "Pour quelle ville ? Vous pouvez aussi me dire « J'habite à ... » pour que je m'en souvienne.";
      }
      return await this.weatherReply(city);
    }
    // --- Tool : l'heure ---
    if (
      lower.includes("quelle heure") ||
      lower.includes("l'heure")
    ) {
      const r = await this.useTool("heure");
      if (!r.ok) return r.error;
      return "Il est " +
        r.result +
        ".";
    }
    // --- Tool : la date ---
    if (
      lower.includes("quelle date") ||
      lower.includes("quel jour") ||
      lower.includes("date d'aujourd")
    ) {
      const r = await this.useTool("date");
      if (!r.ok) return r.error;
      return "Nous sommes le " +
        r.result +
        ".";
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
      const expression = (
        calcMatch
          ? calcMatch[1]
          : clean
      )
        .replace(/\?/g, "")
        .replace(/(\d)\s*x\s*(\d)/gi, "$1*$2")
        .trim();
      const r = await this.useTool(
        "calcul",
        {
          expression: expression
        }
      );
      if (!r.ok) return r.error;
      if (r.result !== null) {
        return "Le résultat est " +
          String(r.result).replace(".", ",") +
          ".";
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
      const known = hasMemory
        ? NexaMemory.recall("prenom")
        : null;
      if (known) {
        return "Bonjour " +
          known +
          ". Ravi de vous retrouver.";
      }
      return "Bonjour. Je suis NEXA. Mon cerveau est en construction, mais je vous écoute.";
    }
    // --- Identité ---
    if (
      lower.includes("qui es-tu") ||
      lower.includes("qui es tu")
    ) {
      return "Je suis NEXA, votre système intelligent personnel. Je suis construit étape par étape.";
    }
    // --- Aucune règle ne correspond :
    // le modèle IA choisira l'outil.
    return null;
  }
};
