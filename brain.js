// ============================================
// NEXA BRAIN - version 1.0
// Le cerveau de NEXA : il reçoit un message
// (et éventuellement un fichier joint), utilise
// la Memory, les Tools (via le registre) et le
// modèle IA, et décide quoi répondre.
// Nouveauté : chronomètre, fichiers joints.
// ============================================

const NexaBrain = {
  version: "1.0",

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

  // Fonction principale : reçoit le texte de l'utilisateur,
  // et éventuellement un fichier joint ({name, type, content}).
  async think(message, attachment) {
    const text = (message || "").trim();

    // Un fichier a été joint : simple accusé de réception pour l'instant
    if (attachment) {
      const ack =
        "J'ai bien reçu votre fichier « " + attachment.name + " ». " +
        "Je ne sais pas encore l'analyser en détail, mais c'est noté.";

      if (typeof NexaMemory !== "undefined") {
        NexaMemory.addToHistory(
          "user",
          text ? text + " [fichier : " + attachment.name + "]" : "[fichier : " + attachment.name + "]"
        );
        NexaMemory.addToHistory("nexa", ack);
      }
      return ack;
    }

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
    
