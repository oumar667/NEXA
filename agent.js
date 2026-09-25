// ============================================
// NEXA AGENT - version 0.3
// Planner + Executor
//
// Rôle actuel :
// - créer un contexte d'exécution
// - définir un objectif
// - créer un plan
// - stocker un plan
// - suivre les étapes
// - exécuter les Tools
// - stocker les résultats
// - gérer l'état de l'exécution
//
// IMPORTANT :
// Cette version ajoute l'Executor.
// Elle n'est pas encore connectée automatiquement
// au Brain pour les exécutions multi-étapes.
// ============================================
const NexaAgent = {
  version: "0.3",
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
    const weatherCities = this.extractWeatherCities(text);
    // ------------------------------------------
    // Exemple :
    // "Compare la météo de Paris et Lyon"
    // ------------------------------------------
    if (weatherCities.length >= 2) {
      const plan = [];
      weatherCities
        .slice(0, this.MAX_STEPS - 1)
        .forEach((city, index) => {
          plan.push({
            id: "step-" + (index + 1),
            action: "Obtenir la météo de " + city,
            tool: "meteo",
            argument: city
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
  // Extrait les villes météo connues.
  // --------------------------------------------
  extractWeatherCities(text) {
    const knownCities = [
      "Paris",
      "Lyon",
      "Marseille",
      "Toulouse",
      "Nice",
      "Nantes",
      "Strasbourg",
      "Montpellier",
      "Bordeaux",
      "Lille",
      "Rennes",
      "Grenoble",
      "Saint-Louis",
      "Mulhouse",
      "Colmar",
      "Nancy",
      "Metz"
    ];
    const found = [];
    knownCities.forEach(function (city) {
      const pattern = new RegExp(
        "\\b" +
          city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
          "\\b",
        "i"
      );
      if (pattern.test(text)) {
        found.push(city);
      }
    });
    return found;
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
  // Exécute un outil NEXA.
  //
  // Cette fonction ne connaît pas les détails
  // internes des Tools.
  // Elle passe simplement par NexaTools.run().
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
      const result = await NexaTools.run(
        step.tool,
        step.argument
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
  //
  // Pour cette version :
  // - les étapes possédant un Tool sont exécutées ;
  // - les étapes sans Tool restent en attente.
  //
  // C'est volontaire :
  // l'étape "Comparer..." nécessitera le futur
  // Verifier / Finalizer.
  // --------------------------------------------
  async executePlan(context) {
    const validation = this.validateContext(context);
    if (!validation.ok) {
      context.state = this.STATES.FAILED;
      context.error = validation.error;
      context.finishedAt = Date.now();
      return context;
    }
    this.setState(context, this.STATES.EXECUTING);
    for (
      let index = 0;
      index < context.plan.length;
      index += 1
    ) {
      const step = context.plan[index];
      context.currentStep = index;
      // Étape déjà terminée : on ne la rejoue pas.
      if (step.status === "completed") {
        continue;
      }
      // Une étape sans Tool ne peut pas encore être
      // exécutée automatiquement.
      if (!step.tool) {
        break;
      }
      step.status = "executing";
      const result = await this.executeTool(step);
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
    // Si toutes les étapes sont terminées,
    // l'exécution peut être considérée comme complète.
    if (this.isPlanComplete(context)) {
      this.setState(
        context,
        this.STATES.COMPLETED
      );
    }
    return context;
  },
  // --------------------------------------------
  // Prépare une exécution.
  // --------------------------------------------
  prepare(message, objective, plan) {
    const context = this.createContext(message);
    const agentObjective =
      objective && String(objective).trim()
        ? String(objective).trim()
        : context.input;
    this.setObjective(
      context,
      agentObjective
    );
    const generatedPlan =
      Array.isArray(plan) && plan.length > 0
        ? plan
        : this.createPlan(agentObjective);
    this.setPlan(
      context,
      generatedPlan
    );
    const validation =
      this.validateContext(context);
    if (!validation.ok) {
      context.state = this.STATES.FAILED;
      context.error = validation.error;
      context.finishedAt = Date.now();
      return context;
    }
    context.state = this.STATES.PLANNING;
    return context;
  },
  // --------------------------------------------
  // Point d'entrée complet :
  // prépare puis exécute le plan.
  //
  // Cette fonction sera utilisée par le Brain
  // à l'étape suivante.
  // --------------------------------------------
  async run(message, objective, plan) {
    const context = this.prepare(
      message,
      objective,
      plan
    );
    if (context.state === this.STATES.FAILED) {
      return context;
    }
    return await this.executePlan(context);
  },
  // --------------------------------------------
  // Retourne une copie du contexte.
  // --------------------------------------------
  snapshot(context) {
    if (!context || typeof context !== "object") {
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
    " chargé. Planner + Executor prêts."
);
