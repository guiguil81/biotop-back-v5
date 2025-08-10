"use strict";

import { concat, compact, isArray } from "lodash";
import fixNumber from "../../../bdd/utils/fixNumber";

const sanitizeUser = (user, ctx) => {
  const { auth } = ctx.state;
  const userSchema = strapi.getModel("plugin::users-permissions.user");
  return strapi.contentAPI.sanitize.output(user, userSchema, { auth });
};

module.exports = (plugin) => {
  // IMPORTANT v5 : plugin.controllers.auth est une factory ({ strapi }) => ({ ... })
  const baseAuthFactory = plugin.controllers.auth;

  plugin.controllers.auth = ({ strapi }) => {
    const baseAuth = baseAuthFactory({ strapi });

    return {
      ...baseAuth,

      async register(ctx) {
        try {
          // === 1) Settings & services
          const upPluginStore = await strapi.store({
            type: "plugin",
            name: "users-permissions",
          });
          const advanced = await upPluginStore.get({ key: "advanced" }); // contient default_role, allow_register, email_confirmation, unique email, etc.
          const userService = strapi
            .plugin("users-permissions")
            .service("user");
          const jwtService = strapi.plugin("users-permissions").service("jwt");
          const registerCfg = strapi
            .plugin("users-permissions")
            .service("register"); // expose allowedFields en v5

          // === 2) Inscriptions activées ?
          if (!advanced?.allow_register) {
            return ctx.badRequest("Register action is currently disabled.");
          }

          // === 3) Whitelist des champs d'entrée
          const alwaysAllowedKeys = ["username", "password", "email"];
          // En v5, si allowedFields est défini, seuls ces champs additionnels sont acceptés ; sinon on accepte tout (mais on reste strict ici).
          const allowedKeys = compact(
            concat(
              alwaysAllowedKeys,
              isArray(registerCfg?.allowedFields)
                ? registerCfg.allowedFields
                : [],
            ),
          );

          const body = ctx.request.body || {};
          const invalidKeys = Object.keys(body).filter(
            (k) => !allowedKeys.includes(k),
          );
          if (invalidKeys.length > 0) {
            return ctx.badRequest(
              `Invalid parameters: ${invalidKeys.join(", ")}`,
            );
          }

          const {
            email,
            password,
            username: rawUsername,
            // tous les champs additionnels explicitement whitelistes
            ...restUnsafe
          } = body;

          // Minimal validations (le core fait aussi des vérifs ; on garde le strict nécessaire côté contrôleur)
          if (!email || !password) {
            return ctx.badRequest("Missing email or password.");
          }

          const emailL = String(email).toLowerCase();
          const usernameL = rawUsername
            ? String(rawUsername).toLowerCase()
            : emailL;
          const provider = "local";

          // Ne conserve dans rest que les clés whitelistees
          const rest = Object.fromEntries(
            Object.entries(restUnsafe).filter(([k]) => allowedKeys.includes(k)),
          );

          // === 4) Rôle par défaut
          const defaultRole = await strapi.db
            .query("plugin::users-permissions.role")
            .findOne({ where: { type: advanced.default_role } });

          if (!defaultRole) {
            return ctx.badRequest("Impossible to find the default role");
          }

          // === 5) Unicité / Conflits
          // Conflit côté provider "local" sur email OU username
          const providerConflict = await strapi.db
            .query("plugin::users-permissions.user")
            .count({
              where: {
                provider,
                $or: [{ email: emailL }, { username: usernameL }],
              },
            });

          if (providerConflict > 0) {
            return ctx.badRequest("Email or Username are already taken");
          }

          // Si "One account per email address" est activé (v5)
          // (clé côté UI : "One account per email address")
          if (advanced?.unique_email) {
            const emailTaken = await strapi.db
              .query("plugin::users-permissions.user")
              .count({ where: { email: emailL } });

            if (emailTaken > 0) {
              return ctx.badRequest("Email is already taken");
            }
          }

          // === 6) Création user (on force confirmed:false comme tu veux)
          // NB: Le core met confirmed=!advanced.email_confirmation ; toi tu veux 100% false.
          const user = await userService.add({
            ...rest,
            role: defaultRole.id,
            email: emailL,
            username: usernameL,
            password,
            provider,
            confirmed: false, // <- ta différence
          });

          console.log("la ??");
          // === 7) Post-actions métier (création game & species, etc.)
          // Exemple :
          const basePlanetName =
            user.username ||
            (user.email ? user.email.split("@")[0] : `User-${user.id}`);

          console.log("la ??", basePlanetName);

          // 1) Round actif (doit exister)
          const [activeRound] = await strapi
            .documents("api::round.round")
            .findMany({
              filters: { isActive: { $eq: true } },
              sort: [{ id: "desc" }],
              limit: 1,
              fields: ["id"],
            });

          console.log("activeRound", activeRound);
          if (!activeRound) return ctx.badRequest("Aucun Round actif trouvé.");

          // 2) Element par défaut (ID 4, doit exister)
          const element = await strapi.db
            .query("api::element.element")
            .findOne({ where: { id: 4 }, select: ["id"] });
          console.log("element", element);

          if (!element) return ctx.badRequest("Element #4 introuvable.");

          // 3) Era par défaut (ID 8, doit exister)
          const era = await strapi.db
            .query("api::era.era")
            .findOne({ where: { id: 8 }, select: ["id"] });
          console.log("era", era);

          if (!era) return ctx.badRequest("era #8 introuvable.");

          // 4) Devises EV (ID 1) & MQ (ID 2) — doivent exister
          const evCurrency = await strapi.db
            .query("api::currency.currency")
            .findOne({ where: { id: 1 }, select: ["id"] });
          const mqCurrency = await strapi.db
            .query("api::currency.currency")
            .findOne({ where: { id: 2 }, select: ["id"] });
          console.log("evCurrency", evCurrency, mqCurrency);

          if (!evCurrency || !mqCurrency) {
            return ctx.badRequest(
              "Currency EV (ID 1) ou MQ (ID 2) introuvable.",
            );
          }

          console.log("avant game");

          // 5) Création de la Game liée au user
          const game = await strapi.documents("api::game.game").create({
            data: {
              planetName: `Planet ${basePlanetName}`,
              score: 0,
              user: user.id,
              round: activeRound.id,
              era: era.id,
              element: element.id,
            },
          });

          console.log("apres game");
          console.log("apres game", game);

          // 6) Initialiser les monnaies EV & MQ à 0 via gameHaveCurrency
          // N.B. champs supposés: qty (BigInt-as-string). Adapte si ton CT a "amount"/"value".
          await strapi
            .documents("api::game-have-currency.game-have-currency")
            .create({
              data: { game: game.id, currency: evCurrency.id, amount: "100" },
            });
          await strapi
            .documents("api::game-have-currency.game-have-currency")
            .create({
              data: { game: game.id, currency: mqCurrency.id, amount: "100" },
            });

          ctx.state.createdGameId = game.id;

          // 7) Initialiser les espèces de base (isPrimitive = true)
          const primitives = await strapi
            .documents("api::specie.specie")
            .findMany({
              filters: { isPrimitive: { $eq: true } },
              fields: ["id", "defaultQty"],
              limit: 1000, // sécurité si tu en as beaucoup
            });

          await Promise.all(
            primitives.map((specie) =>
              strapi
                .documents("api::game-have-specie.game-have-specie")
                .create({
                  data: {
                    game: game.id,
                    specie: specie.id,
                    qty: fixNumber(specie.defaultQty),
                  },
                }),
            ),
          );

          // === 8) JWT + sanitization + réponse
          const jwt = jwtService.issue({ id: user.id });
          const sanitizedUser = await sanitizeUser(user, ctx);

          ctx.body = {
            jwt,
            user: sanitizedUser,
          };
        } catch (error) {
          return ctx.badRequest(`error ${error}`);
        }
      },
    };
  };

  return plugin;
};
