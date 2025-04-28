import { Map, Record } from "immutable";
import fixNumber from "../utils/fixNumber";
import productionCoef from "./productionCoef";
import {
  getSpeciesIdForGroup,
  getGroupSpecies,
  getBasicSpeciesIdFromGameHaveSpecies,
} from "../utils/getSpeciesIdForGroup";
import { SpecieEvolution } from "./interface";
import { getBasicGameHaveSpecies, getGameHaveSpecies } from "../getters/specie";
import { setScoreAndResourcesGames } from "../setters/game";
import { updateGameHaveSpecies } from "../setters/gameHaveSpecie";
import { Game } from "../types";
import { GameHaveSpecie, GameHaveSpecieWithDetails } from "../types/specie";

const gameProcess = async (game: Game) => {
  let speciesObject: Map<string, Record<SpecieEvolution>> = Map();
  const gameElementId = game.element.id;
  const ev = fixNumber(game.ev);
  const evByCycle = fixNumber(game.era.evByCycle);
  const evMax = fixNumber(game.era.evMax);

  const basicGameHaveSpeciesId: GameHaveSpecie[] =
    await getBasicGameHaveSpecies(game);
  const gameSpeciesId = getBasicSpeciesIdFromGameHaveSpecies(
    basicGameHaveSpeciesId,
  );

  const gameHaveSpecies: GameHaveSpecieWithDetails[] = await getGameHaveSpecies(
    game,
    gameSpeciesId,
  );

  // init all cycle process + cycle reproduction
  gameHaveSpecies.forEach((gameHaveSpecie) => {
    const gameHaveSpecieId = gameHaveSpecie.id;
    const initSpecieQty = fixNumber(gameHaveSpecie.qty);

    const specie = gameHaveSpecie.specie;
    const specieId = specie.id;
    const specieElement = specie.element.id;
    const { speciesFoundScore, specieMaxScore } = specie.era;

    const { reproduction, eat, product, dead } = gameHaveSpecie.specie;

    const eatFinal = fixNumber(initSpecieQty * eat);
    const nbReproduction = productionCoef(
      initSpecieQty,
      reproduction,
      fixNumber(gameElementId),
      fixNumber(specieElement),
    );

    speciesObject = speciesObject.mergeIn([specieId], {
      finalQty: 0,
      specieId,
      gameHaveSpecieId,
      initSpecieQty: fixNumber(initSpecieQty),
      reproduction: nbReproduction,
      eat: eatFinal,
      product: fixNumber(initSpecieQty * product),
      dead: fixNumber(initSpecieQty * dead),
      speciesFoundScore: fixNumber(speciesFoundScore),
      specieMaxScore: fixNumber(specieMaxScore),
    });

    // update final qty with reproduction
    speciesObject = speciesObject.mergeIn([specieId], {
      finalQty: fixNumber(fixNumber(initSpecieQty) + nbReproduction),
    });

    // add require logics
    const { groupSpeciesRequire, groupSpeciesRequiredBy } =
      gameHaveSpecie.specie.groupSpecie;
    const require = getSpeciesIdForGroup(groupSpeciesRequire);
    const requiredBy = getSpeciesIdForGroup(groupSpeciesRequiredBy);

    speciesObject = speciesObject.mergeIn([specieId], {
      require: require,
      requiredBy: requiredBy,
    });

    require.forEach((requireId) => {
      speciesObject = speciesObject.updateIn(
        [requireId, "nbRequiredBy"],
        0,
        (value: number) => value + eatFinal,
      );
    });

    // add eat logic
    const { groupSpeciesEat, groupSpeciesEatenBy } =
      gameHaveSpecie.specie.groupSpecie;
    const eatGroupSpecies = getSpeciesIdForGroup(groupSpeciesEat);
    const eatGroupSpeciesBy = getSpeciesIdForGroup(groupSpeciesEatenBy);
    const eatGroup = getGroupSpecies(groupSpeciesEat);
    const eatGroupBy = getGroupSpecies(groupSpeciesEatenBy);

    speciesObject = speciesObject.mergeIn([specieId], {
      eatGroupSpecies: eatGroupSpecies,
      eatGroupSpeciesBy: eatGroupSpeciesBy,
      eatGroup: eatGroup,
      eatGroupBy: eatGroupBy,
    });

    // add usage logic
    const { groupSpeciesUse, groupSpeciesUsedBy } =
      gameHaveSpecie.specie.groupSpecie;

    const useGroupSpecies = getSpeciesIdForGroup(groupSpeciesUse);
    const usedGroupSpeciesBy = getSpeciesIdForGroup(groupSpeciesUsedBy);

    speciesObject = speciesObject.mergeIn([specieId], {
      useGroupSpecies: useGroupSpecies,
      usedGroupSpeciesBy: usedGroupSpeciesBy,
    });

    // add product logic
    const { groupSpeciesProduce, groupSpeciesProducedBy } =
      gameHaveSpecie.specie.groupSpecie;

    const productGroupSpecies = getSpeciesIdForGroup(groupSpeciesProduce);
    const producedGroupSpeciesBy = getSpeciesIdForGroup(groupSpeciesProducedBy);

    speciesObject = speciesObject.mergeIn([specieId], {
      productGroupSpecies: productGroupSpecies,
      producedGroupSpeciesBy: producedGroupSpeciesBy,
    });

    // add dead logic
    const { groupSpeciesProduceByDead, groupSpeciesProducedByDeadBy } =
      gameHaveSpecie.specie.groupSpecie;

    const produceByDeadGroupSpecies = getSpeciesIdForGroup(
      groupSpeciesProduceByDead,
    );
    const produceByDeadGroupSpeciesBy = getSpeciesIdForGroup(
      groupSpeciesProducedByDeadBy,
    );

    speciesObject = speciesObject.mergeIn([specieId], {
      produceByDeadGroupSpecies: produceByDeadGroupSpecies,
      produceByDeadGroupSpeciesBy: produceByDeadGroupSpeciesBy,
    });
  });

  // cycle A require
  speciesObject = speciesObject.withMutations((map) => {
    map.forEach((specie, specieId) => {
      const finalQty = specie.get("finalQty");
      let nbRequiredBy = specie.get("nbRequiredBy");
      const requiredBy = specie.get("requiredBy");

      if (nbRequiredBy === undefined) nbRequiredBy = 0;
      const requireDifference = finalQty - nbRequiredBy;

      if (requireDifference < 0) {
        requiredBy.forEach((requiredById) => {
          const eat = speciesObject.getIn([requiredById, "eat"]) as number;
          const proportion = eat / nbRequiredBy;
          const nbCanEat = fixNumber(proportion * finalQty);

          const deadByRequire = fixNumber(eat - nbCanEat);

          map.updateIn([requiredById, "finalQty"], 0, (value: number) =>
            fixNumber(value - deadByRequire),
          );
        });
        map.setIn([specieId, "finalQty"], 0);
      } else {
        map.setIn([specieId, "finalQty"], fixNumber(requireDifference));
      }
    });
  });

  // cycle A element
  speciesObject = speciesObject.withMutations((map) => {
    // init willEatBy
    map.forEach((specie, specieId) => {
      const eatGroup = specie.get("eatGroup");
      const eat = specie.get("eat");

      eatGroup.forEach((groups) => {
        let totalEat: number = 0;
        groups.forEach((specieOnGroup) => {
          const finalQty = map.getIn([specieOnGroup, "finalQty"], 0) as number;
          totalEat += finalQty;
        });

        groups.forEach((specieOnGroup) => {
          const finalQty = map.getIn([specieOnGroup, "finalQty"], 0) as number;
          let qtyEat: number;
          if (totalEat === 0) {
            qtyEat = fixNumber(eat / groups.length);
          } else {
            qtyEat = fixNumber((eat * finalQty) / totalEat);
          }

          map.updateIn(
            [specieOnGroup, "willEatBy"],
            [],
            (value: { specieId: string; qtyEat: number }[]) =>
              value.concat({ specieId: specieId, qtyEat: qtyEat }),
          );
          map.updateIn([specieOnGroup, "nbEatGroupBy"], 0, (value: number) =>
            fixNumber(value + qtyEat),
          );
        });
      });
    });

    // add calculation and update qty
    map.forEach((specie, specieId) => {
      const willEatBy = specie.get("willEatBy");

      if (willEatBy !== undefined && willEatBy.length !== 0) {
        const finalQty = specie.get("finalQty");
        let nbEatGroupBy = specie.get("nbEatGroupBy");

        if (nbEatGroupBy === undefined) {
          nbEatGroupBy = 0;
        }

        const requireDifference = finalQty - nbEatGroupBy;

        if (requireDifference < 0) {
          willEatBy.forEach((eatBy) => {
            const eat = eatBy.qtyEat;
            const proportion = fixNumber(eat / nbEatGroupBy);
            const canEat = fixNumber(proportion * finalQty);

            const deadByEat = fixNumber(eat - canEat);

            map.updateIn([eatBy.specieId, "deadByEat"], 0, (value: number) =>
              fixNumber(value + deadByEat),
            );
          });
          map.setIn([specieId, "finalQty"], 0);
        } else {
          map.setIn([specieId, "finalQty"], fixNumber(requireDifference));
        }
      }
    });
  });

  // update deadByEat
  speciesObject = speciesObject.withMutations((map) => {
    // update final qty
    map.forEach((specie, specieId) => {
      const deadByEat = specie.get("deadByEat");

      if (deadByEat) {
        map.updateIn([specieId, "finalQty"], 0, (value: number) => {
          return fixNumber(value - deadByEat);
        });
      }
    });
  });

  // cycle A usage
  speciesObject = speciesObject.withMutations((map) => {
    // update final qty
    map.forEach((specie) => {
      const useGroupSpecies = specie.get("useGroupSpecies");
      const eat = specie.get("eat");

      useGroupSpecies.forEach((groups) => {
        map.updateIn([groups, "finalQty"], 0, (value: number) => {
          return fixNumber(value - eat);
        });
      });
    });
  });

  // cycle production
  speciesObject = speciesObject.withMutations((map) => {
    // update final qty
    map.forEach((specie) => {
      const useGroupSpecies = specie.get("useGroupSpecies");
      let nbUseSpecies = 0;

      useGroupSpecies.forEach((useSpecieId) => {
        const finalQty = map.getIn([useSpecieId, "finalQty"], 0) as number;
        nbUseSpecies += finalQty;
      });

      const canProduct = nbUseSpecies === 0;

      if (canProduct) {
        const productGroupSpecies = specie.get("productGroupSpecies");
        const product = specie.get("product");

        productGroupSpecies.forEach((groups) => {
          map.updateIn([groups, "finalQty"], 0, (value: number) =>
            fixNumber(value + product),
          );
        });
      }
    });
  });

  // cycle dead + production by dead
  speciesObject = speciesObject.withMutations((map) => {
    map.forEach((specie, specieId) => {
      // update final qty by dead
      const dead = specie.get("dead");
      map.updateIn([specieId, "finalQty"], 0, (value: number) =>
        fixNumber(value - dead),
      );

      // produce species by dead
      const produceByDeadGroupSpecies = specie.get("produceByDeadGroupSpecies");

      produceByDeadGroupSpecies.forEach((produceByDeadSpecieId) => {
        map.updateIn([produceByDeadSpecieId, "finalQty"], 0, (value: number) =>
          fixNumber(value + dead),
        );
      });
    });
  });

  // calculate score and update EV
  speciesObject = speciesObject.withMutations((map) => {
    let score = 0;

    map.forEach((specie) => {
      // calculate score
      const specieId = specie.get("specieId");
      const finalQty = specie.get("finalQty");
      const speciesFoundScore = specie.get("speciesFoundScore");
      const specieMaxScore = specie.get("specieMaxScore");

      score += speciesFoundScore + (1 + finalQty / specieMaxScore);

      updateGameHaveSpecies(specieId, finalQty);
    });

    const data = {
      ev: fixNumber(ev + evByCycle) > evMax ? evMax : fixNumber(ev + evByCycle),
      score: score,
    };

    setScoreAndResourcesGames(game.id.toString(), data).then();
  });

  speciesObject.forEach((specieRecord, specieId) => {
    // console.log(`ID de l'espèce: ${specieId}`);
    console.log(`Données de l'espèce:`, specieRecord.toJS()); // Convertit le Record en objet JavaScript pour l'affichage
  });
};

export default gameProcess;
