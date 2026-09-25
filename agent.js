// ============================================
// NEXA AGENT - version 0.2
// Socle du futur Agent autonome de NEXA.
//
// Rôle actuel :
// - créer un contexte d'exécution
// - définir un objectif
// - créer un plan
// - stocker un plan
// - suivre les étapes
// - stocker les résultats
// - gérer l'état de l'exécution
//
// IMPORTANT :
// Cette version ne modifie encore aucun comportement
// existant de NEXA et n'exécute pas encore les Tools.
// ============================================
const NexaAgent = {
  version: "0.2",
  // Nombre maximum d'étapes autorisées pour une exécution.
  MAX_STEPS: 10,
  // États possibles d'une exécution.
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
  // Génère un identifiant simple pour une exécution.
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
  // Définit l'objectif de l'exécution.
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
  // Crée un premier plan local à partir d'un objectif.
  // --------------------------------------------
  createPlan(objective) {
    const text = String(objective || "").trim();
    if (!text) {
      return [];
    }
    // ------------------------------------------
    // Comparaison de plusieurs villes.
    // Exemple :
    // "Compare la météo de Paris et Lyon"
    // ------------------------------------------
    const weatherCities = this.extractWeatherCities(text);
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
    // Demande contenant plusieurs actions explicites.
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
    // ------------------------------------------
    // Une seule étape.
    // ------------------------------------------
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
  // Extrait les villes présentes dans une demande
  // météo.
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
        status: "pending",
        result: null,
        error: null
      };
    });
    context.plan = normalizedPlan;
    context.currentStep = 0;
    return context;
  },
  // --------------------------------------------
  // Valide la structure d'un contexte.
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
  // Enregistre le résultat d'une étape.
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
  // Change l'état de l'exécution.
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
  // Retourne l'étape actuellement sélectionnée.
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
  // Vérifie si toutes les étapes sont terminées.
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
  // Marque une étape comme terminée.
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
  // Marque une étape comme échouée.
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
  // --------------------------------------------
  // Prépare une exécution Agent.
  //
  // CORRECTION v0.2 :
  // Si objective n'est pas fourni, la demande
  // utilisateur devient automatiquement l'objectif.
  // --------------------------------------------
  prepare(message, objective, plan) {
    const context = this.createContext(message);
    // Si aucun objectif explicite n'est fourni,
    // on utilise directement la demande utilisateur.
    const agentObjective =
      objective && String(objective).trim()
        ? String(objective).trim()
        : context.input;
    this.setObjective(context, agentObjective);
    const generatedPlan =
      Array.isArray(plan) && plan.length > 0
        ? plan
        : this.createPlan(agentObjective);
    this.setPlan(context, generatedPlan);
    const validation = this.validateContext(context);
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
  // Retourne une copie exploitable du contexte.
  // --------------------------------------------
  snapshot(context) {
    if (!context || typeof context !== "object") {
      return null;
    }
    return JSON.parse(JSON.stringify(context));
  }
};
console.log(
  "NexaAgent v" +
    NexaAgent.version +
    " chargé. Planner local prêt."
);
