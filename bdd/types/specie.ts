import { Data } from "@strapi/strapi";

type GameHaveSpecie = Pick<
  Data.ContentType<"api::game-have-specie.game-have-specie">,
  "id"
> & {
  specie?: Pick<Data.ContentType<"api::specie.specie">, "id">;
};

type SpeciesRelation = Pick<
  Data.ContentType<"api::group-specie.group-specie">,
  "id"
> & {
  species?: Pick<Data.ContentType<"api::specie.specie">, "id">[];
};

type GroupSpecieWithRelations = Pick<
  Data.ContentType<"api::group-specie.group-specie">,
  "id"
> & {
  groupSpeciesRequire?: SpeciesRelation[];
  groupSpeciesRequiredBy?: SpeciesRelation[];
  groupSpeciesEat?: SpeciesRelation[];
  groupSpeciesEatenBy?: SpeciesRelation[];
  groupSpeciesUse?: SpeciesRelation[];
  groupSpeciesUsedBy?: SpeciesRelation[];
  groupSpeciesProduce?: SpeciesRelation[];
  groupSpeciesProducedBy?: SpeciesRelation[];
  groupSpeciesProduceByDead?: SpeciesRelation[];
  groupSpeciesProducedByDeadBy?: SpeciesRelation[];
};

type SpecieWithRelations = Pick<
  Data.ContentType<"api::specie.specie">,
  "id" | "reproduction" | "eat" | "product" | "dead"
> & {
  era?: Pick<
    Data.ContentType<"api::era.era">,
    "id" | "speciesFoundScore" | "specieMaxScore"
  >;
  element?: Pick<Data.ContentType<"api::element.element">, "id">;
  groupSpecie?: GroupSpecieWithRelations;
};

type GameHaveSpecieWithDetails = Pick<
  Data.ContentType<"api::game-have-specie.game-have-specie">,
  "id" | "qty"
> & {
  specie?: SpecieWithRelations;
};

export { GameHaveSpecie, GameHaveSpecieWithDetails, SpeciesRelation };
