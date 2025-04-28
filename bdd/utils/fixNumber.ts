import limitedNumber from "./limitedNumber";

const fixNumber = (number: number | string) => {
  if (typeof number === "string") {
    return limitedNumber(Math.round(parseInt(number, 10)));
  }
  return limitedNumber(Math.round(number));
};

export default fixNumber;
