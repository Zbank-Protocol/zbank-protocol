import type { RoadmapPhase } from "../data/site";

/** One roadmap row: evidence, current state, and concrete scope. */
export function RoadmapStage({ stage }: { stage: RoadmapPhase }) {
  return (
    <div className="stage" data-mission={stage.mission ?? false} data-status={stage.status}>
      <div className="stage__meta">
        <span className="stage__phase">{stage.phase}</span>
        <span className="stage__status">{stage.status}</span>
      </div>
      <div className="stage__summary">
        <span className="stage__name">{stage.name}</span>
        <p className="stage__copy">{stage.copy}</p>
      </div>
      <ul className="stage__items">
        {stage.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
