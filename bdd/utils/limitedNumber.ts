import MAX_NUMBER from "../config/config";

const limitedNumber = (number: number | string) => {
  let newNumber: number;
  if (typeof number === "string") {
    newNumber = parseInt(number, 10);
  } else {
    newNumber = number;
  }

  if (newNumber < 0) {
    return 0;
  }
  if (newNumber > MAX_NUMBER) {
    return MAX_NUMBER;
  }
  return newNumber;
};

export default limitedNumber;
