import type { Progress } from "../progress/Progress";
import { Scheduler, type Review } from "../scheduler/Scheduler";
import { initialRating } from "./rating";
import { puzzleCards, type WoodpeckerSet } from "./training";

/** Puzzle use-case port: the UI never owns database or scheduling transactions. */
export class PuzzleTraining {
  private readonly scheduler: Scheduler<ReturnType<typeof puzzleCards>[number]>;
  constructor(private readonly progress: Progress) {
    this.scheduler = new Scheduler(puzzleCards, progress);
  }
  async snapshot() {
    const data = await this.progress.snapshot();
    return {
      reviews: data.reviewLog,
      rating: data.puzzleRating[0] ?? initialRating,
      sets: data.woodpeckerSets,
    };
  }
  record(review: Review) {
    return this.scheduler.record(review);
  }
  due(now: number) {
    return this.scheduler.due(now);
  }
  saveSet(set: WoodpeckerSet) {
    return this.progress.saveWoodpeckerSet(set);
  }
}
