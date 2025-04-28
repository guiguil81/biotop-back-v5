const createGameHaveSpecie = async (game, specie) => {
  return await strapi
    .documents("api::game-have-specie.game-have-specie")
    .create({
      data: {
        game: game.id,
        specie: specie.id,
        qty: specie.defaultQty,
      },
    });
};

export default createGameHaveSpecie;
