// ============================================
// NEXA BRAIN - version 0.9
// Le cerveau de NEXA : il reçoit un message,
// utilise la Memory, les Tools (via le registre)
// et le modèle IA, et décide quoi répondre.
// Nouveauté : liste de tâches.
// ============================================

const NexaBrain = {
  version: "0.9",

  // Sert à se souvenir qu'on attend une réponse
  // (ex : "Pour quelle ville ?")
  pending: null,

  // Pays reconnus à la fin d'un nom de ville
  // (sans accents, en minuscules)
  countries: [
    "france", "belgique", "suisse", "canada", "luxembourg", "maroc",
    "algerie", "tunisie", "senegal", "mali", "cameroun", "gabon",
    "congo", "madagascar", "mauritanie", "guinee", "benin", "togo",
    "niger", "tchad", "comores", "djibouti", "haiti", "liban",
    "egypte", "turquie", "espagne", "italie", "allemagne", "portugal",
    "angleterre", "royaume-uni", "etats-unis", "usa"
  ],

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

  // Texte de l'aide : la liste des commandes
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
      "- Clé IA : « Change ma clé » ou « Supprime ma clé »\n" +
      "- Conversation : « Efface la conversation »\n" +
      "- Tout le reste : je le confie au modèle IA."
    );
  },

  // "Saint-Louis France" devient "Saint-Louis, France"
  // (si le dernier mot est un pays connu)
  formatPlace(str) {
    const text = (str || "").trim();
    if (!text) return text;

    // Déjà précisé avec une virgule ou "en / au / aux / dans"
    if (/,|\s(?:en|au|aux|dans)\s/i.test(text)) return text;

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

  // Nettoie un texte pour ne garder que le sujet d'une recherche
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
    while (words.length > 0 && stopStart.includes(words[0].toLowerCase())) {
      words.shift();
      removed++;
    }
    if (removed > 0 && words.length > 0 && /^d'./i.test(words[0])) {
      words[0] = words[0].slice(2);
    }
    while (words.length > 0 && stopEnd.includes(words[words.length - 1].toLowerCase())) {
      words.pop();
    }
    return words.join(" ").trim();
  },

  // Trouve le sujet dans une phrase qui parle de Wikipédia
  extractWikiQuery(clean) {
    return this.cleanTopic(clean.replace(/wikip[ée]dia/gi, " "));
  },

  // Demande la météo à l'outil et renvoie la phrase
  async weatherReply(city) {
    const place = this.formatPlace(city);
    const r = await this.useTool("meteo", { city: place });
    if (!r.ok) return r.error;
    return r.result;
  },

  // Demande un résumé à l'outil Wikipédia
  async wikiReply(topic) {
    const r = await this.useTool("wikipedia", { query: topic });
    if (!r.ok) return r.error;
    return r.result;
  },

  // Appelle l'outil de tâches et renvoie la phrase
  async taskCall(args) {
    const r = await this.useTool("taches", args);
    if (!r.ok) return r.error;
    return r.result;
  },

  // Reconnaît les commandes de la liste de tâches.
  // Renvoie une réponse, ou null si ce n'est pas une commande de tâches.
  async handleTasks(clean) {

    // Vider toute la liste
    if (
      /(?:vide|vider|efface|effacer|supprime|supprimer|nettoie|nettoyer|r[ée]initialise)\s+(?:toutes?\s+)?(?:mes|les|ma)\s+(?:t[âa]ches|liste)/i.test(clean)
    ) {
      return await this.taskCall({ action: "clear" });
    }

    // Supprimer une tâche par son numéro
    const deleteMatch = clean.match(
      /(?:supprime|supprimer|retire|retirer|enl[eè]ve|enlever|efface|effacer)\s+(?:la\s+)?t[âa]che\s*(?:num[ée]ro\s*|n[°o]\s*)?(\d+)/i
    );
    if (deleteMatch) {
      return await this.taskCall({ action: "delete", number: parseInt(deleteMatch[1], 10) });
    }

    // Terminer une tâche par son numéro
    const doneMatch =
      clean.match(/(?:termine|terminer|finis|finir|coche|cocher|valide|valider)\s+(?:la\s+)?t[âa]che\s*(?:num[ée]ro\s*|n[°o]\s*)?(\d+)/i) ||
      clean.match(/j'ai\s+(?:fini|termin[ée]|fait)\s+(?:la\s+)?t[âa]che\s*(?:num[ée]ro\s*|n[°o]\s*)?(\d+)/i) ||
      clean.match(/t[âa]che\s*(?:num[ée]ro\s*|n[°o]\s*)?(\d+)\s+(?:est\s+)?(?:termin[ée]e|faite|finie|coch[ée]e)/i);
    if (doneMatch) {
      return await this.taskCall({ action: "done", number: parseInt(doneMatch[1], 10) });
    }

    // Terminer ou supprimer sans numéro
    if (
      /(?:supprime|supprimer|retire|retirer|enl[eè]ve|enlever|termine|terminer|finis|finir|coche|cocher)\s+(?:la\s+)?t[âa]che\s*[?!.]*$/i.test(clean)
    ) {
      return "Quel est le numéro de la tâche ? Écrivez « Mes tâches » pour voir la liste.";
    }

    // Ajouter une tâche : "Ajoute une tâche : appeler le médecin"
    const addMatch = clean.match(
      /(?:ajoute|ajouter|rajoute|rajouter|nouvelle|cr[ée]e|cr[ée]er)\s+(?:une\s+|la\s+)?t[âa]che(?:\s*[:\-]\s*|\s+)?(.*)$/i
    );
    if (addMatch) {
      return await this.taskCall({ action: "add", text: addMatch[1].trim() });
    }

    // Ajouter une tâche : "Ajoute acheter du pain à ma liste"
    const addListMatch = clean.match(
      /(?:ajoute|ajouter|rajoute|rajouter|mets|mettre)\s+(.+?)\s+(?:à|a|sur|dans)\s+ma\s+(?:liste|to-?do|todo)(?:\s+de\s+t[âa]ches)?\s*[.!]*$/i
    );
    if (addListMatch) {
      return await this.taskCall({ action: "add", text: addListMatch[1].trim() });
    }

    // Afficher la liste : "Mes tâches", "Ma liste", "Montre-moi ma liste"
    if (
      /mes\s+t[âa]ches/i.test(clean) ||
      /^(?:(?:affiche|afficher|montre|montrer|donne|donner|voir|vois|lis)[-\s]*(?:moi\s+)?)?ma\s+(?:liste|to-?do|todo)(?:\s+de\s+t[âa]ches)?\s*[?!.]*$/i.test(clean)
    ) {
      return await this.taskCall({ action: "list" });
    }

    return null;
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
      "Tu n'as pas accès à Internet et tu ne connais pas l'heure exacte. " +
      "Tu ne peux rien enregistrer toi-même : si l'utilisateur veut que tu " +
      "retiennes quelque chose, dis-lui d'écrire « Retiens que ... ». " +
      "Pour la météo, dis-lui d'écrire « Météo à Paris » (avec sa ville). " +
      "Pour une recherche, dis-lui d'écrire « Cherche sur Wikipédia ... ». " +
      "Pour une liste de tâches, dis-lui d'écrire « Ajoute une tâche : ... » ou « Mes tâches ». " +
      "S'il demande ce que tu sais faire, dis-lui d'écrire « Aide ». " +
      "Tu n'utilises jamais de Markdown : pas d'astérisques, pas de titres.";

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

    // Si on attendait une réponse mais que l'utilisateur tape une
    // commande de tâches ou d'aide, on abandonne la question en attente
    if (this.pending && /t[âa]ches?|ma\s+liste|(^|\s)aide(\s|$)
