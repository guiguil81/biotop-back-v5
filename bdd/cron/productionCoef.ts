import fixNumber from "../utils/fixNumber";

const coefs = [0.95, 1.1, 1.04];
const productionCoef = (
  initQty: number,
  reproductionCoef: number,
  gameElement: number,
  specieElement: number,
) => {
  if (gameElement === 1) {
    return fixNumber(initQty * (1.02 * reproductionCoef));
  }
  if (specieElement === 1) {
    return fixNumber(initQty * (0.98 * reproductionCoef));
  }

  const index = (gameElement - specieElement) % coefs.length;
  return fixNumber(initQty * (reproductionCoef * coefs[index]));
};

export default productionCoef;
