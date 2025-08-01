"use strict";

module.exports = (plugin) => {
  const rawAuth = plugin.controllers.auth({ strapi });

  const auth = ({ strapi }) => {
    return {
      ...rawAuth,
      register: async (ctx) => {
        const { email } = ctx.request.body;

        await rawAuth.register(ctx);

        const users = await strapi
          .documents("plugin::users-permissions.user")
          .findMany({
            filters: { email },
          });

        if (users && users[0]) {
          await strapi.entityService.update(
            "plugin::users-permissions.user",
            users[0].id,
            {
              data: { confirmed: false },
            },
          );
        }
      },
    };
  };

  plugin.controllers.auth = auth;
  return plugin;
};
