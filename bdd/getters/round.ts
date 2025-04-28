import { RoundIdOnly } from "../types";

const getCurrentRound: () => Promise<RoundIdOnly[]> = async () => {
  return await strapi.documents("api::round.round").findMany({
    fields: ["id"],
    filters: {
      isActive: true,
    },
  });
};

export default getCurrentRound;
