interface SpecieEvolution {
  finalQty: number;
  specieId: string;
  gameHaveSpecieId: string;
  initSpecieQty: number;
  reproduction: number;
  eat: number;
  product: number;
  dead: number;
  require: number[];
  requiredBy: number[];
  nbRequiredBy: number;
  deadByRequire: number;
  eatGroupSpecies: number[];
  eatGroupSpeciesBy: number[];
  eatGroup: number[][];
  eatGroupBy: number[][];
  nbEatGroupBy: number;
  willEatBy: { specieId: string; qtyEat: number }[];
  deadByEat: number;
  useGroupSpecies: number[];
  usedGroupSpeciesBy: number[];
  productGroupSpecies: number[];
  producedGroupSpeciesBy: number[];
  produceByDeadGroupSpecies: number[];
  produceByDeadGroupSpeciesBy: number[];
  speciesFoundScore: number;
  specieMaxScore: number;
}

export { SpecieEvolution };
