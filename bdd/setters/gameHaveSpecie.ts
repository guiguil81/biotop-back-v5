const updateGameHaveSpecies = async (
  gameHaveSpecieId: string,
  finalQty: number,
) => {
  return await strapi
    .documents("api::game-have-specie.game-have-specie")
    .update({
      documentId: gameHaveSpecieId,
      data: {
        qty: finalQty,
      },
    });
};

export { updateGameHaveSpecies };
