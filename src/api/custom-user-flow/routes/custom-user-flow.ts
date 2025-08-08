export default {
  routes: [
    {
      method: "PATCH",
      path: "/updateUnconfirmedEmail",
      handler: "custom-user-flow.updateUnconfirmedEmail",
      config: {
        policies: ["global::is-authenticated"],
        middlewares: [],
      },
    },
    {
      method: "POST",
      path: "/sendEmailChangeCode",
      handler: "custom-user-flow.sendEmailChangeCode",
      config: {
        policies: ["global::is-authenticated"],
        middlewares: [],
      },
    },
    {
      method: "POST",
      path: "/confirmEmailChange",
      handler: "custom-user-flow.confirmEmailChange",
      config: {
        policies: ["global::is-authenticated"],
        middlewares: [],
      },
    },
  ],
};
