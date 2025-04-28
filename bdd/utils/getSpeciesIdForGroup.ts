import { GameHaveSpecie, SpeciesRelation } from "../types/specie";

const getSpeciesIdForGroup = (groups: SpeciesRelation[]): number[] => {
  const speciesId = [];

  groups.forEach((group) => {
    group.species.forEach((specie) => {
      speciesId.push(specie.id);
    });
  });

  return speciesId;
};

const getGroupSpecies = (groups: SpeciesRelation[]): number[] => {
  const groupsId = [];

  groups.forEach((group) => {
    const groupId = [];
    group.species.forEach((specie) => {
      groupId.push(specie.id);
    });

    groupsId.push(groupId);
  });

  return groupsId;
};

const getBasicSpeciesIdFromGameHaveSpecies = (
  groups: GameHaveSpecie[],
): number[] => {
  const speciesId = [];

  groups.forEach((group) => {
    speciesId.push(group.specie.id);
  });

  return speciesId;
};

export {
  getBasicSpeciesIdFromGameHaveSpecies,
  getSpeciesIdForGroup,
  getGroupSpecies,
};
