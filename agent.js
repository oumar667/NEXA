// ============================================
// NEXA AGENT - version 0.5
// Planner + Executor + Verifier + Finalizer
//
// Rôle actuel :
// - créer un contexte d'exécution
// - définir un objectif
// - créer un plan
// - détecter des localisations météo dynamiques
// - stocker un plan
// - suivre les étapes
// - exécuter les Tools
// - transmettre correctement les arguments aux Tools
// - stocker les résultats
// - vérifier les résultats
// - construire une réponse finale
// - gérer l'état de l'exécution
//
// IMPORTANT :
// Cette version :
// - supprime la liste fixe de villes météo
// - accepte des localisations dynamiques
// - corrige le passage des arguments au Tool météo
// - conserve l'architecture Planner + Executor
//   + Verifier + Finalizer
// ============================================
const NexaAgent = {
  version: "0.5",
  MAX_STEPS: 10,
  STATES: {
    IDLE: "idle",
    PLANNING: "planning",
    EXECUTING: "executing",
    VERIFYING: "verifying",
    COMPLETED: "completed",
    FAILED: "failed"
  },
  // --------------------------------------------
  // Crée un nouveau contexte d'exécution.
  // --------------------------------------------
  createContext(message) {
    const text = (message || "").trim();
    return {
      id: this.createExecutionId(),
      input: text,
      objective: null,
      plan: [],
      currentStep: 0,
      results: [],
      state: this.STATES.IDLE,
      error: null,
      finalAnswer: null,
      startedAt: Date.now(),
      finishedAt: null
    };
  },
  // --------------------------------------------
  // Génère un identifiant d'exécution.
  // --------------------------------------------
  createExecutionId() {
    return (
      "nexa-" +
      Date.now() +
      "-" +
      Math.random().toString(36).slice(2, 8)
    );
  },
  // --------------------------------------------
  // Définit l'objectif.
  // --------------------------------------------
  setObjective(context, objective) {
    if (!context || typeof context !== "object") {
      throw new Error("Contexte Agent invalide.");
    }
    const text = (objective || "").trim();
    if (!text) {
      throw new Error("L'objectif Agent ne peut pas être vide.");
    }
    context.objective = text;
    return context;
  },
  // --------------------------------------------
  // Planner local.
  // --------------------------------------------
  createPlan(objective) {
    const text = String(objective || "").trim();
    if (!text) {
      return [];
    }
    const weatherLocations =
      this.extractWeatherLocations(text);
    // ------------------------------------------
    // Exemple :
    // "Compare la météo de Paris et Lyon"
    //
    // Devient :
    // 1. météo Paris
    // 2. météo Lyon
    // 3. comparaison
    //
    // Les localisations ne sont plus limitées
    // à une liste prédéfinie.
    // ------------------------------------------
    if (weatherLocations.length >= 2) {
      const plan = [];
      weatherLocations
        .slice(0, this.MAX_STEPS - 1)
        .forEach((location, index) => {
          plan.push({
            id: "step-" + (index + 1),
            action: "Obtenir la météo de " + location,
            tool: "meteo",
            argument: location
          });
        });
      plan.push({
        id: "step-" + (plan.length + 1),
        action: "Comparer les résultats météo obtenus",
        tool: null,
        argument: null
      });
      return plan.slice(0, this.MAX_STEPS);
    }
    // ------------------------------------------
    // Plusieurs actions explicites.
    // ------------------------------------------
    const actionSeparators =
      /\s+(?:puis|ensuite|et ensuite|après|ensuite il faut)\s+/i;
    const parts = text
      .split(actionSeparators)
      .map(function (part) {
        return part.trim();
      })
      .filter(Boolean);
    if (parts.length >= 2) {
      return parts
        .slice(0, this.MAX_STEPS)
        .map(function (part, index) {
          return {
            id: "step-" + (index + 1),
            action: part,
            tool: null,
            argument: null
          };
        });
    }
    return [
      {
        id: "step-1",
        action: text,
        tool: null,
        argument: null
      }
    ];
  },
  // --------------------------------------------
  // Extrait dynamiquement les localisations
  // météo depuis une demande utilisateur.
  //
  // Exemples acceptés :
  //
  // "Compare la météo de Paris et Lyon"
  //
  // "Compare la météo de Tokyo et New York"
  //
  // "Compare la météo de Dakar et Saint-Louis"
  //
  // "Compare la météo de Mulhouse, France
  //  et Genève, Suisse"
  //
  // Aucune liste fixe de villes n'est utilisée.
  // --------------------------------------------
  extractWeatherLocations(text) {
    const source = String(text || "").trim();
    if (!source) {
      return [];
    }
    const match = source.match(
      /(?:météo|meteo|temps)\s+(?:de|du|d'|à|a|pour)\s+(.+?)(?:[?.!]|$)/i
    );
    if (!match || !match[1]) {
      return [];
    }
    let locationsText = match[1].trim();
    // Supprime certaines formulations naturelles
    // qui peuvent suivre la liste.
    locationsText = locationsText
      .replace(
        /\s+(?:aujourd'hui|aujourd’hui|demain|ce soir|maintenant)$/i,
        ""
      )
      .trim();
    if (!locationsText) {
      return [];
    }
    // Le séparateur principal entre plusieurs
    // localisations est "et".
    //
    // Exemple :
    // "Paris et Lyon"
    //
    // ou :
    // "Mulhouse, France et Genève, Suisse"
    const locations = locationsText
      .split(/\s+et\s+/i)
      .map(function (location) {
        return location
          .replace(/^[,;:\s]+|[,;:\s]+$/g, "")
          .trim();
      })
      .filter(function (location) {
        return location.length > 0;
      });
    return locations;
  },
  // --------------------------------------------
  // Définit le plan.
  // --------------------------------------------
  setPlan(context, plan) {
    if (!context || typeof context !== "object") {
      throw new Error("Contexte Agent invalide.");
    }
    if (!Array.isArray(plan)) {
      throw new Error("Le plan Agent doit être un tableau.");
    }
    if (plan.length > this.MAX_STEPS) {
      throw new Error(
        "Le plan contient trop d'étapes. Maximum autorisé : " +
          this.MAX_STEPS +
          "."
      );
    }
    const normalizedPlan = plan.map((step, index) => {
      if (!step || typeof step !== "object") {
        throw new Error(
          "Étape Agent invalide à la position " + index + "."
        );
      }
      const action = String(step.action || "").trim();
      if (!action) {
        throw new Error(
          "L'étape Agent " +
            (index + 1) +
            " ne possède pas d'action."
        );
      }
      return {
        id: step.id || "step-" + (index + 1),
        action: action,
        tool: step.tool || null,
        argument: step.argument ?? null,
        status: step.status || "pending",
        result: step.result ?? null,
        error: step.error ?? null
      };
    });
    context.plan = normalizedPlan;
    context.currentStep = 0;
    return context;
  },
  // --------------------------------------------
  // Valide un contexte.
  // --------------------------------------------
  validateContext(context) {
    if (!context || typeof context !== "object") {
      return {
        ok: false,
        error: "Contexte Agent invalide."
      };
    }
    if (!context.input) {
      return {
        ok: false,
        error: "La demande utilisateur est vide."
      };
    }
    if (!context.objective) {
      return {
        ok: false,
        error: "Aucun objectif Agent défini."
      };
    }
    if (!Array.isArray(context.plan)) {
      return {
        ok: false,
        error: "Le plan Agent est invalide."
      };
    }
    if (context.plan.length > this.MAX_STEPS) {
      return {
        ok: false,
        error: "Le plan dépasse la limite maximale d'étapes."
      };
    }
    return {
      ok: true
    };
  },
  // --------------------------------------------
  // Enregistre un résultat.
  // --------------------------------------------
  addResult(context, stepId, result) {
    if (!context || typeof context !== "object") {
      throw new Error("Contexte Agent invalide.");
    }
    const entry = {
      stepId: stepId || null,
      ok: result && result.ok !== false,
      result:
        result &&
        Object.prototype.hasOwnProperty.call(result, "result")
          ? result.result
          : result,
      error:
        result && result.error
          ? result.error
          : null,
      timestamp: Date.now()
    };
    context.results.push(entry);
    return entry;
  },
  // --------------------------------------------
  // Change l'état.
  // --------------------------------------------
  setState(context, state) {
    if (!context || typeof context !== "object") {
      throw new Error("Contexte Agent invalide.");
    }
    const allowed = Object.values(this.STATES);
    if (!allowed.includes(state)) {
      throw new Error("État Agent inconnu : " + state);
    }
    context.state = state;
    if (
      state === this.STATES.COMPLETED ||
      state === this.STATES.FAILED
    ) {
      context.finishedAt = Date.now();
    }
    return context;
  },
  // --------------------------------------------
  // Retourne l'étape actuelle.
  // --------------------------------------------
  getCurrentStep(context) {
    if (!context || !Array.isArray(context.plan)) {
      return null;
    }
    if (
      context.currentStep < 0 ||
      context.currentStep >= context.plan.length
    ) {
      return null;
    }
    return context.plan[context.currentStep];
  },
  // --------------------------------------------
  // Passe à l'étape suivante.
  // --------------------------------------------
  nextStep(context) {
    if (!context || !Array.isArray(context.plan)) {
      throw new Error("Contexte Agent invalide.");
    }
    if (context.currentStep < context.plan.length) {
      context.currentStep += 1;
    }
    return this.getCurrentStep(context);
  },
  // --------------------------------------------
  // Vérifie si le plan est terminé.
  // --------------------------------------------
  isPlanComplete(context) {
    if (!context || !Array.isArray(context.plan)) {
      return false;
    }
    if (context.plan.length === 0) {
      return false;
    }
    return context.plan.every(function (step) {
      return step.status === "completed";
    });
  },
  // --------------------------------------------
  // Marque une étape terminée.
  // --------------------------------------------
  completeStep(context, stepId, result) {
    if (!context || !Array.isArray(context.plan)) {
      throw new Error("Contexte Agent invalide.");
    }
    const step = context.plan.find(function (item) {
      return item.id === stepId;
    });
    if (!step) {
      throw new Error("Étape introuvable : " + stepId);
    }
    step.status = "completed";
    step.result = result ?? null;
    step.error = null;
    this.addResult(context, stepId, {
      ok: true,
      result: result
    });
    return step;
  },
  // --------------------------------------------
  // Marque une étape échouée.
  // --------------------------------------------
  failStep(context, stepId, error) {
    if (!context || !Array.isArray(context.plan)) {
      throw new Error("Contexte Agent invalide.");
    }
    const step = context.plan.find(function (item) {
      return item.id === stepId;
    });
    if (!step) {
      throw new Error("Étape introuvable : " + stepId);
    }
    const message = String(error || "Erreur inconnue.");
    step.status = "failed";
    step.error = message;
    this.addResult(context, stepId, {
      ok: false,
      error: message
    });
    context.error = message;
    return step;
  },
  // ============================================
  // EXECUTOR
  // ============================================
  // --------------------------------------------
  // Prépare les arguments d'un Tool.
  // --------------------------------------------
  prepareToolArguments(step) {
    if (!step || !step.tool) {
      return step ? step.argument : null;
    }
    // Le Tool météo attend un objet contenant
    // la localisation dans "city".
    //
    // Exemple :
    // "Paris"
    //
    // devient :
    // { city: "Paris" }
    if (step.tool === "meteo") {
      return {
        city: String(step.argument || "").trim()
      };
    }
    // Pour les autres Tools, on conserve
    // l'argument existant.
    return step.argument;
  },
  // --------------------------------------------
  // Exécute un outil NEXA.
  // --------------------------------------------
  async executeTool(step) {
    if (
      typeof NexaTools === "undefined" ||
      typeof NexaTools.run !== "function"
    ) {
      return {
        ok: false,
        error: "NexaTools n'est pas disponible."
      };
    }
    if (!step || !step.tool) {
      return {
        ok: false,
        error: "Cette étape ne possède aucun outil à exécuter."
      };
    }
    try {
      const argumentsForTool =
        this.prepareToolArguments(step);
      const result = await NexaTools.run(
        step.tool,
        argumentsForTool
      );
      if (!result || typeof result !== "object") {
        return {
          ok: false,
          error: "Le Tool a renvoyé une réponse invalide."
        };
      }
      return result;
    } catch (error) {
      return {
        ok: false,
        error:
          error && error.message
            ? error.message
            : String(error)
      };
    }
  },
  // --------------------------------------------
  // Exécute le plan étape par étape.
  // --------------------------------------------
  async executePlan(context) {
    const validation = this.validateContext(context);
    if (!validation.ok) {
      context.state = this.STATES.FAILED;
      context.error = validation.error;
      context.finishedAt = Date.now();
      return context;
    }
    this.setState(
      context,
      this.STATES.EXECUTING
    );
    for (
      let index = 0;
      index < context.plan.length;
      index += 1
    ) {
      const step = context.plan[index];
      context.currentStep = index;
      if (step.status === "completed") {
        continue;
      }
      // Une étape sans Tool est traitée
      // par le Verifier / Finalizer.
      if (!step.tool) {
        break;
      }
      step.status = "executing";
      const result =
        await this.executeTool(step);
      if (!result || result.ok === false) {
        this.failStep(
          context,
          step.id,
          result && result.error
            ? result.error
            : "Échec de l'exécution du Tool."
        );
        this.setState(
          context,
          this.STATES.FAILED
        );
        return context;
      }
      this.completeStep(
        context,
        step.id,
        result.result
      );
    }
    return context;
  },
  // ============================================
  // VERIFIER
  // ============================================
  // --------------------------------------------
  // Vérifie qu'un résultat individuel est valide.
  // --------------------------------------------
  verifyResult(result) {
    if (!result) {
      return {
        ok: false,
        error: "Aucun résultat fourni."
      };
    }
    if (result.ok === false) {
      return {
        ok: false,
        error:
          result.error ||
          "Le résultat indique une erreur."
      };
    }
    if (
      !Object.prototype.hasOwnProperty.call(
        result,
        "result"
      )
    ) {
      return {
        ok: false,
        error:
          "Le résultat ne contient aucune donnée."
      };
    }
    if (
      result.result === null ||
      result.result === undefined ||
      result.result === ""
    ) {
      return {
        ok: false,
        error:
          "Le Tool a retourné une donnée vide."
      };
    }
    return {
      ok: true,
      result: result.result
    };
  },
  // --------------------------------------------
  // Vérifie les résultats d'une exécution.
  // --------------------------------------------
  verifyExecution(context) {
    if (!context || typeof context !== "object") {
      return {
        ok: false,
        error: "Contexte Agent invalide."
      };
    }
    if (!Array.isArray(context.results)) {
      return {
        ok: false,
        error: "Les résultats Agent sont invalides."
      };
    }
    const failedResults =
      context.results.filter(
        function (entry) {
          return entry.ok === false;
        }
      );
    if (failedResults.length > 0) {
      return {
        ok: false,
        error:
          failedResults[0].error ||
          "Une étape de l'exécution a échoué."
      };
    }
    const completedSteps =
      context.plan.filter(
        function (step) {
          return step.status === "completed";
        }
      );
    if (completedSteps.length === 0) {
      return {
        ok: false,
        error:
          "Aucun résultat exploitable n'a été obtenu."
      };
    }
    // Toutes les étapes possédant un Tool doivent
    // avoir un résultat valide.
    for (const step of completedSteps) {
      if (!step.tool) {
        continue;
      }
      const matchingResult =
        context.results.find(
          function (entry) {
            return entry.stepId === step.id;
          }
        );
      const verification =
        this.verifyResult(matchingResult);
      if (!verification.ok) {
        return {
          ok: false,
          error:
            "Résultat invalide pour l'étape " +
            step.id +
            " : " +
            verification.error
        };
      }
    }
    return {
      ok: true,
      completedSteps:
        completedSteps.length,
      totalResults:
        context.results.length
    };
  },
  // ============================================
  // FINALIZER
  // ============================================
  // --------------------------------------------
  // Convertit une donnée en texte sans
  // inventer sa structure.
  // --------------------------------------------
  formatResult(result) {
    if (
      result === null ||
      result === undefined
    ) {
      return "";
    }
    if (typeof result === "string") {
      return result;
    }
    if (
      typeof result === "number" ||
      typeof result === "boolean"
    ) {
      return String(result);
    }
    try {
      return JSON.stringify(
        result,
        null,
        2
      );
    } catch (error) {
      return String(result);
    }
  },
  // --------------------------------------------
  // Construit une réponse finale à partir
  // des résultats réellement obtenus.
  // --------------------------------------------
  buildFinalAnswer(context) {
    if (
      !context ||
      !Array.isArray(context.results)
    ) {
      return null;
    }
    const successfulResults =
      context.results.filter(
        function (entry) {
          return (
            entry.ok !== false &&
            entry.result !== null &&
            entry.result !== undefined
          );
        }
      );
    if (successfulResults.length === 0) {
      return null;
    }
    // Cas d'un seul résultat.
    if (successfulResults.length === 1) {
      return this.formatResult(
        successfulResults[0].result
      );
    }
    // Plusieurs résultats :
    // on les conserve tous dans l'ordre
    // d'exécution afin que la prochaine couche
    // puisse les interpréter.
    const lines =
      successfulResults.map(
        function (entry, index) {
          return (
            "Résultat " +
            (index + 1) +
            " : " +
            this.formatResult(
              entry.result
            )
          );
        }.bind(this)
      );
    return lines.join("\n\n");
  },
  // --------------------------------------------
  // Vérifie puis finalise l'exécution.
  // --------------------------------------------
  async verifyAndFinalize(context) {
    this.setState(
      context,
      this.STATES.VERIFYING
    );
    const verification =
      this.verifyExecution(context);
    if (!verification.ok) {
      context.error =
        verification.error;
      this.setState(
        context,
        this.STATES.FAILED
      );
      return context;
    }
    const finalAnswer =
      this.buildFinalAnswer(context);
    if (!finalAnswer) {
      context.error =
        "Impossible de construire une réponse finale.";
      this.setState(
        context,
        this.STATES.FAILED
      );
      return context;
    }
    context.finalAnswer =
      finalAnswer;
    // Le plan peut contenir une dernière étape
    // sans Tool, par exemple :
    // "Comparer les résultats météo obtenus".
    //
    // Elle n'est pas encore marquée completed ici
    // tant qu'une logique spécialisée n'existe pas.
    if (this.isPlanComplete(context)) {
      this.setState(
        context,
        this.STATES.COMPLETED
      );
    } else {
      this.setState(
        context,
        this.STATES.VERIFYING
      );
    }
    return context;
  },
  // ============================================
  // PREPARE
  // ============================================
  // --------------------------------------------
  // Prépare une exécution.
  // --------------------------------------------
  prepare(message, objective, plan) {
    const context =
      this.createContext(message);
    const agentObjective =
      objective &&
      String(objective).trim()
        ? String(objective).trim()
        : context.input;
    this.setObjective(
      context,
      agentObjective
    );
    const generatedPlan =
      Array.isArray(plan) &&
      plan.length > 0
        ? plan
        : this.createPlan(
            agentObjective
          );
    this.setPlan(
      context,
      generatedPlan
    );
    const validation =
      this.validateContext(context);
    if (!validation.ok) {
      context.state =
        this.STATES.FAILED;
      context.error =
        validation.error;
      context.finishedAt =
        Date.now();
      return context;
    }
    context.state =
      this.STATES.PLANNING;
    return context;
  },
  // ============================================
  // RUN
  // ============================================
  // --------------------------------------------
  // Point d'entrée complet :
  // Prepare → Execute → Verify → Finalize
  // --------------------------------------------
  async run(message, objective, plan) {
    const context =
      this.prepare(
        message,
        objective,
        plan
      );
    if (
      context.state ===
      this.STATES.FAILED
    ) {
      return context;
    }
    await this.executePlan(
      context
    );
    if (
      context.state ===
      this.STATES.FAILED
    ) {
      return context;
    }
    return await this.verifyAndFinalize(
      context
    );
  },
  // --------------------------------------------
  // Retourne une copie du contexte.
  // --------------------------------------------
  snapshot(context) {
    if (
      !context ||
      typeof context !== "object"
    ) {
      return null;
    }
    return JSON.parse(
      JSON.stringify(context)
    );
  }
};
console.log(
  "NexaAgent v" +
    NexaAgent.version +
    " chargé. Planner + Executor + Verifier + Finalizer prêts."
);
