// ============================================
// NEXA BRAIN - version 0.1
// Le cerveau de NEXA : il reçoit un message
// et décide quoi répondre.
// ============================================

const NexaBrain = {
  version: "0.1",

  // Fonction principale : reçoit le texte de l'utilisateur
  // et renvoie la réponse de NEXA.
  async think(message) {
    const text = message.trim();
    const lower = text.toLowerCase();

    // Salutations
    if (
      lower.startsWith("bonjour") ||
      lower.startsWith("salut") ||
      lower.startsWith("coucou") ||
      lower.startsWith("hello")
    ) {
      return "Bonjour. Je suis NEXA. Mon cerveau est en construction, mais je vous écoute.";
    }

    // Identité
    if (lower.includes("qui es-tu") || lower.includes("qui es tu")) {
      return "Je suis NEXA, votre système intelligent personnel. Je suis construit étape par étape.";
    }

    // Réponse par défaut
    return (
      "Mon Brain a bien reçu : « " + text + " ». " +
      "Je n'ai pas encore de mémoire ni de modèle IA connecté."
    );
  }
};
