import type { ParsedCapsule } from "./capsule.js";

export function MetricsDashboard({
  capsule,
  netStats,
  counts,
}: {
  capsule: ParsedCapsule;
  netStats: {
    sends: number;
    delivers: number;
    drops: number;
    dups: number;
    linkMap: Map<string, { sends: number; delivers: number; drops: number; dups: number }>;
  };
  counts: Map<string, number>;
}): JSX.Element {
  const { nodes, trace } = capsule;
  const totalEvents = trace.events.length;

  const dropRate = netStats.sends > 0 ? (netStats.drops / netStats.sends) * 100 : 0;
  const dupRate = netStats.sends > 0 ? (netStats.dups / netStats.sends) * 100 : 0;
  const deliveryRate = netStats.sends > 0 ? ((netStats.delivers + netStats.dups) / netStats.sends) * 100 : 0;

  const crashCount = counts.get("crash") ?? 0;
  const restartCount = counts.get("restart") ?? 0;
  const partitionCount = counts.get("partition") ?? 0;
  const totalFaults = crashCount + restartCount + partitionCount;

  return (
    <div className="dashboard-container">
      {/* 1. Metrics Grid */}
      <div className="dashboard-grid">
        <div className="dashboard-card">
          <div className="card-label">Total Events</div>
          <div className="card-val">{totalEvents}</div>
          <div className="card-desc">Logged trace steps</div>
        </div>
        <div className="dashboard-card">
          <div className="card-label">Msg Delivery Rate</div>
          <div className="card-val color-green">{deliveryRate.toFixed(1)}%</div>
          <div className="card-desc">{netStats.delivers} messages delivered</div>
        </div>
        <div className="dashboard-card">
          <div className="card-label">Msg Drop Rate</div>
          <div className={`card-val ${netStats.drops > 0 ? "color-red" : "color-gray"}`}>
            {dropRate.toFixed(1)}%
          </div>
          <div className="card-desc">{netStats.drops} packets lost</div>
        </div>
        <div className="dashboard-card">
          <div className="card-label">Msg Dup Rate</div>
          <div className={`card-val ${netStats.dups > 0 ? "color-amber" : "color-gray"}`}>
            {dupRate.toFixed(1)}%
          </div>
          <div className="card-desc">{netStats.dups} duplicates injected</div>
        </div>
        <div className="dashboard-card">
          <div className="card-label">Faults / Chaos</div>
          <div className={`card-val ${totalFaults > 0 ? "color-violet" : "color-gray"}`}>
            {totalFaults}
          </div>
          <div className="card-desc">{crashCount} crashes · {partitionCount} partitions</div>
        </div>
      </div>

      {/* 2. Network Link Matrix */}
      <div className="dashboard-section">
        <h3 className="section-hdr">Network Link Communication Matrix</h3>
        <div className="matrix-scroll">
          <table className="matrix-table">
            <thead>
              <tr>
                <th>From \ To</th>
                {nodes.map((n) => (
                  <th key={n}>{n}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {nodes.map((src) => (
                <tr key={src}>
                  <td className="node-hdr">{src}</td>
                  {nodes.map((dst) => {
                    if (src === dst) {
                      return <td key={dst} className="cell-self">—</td>;
                    }
                    const key = `${src}->${dst}`;
                    const stats = netStats.linkMap.get(key) ?? { sends: 0, delivers: 0, drops: 0, dups: 0 };
                    return (
                      <td key={dst} className="matrix-cell">
                        {stats.sends > 0 ? (
                          <div>
                            <div className="cell-sent">{stats.sends} sent</div>
                            <div className="cell-details">
                              <span className="color-green">{stats.delivers} ok</span> ·{" "}
                              {stats.drops > 0 && <span className="color-red">{stats.drops} drop</span>}
                              {stats.drops === 0 && <span>0 drop</span>}
                              {stats.dups > 0 && <span className="color-amber"> · {stats.dups} dup</span>}
                            </div>
                          </div>
                        ) : (
                          <span className="cell-empty">no messages</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
