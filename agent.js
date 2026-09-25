// ============================================
// NEXA AGENT - version 1.0 (Planner)
// Permet à NEXA de réfléchir en plusieurs étapes.
// L'agent analyse, choisit un outil, récupère le résultat,
// puis décide s'il a besoin d'un autre outil ou s'il peut répondre.
// ============================================

const NexaAgent = {
  version: "1.0",
  maxSteps: 5, // Sécurité pour éviter les boucles infinies

  async solve(text) {
    if (typeof NexaAI === "undefined") {
      return "Erreur : NexaAI n'est pas connecté, l'Agent ne peut pas réfléchir.";
    }

    // Préparation du contexte (Mémoire)
    const hasMemory = typeof NexaMemory !== "undefined";
    let memoryContext = "";
    if (hasMemory) {
      const name = NexaMemory.recall("prenom");
      const ville = NexaMemory.recall("ville");
      if (name) memoryContext += ` L'utilisateur s'appelle ${name}.`;
      if (ville) memoryContext += ` Sa ville est ${ville}.`;
      
      const notes = typeof NexaBrain !== "undefined" ? NexaBrain.getNotes() : [];
      if (notes.length > 0) {
        memoryContext += " Notes retenues : " + notes.map(n => n.text).join(", ") + ".";
      }
    }

    const systemPrompt = 
      "Tu es NEXA AGENT, le cerveau analytique de NEXA. Tu dois accomplir la demande de l'utilisateur en utilisant des outils si nécessaire.\n" +
      memoryContext +
      "\nÀ chaque étape, tu dois répondre UNIQUEMENT par un objet JSON valide, sans texte autour, au format exact suivant :\n" +
      "CAS 1 - Tu as besoin d'utiliser un outil pour chercher une info :\n" +
      '{"action": "tool", "tool_name": "nom_outil", "tool_args": {"argument_attendu": "valeur"}}\n' +
      "Outils disponibles :\n" +
      '- "meteo" (args attendus: {"city": "nom_ville"})\n' +
      '- "wikipedia" (args attendus: {"query": "sujet"})\n' +
      '- "calcul" (args attendus: {"expression": "le calcul"})\n' +
      "CAS 2 - Tu as terminé (ou aucun outil n'est nécessaire) :\n" +
      '{"action": "final", "reply": "Ta réponse finale en français clair, naturel et direct pour un écran mobile"}\n' +
      "Règle absolue : si tu choisis 'tool', tu recevras le résultat à la prochaine étape de la conversation. Ne choisis 'final' que quand tu as la réponse complète.";

    // Initialisation de la conversation pour l'Agent
    let messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: text }
    ];

    let stepCount = 0;

    // Boucle de réflexion de l'Agent
    while (stepCount < this.maxSteps) {
      stepCount++;
      
      // Demander à l'IA la prochaine action
      const rawResponse = await NexaAI.ask(messages);
      const decision = this.parseAgentJSON(rawResponse);

      // Si l'IA ne renvoie pas de JSON valide, on essaie de retourner le texte tel quel pour ne pas bloquer le système
      if (!decision) {
         return rawResponse; 
      }

      if (decision.action === "final") {
        return decision.reply || "Je n'ai pas pu formuler de réponse finale.";
      }

      if (decision.action === "tool") {
        const toolName = decision.tool_name;
        const toolArgs = decision.tool_args || {};

        // Exécuter l'outil via le Brain existant
        let toolResult;
        if (typeof NexaBrain !== "undefined" && typeof NexaBrain.useTool === "function") {
          const r = await NexaBrain.useTool(toolName, toolArgs);
          toolResult = r.ok ? r.result : "Erreur de l'outil : " + r.error;
        } else {
          toolResult = "Erreur : NexaBrain n'est pas accessible pour lancer les outils.";
        }

        // Ajouter la décision et le résultat dans les messages pour la boucle suivante
        messages.push({ role: "assistant", content: JSON.stringify(decision) });
        messages.push({ role: "user", content: `Résultat de l'outil ${toolName} : ${toolResult}` });
      } else {
        return "Erreur d'action de l'Agent.";
      }
    }

    return "Désolé, la demande était trop complexe, j'ai arrêté d'y réfléchir après " + this.maxSteps + " étapes.";
  },

  parseAgentJSON(raw) {
    if (!raw) return null;
    let text = raw.trim();

    text = text
      .replace(/^```json/i, "")
      .replace(/^```/, "")
      .replace(/```$/, "")
      .trim();

    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1 || end < start) return null;
    text = text.slice(start, end + 1);

    try {
      const data = JSON.parse(text);
      if (data && typeof data === "object" && typeof data.action === "string") {
        return data;
      }
    } catch (e) {
      // JSON invalide
    }
    return null;
  }
};
