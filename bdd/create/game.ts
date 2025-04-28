const createGame = async (user, round) => {
  return await strapi.documents("api::game.game").create({
    data: {
      user: user.id,
      round: round.id,
      planetName: "planet_" + user.username,
      element: 1,
      era: 1,
    },
  });
};

export default createGame;
