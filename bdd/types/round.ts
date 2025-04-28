import { Data } from "@strapi/strapi";

type RoundIdOnly = Pick<Data.ContentType<"api::round.round">, "id">;

export { RoundIdOnly };
