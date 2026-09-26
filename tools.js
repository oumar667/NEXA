// ============================================
// NEXA TOOLS - version 1.5
// Registre et exécution des outils de NEXA
// ============================================

const NexaTools = {
  version: "1.5",

  // --------------------------------------------
  // REGISTRE
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
    } catch (error) {
      console.error("NexaTools error:", error);

      return {
        ok: false,
        error: "L'outil « " + name + " » a échoué."
      };
    }
  },

  describe() {
    return Object.values(this.registry).map(function (tool) {
      return {
        name: tool.name,
        description: tool.description
      };
    });
  },

  list() {
    return Object.keys(this.registry);
  },

  // --------------------------------------------
  // NORMALISATION GENERALE
  // --------------------------------------------
  normalize(str) {
    return String(str || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[-'’]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  },

  // --------------------------------------------
  // NORMALISATION DES LIEUX
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
  // NORMALISATION DES PAYS
  // --------------------------------------------
  normalizeCountryName(str) {
    const value =
      this.normalizePlaceName(str);

    const aliases = {
      "france": "france",
      "fr": "france",
      "republique francaise": "france",

      "etats unis": "etats unis",
      "etats unis d amerique": "etats unis",
      "usa": "etats unis",
      "us": "etats unis",
      "united states": "etats unis",

      "royaume uni": "royaume uni",
      "uk": "royaume uni",
      "united kingdom": "royaume uni",

      "japon": "japon",
      "japan": "japon",

      "senegal": "senegal",

      "allemagne": "allemagne",
      "germany": "allemagne",

      "suisse": "suisse",
      "switzerland": "suisse",

      "belgique": "belgique",
      "belgium": "belgique"
    };

    return aliases[value] || value;
  },

  // --------------------------------------------
  // CODES PAYS
  // --------------------------------------------
  countryAliases: {
    fr: "france",
    us: "etats unis",
    usa: "etats unis",
    gb: "royaume uni",
    uk: "royaume uni",
    jp: "japon",
    sn: "senegal",
    de: "allemagne",
    ch: "suisse",
    be: "belgique"
  },

  countryCodes: {
    france: "FR",
    "etats unis": "US",
    "royaume uni": "GB",
    japon: "JP",
    senegal: "SN",
    allemagne: "DE",
    suisse: "CH",
    belgique: "BE"
  },

  // --------------------------------------------
  // DETECTION DU CODE PAYS
  // --------------------------------------------
  getCountryCode(country) {
    const normalized =
      this.normalizeCountryName(
        country
      );

    if (!normalized) {
      return "";
    }

    if (
      normalized.length === 2 &&
      /^[a-z]{2}$/i.test(normalized)
    ) {
      return normalized.toUpperCase();
    }

    return (
      this.countryCodes[
        normalized
      ] || ""
    );
  },

  // --------------------------------------------
  // DETECTION DU PAYS DANS UNE PRECISION
  // --------------------------------------------
  getCountryCodeFromHint(hint) {
    const raw =
      String(hint || "").trim();

    if (!raw) {
      return "";
    }

    const parts =
      raw
        .split(",")
        .map(function (part) {
          return part.trim();
        })
        .filter(Boolean);

    for (
      let i = parts.length - 1;
      i >= 0;
      i--
    ) {
      const code =
        this.getCountryCode(
          parts[i]
        );

      if (code) {
        return code;
      }
    }

    const normalized =
      this.normalizePlaceName(
        raw
      );

    const countryNames =
      Object.keys(
        this.countryCodes
      ).sort(function (a, b) {
        return b.length - a.length;
      });

    for (
      let i = 0;
      i < countryNames.length;
      i++
    ) {
      const country =
        countryNames[i];

      if (
        normalized === country ||
        normalized.endsWith(
          " " + country
        )
      ) {
        return this.countryCodes[
          country
        ];
      }
    }

    return "";
  },

  // --------------------------------------------
  // HEURE
  // --------------------------------------------
  getTime() {
    const now = new Date();

    return now.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit"
    });
  },

  // --------------------------------------------
  // DATE
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
  // CALCUL
  // --------------------------------------------
  calculate(expression) {
    let expr = String(expression || "")
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
    } catch (error) {
      // Expression invalide
    }

    return null;
  },

  // --------------------------------------------
  // CODES METEO
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
  // DECOMPOSITION DU LIEU
  // --------------------------------------------
  splitPlace(input) {
    const text = String(input || "")
      .trim();

    if (!text) {
      return {
        city: "",
        hint: "",
        postalCode: ""
      };
    }

    // ------------------------------------------
    // Virgules
    // ------------------------------------------
    if (text.includes(",")) {
      const parts = text
        .split(",")
        .map(function (part) {
          return part.trim();
        })
        .filter(Boolean);

      const city = parts[0] || "";

      const postalMatch =
        text.match(/\b\d{5}\b/);

      const hintParts =
        parts.slice(1).filter(function (part) {
          return !/^\d{5}$/.test(part);
        });

      return {
        city: city,
        hint: hintParts.join(", ").trim(),
        postalCode: postalMatch
          ? postalMatch[0]
          : ""
      };
    }

    // ------------------------------------------
    // Code postal
    // ------------------------------------------
    const postalMatch =
      text.match(/\b(\d{5})\b/);

    if (postalMatch) {
      return {
        city: text
          .replace(postalMatch[0], "")
          .replace(/\s+/g, " ")
          .trim(),

        hint: "",

        postalCode:
          postalMatch[0]
      };
    }

    // ------------------------------------------
    // "en", "au", "aux", "dans"
    // ------------------------------------------
    const geographicMatch =
      text.match(
        /^(.+)\s+(?:en|au|aux|dans)\s+(?:(?:le|la|les)\s+|l')?(.+)$/i
      );

    if (geographicMatch) {
      return {
        city: geographicMatch[1].trim(),
        hint: geographicMatch[2].trim(),
        postalCode: ""
      };
    }

    // ------------------------------------------
    // Forme simple
    // ------------------------------------------
    return {
      city: text,
      hint: "",
      postalCode: ""
    };
  },

  // --------------------------------------------
  // COMPOSANTS DE PRECISION
  // --------------------------------------------
  getHintParts(hint) {
    const raw =
      String(hint || "").trim();

    if (!raw) {
      return [];
    }

    const commaParts =
      raw
        .split(",")
        .map(function (part) {
          return part.trim();
        })
        .filter(Boolean);

    if (
      commaParts.length > 1
    ) {
      return commaParts;
    }

    const normalized =
      this.normalizePlaceName(
        raw
      );

    const countryNames =
      Object.keys(
        this.countryCodes
      ).sort(function (a, b) {
        return b.length - a.length;
      });

    for (
      let i = 0;
      i < countryNames.length;
      i++
    ) {
      const country =
        countryNames[i];

      if (
        normalized === country
      ) {
        return [raw];
      }

      if (
        normalized.endsWith(
          " " + country
        )
      ) {
        const prefix =
          normalized
            .slice(
              0,
              -(
                country.length + 1
              )
            )
            .trim();

        if (prefix) {
          return [
            prefix,
            country
          ];
        }

        return [country];
      }
    }

    return [raw];
  },

  getHintComponentSets(hint) {
    const source =
      this.normalize(hint);

    if (!source) {
      return [[]];
    }

    const words =
      source.split(" ");

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
  // INFORMATIONS GEOGRAPHIQUES
  // --------------------------------------------
  getPlaceFields(place) {
    if (!place) {
      return [];
    }

    return [
      place.name,
      place.country,
      place.country_code,
      place.admin1,
      place.admin2,
      place.admin3,
      place.admin4,
      place.feature_name,
      place.postcodes,
      place.postal_code,
      place.postalcode
    ]
      .filter(function (value) {
        return (
          value !== undefined &&
          value !== null &&
          String(value).trim() !== ""
        );
      })
      .map(function (value) {
        return String(value);
      });
  },

  // --------------------------------------------
  // COMPARAISON GENERIQUE
  // --------------------------------------------
  placeFieldMatchesComponent(
    place,
    component
  ) {
    const normalizedComponent =
      this.normalizePlaceName(component);

    if (!normalizedComponent) {
      return true;
    }

    const fields =
      this.getPlaceFields(place)
        .map(
          this.normalizePlaceName.bind(this)
        );

    if (
      fields.includes(
        normalizedComponent
      )
    ) {
      return true;
    }

    return fields.some(
      function (field) {
        return (
          field.includes(
            normalizedComponent
          ) ||
          normalizedComponent.includes(
            field
          )
        );
      }
    );
  },

  // --------------------------------------------
  // COMPARAISON D'UN PAYS
  // --------------------------------------------
  placeMatchesCountry(
    place,
    country
  ) {
    if (!country) {
      return true;
    }

    const wanted =
      this.normalizeCountryName(
        country
      );

    const placeCountry =
      this.normalizeCountryName(
        place.country || ""
      );

    const countryCode =
      this.normalize(
        place.country_code || ""
      );

    if (
      wanted === placeCountry
    ) {
      return true;
    }

    if (
      this.countryAliases[
        countryCode
      ] === wanted
    ) {
      return true;
    }

    return false;
  },

  // --------------------------------------------
  // COMPARAISON ADMINISTRATIVE
  // --------------------------------------------
  placeMatchesAdministrativeComponent(
    place,
    component
  ) {
    const wanted =
      this.normalizePlaceName(
        component
      );

    if (!wanted) {
      return true;
    }

    const administrativeFields = [
      place.admin1,
      place.admin2,
      place.admin3,
      place.admin4
    ]
      .filter(Boolean)
      .map(
        this.normalizePlaceName.bind(this)
      );

    return administrativeFields.some(
      function (field) {
        return (
          field === wanted ||
          field.includes(wanted) ||
          wanted.includes(field)
        );
      }
    );
  },

  // --------------------------------------------
  // PRECISION GEOGRAPHIQUE
  // --------------------------------------------
  placeMatchesHint(place, hint) {
    const rawHint =
      String(hint || "").trim();

    if (!rawHint) {
      return true;
    }

    const explicitParts =
      this.getHintParts(rawHint);

    for (
      let i = 0;
      i < explicitParts.length;
      i++
    ) {
      const part =
        explicitParts[i];

      if (!part) {
        continue;
      }

      // Pays
      if (
        this.placeMatchesCountry(
          place,
          part
        )
      ) {
        const normalizedPart =
          this.normalizeCountryName(
            part
          );

        const normalizedPlaceCountry =
          this.normalizeCountryName(
            place.country || ""
          );

        if (
          normalizedPart ===
          normalizedPlaceCountry
        ) {
          continue;
        }

        if (
          this.countryAliases[
            this.normalize(part)
          ] ===
          normalizedPlaceCountry
        ) {
          continue;
        }
      }

      // Région / département / zone administrative
      if (
        this.placeMatchesAdministrativeComponent(
          place,
          part
        )
      ) {
        continue;
      }

      // Code postal
      if (
        this.placeMatchesPostalCode(
          place,
          part
        )
      ) {
        continue;
      }

      // Autre champ géographique
      if (
        this.placeFieldMatchesComponent(
          place,
          part
        )
      ) {
        continue;
      }

      return false;
    }

    return true;
  },

  // --------------------------------------------
  // CODE POSTAL
  // --------------------------------------------
  placeMatchesPostalCode(
    place,
    postalCode
  ) {
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

    return fields.some(
      function (field) {
        return String(field)
          .split(/[,\s;]+/)
          .includes(
            normalizedPostal
          );
      }
    );
  },

  // --------------------------------------------
  // RECHERCHE GEOCODAGE
  // --------------------------------------------
  async findPlaces(
    name,
    count,
    countryCode
  ) {
    const safeCount =
      Math.min(
        Math.max(
          Number(count) || 50,
          1
        ),
        100
      );

    let url =
      "https://geocoding-api.open-meteo.com/v1/search" +
      "?name=" +
      encodeURIComponent(name) +
      "&count=" +
      safeCount +
      "&language=fr&format=json";

    if (countryCode) {
      url +=
        "&countryCode=" +
        encodeURIComponent(
          countryCode
        );
    }

    const response =
      await fetch(url);

    if (!response.ok) {
      const error =
        new Error(
          "Erreur du service de géocodage."
        );

      error.code =
        "GEOCODING_HTTP_ERROR";

      throw error;
    }

    const data =
      await response.json();

    if (
      !data ||
      !Array.isArray(
        data.results
      )
    ) {
      const error =
        new Error(
          "Réponse de géocodage invalide."
        );

      error.code =
        "GEOCODING_INVALID_RESPONSE";

      throw error;
    }

    return data.results;
  },

  // --------------------------------------------
  // RECHERCHE SECURISEE
  // --------------------------------------------
  async findPlacesSafe(
    name,
    count,
    countryCode
  ) {
    try {
      return {
        ok: true,
        results:
          await this.findPlaces(
            name,
            count,
            countryCode
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
  // MATCH NOM EXACT
  // --------------------------------------------
  getExactNameMatches(
    results,
    name
  ) {
    const normalizedName =
      this.normalizePlaceName(
        name
      );

    return results.filter(
      function (place) {
        return (
          this.normalizePlaceName(
            place.name
          ) === normalizedName
        );
      },
      this
    );
  },

  // --------------------------------------------
  // LIEU PRINCIPAL
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
  // CONFIANCE
  // --------------------------------------------
  getPlaceConfidence(
    place,
    name,
    results
  ) {
    const normalizedName =
      this.normalizePlaceName(
        name
      );

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
      this.isPrimaryPlace(
        place
      )
    ) {
      score += 25;
    }

    const population =
      Number(
        place.population || 0
      );

    if (
      population >= 1000000
    ) {
      score += 40;
    } else if (
      population >= 500000
    ) {
      score += 30;
    } else if (
      population >= 100000
    ) {
      score += 20;
    } else if (
      population >= 50000
    ) {
      score += 10;
    }

    return score;
  },

  // --------------------------------------------
  // RESOLUTION CLASSIQUE
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
    // CODE POSTAL
    // ------------------------------------------
    if (
      parts.postalCode
    ) {
      const postalMatches =
        results.filter(
          function (place) {
            return self.placeMatchesPostalCode(
              place,
              parts.postalCode
            );
          }
        );

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
    // PRECISION GEOGRAPHIQUE
    // ------------------------------------------
    if (
      parts.hint
    ) {
      const hintMatches =
        results.filter(
          function (place) {
            return self.placeMatchesHint(
              place,
              parts.hint
            );
          }
        );

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
    // AUCUNE PRECISION
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
      exactMatches.map(
        function (place) {
          return {
            place: place,
            score:
              self.getPlaceConfidence(
                place,
                parts.city,
                exactMatches
              )
          };
        }
      );

    scored.sort(
      function (a, b) {
        return b.score - a.score;
      }
    );

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
  // IDENTIFIANTS ADMINISTRATIFS
  // --------------------------------------------
  placeMatchesAdministrativeId(
    place,
    administrativeIds
  ) {
    if (
      !place ||
      !Array.isArray(
        administrativeIds
      ) ||
      administrativeIds.length === 0
    ) {
      return false;
    }

    const ids = [
      place.admin1_id,
      place.admin2_id,
      place.admin3_id,
      place.admin4_id
    ]
      .filter(function (value) {
        return (
          value !== undefined &&
          value !== null &&
          String(value).trim() !== ""
        );
      })
      .map(function (value) {
        return String(value);
      });

    return administrativeIds.some(
      function (id) {
        return ids.includes(
          String(id)
        );
      }
    );
  },

  // --------------------------------------------
  // RECHERCHE DES IDENTIFIANTS ADMINISTRATIFS
  // --------------------------------------------
  async getAdministrativeIds(
    component,
    countryCode
  ) {
    const value =
      String(component || "").trim();

    if (!value) {
      return [];
    }

    const search =
      await this.findPlacesSafe(
        value,
        100,
        countryCode || ""
      );

    if (
      !search.ok ||
      !Array.isArray(
        search.results
      )
    ) {
      return [];
    }

    const normalizedComponent =
      this.normalizePlaceName(
        value
      );

    const ids = [];

    search.results.forEach(
      function (place) {
        const featureCode =
          String(
            place.feature_code || ""
          ).toUpperCase();

        const isAdministrative =
          featureCode.startsWith("A.");

        const names = [
          place.name,
          place.admin1,
          place.admin2,
          place.admin3,
          place.admin4,
          place.feature_name
        ]
          .filter(Boolean)
          .map(
            this.normalizePlaceName.bind(this)
          );

        const nameMatches =
          names.some(
            function (name) {
              return (
                name ===
                  normalizedComponent ||
                name.includes(
                  normalizedComponent
                ) ||
                normalizedComponent.includes(
                  name
                )
              );
            }
          );

        if (
          isAdministrative &&
          nameMatches
        ) {
          [
            place.id,
            place.admin1_id,
            place.admin2_id,
            place.admin3_id,
            place.admin4_id
          ]
            .filter(function (id) {
              return (
                id !== undefined &&
                id !== null &&
                String(id).trim() !== ""
              );
            })
            .forEach(
              function (id) {
                const normalizedId =
                  String(id);

                if (
                  !ids.includes(
                    normalizedId
                  )
                ) {
                  ids.push(
                    normalizedId
                  );
                }
              }
            );
        }
      }.bind(this)
    );

    return ids;
  },

  // --------------------------------------------
  // RESOLUTION AVEC IDENTIFIANTS ADMINISTRATIFS
  // --------------------------------------------
  async resolvePlaceWithAdministrativeIds(
    results,
    parts
  ) {
    const basicResolution =
      this.resolvePlace(
        results,
        parts
      );

    if (
      basicResolution.type !==
        "not_found" ||
      !parts ||
      !parts.hint
    ) {
      return basicResolution;
    }

    const hintParts =
      this.getHintParts(
        parts.hint
      );

    if (
      !hintParts.length
    ) {
      return basicResolution;
    }

    const countryCode =
      this.getCountryCodeFromHint(
        parts.hint
      );

    let candidates =
      results.filter(
        function (place) {
          return (
            this.normalizePlaceName(
              place.name
            ) ===
            this.normalizePlaceName(
              parts.city
            ) &&
            (
              !countryCode ||
              this.normalize(
                place.country_code || ""
              ) ===
              countryCode.toLowerCase()
            )
          );
        }.bind(this)
      );

    if (
      candidates.length === 0
    ) {
      candidates =
        results.filter(
          function (place) {
            return (
              this.normalizePlaceName(
                place.name
              ) ===
              this.normalizePlaceName(
                parts.city
              )
            );
          }.bind(this)
        );
    }

    if (
      candidates.length === 0
    ) {
      return basicResolution;
    }

    // ------------------------------------------
    // Chaque précision administrative est
    // recherchée individuellement.
    //
    // Exemple :
    // "Haut-Rhin France"
    //
    // Haut-Rhin -> identifiant administratif
    // France    -> filtre pays
    // ------------------------------------------
    let administrativeCandidates =
      candidates.slice();

    for (
      let i = 0;
      i < hintParts.length;
      i++
    ) {
      const component =
        hintParts[i];

      if (!component) {
        continue;
      }

      const componentCountryCode =
        this.getCountryCode(
          component
        );

      if (
        componentCountryCode
      ) {
        administrativeCandidates =
          administrativeCandidates.filter(
            function (place) {
              return (
                this.normalize(
                  place.country_code || ""
                ) ===
                componentCountryCode.toLowerCase()
              );
            }.bind(this)
          );

        continue;
      }

      if (
        this.placeMatchesPostalCode(
          candidates[0],
          component
        )
      ) {
        administrativeCandidates =
          administrativeCandidates.filter(
            function (place) {
              return this.placeMatchesPostalCode(
                place,
                component
              );
            }.bind(this)
          );

        continue;
      }

      const directAdministrativeMatches =
        administrativeCandidates.filter(
          function (place) {
            return this.placeMatchesAdministrativeComponent(
              place,
              component
            );
          }.bind(this)
        );

      if (
        directAdministrativeMatches.length > 0
      ) {
        administrativeCandidates =
          directAdministrativeMatches;

        continue;
      }

      const administrativeIds =
        await this.getAdministrativeIds(
          component,
          countryCode
        );

      if (
        administrativeIds.length > 0
      ) {
        const idMatches =
          administrativeCandidates.filter(
            function (place) {
              return this.placeMatchesAdministrativeId(
                place,
                administrativeIds
              );
            }.bind(this)
          );

        if (
          idMatches.length > 0
        ) {
          administrativeCandidates =
            idMatches;
        } else {
          return {
            type: "not_found"
          };
        }
      } else {
        return {
          type: "not_found"
        };
      }
    }

    if (
      administrativeCandidates.length === 1
    ) {
      return {
        type: "resolved",
        place:
          administrativeCandidates[0]
      };
    }

    if (
      administrativeCandidates.length > 1
    ) {
      return {
        type: "ambiguous",
        candidates:
          administrativeCandidates
      };
    }

    return {
      type: "not_found"
    };
  },

  // --------------------------------------------
  // RESOLUTION SANS VIRGULES
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

    const resolvedCandidates =
      [];

    const ambiguousCandidates =
      [];

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

      const countryCode =
        this.getCountryCodeFromHint(
          hint
        );

      const citySearch =
        await this.findPlacesSafe(
          city,
          100,
          countryCode
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
        await this.resolvePlaceWithAdministrativeIds(
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

    if (
      resolvedCandidates.length === 1
    ) {
      return resolvedCandidates[0];
    }

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

      return {
        parts:
          resolvedCandidates[0]
            .parts,

        results:
          resolvedCandidates[0]
            .results,

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

    if (
      ambiguousCandidates.length > 0
    ) {
      return ambiguousCandidates[0];
    }

    return null;
  },

  // --------------------------------------------
  // FORMATAGE DES CANDIDATS
  // --------------------------------------------
  formatPlaceCandidates(
    candidates
  ) {
    const self = this;

    const unique = [];

    candidates.forEach(
      function (place) {
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
          !unique.some(
            function (item) {
              return item.key === key;
            }
          )
        ) {
          unique.push({
            key: key,
            place: place
          });
        }
      }
    );

    return unique
      .slice(0, 5)
      .map(
        function (
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
                  details.join(", ") +
                  ")"
                : ""
            )
          );
        }
      )
      .join("\n");
  },

  // --------------------------------------------
  // METEO
  // --------------------------------------------
  async getWeather(city) {
    const name =
      String(city || "").trim();

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
      // CODE PAYS CONNU
      // ----------------------------------------
      const requestedCountryCode =
        this.getCountryCodeFromHint(
          parts.hint
        );

      // ----------------------------------------
      // RECHERCHE DIRECTE
      // ----------------------------------------
      let searchName =
        parts.city;

      if (
        parts.hint
      ) {
        searchName =
          parts.city +
          ", " +
          parts.hint;
      }

      const qualifiedSearch =
        await this.findPlacesSafe(
          searchName,
          100,
          requestedCountryCode
        );

      if (
        qualifiedSearch.ok
      ) {
        results =
          qualifiedSearch.results;

        resolution =
          await this.resolvePlaceWithAdministrativeIds(
            results,
            parts
          );
      } else {
        resolution = {
          type: "not_found"
        };
      }

      // ----------------------------------------
      // RECHERCHE DE LA VILLE SEULE
      //
      // Exemple :
      // Saint-Louis, Haut-Rhin, France
      //
      // On recherche Saint-Louis avec FR puis
      // on vérifie :
      //
      // 1. pays
      // 2. admin1/admin2/admin3/admin4
      // 3. identifiants administratifs
      // ----------------------------------------
      if (
        resolution.type ===
          "not_found" &&
        (
          parts.hint ||
          parts.postalCode
        )
      ) {
        const citySearch =
          await this.findPlacesSafe(
            parts.city,
            100,
            requestedCountryCode
          );

        if (
          citySearch.ok
        ) {
          results =
            citySearch.results;

          if (
            parts.hint
          ) {
            resolution =
              await this.resolvePlaceWithAdministrativeIds(
                results,
                parts
              );
          } else {
            resolution =
              this.resolvePlace(
                results,
                parts
              );
          }
        }
      }

      // ----------------------------------------
      // FALLBACK SANS VIRGULES
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
      // PAS TROUVE
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
      // AMBIGU
      // ----------------------------------------
      if (
        resolution.type ===
        "ambiguous"
      ) {
        const candidates =
          resolution.candidates || [];

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
      // LIEU RESOLU
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

      let weatherData;

      try {
        weatherData =
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
        weatherData.current;

      const daily =
        weatherData.daily;

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

    } catch (error) {
      console.error(
        "NexaTools.getWeather error:",
        error
      );

      return (
        "Impossible de traiter la demande météo pour le moment."
      );
    }
  },

  // --------------------------------------------
  // WIKIPEDIA
  // --------------------------------------------
  async searchWikipedia(query) {
    const q =
      String(query || "").trim();

    if (!q) {
      return (
        "Que voulez-vous que je cherche sur Wikipédia ?"
      );
    }

    try {
      const searchUrl =
        "https://fr.wikipedia.org/w/api.php" +
        "?action=query" +
        "&list=search" +
        "&srlimit=1" +
        "&format=json" +
        "&formatversion=2" +
        "&utf8=1" +
        "&origin=*" +
        "&srsearch=" +
        encodeURIComponent(q);

      const searchResponse =
        await fetch(searchUrl);

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
        "?action=query" +
        "&prop=extracts" +
        "&exintro=1" +
        "&explaintext=1" +
        "&exsentences=3" +
        "&redirects=1" +
        "&format=json" +
        "&formatversion=2" +
        "&origin=*" +
        "&titles=" +
        encodeURIComponent(title);

      const summaryResponse =
        await fetch(summaryUrl);

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
          extract.slice(
            0,
            700
          ).trim() +
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

    } catch (error) {
      return (
        "Impossible de joindre Wikipédia. Vérifiez votre connexion."
      );
    }
  },

  // --------------------------------------------
  // TACHES
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
      .map(
        function (task, index) {
          return (
            (index + 1) +
            ". " +
            (
              task.done
                ? "✅"
                : "☐"
            ) +
            " " +
            task.text
          );
        }
      )
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
      let taskText =
        String(text || "")
          .trim()
          .slice(0, 200);

      if (!taskText) {
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

      taskText =
        taskText.charAt(0).toUpperCase() +
        taskText.slice(1);

      list.push({
        text: taskText,
        done: false,
        created:
          new Date().toISOString()
      });

      this.saveTasks(list);

      return (
        "C'est ajouté : « " +
        taskText +
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
          function (task) {
            return !task.done;
          }
        ).length;

      return (
        "Vos tâches (" +
        remaining +
        " à faire sur " +
        list.length +
        ") :\n" +
        this.formatTasks(list)
      );
    }

    if (
      action === "clear"
    ) {
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

        this.saveTasks(list);

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
  // CHRONOMETRE
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
  // FICHIERS LOCAUX
  // --------------------------------------------
  async processLocalFile(file) {
    return new Promise(
      function (resolve) {
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
            function (event) {
              resolve({
                name: file.name,
                type: "text",
                content:
                  event.target.result
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
            function (event) {
              resolve({
                name: file.name,
                type: "image",
                content:
                  event.target.result
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
      }
    );
  }
};

// ============================================
// ENREGISTREMENT DES OUTILS
// ============================================

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
  "Fait un calcul mathématique.",
  function (args) {
    return NexaTools.calculate(
      args.expression || ""
    );
  }
);

NexaTools.register(
  "meteo",
  "Donne la météo d'une ville.",
  function (args) {
    return NexaTools.getWeather(
      args.city || ""
    );
  }
);

NexaTools.register(
  "wikipedia",
  "Cherche un sujet sur Wikipédia.",
  function (args) {
    return NexaTools.searchWikipedia(
      args.query || ""
    );
  }
);

NexaTools.register(
  "taches",
  "Gère la liste de tâches.",
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
  "Affiche un chronomètre interactif.",
  function () {
    return NexaTools.createChronometer();
  }
);