import getCurrentRound from "../getters/round";
import { getCurrentGames } from "../getters/game";
import gameProcess from "./gameProcess";
import { Game, RoundIdOnly } from "../types";

export default module.exports = {
  "* * * * * *": async () => {
    console.time("ExecutionCron");

    const currentRound: RoundIdOnly[] = await getCurrentRound();

    if (currentRound.length === 0) return null;

    const currentGames: Game[] = await getCurrentGames(currentRound);

    currentGames.forEach((game) => {
      gameProcess(game);
    });

    console.timeEnd("ExecutionCron");
  },
};
