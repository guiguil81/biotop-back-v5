import { Data } from "@strapi/strapi";

type Game = Pick<Data.ContentType<"api::game.game">, "id"> & {
  element?: Pick<Data.ContentType<"api::element.element">, "id">;
  era?: Pick<
    Data.ContentType<"api::era.era">,
    "id" | "level" | "evByCycle" | "evMax"
  >;
};

export { Game };
