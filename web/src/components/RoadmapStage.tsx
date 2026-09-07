import type { RoadmapPhase } from "../data/site";

/** One roadmap row: phase, name, one sentence. Institutional, not a rocket in sight. */
export function RoadmapStage({ stage }: { stage: RoadmapPhase }) {
  return (
    <div className="stage" data-mission={stage.mission ?? false}>
      <span className="stage__phase">{stage.phase}</span>
      <span className="stage__name">{stage.name}</span>
      <p className="stage__copy">{stage.copy}</p>
    </div>
  );
}
