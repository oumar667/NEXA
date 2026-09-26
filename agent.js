// ============================================
// NEXA AGENT - version 0.6
// Planner + Executor + Verifier + Finalizer
// + Comparison Engine
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
// - comparer les résultats
// - construire une réponse finale
// - gérer l'état de l'exécution
//
// IMPORTANT :
// Cette version :
// - conserve la liste dynamique des localisations météo
// - conserve le passage correct des arguments météo
// - conserve Planner + Executor + Verifier + Finalizer
// - ajoute un moteur générique de comparaison
// ============================================

const NexaAgent = {
  version: "0.6",

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

    locationsText = locationsText
      .replace(
        /\s+(?:aujourd'hui|aujourd’hui|demain|ce soir|maintenant)$/i,
        ""
      )
      .trim();

    if (!locationsText) {
      return [];
    }

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

    if (step.tool === "meteo") {
      return {
        city: String(step.argument || "").trim()
      };
    }

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

  // ============================================
  // COMPARISON ENGINE
  // ============================================

  // --------------------------------------------
  // Détecte si une étape correspond à une
  // demande de comparaison.
  // --------------------------------------------
  isComparisonStep(step) {
    if (!step || step.tool) {
      return false;
    }

    const action = String(step.action || "").trim();

    return /compar|compare|comparer|différence|difference|écart|ecart/i.test(
      action
    );
  },

  // --------------------------------------------
  // Convertit une valeur en texte exploitable.
  // --------------------------------------------
  normalizeComparisonText(value) {
    if (value === null || value === undefined) {
      return "";
    }

    if (typeof value === "string") {
      return value.trim();
    }

    if (
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      return String(value);
    }

    try {
      return JSON.stringify(value);
    } catch (error) {
      return String(value);
    }
  },

  // --------------------------------------------
  // Extrait les valeurs numériques d'un résultat.
  //
  // Exemples :
  // "22 °C"       -> 22
  // "22°C"        -> 22
  // "17 degrés"   -> 17
  // { temperature: 22 } -> 22
  // --------------------------------------------
  extractNumericValues(value) {
    const values = [];

    if (
      value !== null &&
      value !== undefined &&
      typeof value === "object"
    ) {
      const keys = [
        "temperature",
        "temp",
        "value",
        "current",
        "current_temperature"
      ];

      for (const key of keys) {
        if (
          Object.prototype.hasOwnProperty.call(
            value,
            key
          )
        ) {
          const numeric = Number(value[key]);

          if (Number.isFinite(numeric)) {
            values.push(numeric);
          }
        }
      }

      if (values.length > 0) {
        return values;
      }
    }

    const text =
      this.normalizeComparisonText(value);

    if (!text) {
      return [];
    }

    const matches = text.match(
      /[-+]?\d+(?:[.,]\d+)?/g
    );

    if (!matches) {
      return [];
    }

    matches.forEach(function (match) {
      const numeric = Number(
        match.replace(",", ".")
      );

      if (Number.isFinite(numeric)) {
        values.push(numeric);
      }
    });

    return values;
  },

  // --------------------------------------------
  // Cherche une unité commune.
  // --------------------------------------------
  extractComparisonUnit(value) {
    const text =
      this.normalizeComparisonText(value);

    if (!text) {
      return null;
    }

    const unitMatch = text.match(
      /(?:°\s*[CF]|%|km\/h|km|m|kg|g|€|\$|£|h|min|s|degr(?:é|e)s?)/i
    );

    if (!unitMatch) {
      return null;
    }

    return unitMatch[0];
  },

  // --------------------------------------------
  // Extrait un nom de localisation depuis un
  // résultat météo textuel.
  //
  // Exemple :
  // "Météo à Paris (Île-de-France, France) : 22 °C"
  // -> "Paris"
  // --------------------------------------------
  extractComparisonLabel(value) {
    if (
      value !== null &&
      value !== undefined &&
      typeof value === "object"
    ) {
      const keys = [
        "city",
        "name",
        "location",
        "place"
      ];

      for (const key of keys) {
        if (
          Object.prototype.hasOwnProperty.call(
            value,
            key
          ) &&
          value[key]
        ) {
          return String(value[key]).trim();
        }
      }
    }

    const text =
      this.normalizeComparisonText(value);

    if (!text) {
      return "Résultat";
    }

    const weatherMatch = text.match(
      /(?:météo|meteo)\s+(?:à|a|de|du)\s+([^(,:]+?)(?:\s*\(|\s*:|$)/i
    );

    if (weatherMatch && weatherMatch[1]) {
      return weatherMatch[1].trim();
    }

    return "Résultat";
  },

  // --------------------------------------------
  // Compare deux résultats numériques.
  // --------------------------------------------
  compareNumericResults(first, second) {
    const firstValues =
      this.extractNumericValues(first.result);

    const secondValues =
      this.extractNumericValues(second.result);

    if (
      firstValues.length === 0 ||
      secondValues.length === 0
    ) {
      return {
        ok: false,
        error: "Aucune valeur numérique comparable trouvée."
      };
    }

    const firstValue = firstValues[0];
    const secondValue = secondValues[0];

    const difference =
      secondValue - firstValue;

    const absoluteDifference =
      Math.abs(difference);

    const firstLabel =
      this.extractComparisonLabel(
        first.result
      );

    const secondLabel =
      this.extractComparisonLabel(
        second.result
      );

    const unit =
      this.extractComparisonUnit(
        first.result
      ) ||
      this.extractComparisonUnit(
        second.result
      );

    let relation;

    if (difference > 0) {
      relation =
        secondLabel +
        " est supérieur à " +
        firstLabel;
    } else if (difference < 0) {
      relation =
        secondLabel +
        " est inférieur à " +
        firstLabel;
    } else {
      relation =
        firstLabel +
        " et " +
        secondLabel +
        " ont la même valeur";
    }

    const formattedDifference =
      Number.isInteger(absoluteDifference)
        ? String(absoluteDifference)
        : absoluteDifference.toFixed(1);

    let comparisonText = relation;

    if (absoluteDifference > 0) {
      comparisonText +=
        " de " +
        formattedDifference +
        (unit ? " " + unit : "");
    } else {
      comparisonText += ".";
    }

    return {
      ok: true,
      type: "numeric",
      first: {
        stepId: first.stepId,
        label: firstLabel,
        value: firstValue,
        unit: unit
      },
      second: {
        stepId: second.stepId,
        label: secondLabel,
        value: secondValue,
        unit: unit
      },
      difference: difference,
      absoluteDifference: absoluteDifference,
      text: comparisonText
    };
  },

  // --------------------------------------------
  // Compare les résultats disponibles.
  // --------------------------------------------
  compareResults(context) {
    if (
      !context ||
      !Array.isArray(context.results)
    ) {
      return {
        ok: false,
        error: "Résultats Agent invalides."
      };
    }

    const successfulResults =
      context.results.filter(function (entry) {
        return (
          entry &&
          entry.ok !== false &&
          entry.stepId &&
          entry.result !== null &&
          entry.result !== undefined &&
          entry.result !== ""
        );
      });

    if (successfulResults.length < 2) {
      return {
        ok: false,
        error:
          "Au moins deux résultats exploitables sont nécessaires pour effectuer une comparaison."
      };
    }

    const comparisons = [];

    for (
      let index = 0;
      index < successfulResults.length - 1;
      index += 1
    ) {
      const first =
        successfulResults[index];

      const second =
        successfulResults[index + 1];

      const comparison =
        this.compareNumericResults(
          first,
          second
        );

      if (comparison.ok) {
        comparisons.push(comparison);
      }
    }

    if (comparisons.length === 0) {
      return {
        ok: false,
        error:
          "Les résultats disponibles ne contiennent pas de valeurs numériques comparables."
      };
    }

    const texts =
      comparisons.map(function (comparison) {
        return comparison.text;
      });

    return {
      ok: true,
      type: "comparison",
      comparisons: comparisons,
      text: texts.join("\n")
    };
  },

  // --------------------------------------------
  // Exécute une étape de comparaison.
  // --------------------------------------------
  executeComparisonStep(context, step) {
    if (!this.isComparisonStep(step)) {
      return {
        ok: false,
        error:
          "Cette étape n'est pas une étape de comparaison."
      };
    }

    return this.compareResults(context);
  },

  // --------------------------------------------
  // Exécute le plan étape par étape.
  // --------------------------------------------
  async executePlan(context) {
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

    this.setState(
      context,
      this.STATES.EXECUTING
    );

    for (
      let index = 0;
      index < context.plan.length;
      index += 1
    ) {
      const step =
        context.plan[index];

      context.currentStep =
        index;

      if (step.status === "completed") {
        continue;
      }

      // ----------------------------------------
      // Nouvelle logique :
      // une étape sans Tool peut être une étape
      // de comparaison.
      // ----------------------------------------
      if (!step.tool) {
        if (this.isComparisonStep(step)) {
          step.status = "executing";

          const comparisonResult =
            this.executeComparisonStep(
              context,
              step
            );

          if (
            !comparisonResult ||
            comparisonResult.ok === false
          ) {
            this.failStep(
              context,
              step.id,
              comparisonResult &&
              comparisonResult.error
                ? comparisonResult.error
                : "Échec de la comparaison."
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
            comparisonResult
          );

          continue;
        }

        // Une étape sans Tool qui n'est pas
        // une comparaison reste gérée par
        // le Verifier / Finalizer.
        break;
      }

      step.status = "executing";

      const result =
        await this.executeTool(step);

      if (
        !result ||
        result.ok === false
      ) {
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

    for (const step of completedSteps) {
      const matchingResult =
        context.results.find(
          function (entry) {
            return entry.stepId === step.id;
          }
        );

      if (!matchingResult) {
        return {
          ok: false,
          error:
            "Aucun résultat trouvé pour l'étape " +
            step.id +
            "."
        };
      }

      // ----------------------------------------
      // Vérification d'une étape de comparaison.
      // ----------------------------------------
      if (this.isComparisonStep(step)) {
        const comparison =
          matchingResult.result;

        if (
          !comparison ||
          typeof comparison !== "object" ||
          comparison.ok !== true ||
          comparison.type !== "comparison" ||
          typeof comparison.text !== "string" ||
          !comparison.text.trim()
        ) {
          return {
            ok: false,
            error:
              "Le résultat de comparaison de l'étape " +
              step.id +
              " est invalide."
          };
        }

        continue;
      }

      if (!step.tool) {
        continue;
      }

      const verification =
        this.verifyResult(
          matchingResult
        );

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
  // Convertit une donnée en texte.
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

    // Une comparaison possède déjà une réponse
    // lisible. On ne renvoie pas tout son objet JSON.
    if (
      typeof result === "object" &&
      result.type === "comparison" &&
      typeof result.text === "string"
    ) {
      return result.text;
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
  // Construit une réponse finale.
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

    // ----------------------------------------
    // Si une comparaison existe, elle devient
    // la conclusion principale.
    // ----------------------------------------
    const comparisonResults =
      successfulResults.filter(
        function (entry) {
          return (
            entry.result &&
            typeof entry.result === "object" &&
            entry.result.type === "comparison" &&
            typeof entry.result.text === "string"
          );
        }
      );

    if (comparisonResults.length > 0) {
      const comparison =
        comparisonResults[
          comparisonResults.length - 1
        ];

      const originalResults =
        successfulResults.filter(
          function (entry) {
            return (
              !entry.result ||
              typeof entry.result !== "object" ||
              entry.result.type !== "comparison"
            );
          }
        );

      const lines =
        originalResults.map(
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

      lines.push(
        "Comparaison : " +
          this.formatResult(
            comparison.result
          )
      );

      return lines.join("\n\n");
    }

    // ----------------------------------------
    // Cas d'un seul résultat.
    // ----------------------------------------
    if (successfulResults.length === 1) {
      return this.formatResult(
        successfulResults[0].result
      );
    }

    // ----------------------------------------
    // Plusieurs résultats sans comparaison.
    // ----------------------------------------
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
    " chargé. Planner + Executor + Verifier + Finalizer + Comparison Engine prêts."
);