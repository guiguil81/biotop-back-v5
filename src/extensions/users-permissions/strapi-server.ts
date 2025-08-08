"use strict";

import { concat, compact, isArray } from "lodash";

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
        // === 1) Settings & services
        const upPluginStore = await strapi.store({
          type: "plugin",
          name: "users-permissions",
        });
        const advanced = await upPluginStore.get({ key: "advanced" }); // contient default_role, allow_register, email_confirmation, unique email, etc.
        const userService = strapi.plugin("users-permissions").service("user");
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

        // === 7) Post-actions métier (création game & species, etc.)
        // Exemple :
        // await strapi.entityService.create("api::game.game", {
        //   data: { user: user.id, /* ... */ },
        // });
        // await strapi.entityService.create("api::species.species", {
        //   data: { owner: user.id, /* ... */ },
        // });

        // === 8) JWT + sanitization + réponse
        const jwt = jwtService.issue({ id: user.id });
        const sanitizedUser = await sanitizeUser(user, ctx);

        ctx.body = {
          jwt,
          user: sanitizedUser,
        };
      },
    };
  };

  return plugin;
};
