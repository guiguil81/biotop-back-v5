import { Game, RoundIdOnly } from "../types";

const getCurrentGames: (
  currentRound: RoundIdOnly[],
) => Promise<Game[]> = async (currentRound: RoundIdOnly[]) => {
  if (currentRound.length === 0) {
    return [];
  }

  const data: Game[] = await strapi.documents("api::game.game").findMany({
    fields: ["id"],
    filters: {
      $and: [
        {
          round: {
            id: currentRound[0].id,
          },
        },
      ],
    },
    populate: {
      element: {
        fields: ["id"],
      },
      era: {
        fields: ["id", "level", "evByCycle", "evMax"],
      },
    },
  });

  return data;
};

export { getCurrentGames };
