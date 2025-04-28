import { Game } from "../types";
import { GameHaveSpecie, GameHaveSpecieWithDetails } from "../types/specie";

const getBasicGameHaveSpecies = async (game: Game) => {
  const data: GameHaveSpecie[] = await strapi
    .documents("api::game-have-specie.game-have-specie")
    .findMany({
      fields: ["id"],
      filters: {
        $and: [
          {
            game: {
              id: game.id,
            },
          },
        ],
      },
      populate: {
        specie: {
          fields: ["id"],
        },
      },
    });

  return data;
};

const getGameHaveSpecies = async (game: Game, gameSpeciesId: number[]) => {
  const groupSpecies = {
    fields: ["id"],
    populate: {
      species: {
        fields: ["id"],
        filters: {
          $and: [
            {
              id: {
                $in: gameSpeciesId,
              },
            },
            {
              era: {
                level: {
                  $lte: game.era.level,
                },
              },
            },
          ],
        },
      },
    },
  } as never;

  const data: GameHaveSpecieWithDetails[] = await strapi
    .documents("api::game-have-specie.game-have-specie")
    .findMany({
      fields: ["id", "qty"],
      filters: {
        game: {
          id: game.id,
        },
      },
      populate: {
        specie: {
          fields: ["id", "reproduction", "eat", "product", "dead"],
          populate: {
            era: {
              fields: ["id", "speciesFoundScore", "specieMaxScore"],
            },
            element: {
              fields: ["id"],
            },
            groupSpecie: {
              fields: ["id"],
              populate: {
                groupSpeciesRequire: groupSpecies,
                groupSpeciesRequiredBy: groupSpecies,
                groupSpeciesEat: groupSpecies,
                groupSpeciesEatenBy: groupSpecies,
                groupSpeciesUse: groupSpecies,
                groupSpeciesUsedBy: groupSpecies,
                groupSpeciesProduce: groupSpecies,
                groupSpeciesProducedBy: groupSpecies,
                groupSpeciesProduceByDead: groupSpecies,
                groupSpeciesProducedByDeadBy: groupSpecies,
              },
            },
          },
        },
      },
    });

  return data;
};

export { getBasicGameHaveSpecies, getGameHaveSpecies };
