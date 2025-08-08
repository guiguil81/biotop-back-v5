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
      path: "/updateConfirmedEmail",
      handler: "custom-user-flow.updateConfirmedEmail",
      config: {
        policies: ["global::is-authenticated"],
        middlewares: [],
      },
    },
  ],
};
