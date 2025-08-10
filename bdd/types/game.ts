import { Data } from "@strapi/strapi";

type Game = Pick<Data.ContentType<"api::game.game">, "id"> & {
  element?: Pick<Data.ContentType<"api::element.element">, "id">;
  gameHaveCurrencies?: Array<
    Pick<
      Data.ContentType<"api::game-have-currency.game-have-currency">,
      "id" | "amount"
    > & {
      currency?: Pick<Data.ContentType<"api::currency.currency">, "id">;
    }
  >;
  era?: Pick<
    Data.ContentType<"api::era.era">,
    "id" | "level" | "evByCycle" | "evMax"
  >;
};

export { Game };
