const setScoreAndResourcesGames = async (
  gameId: string,
  data: { score: number; ev: number },
) => {
  return await strapi.documents("api::game.game").update({
    documentId: gameId,
    data: data,
  });
};

export { setScoreAndResourcesGames };
