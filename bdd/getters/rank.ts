const getRanksAndMyRank = async (round, user) => {
  const allCurrentGames = await strapi.documents("api::game.game").findMany({
    fields: [],
    filters: {
      round: round.id,
    },
    populate: {
      user: {
        fields: [],
      },
    },
    orderBy: { score: "desc" },
  });

  const ranks = [];
  allCurrentGames.forEach((game) => {
    ranks.push(game);
  });

  const myRank =
    allCurrentGames.findIndex((game) => {
      return game.user.id === user.id;
    }) + 1;

  return {
    ranks,
    myRank,
  };
};

export default getRanksAndMyRank;
