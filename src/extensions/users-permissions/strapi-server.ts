"use strict";

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
      const { email, password, username, ...rest } = ctx.request.body;

      if (!email || !password || !username) {
        return ctx.badRequest("Missing email, password or username");
      }

      const [existingEmailUser] = await strapi.entityService.findMany(
        "plugin::users-permissions.user",
        { filters: { email: email.toLowerCase() }, limit: 1 },
      );
      if (existingEmailUser) {
        return ctx.badRequest("Email already taken");
      }

      const [existingUsernameUser] = await strapi.entityService.findMany(
        "plugin::users-permissions.user",
        { filters: { username }, limit: 1 },
      );
      if (existingUsernameUser) {
        return ctx.badRequest("Username already taken");
      }

      const user = await userService.add({
        email: email.toLowerCase(),
        password,
        username,
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
