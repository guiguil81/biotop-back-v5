export default {
  updateUnconfirmedEmail: async (ctx) => {
    try {
      const { email, password } = ctx.request.body;

      // ✅ Récupérer l'utilisateur courant (token JWT)
      const user = ctx.state.user;
      if (!user) {
        return ctx.unauthorized("Utilisateur non authentifié");
      }

      // Vérifier si le compte est déjà confirmé
      if (user.confirmed) {
        return ctx.forbidden("Compte déjà confirmé, modification impossible");
      }

      // Vérifier unicité email (ou username si besoin)
      const identifierFilter = {
        $or: [
          { email: email.toLowerCase() },
          { username: email.toLowerCase() },
        ],
      };

      const conflictingUserCount = await strapi.db
        .query("plugin::users-permissions.user")
        .count({
          where: { ...identifierFilter },
        });

      if (conflictingUserCount > 0) {
        return ctx.badRequest("Email ou Username déjà pris");
      }

      // Mettre à jour l'email et le password
      const updatedUser = await strapi.db
        .query("plugin::users-permissions.user")
        .update({
          where: { id: user.id },
          data: {
            email: email.toLowerCase(),
            password,
            confirmed: false,
          },
        });

      await strapi
        .plugin("users-permissions")
        .service("user")
        .sendConfirmationEmail(updatedUser);

      ctx.body = {
        ok: true,
        message: "Email modifié, mail de confirmation envoyé.",
      };
    } catch (err) {
      ctx.body = err;
    }
  },
  updateConfirmedEmail: async (ctx) => {
    try {
      const { email, password } = ctx.request.body;

      // ✅ Récupérer l'utilisateur courant (token JWT)
      const user = ctx.state.user;
      if (!user) {
        return ctx.unauthorized("Utilisateur non authentifié");
      }

      // Vérifier si le compte est déjà confirmé
      if (user.confirmed) {
        return ctx.forbidden("Compte déjà confirmé, modification impossible");
      }

      // Vérifier unicité email (ou username si besoin)
      const identifierFilter = {
        $or: [
          { email: email.toLowerCase() },
          { username: email.toLowerCase() },
        ],
      };

      const conflictingUserCount = await strapi.db
        .query("plugin::users-permissions.user")
        .count({
          where: { ...identifierFilter },
        });

      if (conflictingUserCount > 0) {
        return ctx.badRequest("Email ou Username déjà pris");
      }

      // Mettre à jour l'email et le password
      const updatedUser = await strapi.db
        .query("plugin::users-permissions.user")
        .update({
          where: { id: user.id },
          data: {
            email: email.toLowerCase(),
            password,
            confirmed: false,
          },
        });

      await strapi
        .plugin("users-permissions")
        .service("user")
        .sendConfirmationEmail(updatedUser);

      ctx.body = {
        ok: true,
        message: "Email modifié, mail de confirmation envoyé.",
      };
    } catch (err) {
      ctx.body = err;
    }
  },
};
