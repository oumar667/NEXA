// ============================================
// NEXA TOOLS - version 1.0
// Les capacités de NEXA.
// Registre d'outils : heure, date, calcul,
// météo, Wikipédia, tâches, chronomètre,
// lecture de fichiers joints.
// ============================================
const NexaTools = {
  version: "1.1",
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
      console.error("NexaTools error:", e);
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
  // Normalisation spécifique aux noms de lieux.
  //
  // Permet de rapprocher certaines variantes
  // géographiques courantes :
  //
  // Saint-Louis <-> St Louis
  // Sainte-Marie <-> Ste Marie
  // --------------------------------------------
  normalizePlaceName(str) {
    return this.normalize(str)
      .replace(/^st(?=\s|$)/, "saint")
      .replace(/\bst(?=\s)/g, "saint")
      .replace(/^ste(?=\s|$)/, "sainte")
      .replace(/\bste(?=\s)/g, "sainte")
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
      if (typeof result === "number" && isFinite(result)) {
        return Math.round(result * 1000000) / 1000000;
      }
    } catch (e) {
      // Calcul invalide
    }
    return null;
  },
  // --------------------------------------------
  // OUTIL : la météo (Open-Meteo, gratuit)
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
  // Analyse d'un lieu demandé
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

    // ------------------------------------------
    // Virgules explicites
    //
    // Paris, France
    // Paris, Texas
    // Saint-Louis, Haut-Rhin, France
    // Saint-Louis, 68300
    // ------------------------------------------
    if (text.includes(",")) {
      const parts = text
        .split(",")
        .map(function (part) {
          return part.trim();
        })
        .filter(Boolean);

      const city = parts[0] || "";
      const remainingParts = parts.slice(1);
      const postalMatch = text.match(/\b\d{5}\b/);

      const hintParts = remainingParts.filter(function (part) {
        return !/^\d{5}$/.test(part);
      });

      return {
        city: city,
        hint: hintParts.join(", ").trim(),
        postalCode: postalMatch ? postalMatch[0] : ""
      };
    }

    // ------------------------------------------
    // Code postal sans virgule
    //
    // Saint-Louis 68300
    // ------------------------------------------
    const postalMatch = text.match(/\b(\d{5})\b/);

    if (postalMatch) {
      return {
        city: text
          .replace(postalMatch[0], "")
          .replace(/\s+/g, " ")
          .trim(),
        hint: "",
        postalCode: postalMatch[0]
      };
    }

    // ------------------------------------------
    // Prépositions géographiques explicites
    //
    // Paris en France
    // Paris dans le Texas
    // Paris au Texas
    // Paris aux États-Unis
    // ------------------------------------------
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

    // ------------------------------------------
    // Sans virgule ni préposition :
    //
    // On NE découpe PAS ici arbitrairement.
    //
    // La résolution intelligente dans getWeather()
    // essaiera plusieurs séparations possibles
    // et ne conservera qu'une séparation validée
    // par le géocodeur.
    // ------------------------------------------
    return {
      city: text,
      hint: "",
      postalCode: ""
    };
  },

  // --------------------------------------------
  // Normalise une précision géographique
  // --------------------------------------------
  getHintParts(hint) {
    return String(hint || "")
      .split(",")
      .map(function (part) {
        return part.trim();
      })
      .filter(Boolean);
  },

  // --------------------------------------------
  // Produit les regroupements possibles d'une
  // précision écrite sans virgules.
  //
  // Exemple :
  // "Haut-Rhin France"
  //
  // peut être interprété comme :
  // "Haut-Rhin" + "France"
  //
  // ou d'autres regroupements nécessaires.
  // --------------------------------------------
  getHintComponentSets(hint) {
    const source = this.normalize(hint);

    if (!source) {
      return [[]];
    }

    const words = source.split(" ");
    const sets = [];

    function build(parts, index) {
      if (index >= words.length) {
        sets.push(parts.slice());
        return;
      }

      for (
        let end = index + 1;
        end <= words.length;
        end++
      ) {
        parts.push(
          words
            .slice(index, end)
            .join(" ")
        );

        build(parts, end);
        parts.pop();
      }
    }

    build([], 0);

    return sets;
  },

  // --------------------------------------------
  // Vérifie une composante géographique contre
  // les champs disponibles du géocodeur.
  // --------------------------------------------
  placeFieldMatchesComponent(place, component) {
    const normalized =
      this.normalize(component);

    if (!normalized) {
      return true;
    }

    const fields = [
      place.country,
      place.country_code,
      place.admin1,
      place.admin2,
      place.admin3,
      place.admin4
    ]
      .filter(Boolean)
      .map(this.normalize.bind(this));

    if (fields.includes(normalized)) {
      return true;
    }

    return fields.some(function (field) {
      return (
        field.includes(normalized) ||
        normalized.includes(field)
      );
    });
  },

  // --------------------------------------------
  // Vérifie si un lieu correspond à une précision.
  //
  // Fonctionne avec :
  //
  // Haut-Rhin, France
  // Haut-Rhin France
  // Missouri
  // Texas
  // États-Unis
  // --------------------------------------------
  placeMatchesHint(place, hint) {
    const rawHint =
      String(hint || "").trim();

    if (!rawHint) {
      return true;
    }

    const explicitParts =
      this.getHintParts(rawHint);

    if (explicitParts.length > 1) {
      return explicitParts.every(function (part) {
        return this.placeFieldMatchesComponent(
          place,
          part
        );
      }, this);
    }

    const componentSets =
      this.getHintComponentSets(rawHint);

    return componentSets.some(function (components) {
      return components.every(function (component) {
        return this.placeFieldMatchesComponent(
          place,
          component
        );
      }, this);
    }, this);
  },

  // --------------------------------------------
  // Vérifie le code postal
  // --------------------------------------------
  placeMatchesPostalCode(place, postalCode) {
    if (!postalCode) {
      return false;
    }

    const normalizedPostal =
      String(postalCode).trim();

    const fields = [
      place.postcodes,
      place.postal_code,
      place.postalcode
    ].filter(Boolean);

    return fields.some(function (field) {
      return String(field)
        .split(/[,\s;]+/)
        .includes(normalizedPostal);
    });
  },

  // --------------------------------------------
  // Recherche géographique
  // --------------------------------------------
  async findPlaces(name, count) {
    const url =
      "https://geocoding-api.open-meteo.com/v1/search?name=" +
      encodeURIComponent(name) +
      "&count=" +
      count +
      "&language=fr&format=json";

    const response =
      await fetch(url);

    if (!response.ok) {
      const error = new Error(
        "Le service de géocodage a répondu avec une erreur."
      );

      error.code =
        "GEOCODING_HTTP_ERROR";

      throw error;
    }

    const data =
      await response.json();

    if (
      !data ||
      !Array.isArray(data.results)
    ) {
      const error = new Error(
        "Réponse de géocodage invalide."
      );

      error.code =
        "GEOCODING_INVALID_RESPONSE";

      throw error;
    }

    return data.results;
  },

  // --------------------------------------------
  // Recherche géographique sécurisée.
  //
  // Une erreur sur une recherche ne doit pas
  // empêcher les recherches de secours.
  // --------------------------------------------
  async findPlacesSafe(name, count) {
    try {
      return {
        ok: true,
        results:
          await this.findPlaces(
            name,
            count
          )
      };
    } catch (error) {
      console.error(
        "NexaTools geocoding error:",
        error
      );

      return {
        ok: false,
        results: [],
        error: error
      };
    }
  },

  // --------------------------------------------
  // Nom exact d'une ville
  // --------------------------------------------
  getExactNameMatches(results, name) {
    const normalizedName =
      this.normalizePlaceName(name);

    return results.filter(function (place) {
      return (
        this.normalizePlaceName(
          place.name
        ) === normalizedName
      );
    }, this);
  },

  // --------------------------------------------
  // Détermine si un résultat est un lieu principal
  // --------------------------------------------
  isPrimaryPlace(place) {
    const featureCode =
      String(
        place.feature_code || ""
      ).toUpperCase();

    return [
      "PPLC",
      "PPLA",
      "PPLA2",
      "PPLA3",
      "PPLA4"
    ].includes(featureCode);
  },

  // --------------------------------------------
  // Score de confiance géographique
  // --------------------------------------------
  getPlaceConfidence(
    place,
    name,
    results
  ) {
    const normalizedName =
      this.normalizePlaceName(name);

    const normalizedPlaceName =
      this.normalizePlaceName(
        place.name
      );

    let score = 0;

    if (
      normalizedPlaceName ===
      normalizedName
    ) {
      score += 100;
    }

    const index =
      results.indexOf(place);

    if (index === 0) {
      score += 20;
    } else if (index === 1) {
      score += 5;
    }

    if (
      this.isPrimaryPlace(place)
    ) {
      score += 25;
    }

    const population =
      Number(
        place.population || 0
      );

    if (population >= 1000000) {
      score += 40;
    } else if (population >= 500000) {
      score += 30;
    } else if (population >= 100000) {
      score += 20;
    } else if (population >= 50000) {
      score += 10;
    }

    return score;
  },

  // --------------------------------------------
  // Résolution intelligente d'un lieu
  // --------------------------------------------
  resolvePlace(
    results,
    parts
  ) {
    const self = this;

    if (
      !results ||
      results.length === 0
    ) {
      return {
        type: "not_found"
      };
    }

    // ------------------------------------------
    // CAS 1 : code postal explicite
    // ------------------------------------------
    if (parts.postalCode) {
      const postalMatches =
        results.filter(function (place) {
          return self.placeMatchesPostalCode(
            place,
            parts.postalCode
          );
        });

      const exactPostalNameMatches =
        self.getExactNameMatches(
          postalMatches,
          parts.city
        );

      if (
        exactPostalNameMatches.length === 1
      ) {
        return {
          type: "resolved",
          place:
            exactPostalNameMatches[0]
        };
      }

      if (
        postalMatches.length === 1
      ) {
        return {
          type: "resolved",
          place:
            postalMatches[0]
        };
      }

      if (
        postalMatches.length > 1
      ) {
        return {
          type: "ambiguous",
          candidates:
            postalMatches
        };
      }

      return {
        type: "not_found"
      };
    }

    // ------------------------------------------
    // CAS 2 : pays / région explicite
    // ------------------------------------------
    if (parts.hint) {
      const hintMatches =
        results.filter(function (place) {
          return self.placeMatchesHint(
            place,
            parts.hint
          );
        });

      const exactMatches =
        self.getExactNameMatches(
          hintMatches,
          parts.city
        );

      if (
        exactMatches.length === 1
      ) {
        return {
          type: "resolved",
          place:
            exactMatches[0]
        };
      }

      if (
        exactMatches.length > 1
      ) {
        return {
          type: "ambiguous",
          candidates:
            exactMatches
        };
      }

      if (
        hintMatches.length === 1
      ) {
        return {
          type: "resolved",
          place:
            hintMatches[0]
        };
      }

      if (
        hintMatches.length > 1
      ) {
        return {
          type: "ambiguous",
          candidates:
            hintMatches
        };
      }

      return {
        type: "not_found"
      };
    }

    // ------------------------------------------
    // CAS 3 : aucun indice de localisation
    // ------------------------------------------
    const exactMatches =
      self.getExactNameMatches(
        results,
        parts.city
      );

    if (
      exactMatches.length === 1
    ) {
      return {
        type: "resolved",
        place:
          exactMatches[0]
      };
    }

    if (
      exactMatches.length === 0
    ) {
      if (
        results.length === 1
      ) {
        return {
          type: "resolved",
          place:
            results[0]
        };
      }

      return {
        type: "ambiguous",
        candidates:
          results
      };
    }

    const scored =
      exactMatches.map(function (place) {
        return {
          place: place,
          score:
            self.getPlaceConfidence(
              place,
              parts.city,
              exactMatches
            )
        };
      });

    scored.sort(function (a, b) {
      return b.score - a.score;
    });

    const best =
      scored[0];

    const second =
      scored[1];

    if (
      best &&
      (
        !second ||
        best.score -
          second.score >= 35
      )
    ) {
      return {
        type: "resolved",
        place:
          best.place
      };
    }

    return {
      type: "ambiguous",
      candidates:
        exactMatches
    };
  },

  // --------------------------------------------
  // Recherche d'une forme sans virgule.
  //
  // Exemples :
  //
  // Paris Texas
  // Paris France
  // Saint-Louis Missouri
  // Saint-Louis Haut-Rhin France
  // --------------------------------------------
  async resolveUnseparatedPlace(
    text
  ) {
    const source =
      String(text || "")
        .trim()
        .replace(/\s+/g, " ");

    if (!source) {
      return null;
    }

    const words =
      source.split(" ");

    if (
      words.length < 2
    ) {
      return null;
    }

    const resolvedCandidates = [];
    const ambiguousCandidates = [];

    // ------------------------------------------
    // On teste toutes les coupures possibles.
    //
    // Exemple :
    //
    // Saint-Louis Haut-Rhin France
    //
    // peut donner :
    //
    // Saint-Louis + Haut-Rhin France
    // Saint-Louis Haut-Rhin + France
    //
    // Chaque interprétation est ensuite validée
    // par les résultats géographiques réels.
    // ------------------------------------------
    for (
      let cityWordCount = 1;
      cityWordCount < words.length;
      cityWordCount++
    ) {
      const city =
        words
          .slice(
            0,
            cityWordCount
          )
          .join(" ")
          .trim();

      const hint =
        words
          .slice(
            cityWordCount
          )
          .join(" ")
          .trim();

      if (
        !city ||
        !hint
      ) {
        continue;
      }

      // ----------------------------------------
      // Recherche de la ville seule.
      //
      // C'est volontairement la méthode principale :
      // le géocodeur peut parfois mal interpréter
      // "ville + région + pays" comme une seule
      // requête.
      // ----------------------------------------
      const citySearch =
        await this.findPlacesSafe(
          city,
          50
        );

      if (
        !citySearch.ok ||
        !citySearch.results.length
      ) {
        continue;
      }

      const parts = {
        city: city,
        hint: hint,
        postalCode: ""
      };

      const resolution =
        this.resolvePlace(
          citySearch.results,
          parts
        );

      if (
        resolution.type ===
        "resolved"
      ) {
        resolvedCandidates.push({
          parts: parts,
          results:
            citySearch.results,
          resolution:
            resolution
        });
      } else if (
        resolution.type ===
        "ambiguous"
      ) {
        ambiguousCandidates.push({
          parts: parts,
          results:
            citySearch.results,
          resolution:
            resolution
        });
      }
    }

    // ------------------------------------------
    // Une seule interprétation valide.
    // ------------------------------------------
    if (
      resolvedCandidates.length === 1
    ) {
      return resolvedCandidates[0];
    }

    // ------------------------------------------
    // Plusieurs séparations donnent exactement
    // les mêmes coordonnées : c'est le même lieu.
    // ------------------------------------------
    if (
      resolvedCandidates.length > 1
    ) {
      const first =
        resolvedCandidates[0]
          .resolution.place;

      const samePlace =
        resolvedCandidates.every(
          function (item) {
            const place =
              item.resolution.place;

            return (
              Number(
                place.latitude
              ) ===
                Number(
                  first.latitude
                ) &&
              Number(
                place.longitude
              ) ===
                Number(
                  first.longitude
                )
            );
          }
        );

      if (samePlace) {
        return resolvedCandidates[0];
      }

      // Plusieurs lieux différents :
      // NEXA ne choisit pas arbitrairement.
      return {
        parts:
          resolvedCandidates[0].parts,
        results:
          resolvedCandidates[0].results,
        resolution: {
          type: "ambiguous",
          candidates:
            resolvedCandidates.map(
              function (item) {
                return item
                  .resolution
                  .place;
              }
            )
        }
      };
    }

    // ------------------------------------------
    // Pas de résolution unique, mais une
    // interprétation ambiguë existe.
    // ------------------------------------------
    if (
      ambiguousCandidates.length > 0
    ) {
      return ambiguousCandidates[0];
    }

    return null;
  },

  // --------------------------------------------
  // Formate les candidats proposés
  // --------------------------------------------
  formatPlaceCandidates(
    candidates
  ) {
    const self = this;
    const unique = [];

    candidates.forEach(function (place) {
      const key =
        self.normalize(
          place.name
        ) +
        "|" +
        self.normalize(
          place.admin1 || ""
        ) +
        "|" +
        self.normalize(
          place.admin2 || ""
        ) +
        "|" +
        self.normalize(
          place.country || ""
        );

      if (
        !unique.some(function (item) {
          return item.key === key;
        })
      ) {
        unique.push({
          key: key,
          place: place
        });
      }
    });

    return unique
      .slice(0, 5)
      .map(function (
        item,
        index
      ) {
        const place =
          item.place;

        const details = [
          place.admin1,
          place.admin2,
          place.country
        ].filter(Boolean);

        return (
          (index + 1) +
          ". " +
          place.name +
          (
            details.length
              ? " (" +
                details.join(
                  ", "
                ) +
                ")"
              : ""
          )
        );
      })
      .join("\n");
  },

  // --------------------------------------------
  // OUTIL : météo
  // --------------------------------------------
  async getWeather(city) {
    const name =
      (city || "").trim();

    if (!name) {
      return (
        "Pour quelle ville voulez-vous la météo ?"
      );
    }

    try {
      let parts =
        this.splitPlace(name);

      if (!parts.city) {
        return (
          "Pour quelle ville voulez-vous la météo ?"
        );
      }

      let results = [];
      let resolution = null;

      // ----------------------------------------
      // Recherche normale
      // ----------------------------------------
      let searchName =
        parts.city;

      if (parts.hint) {
        searchName =
          parts.city +
          ", " +
          parts.hint;
      }

      // ----------------------------------------
      // Recherche qualifiée sécurisée.
      //
      // Si elle échoue, on passe à la recherche
      // de secours au lieu de considérer cela
      // comme une panne météo.
      // ----------------------------------------
      const qualifiedSearch =
        await this.findPlacesSafe(
          searchName,
          50
        );

      if (qualifiedSearch.ok) {
        results =
          qualifiedSearch.results;

        resolution =
          this.resolvePlace(
            results,
            parts
          );
      } else {
        results = [];
        resolution = {
          type: "not_found"
        };
      }

      // ----------------------------------------
      // FALLBACK 1 :
      // recherche de la ville seule si une
      // précision était fournie.
      //
      // Exemple :
      // Saint-Louis, Missouri
      // Paris, Texas
      // ----------------------------------------
      if (
        resolution.type ===
          "not_found" &&
        parts.hint &&
        !parts.postalCode
      ) {
        const citySearch =
          await this.findPlacesSafe(
            parts.city,
            50
          );

        if (
          citySearch.ok
        ) {
          results =
            citySearch.results;

          resolution =
            this.resolvePlace(
              results,
              parts
            );
        }
      }

      // ----------------------------------------
      // FALLBACK 2 :
      // aucune virgule / aucune préposition.
      //
      // Exemple :
      // Paris Texas
      // Paris France
      // Saint-Louis Missouri
      // Saint-Louis Haut-Rhin France
      // ----------------------------------------
      if (
        resolution.type ===
          "not_found" &&
        !parts.hint &&
        !parts.postalCode &&
        /\s/.test(name)
      ) {
        const parsed =
          await this.resolveUnseparatedPlace(
            name
          );

        if (parsed) {
          parts =
            parsed.parts;

          results =
            parsed.results;

          resolution =
            parsed.resolution;
        }
      }

      // ----------------------------------------
      // Lieu introuvable
      // ----------------------------------------
      if (
        resolution.type ===
        "not_found"
      ) {
        if (
          parts.hint ||
          parts.postalCode
        ) {
          return (
            "Je n'ai pas trouvé « " +
            parts.city +
            " » avec la précision demandée."
          );
        }

        return (
          "Je n'ai pas trouvé la ville « " +
          parts.city +
          " »."
        );
      }

      // ----------------------------------------
      // Lieu ambigu
      // ----------------------------------------
      if (
        resolution.type ===
        "ambiguous"
      ) {
        const candidates =
          resolution.candidates ||
          [];

        let message =
          "Je trouve plusieurs lieux possibles pour « " +
          parts.city +
          " ». Lequel voulez-vous ?";

        if (
          candidates.length > 0
        ) {
          message +=
            "\n" +
            this.formatPlaceCandidates(
              candidates
            );
        }

        message +=
          "\n\nVous pouvez aussi préciser le pays, la région ou le code postal.";

        return message;
      }

      // ----------------------------------------
      // Lieu résolu
      // ----------------------------------------
      const place =
        resolution.place;

      const weatherUrl =
        "https://api.open-meteo.com/v1/forecast" +
        "?latitude=" +
        place.latitude +
        "&longitude=" +
        place.longitude +
        "&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m" +
        "&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max" +
        "&timezone=auto&forecast_days=1";

      let weatherResponse;

      try {
        weatherResponse =
          await fetch(
            weatherUrl
          );
      } catch (error) {
        console.error(
          "NexaTools weather connection error:",
          error
        );

        return (
          "Je n'arrive pas à joindre le service météo pour le moment."
        );
      }

      if (
        !weatherResponse.ok
      ) {
        return (
          "Je n'arrive pas à joindre le service météo pour le moment."
        );
      }

      let w;

      try {
        w =
          await weatherResponse.json();
      } catch (error) {
        console.error(
          "NexaTools weather JSON error:",
          error
        );

        return (
          "Le service météo a renvoyé une réponse invalide."
        );
      }

      const current =
        w.current;

      const daily =
        w.daily;

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

      const place_name =
        place.name +
        (
          where
            ? " (" +
              where +
              ")"
            : ""
        );

      const condition =
        this.weatherCodes[
          current.weather_code
        ] ||
        "conditions variables";

      let text =
        "Météo à " +
        place_name +
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
        "Impossible de traiter la demande météo pour le moment."
      );
    }
  },

  // --------------------------------------------
  // OUTIL : recherche Wikipédia
  // --------------------------------------------
  async searchWikipedia(query) {
    const q =
      (query || "").trim();

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
        await fetch(
          searchUrl
        );

      if (
        !searchResponse.ok
      ) {
        return (
          "Je n'arrive pas à joindre Wikipédia pour le moment."
        );
      }

      const searchData =
        await searchResponse.json();

      const hits =
        searchData.query &&
        searchData.query.search;

      if (
        !hits ||
        hits.length === 0
      ) {
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
        encodeURIComponent(
          title
        );

      const summaryResponse =
        await fetch(
          summaryUrl
        );

      if (
        !summaryResponse.ok
      ) {
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
        pages &&
        pages[0];

      let extract =
        page &&
        page.extract
          ? page.extract.trim()
          : "";

      const link =
        "https://fr.wikipedia.org/wiki/" +
        encodeURIComponent(
          title.replace(
            / /g,
            "_"
          )
        );

      if (!extract) {
        return (
          "J'ai trouvé la page « " +
          title +
          " » mais sans résumé disponible.\nSource : " +
          link
        );
      }

      if (
        extract.length > 700
      ) {
        extract =
          extract
            .slice(
              0,
              700
            )
            .trim() +
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
      typeof NexaMemory ===
      "undefined"
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
      typeof NexaMemory ===
      "undefined"
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
      .map(function (
        t,
        i
      ) {
        return (
          (i + 1) +
          ". " +
          (
            t.done
              ? "✅"
              : "☐"
          ) +
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

    if (
      action === "add"
    ) {
      let t =
        (text || "")
          .trim()
          .slice(
            0,
            200
          );

      if (!t) {
        return (
          "Quelle tâche voulez-vous ajouter ?"
        );
      }

      if (
        list.length >= 50
      ) {
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

      this.saveTasks(
        list
      );

      return (
        "C'est ajouté : « " +
        t +
        " ». Vous avez " +
        list.length +
        " tâche(s) dans votre liste."
      );
    }

    if (
      action === "list"
    ) {
      if (
        list.length === 0
      ) {
        return (
          "Votre liste est vide. Dites par exemple : « Ajoute une tâche : appeler le médecin »."
        );
      }

      const remaining =
        list.filter(
          function (t) {
            return !t.done;
          }
        ).length;

      return (
        "Vos tâches (" +
        remaining +
        " à faire sur " +
        list.length +
        ") :\n" +
        this.formatTasks(
          list
        )
      );
    }

    if (
      action === "clear"
    ) {
      const count =
        list.length;

      this.saveTasks(
        []
      );

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

      if (
        action === "done"
      ) {
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

        this.saveTasks(
          list
        );

        return (
          "Bien joué ! Tâche " +
          n +
          " terminée : « " +
          task.text +
          " »."
        );
      }

      list.splice(
        n - 1,
        1
      );

      this.saveTasks(
        list
      );

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
    return new Promise(function (
      resolve
    ) {
      const ext =
        (
          file.name
            .split(".")
            .pop() ||
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
              content:
                e.target.result
            });
          };

        reader.readAsText(
          file
        );

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
              content:
                e.target.result
            });
          };

        reader.readAsDataURL(
          file
        );

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
  "Donne la météo d'une ville (argument : city).",
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
