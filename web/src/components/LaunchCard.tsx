import { ZLAUNCH } from "../data/site";

/**
 * The launch slate, rendered as the empty template it currently is: real table, honest dashes.
 * A fabricated project row would undercut the transparency section two scrolls below it.
 */
export function LaunchCard() {
  const row = ZLAUNCH.mockRow;

  return (
    <div className="launch">
      <div className="launch__head">
        <span className="metric__label">Launch slate</span>
        <span className="t-demo">Template — no live launches</span>
      </div>
      <div className="launch__scroll">
        <table className="launch__table">
        <thead>
          <tr>
            <th scope="col">Project</th>
            <th scope="col">Ticker</th>
            <th scope="col">ZEC raised</th>
            <th scope="col">Participants</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{row.project}</td>
            <td>{row.ticker}</td>
            <td>{row.raised}</td>
            <td>{row.participants}</td>
            <td>
              <span className="chip" data-status="Planned">
                {row.status}
              </span>
            </td>
          </tr>
        </tbody>
        </table>
      </div>
    </div>
  );
}
