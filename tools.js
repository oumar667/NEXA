// ============================================
// NEXA TOOLS - version 0.7
// Les capacités de NEXA.
// Registre d'outils : heure, date, calcul,
// météo, Wikipédia, tâches, chronomètre,
// lecture de fichiers joints.
// ============================================

const NexaTools = {
  version: "0.7",

  // --------------------------------------------
  // LE REGISTRE : la liste des outils disponibles
  // --------------------------------------------
  registry: {},

  register(name, description, handler) {
    this.registry[name] = {
      name: name,
      description: description,
      handler: handler
    };
  },

  async run(name, args) {
    const tool = this.registry[name];

    if (!tool) {
      return {
        ok: false,
        error: "Outil inconnu : " + name
      };
    }

    try {
      const result = await tool.handler(args || {});

      return {
        ok: true,
        result: result
      };
    } catch (e) {
      return {
        ok: false,
        error: "L'outil « " + name + " » a échoué."
      };
    }
  },

  describe() {
    return Object.values(this.registry).map(function (t) {
      return {
        name: t.name,
        description: t.description
      };
    });
  },

  list() {
    return Object.keys(this.registry);
  },

  normalize(str) {
    return (str || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[-'’]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  },

  // --------------------------------------------
  // OUTIL : l'heure
  // --------------------------------------------
  getTime() {
    const now = new Date();

    return now.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit"
    });
  },

  // --------------------------------------------
  // OUTIL : la date
  // --------------------------------------------
  getDate() {
    const now = new Date();

    return now.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  },

  // --------------------------------------------
  // OUTIL : les calculs
  // --------------------------------------------
  calculate(expression) {
    let expr = expression
      .replace(/×/g, "*")
      .replace(/÷/g, "/")
      .replace(/,/g, ".")
      .trim();

    if (!/^[0-9+\-*/().\s]+$/.test(expr)) {
      return null;
    }

    try {
      const result = Function(
        '"use strict"; return (' + expr + ");"
      )();

      if (
        typeof result === "number" &&
        isFinite(result)
      ) {
        return Math.round(result * 1000000) / 1000000;
      }
    } catch (e) {
      // Calcul invalide
    }

    return null;
  },

  // --------------------------------------------
  // OUTIL : la météo
  // Open-Meteo, gratuit, sans clé
  // --------------------------------------------
  weatherCodes: {
    0: "ciel dégagé",
    1: "plutôt dégagé",
    2: "partiellement nuageux",
    3: "ciel couvert",
    45: "brouillard",
    48: "brouillard givrant",
    51: "bruine légère",
    53: "bruine",
    55: "bruine forte",
    56: "bruine verglaçante",
    57: "bruine verglaçante forte",
    61: "pluie faible",
    63: "pluie modérée",
    65: "pluie forte",
    66: "pluie verglaçante",
    67: "pluie verglaçante forte",
    71: "neige faible",
    73: "neige modérée",
    75: "neige forte",
    77: "grains de neige",
    80: "averses faibles",
    81: "averses",
    82: "averses violentes",
    85: "averses de neige",
    86: "fortes averses de neige",
    95: "orage",
    96: "orage avec grêle",
    99: "orage violent avec grêle"
  },

  // --------------------------------------------
  // Analyse d'un lieu
  //
  // Exemples :
  // Saint-Louis
  // Saint-Louis, France
  // Saint-Louis en France
  // Saint-Louis 68300
  // Saint-Louis, 68300
  // --------------------------------------------
  splitPlace(input) {
    const text = (input || "").trim();

    if (!text) {
      return {
        city: "",
        hint: "",
        postalCode: ""
      };
    }

    // Exemple : Saint-Louis, 68300
    const commaPostal = text.match(
      /^(.+?),\s*(\d{5})$/
    );

    if (commaPostal) {
      return {
        city: commaPostal[1].trim(),
        hint: "",
        postalCode: commaPostal[2]
      };
    }

    // Exemple : Saint-Louis 68300
    const endPostal = text.match(
      /^(.+?)\s+(\d{5})$/
    );

    if (endPostal) {
      return {
        city: endPostal[1].trim(),
        hint: "",
        postalCode: endPostal[2]
      };
    }

    // Exemple : Saint-Louis, France
    if (text.includes(",")) {
      const parts = text.split(",");

      return {
        city: parts[0].trim(),
        hint: parts.slice(1).join(" ").trim(),
        postalCode: ""
      };
    }

    // Exemples :
    // Saint-Louis en France
    // Saint-Louis dans le Haut-Rhin
    // Lyon en France
    const match = text.match(
      /^(.+)\s+(?:en|au|aux|dans)\s+(?:(?:le|la|les)\s+|l')?(.+)$/i
    );

    if (match) {
      return {
        city: match[1].trim(),
        hint: match[2].trim(),
        postalCode: ""
      };
    }

    return {
      city: text,
      hint: "",
      postalCode: ""
    };
  },

  // --------------------------------------------
  // Vérifie si un résultat géographique
  // correspond à une indication donnée.
  // --------------------------------------------
  placeMatchesHint(place, hint) {
    const h = this.normalize(hint);

    if (!h) {
      return true;
    }

    // Code pays ISO : FR, US, JP...
    if (
      h.length === 2 &&
      this.normalize(place.country_code) === h
    ) {
      return true;
    }

    if (h.length < 3) {
      return false;
    }

    const fields = [
      place.country,
      place.admin1,
      place.admin2,
      place.admin3,
      place.admin4
    ]
      .filter(Boolean)
      .map(this.normalize.bind(this));

    return fields.some(function (field) {
      return (
        field === h ||
        field.includes(h) ||
        h.includes(field)
      );
    });
  },

  // --------------------------------------------
  // Vérifie un code postal.
  //
  // Open-Meteo peut fournir un tableau
  // "postcodes" selon le résultat.
  // --------------------------------------------
  placeMatchesPostalCode(place, postalCode) {
    if (!postalCode) {
      return false;
    }

    const target = String(postalCode).trim();

    if (!target) {
      return false;
    }

    if (
      Array.isArray(place.postcodes) &&
      place.postcodes.some(function (code) {
        return String(code).trim() === target;
      })
    ) {
      return true;
    }

    return false;
  },

  // --------------------------------------------
  // Recherche géographique Open-Meteo
  // --------------------------------------------
  async findPlaces(name, count) {
    const url =
      "https://geocoding-api.open-meteo.com/v1/search" +
      "?name=" +
      encodeURIComponent(name) +
      "&count=" +
      count +
      "&language=fr&format=json";

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error("geocoding");
    }

    const data = await response.json();

    return data.results || [];
  },

  // --------------------------------------------
  // Retourne les correspondances ayant
  // exactement le même nom.
  // --------------------------------------------
  getExactNameMatches(results, city) {
    const normalizedCity =
      this.normalize(city);

    return results.filter(function (place) {
      return (
        this.normalize(place.name) ===
        normalizedCity
      );
    }, this);
  },

  // --------------------------------------------
  // Génère une description lisible
  // d'un résultat géographique.
  // --------------------------------------------
  describePlace(place) {
    const parts = [];

    if (place.admin1) {
      parts.push(place.admin1);
    }

    if (place.admin2) {
      if (
        this.normalize(place.admin2) !==
        this.normalize(place.admin1)
      ) {
        parts.push(place.admin2);
      }
    }

    if (place.country) {
      parts.push(place.country);
    }

    const location =
      parts.length > 0
        ? " (" + parts.join(", ") + ")"
        : "";

    return (
      (place.name || "Lieu inconnu") +
      location
    );
  },

  // --------------------------------------------
  // Résolution géographique.
  //
  // RÈGLE IMPORTANTE :
  // NEXA ne choisit jamais arbitrairement
  // un lieu lorsqu'il existe plusieurs
  // correspondances pertinentes.
  // --------------------------------------------
  async resolvePlace(input) {
    const parts = this.splitPlace(input);

    if (!parts.city) {
      return {
        type: "empty"
      };
    }

    const results = await this.findPlaces(
      parts.city,
      50
    );

    if (!results.length) {
      return {
        type: "not_found",
        city: parts.city,
        hint: parts.hint,
        postalCode: parts.postalCode
      };
    }

    // ------------------------------------------
    // 1. Code postal explicitement fourni
    // ------------------------------------------
    if (parts.postalCode) {
      const postalMatches = results.filter(
        this.placeMatchesPostalCode.bind(
          this,
          undefined
        )
      );

      // Le bind ci-dessus n'est pas utilisé directement.
      // Recherche explicite pour conserver une logique claire.
      const matchingPostalPlaces =
        results.filter((place) => {
          return this.placeMatchesPostalCode(
            place,
            parts.postalCode
          );
        });

      if (matchingPostalPlaces.length === 1) {
        return {
          type: "resolved",
          place: matchingPostalPlaces[0]
        };
      }

      if (matchingPostalPlaces.length > 1) {
        return {
          type: "ambiguous",
          city: parts.city,
          hint: parts.postalCode,
          candidates: matchingPostalPlaces.slice(0, 5)
        };
      }

      return {
        type: "not_found",
        city: parts.city,
        hint: parts.postalCode,
        postalCode: parts.postalCode
      };
    }

    // ------------------------------------------
    // 2. Pays / région / zone explicitement fourni
    // ------------------------------------------
    if (parts.hint) {
      const hintMatches = results.filter(
        this.placeMatchesHint.bind(
          this
        )
      );

      const exactHintMatches =
        this.getExactNameMatches(
          hintMatches,
          parts.city
        );

      // Une seule correspondance exacte après
      // application de la précision.
      if (exactHintMatches.length === 1) {
        return {
          type: "resolved",
          place: exactHintMatches[0]
        };
      }

      // Plusieurs correspondances restent possibles.
      if (exactHintMatches.length > 1) {
        return {
          type: "ambiguous",
          city: parts.city,
          hint: parts.hint,
          candidates: exactHintMatches.slice(0, 5)
        };
      }

      // Pas de nom exact, mais une seule
      // correspondance avec l'indication fournie.
      if (hintMatches.length === 1) {
        return {
          type: "resolved",
          place: hintMatches[0]
        };
      }

      if (hintMatches.length > 1) {
        return {
          type: "ambiguous",
          city: parts.city,
          hint: parts.hint,
          candidates: hintMatches.slice(0, 5)
        };
      }

      return {
        type: "not_found",
        city: parts.city,
        hint: parts.hint
      };
    }

    // ------------------------------------------
    // 3. Aucun pays/région/code postal fourni
    // ------------------------------------------
    const exactMatches =
      this.getExactNameMatches(
        results,
        parts.city
      );

    // Une seule correspondance exacte :
    // on peut continuer.
    if (exactMatches.length === 1) {
      return {
        type: "resolved",
        place: exactMatches[0]
      };
    }

    // Plusieurs lieux avec exactement le même nom :
    // ON NE CHOISIT PAS.
    if (exactMatches.length > 1) {
      return {
        type: "ambiguous",
        city: parts.city,
        candidates: exactMatches.slice(0, 5)
      };
    }

    // ------------------------------------------
    // Aucun nom exactement identique.
    //
    // Si plusieurs résultats existent, on ne
    // prend pas arbitrairement le premier.
    // ------------------------------------------
    if (results.length > 1) {
      return {
        type: "ambiguous",
        city: parts.city,
        candidates: results.slice(0, 5)
      };
    }

    // Un seul résultat disponible.
    return {
      type: "resolved",
      place: results[0]
    };
  },

  // --------------------------------------------
  // OUTIL : météo
  // --------------------------------------------
  async getWeather(city) {
    const name = (city || "").trim();

    if (!name) {
      return "Pour quelle ville voulez-vous la météo ?";
    }

    try {
      const resolution =
        await this.resolvePlace(name);

      // ------------------------------------------
      // Aucun lieu fourni
      // ------------------------------------------
      if (resolution.type === "empty") {
        return "Pour quelle ville voulez-vous la météo ?";
      }

      // ------------------------------------------
      // Aucun lieu trouvé
      // ------------------------------------------
      if (resolution.type === "not_found") {
        if (resolution.hint) {
          return (
            "Je n'ai pas trouvé « " +
            resolution.city +
            " » avec la précision « " +
            resolution.hint +
            " »."
          );
        }

        return (
          "Je n'ai pas trouvé le lieu « " +
          resolution.city +
          " »."
        );
      }

      // ------------------------------------------
      // Plusieurs lieux possibles
      // ------------------------------------------
      if (resolution.type === "ambiguous") {
        const candidates =
          resolution.candidates || [];

        const descriptions =
          candidates
            .map(
              this.describePlace.bind(this)
            )
            .slice(0, 4);

        let message =
          "Je trouve plusieurs lieux correspondant à « " +
          resolution.city +
          " ». " +
          "Pour éviter de me tromper, précisez le pays, la région ou le code postal.";

        if (descriptions.length) {
          message +=
            "\nExemples trouvés : " +
            descriptions.join(" ; ") +
            ".";
        }

        return message;
      }

      // ------------------------------------------
      // Lieu résolu
      // ------------------------------------------
      const place =
        resolution.place;

      if (!place) {
        return (
          "Je n'ai pas réussi à déterminer ce lieu."
        );
      }

      // ------------------------------------------
      // Requête météo
      // ------------------------------------------
      const weatherUrl =
        "https://api.open-meteo.com/v1/forecast" +
        "?latitude=" +
        place.latitude +
        "&longitude=" +
        place.longitude +
        "&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m" +
        "&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max" +
        "&timezone=auto&forecast_days=1";

      const weatherResponse =
        await fetch(weatherUrl);

      if (!weatherResponse.ok) {
        return (
          "Je n'arrive pas à joindre le service météo pour le moment."
        );
      }

      const w =
        await weatherResponse.json();

      const current = w.current;
      const daily = w.daily;

      if (!current) {
        return (
          "Le service météo n'a pas renvoyé de données."
        );
      }

      const where = [
        place.admin1,
        place.country
      ]
        .filter(Boolean)
        .join(", ");

      const placeName =
        place.name +
        (where
          ? " (" + where + ")"
          : "");

      const condition =
        this.weatherCodes[
          current.weather_code
        ] ||
        "conditions variables";

      let text =
        "Météo à " +
        placeName +
        " : " +
        Math.round(
          current.temperature_2m
        ) +
        " °C" +
        " (ressenti " +
        Math.round(
          current.apparent_temperature
        ) +
        " °C), " +
        condition +
        ". Vent : " +
        Math.round(
          current.wind_speed_10m
        ) +
        " km/h.";

      if (
        daily &&
        daily.temperature_2m_min &&
        daily.temperature_2m_max
      ) {
        text +=
          " Aujourd'hui : min " +
          Math.round(
            daily.temperature_2m_min[0]
          ) +
          " °C, max " +
          Math.round(
            daily.temperature_2m_max[0]
          ) +
          " °C";

        if (
          daily.precipitation_probability_max &&
          daily.precipitation_probability_max[0] !== null &&
          daily.precipitation_probability_max[0] !== undefined
        ) {
          text +=
            ", risque de pluie " +
            daily.precipitation_probability_max[0] +
            " %";
        }

        text += ".";
      }

      return text;
    } catch (e) {
      console.error(
        "NexaTools.getWeather error:",
        e
      );

      return (
        "Impossible de joindre le service météo. Vérifiez votre connexion."
      );
    }
  },

  // --------------------------------------------
  // OUTIL : recherche Wikipédia
  // --------------------------------------------
  async searchWikipedia(query) {
    const q = (query || "").trim();

    if (!q) {
      return (
        "Que voulez-vous que je cherche sur Wikipédia ?"
      );
    }

    try {
      const searchUrl =
        "https://fr.wikipedia.org/w/api.php" +
        "?action=query&list=search&srlimit=1&format=json&formatversion=2&utf8=1&origin=*" +
        "&srsearch=" +
        encodeURIComponent(q);

      const searchResponse =
        await fetch(searchUrl);

      if (!searchResponse.ok) {
        return (
          "Je n'arrive pas à joindre Wikipédia pour le moment."
        );
      }

      const searchData =
        await searchResponse.json();

      const hits =
        searchData.query &&
        searchData.query.search;

      if (!hits || hits.length === 0) {
        return (
          "Je n'ai rien trouvé sur Wikipédia pour « " +
          q +
          " »."
        );
      }

      const title =
        hits[0].title;

      const summaryUrl =
        "https://fr.wikipedia.org/w/api.php" +
        "?action=query&prop=extracts&exintro=1&explaintext=1&exsentences=3" +
        "&redirects=1&format=json&formatversion=2&origin=*" +
        "&titles=" +
        encodeURIComponent(title);

      const summaryResponse =
        await fetch(summaryUrl);

      if (!summaryResponse.ok) {
        return (
          "Je n'arrive pas à lire la page Wikipédia pour le moment."
        );
      }

      const summaryData =
        await summaryResponse.json();

      const pages =
        summaryData.query &&
        summaryData.query.pages;

      const page =
        pages && pages[0];

      let extract =
        page && page.extract
          ? page.extract.trim()
          : "";

      const link =
        "https://fr.wikipedia.org/wiki/" +
        encodeURIComponent(
          title.replace(/ /g, "_")
        );

      if (!extract) {
        return (
          "J'ai trouvé la page « " +
          title +
          " » mais sans résumé disponible.\nSource : " +
          link
        );
      }

      if (extract.length > 700) {
        extract =
          extract.slice(0, 700).trim() +
          "…";
      }

      return (
        "Wikipédia — " +
        title +
        " :\n" +
        extract +
        "\n\nSource : " +
        link
      );
    } catch (e) {
      return (
        "Impossible de joindre Wikipédia. Vérifiez votre connexion."
      );
    }
  },

  // --------------------------------------------
  // OUTIL : la liste de tâches
  // --------------------------------------------
  tasksKey: "tasks",

  loadTasks() {
    if (
      typeof NexaMemory === "undefined"
    ) {
      return null;
    }

    const list =
      NexaMemory.recall(
        this.tasksKey
      );

    return Array.isArray(list)
      ? list
      : [];
  },

  saveTasks(list) {
    if (
      typeof NexaMemory === "undefined"
    ) {
      return false;
    }

    return NexaMemory.remember(
      this.tasksKey,
      list
    );
  },

  formatTasks(list) {
    return list
      .map(function (t, i) {
        return (
          i +
          1 +
          ". " +
          (t.done ? "✅" : "☐") +
          " " +
          t.text
        );
      })
      .join("\n");
  },

  manageTasks(
    action,
    text,
    number
  ) {
    const list =
      this.loadTasks();

    if (list === null) {
      return (
        "Ma mémoire n'est pas encore connectée."
      );
    }

    if (action === "add") {
      let t =
        (text || "")
          .trim()
          .slice(0, 200);

      if (!t) {
        return (
          "Quelle tâche voulez-vous ajouter ?"
        );
      }

      if (list.length >= 50) {
        return (
          "Votre liste est pleine (50 tâches). Terminez ou supprimez-en avant d'en ajouter."
        );
      }

      t =
        t.charAt(0).toUpperCase() +
        t.slice(1);

      list.push({
        text: t,
        done: false,
        created:
          new Date().toISOString()
      });

      this.saveTasks(list);

      return (
        "C'est ajouté : « " +
        t +
        " ». Vous avez " +
        list.length +
        " tâche(s) dans votre liste."
      );
    }

    if (action === "list") {
      if (list.length === 0) {
        return (
          "Votre liste est vide. Dites par exemple : « Ajoute une tâche : appeler le médecin »."
        );
      }

      const remaining =
        list.filter(function (t) {
          return !t.done;
        }).length;

      return (
        "Vos tâches (" +
        remaining +
        " à faire sur " +
        list.length +
        ") :\n" +
        this.formatTasks(list)
      );
    }

    if (action === "clear") {
      const count =
        list.length;

      this.saveTasks([]);

      return (
        "C'est fait. J'ai vidé votre liste (" +
        count +
        " tâche(s) supprimée(s))."
      );
    }

    if (
      action === "done" ||
      action === "delete"
    ) {
      const n =
        Number(number);

      if (
        !Number.isInteger(n) ||
        n < 1 ||
        n > list.length
      ) {
        return (
          "Je ne trouve pas la tâche " +
          number +
          ". Écrivez « Mes tâches » pour voir la liste."
        );
      }

      const task =
        list[n - 1];

      if (action === "done") {
        if (task.done) {
          return (
            "La tâche " +
            n +
            " est déjà terminée : « " +
            task.text +
            " »."
          );
        }

        task.done = true;

        this.saveTasks(list);

        return (
          "Bien joué ! Tâche " +
          n +
          " terminée : « " +
          task.text +
          " »."
        );
      }

      list.splice(n - 1, 1);

      this.saveTasks(list);

      return (
        "C'est supprimé : « " +
        task.text +
        " ». Il reste " +
        list.length +
        " tâche(s)."
      );
    }

    return (
      "Je ne sais pas faire cette action sur la liste de tâches."
    );
  },

  // --------------------------------------------
  // OUTIL : chronomètre
  // --------------------------------------------
  createChronometer() {
    const id =
      "chrono_" +
      Date.now();

    return (
      '<div style="background:rgba(255,255,255,0.05); padding:12px 16px; border-radius:14px; border:1px solid rgba(255,255,255,0.1); margin-top:8px; display:inline-block; text-align:center;">' +
      '⏱️ <b>Chronomètre NEXA</b><br>' +
      '<span id="' +
      id +
      '" style="font-size:1.4rem; font-weight:bold; font-family:monospace; color:#a78bfa;">00:00:00</span><br>' +
      '<div style="margin-top:8px; display:flex; gap:6px; justify-content:center;">' +
      '<button onclick="startChrono(\'' +
      id +
      '\')" style="padding:4px 10px; background:#4ade80; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">Start</button>' +
      '<button onclick="stopChrono(\'' +
      id +
      '\')" style="padding:4px 10px; background:#f87171; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">Stop</button>' +
      '<button onclick="resetChrono(\'' +
      id +
      '\')" style="padding:4px 10px; background:#9ca3af; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">Reset</button>' +
      "</div>" +
      "</div>"
    );
  },

  // --------------------------------------------
  // OUTIL : lecture d'un fichier joint
  // --------------------------------------------
  async processLocalFile(file) {
    return new Promise((resolve) => {
      const ext =
        (
          file.name.split(".").pop() ||
          ""
        ).toLowerCase();

      const reader =
        new FileReader();

      reader.onerror =
        function () {
          resolve({
            error:
              "Je n'ai pas réussi à lire ce fichier. Réessayez, ou choisissez-en un autre."
          });
        };

      if (
        [
          "txt",
          "json",
          "js",
          "html",
          "css",
          "md",
          "csv"
        ].includes(ext)
      ) {
        reader.onload =
          function (e) {
            resolve({
              name: file.name,
              type: "text",
              content: e.target.result
            });
          };

        reader.readAsText(file);
      } else if (
        [
          "jpg",
          "jpeg",
          "png",
          "gif",
          "webp"
        ].includes(ext)
      ) {
        reader.onload =
          function (e) {
            resolve({
              name: file.name,
              type: "image",
              content: e.target.result
            });
          };

        reader.readAsDataURL(file);
      } else {
        resolve({
          error:
            "Format de fichier non pris en charge (" +
            (ext || "inconnu") +
            ")."
        });
      }
    });
  }
};

// --------------------------------------------
// On déclare les outils dans le registre
// --------------------------------------------

NexaTools.register(
  "heure",
  "Donne l'heure actuelle.",
  function () {
    return NexaTools.getTime();
  }
);

NexaTools.register(
  "date",
  "Donne la date d'aujourd'hui.",
  function () {
    return NexaTools.getDate();
  }
);

NexaTools.register(
  "calcul",
  "Fait un calcul mathématique (argument : expression).",
  function (args) {
    return NexaTools.calculate(
      args.expression || ""
    );
  }
);

NexaTools.register(
  "meteo",
  "Donne la météo d'un lieu (argument : city). Ne choisit jamais arbitrairement entre plusieurs lieux ambigus.",
  function (args) {
    return NexaTools.getWeather(
      args.city || ""
    );
  }
);

NexaTools.register(
  "wikipedia",
  "Cherche un sujet sur Wikipédia et en donne un résumé (argument : query).",
  function (args) {
    return NexaTools.searchWikipedia(
      args.query || ""
    );
  }
);

NexaTools.register(
  "taches",
  "Gère la liste de tâches (arguments : action = add, list, done, delete ou clear ; text ; number).",
  function (args) {
    return NexaTools.manageTasks(
      args.action,
      args.text,
      args.number
    );
  }
);

NexaTools.register(
  "chronometre",
  "Affiche un chronomètre interactif (Start/Stop/Reset).",
  function () {
    return NexaTools.createChronometer();
  }
);
