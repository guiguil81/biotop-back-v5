"use strict";

import { concat, compact, isArray } from "lodash";

const sanitizeUser = (user, ctx) => {
  const { auth } = ctx.state;
  const userSchema = strapi.getModel("plugin::users-permissions.user");
  return strapi.contentAPI.sanitize.output(user, userSchema, { auth });
};

module.exports = (plugin) => {
  const rawAuth = plugin.controllers.auth({ strapi });

  const auth = ({ strapi }) => ({
    ...rawAuth,
    async register(ctx) {
      const userService = strapi.plugin("users-permissions").service("user");
      const jwtService = strapi.plugin("users-permissions").service("jwt");
      const register = strapi.plugin("users-permissions").service("register");

      const alwaysAllowedKeys = ["username", "password", "email"];

      // Note that we intentionally do not filter allowedFields to allow a project to explicitly accept private or other Strapi field on registration
      const allowedKeys = compact(
        concat(
          alwaysAllowedKeys,
          isArray(register?.allowedFields) ? register.allowedFields : [],
        ),
      );

      const invalidKeys = Object.keys(ctx.request.body).filter(
        (key) => !allowedKeys.includes(key),
      );

      if (invalidKeys.length > 0) {
        return ctx.badRequest(`Invalid parameters: ${invalidKeys.join(", ")}`);
      }

      const {
        email,
        password,
        username,
        provider = "local",
        ...rest
      } = ctx.request.body;

      const identifierFilter = {
        $or: [
          { email: email.toLowerCase() },
          { username: email.toLowerCase() },
          { username },
          { email: username },
        ],
      };

      const pluginStore = await strapi.store({
        type: "plugin",
        name: "users-permissions",
      });

      const settings = await pluginStore.get({ key: "advanced" });

      const role = await strapi.db
        .query("plugin::users-permissions.role")
        .findOne({ where: { type: settings.default_role } });

      if (!role) {
        return ctx.badRequest("Impossible to find the default role");
      }

      const conflictingUserCount = await strapi.db
        .query("plugin::users-permissions.user")
        .count({
          where: { ...identifierFilter, provider },
        });

      if (conflictingUserCount > 0) {
        return ctx.badRequest("Email or Username are already taken");
      }

      const conflictingUserEmail = await strapi.db
        .query("plugin::users-permissions.user")
        .count({
          where: { ...identifierFilter },
        });

      if (conflictingUserEmail > 0) {
        return ctx.badRequest("Email or Username are already taken");
      }

      const user = await userService.add({
        ...rest,
        role: role.id,
        email: email.toLowerCase(),
        username,
        confirmed: !settings.email_confirmation,
        password,
        provider,
        ...rest,
      });

      const userUpdate = await strapi.entityService.update(
        "plugin::users-permissions.user",
        user.id,
        { data: { confirmed: false } },
      );

      const jwt = jwtService.issue({ id: userUpdate.id });
      const sanitizedUser = await sanitizeUser(userUpdate, ctx);

      // need creation game & species

      ctx.body = {
        jwt,
        user: sanitizedUser,
      };
    },
  });

  plugin.controllers.auth = auth;
  return plugin;
};
