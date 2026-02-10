import { useState, useMemo } from "react";

const PHASES = [
  { id: "p1", name: "VM Provisioning", short: "P1", color: "#f472b6", weeks: [1,2] },
  { id: "p2", name: "Seed & Keychain", short: "P2", color: "#a78bfa", weeks: [2,3] },
  { id: "p3", name: "Micro-checkpoints", short: "P3", color: "#34d399", weeks: [3,4] },
  { id: "p4", name: "State Images", short: "P4", color: "#fbbf24", weeks: [4,5] },
  { id: "p5", name: "Threat-Aware Update", short: "P5", color: "#38bdf8", weeks: [5,7] },
  { id: "p6", name: "Golden Images", short: "P6", color: "#fb923c", weeks: [7,8] },
  { id: "p7", name: "Forensic Archive", short: "P7", color: "#f87171", weeks: [8,10] },
  { id: "p8", name: "Recovery Modes", short: "P8", color: "#818cf8", weeks: [9,10] },
  { id: "p9", name: "CLI/Docs/Hardening", short: "P9", color: "#2dd4bf", weeks: [10,12] },
];

const STATUS_OPTIONS = ["backlog","todo","inprogress","review","done"];
const STATUS_LABELS = { backlog: "Backlog", todo: "To Do", inprogress: "In Progress", review: "Review", done: "Done" };
const STATUS_COLORS = { backlog: "#475569", todo: "#64748b", inprogress: "#38bdf8", review: "#a78bfa", done: "#34d399" };

const initialTasks = [
  { id:"t1", title:"Hypervisor selection & PoC", phase:"p1", critical:true, status:"backlog" },
  { id:"t2", title:"Base Ubuntu 24.04 arm64 image", phase:"p1", critical:false, status:"backlog" },
  { id:"t3", title:"Network isolation & egress firewall", phase:"p1", critical:false, status:"backlog" },
  { id:"t4", title:"Encrypted QCOW2 disk + snapshots", phase:"p1", critical:true, status:"backlog" },
  { id:"t5", title:"Seed generation (256-bit CSPRNG)", phase:"p2", critical:false, status:"backlog" },
  { id:"t6", title:"HKDF key hierarchy derivation", phase:"p2", critical:true, status:"backlog" },
  { id:"t7", title:"macOS Keychain integration", phase:"p2", critical:false, status:"backlog" },
  { id:"t8", title:"BIP-39 mnemonic backup", phase:"p2", critical:false, status:"backlog" },
  { id:"t9", title:"State layer mapping", phase:"p3", critical:false, status:"backlog" },
  { id:"t10", title:"Hourly incremental diff agent", phase:"p3", critical:true, status:"backlog" },
  { id:"t11", title:"Micro-checkpoint storage (7-day)", phase:"p3", critical:false, status:"backlog" },
  { id:"t12", title:"Micro-rollback restore procedure", phase:"p3", critical:false, status:"backlog" },
  { id:"t13", title:"Full state tar pipeline", phase:"p4", critical:false, status:"backlog" },
  { id:"t14", title:"LLM memory integrity scan", phase:"p4", critical:true, status:"backlog" },
  { id:"t15", title:"Skill hash audit (VT cross-ref)", phase:"p4", critical:false, status:"backlog" },
  { id:"t16", title:"Config drift detection", phase:"p4", critical:false, status:"backlog" },
  { id:"t17", title:"GitHub release metadata fetcher", phase:"p5", critical:false, status:"backlog" },
  { id:"t18", title:"GPG/SSH commit sig verification", phase:"p5", critical:true, status:"backlog" },
  { id:"t19", title:"CVE/GHSA threat intelligence", phase:"p5", critical:false, status:"backlog" },
  { id:"t20", title:"LLM-assisted diff review", phase:"p5", critical:true, status:"backlog" },
  { id:"t21", title:"Sandbox test sub-VM", phase:"p5", critical:false, status:"backlog" },
  { id:"t22", title:"Trust scoring model", phase:"p5", critical:false, status:"backlog" },
  { id:"t23", title:"Full VM QCOW2 snapshot pipeline", phase:"p6", critical:false, status:"backlog" },
  { id:"t24", title:"Post-snapshot threat pipeline", phase:"p6", critical:true, status:"backlog" },
  { id:"t25", title:"Golden image retention (min 3)", phase:"p6", critical:false, status:"backlog" },
  { id:"t26", title:"Append-only encrypted archive vol", phase:"p7", critical:true, status:"backlog" },
  { id:"t27", title:"Pre-reset state capture automation", phase:"p7", critical:true, status:"backlog" },
  { id:"t28", title:"LLM dissection pipeline", phase:"p7", critical:false, status:"backlog" },
  { id:"t29", title:"Skill autopsy & config drift", phase:"p7", critical:false, status:"backlog" },
  { id:"t30", title:"Network forensics (egress logs)", phase:"p7", critical:false, status:"backlog" },
  { id:"t31", title:"Timeline reconstruction engine", phase:"p7", critical:false, status:"backlog" },
  { id:"t32", title:"Immunity Ledger + IOC blocklist", phase:"p7", critical:true, status:"backlog" },
  { id:"t33", title:"Hot-patch delivery to running VM", phase:"p7", critical:false, status:"backlog" },
  { id:"t34", title:"Micro-rollback CLI", phase:"p8", critical:false, status:"backlog" },
  { id:"t35", title:"State restore CLI", phase:"p8", critical:false, status:"backlog" },
  { id:"t36", title:"Golden restore CLI", phase:"p8", critical:false, status:"backlog" },
  { id:"t37", title:"Seed reset w/ forensic capture", phase:"p8", critical:true, status:"backlog" },
  { id:"t38", title:"Unified installer CLI (ocsi)", phase:"p9", critical:false, status:"backlog" },
  { id:"t39", title:"User docs & runbooks", phase:"p9", critical:false, status:"backlog" },
  { id:"t40", title:"Integration test suite", phase:"p9", critical:true, status:"backlog" },
  { id:"t41", title:"Penetration testing & hardening", phase:"p9", critical:false, status:"backlog" },
];

function Bar({ value, max, color, height = 10, bg = "#1e293b" }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ background: bg, borderRadius: height/2, height, width: "100%", overflow: "hidden", position: "relative" }}>
      <div style={{ background: color, height: "100%", width: `${pct}%`, borderRadius: height/2, transition: "width 0.4s ease" }} />
    </div>
  );
}

function Stat({ label, value, sub, color = "#f8fafc", size = 28 }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: size, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: "#64748b", marginTop: 4, fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function PhaseRow({ phase, tasks, onToggle, expanded, onExpand }) {
  const total = tasks.length;
  const done = tasks.filter(t => t.status === "done").length;
  const inProg = tasks.filter(t => t.status === "inprogress" || t.status === "review").length;
  const critical = tasks.filter(t => t.critical);
  const critDone = critical.filter(t => t.status === "done").length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const phaseStatus = done === total ? "complete" : inProg > 0 ? "active" : done > 0 ? "partial" : "pending";
  const statusIcon = { complete: "✅", active: "🔨", partial: "◐", pending: "○" }[phaseStatus];

  return (
    <div style={{ borderBottom: "1px solid #1e293b" }}>
      <div onClick={() => onExpand(phase.id)} style={{
        display: "grid", gridTemplateColumns: "36px 40px 1fr 100px 140px 80px 60px",
        alignItems: "center", padding: "10px 14px", cursor: "pointer", gap: 10,
        background: expanded ? "#111827" : "transparent",
        transition: "background 0.15s",
      }}
      onMouseEnter={e => { if (!expanded) e.currentTarget.style.background = "#0f1520"; }}
      onMouseLeave={e => { if (!expanded) e.currentTarget.style.background = "transparent"; }}
      >
        <span style={{ fontSize: 14, textAlign: "center" }}>{statusIcon}</span>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700,
          color: phase.color, background: phase.color + "18", padding: "2px 6px",
          borderRadius: 4, textAlign: "center",
        }}>{phase.short}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>{phase.name}</span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#64748b" }}>W{phase.weeks[0]}–W{phase.weeks[1]}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Bar value={done} max={total} color={phase.color} />
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: phase.color, fontWeight: 700, minWidth: 32 }}>{pct}%</span>
        </div>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: critDone === critical.length && critical.length > 0 ? "#34d399" : "#f97316" }}>
          {critDone}/{critical.length} crit
        </span>
        <span style={{ color: "#475569", fontSize: 12, textAlign: "right" }}>{expanded ? "▾" : "▸"}</span>
      </div>
      {expanded && (
        <div style={{ padding: "0 14px 12px 14px", background: "#111827" }}>
          {tasks.map(t => (
            <div key={t.id} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "6px 10px",
              borderRadius: 6, marginBottom: 4, background: "#0a0e17",
              border: `1px solid ${t.critical ? "#f9731933" : "#1e293b"}`,
            }}>
              {t.critical && <span style={{ fontSize: 8, color: "#f97316", fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, background: "#f9731618", padding: "1px 5px", borderRadius: 3 }}>CRIT</span>}
              <span style={{ fontSize: 12, color: t.status === "done" ? "#64748b" : "#e2e8f0", flex: 1, textDecoration: t.status === "done" ? "line-through" : "none" }}>{t.title}</span>
              <select
                value={t.status}
                onChange={e => onToggle(t.id, e.target.value)}
                style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
                  background: STATUS_COLORS[t.status] + "22", color: STATUS_COLORS[t.status],
                  border: `1px solid ${STATUS_COLORS[t.status]}44`, borderRadius: 4,
                  padding: "3px 6px", cursor: "pointer", outline: "none",
                }}
              >
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MiniHeatmap({ tasks }) {
  const weeks = Array.from({ length: 12 }, (_, i) => i + 1);
  return (
    <div style={{ display: "flex", gap: 3, alignItems: "flex-end" }}>
      {weeks.map(w => {
        const phase = PHASES.find(p => w >= p.weeks[0] && w <= p.weeks[1]);
        const phaseTasks = phase ? tasks.filter(t => t.phase === phase.id) : [];
        const done = phaseTasks.filter(t => t.status === "done").length;
        const total = phaseTasks.length;
        const pct = total > 0 ? done / total : 0;
        const h = 4 + pct * 28;
        return (
          <div key={w} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <div style={{
              width: 18, height: h, borderRadius: 3,
              background: phase ? (pct === 1 ? "#34d399" : pct > 0 ? phase.color : "#1e293b") : "#1e293b",
              transition: "height 0.3s ease",
              opacity: pct > 0 ? 1 : 0.4,
            }} />
            <span style={{ fontSize: 8, color: "#475569", fontFamily: "'JetBrains Mono', monospace" }}>W{w}</span>
          </div>
        );
      })}
    </div>
  );
}

function RiskGauge({ tasks }) {
  const critical = tasks.filter(t => t.critical);
  const critNotDone = critical.filter(t => t.status !== "done").length;
  const total = critical.length;
  const riskPct = total > 0 ? (critNotDone / total) * 100 : 0;
  const color = riskPct > 70 ? "#ef4444" : riskPct > 40 ? "#f97316" : riskPct > 10 ? "#fbbf24" : "#34d399";
  const label = riskPct > 70 ? "HIGH" : riskPct > 40 ? "ELEVATED" : riskPct > 10 ? "MODERATE" : "LOW";

  const r = 44;
  const circ = 2 * Math.PI * r;
  const arc = circ * 0.75;
  const offset = arc - (arc * (100 - riskPct) / 100);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg width="100" height="80" viewBox="0 0 100 80">
        <path d="M 6 74 A 44 44 0 1 1 94 74" fill="none" stroke="#1e293b" strokeWidth="7" strokeLinecap="round" />
        <path d="M 6 74 A 44 44 0 1 1 94 74" fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={`${arc}`} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s ease, stroke 0.3s" }}
        />
        <text x="50" y="52" textAnchor="middle" fill={color} fontSize="18" fontWeight="700" fontFamily="'JetBrains Mono', monospace">{critNotDone}</text>
        <text x="50" y="66" textAnchor="middle" fill="#64748b" fontSize="8" fontFamily="'JetBrains Mono', monospace">/{total} OPEN</text>
      </svg>
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 700, color, marginTop: -4 }}>{label} RISK</span>
    </div>
  );
}

function FlowSankey({ tasks }) {
  const counts = {};
  STATUS_OPTIONS.forEach(s => { counts[s] = tasks.filter(t => t.status === s).length; });
  const max = Math.max(...Object.values(counts), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 60 }}>
      {STATUS_OPTIONS.map((s, i) => {
        const h = Math.max(4, (counts[s] / max) * 56);
        return (
          <div key={s} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, flex: 1 }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 700, color: STATUS_COLORS[s] }}>{counts[s]}</span>
            <div style={{ width: "100%", height: h, background: STATUS_COLORS[s], borderRadius: 3, transition: "height 0.3s" }} />
            <span style={{ fontSize: 8, color: "#64748b", fontFamily: "'JetBrains Mono', monospace", textAlign: "center" }}>{STATUS_LABELS[s].split(" ").map(w=>w[0]).join("")}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function Dashboard() {
  const [tasks, setTasks] = useState(initialTasks);
  const [expandedPhase, setExpandedPhase] = useState(null);

  const toggleStatus = (id, newStatus) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));
  };

  const toggleExpand = (phaseId) => {
    setExpandedPhase(prev => prev === phaseId ? null : phaseId);
  };

  const stats = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter(t => t.status === "done").length;
    const inProg = tasks.filter(t => t.status === "inprogress").length;
    const review = tasks.filter(t => t.status === "review").length;
    const crit = tasks.filter(t => t.critical);
    const critDone = crit.filter(t => t.status === "done").length;
    const phasesComplete = PHASES.filter(p => {
      const pt = tasks.filter(t => t.phase === p.id);
      return pt.length > 0 && pt.every(t => t.status === "done");
    }).length;
    return { total, done, inProg, review, crit: crit.length, critDone, phasesComplete, pct: Math.round((done/total)*100) };
  }, [tasks]);

  const currentWeek = useMemo(() => {
    const start = new Date("2026-02-10");
    const now = new Date();
    return Math.max(1, Math.min(12, Math.ceil((now - start) / (7*24*60*60*1000))));
  }, []);

  const expectedPhase = PHASES.find(p => currentWeek >= p.weeks[0] && currentWeek <= p.weeks[1]);

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: "#0a0e17", minHeight: "100vh", color: "#e2e8f0" }}>
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #1e293b", background: "linear-gradient(180deg, #0f1520, #0a0e17)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h1 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700, margin: 0 }}>
              <span style={{ color: "#38bdf8" }}>◉</span> OpenClaw Secure Installer — <span style={{ color: "#38bdf8" }}>Dashboard</span>
            </h1>
            <div style={{ fontSize: 11, color: "#64748b", fontFamily: "'JetBrains Mono', monospace", marginTop: 4 }}>
              Week {currentWeek}/12 {expectedPhase && <span>• Expected: <span style={{ color: expectedPhase.color }}>{expectedPhase.name}</span></span>}
            </div>
          </div>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 36, fontWeight: 700,
            color: stats.pct === 100 ? "#34d399" : stats.pct > 60 ? "#38bdf8" : stats.pct > 30 ? "#fbbf24" : "#f8fafc",
            lineHeight: 1,
          }}>
            {stats.pct}<span style={{ fontSize: 16, color: "#64748b" }}>%</span>
          </div>
        </div>
      </div>

      {/* Top metrics row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 0, borderBottom: "1px solid #1e293b" }}>
        {[
          { label: "Total Tasks", value: stats.total, color: "#f8fafc" },
          { label: "Done", value: stats.done, color: "#34d399" },
          { label: "In Progress", value: stats.inProg, color: "#38bdf8" },
          { label: "In Review", value: stats.review, color: "#a78bfa" },
          { label: "Critical Done", value: `${stats.critDone}/${stats.crit}`, color: stats.critDone === stats.crit ? "#34d399" : "#f97316" },
          { label: "Phases Complete", value: `${stats.phasesComplete}/9`, color: stats.phasesComplete === 9 ? "#34d399" : "#fbbf24" },
        ].map((s, i) => (
          <div key={i} style={{ padding: "16px 12px", borderRight: "1px solid #1e293b", display: "flex", justifyContent: "center" }}>
            <Stat label={s.label} value={s.value} color={s.color} size={22} />
          </div>
        ))}
      </div>

      {/* Overall progress bar */}
      <div style={{ padding: "14px 24px", borderBottom: "1px solid #1e293b" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>Overall Progress</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 0, height: 14, borderRadius: 7, overflow: "hidden", background: "#1e293b" }}>
          {PHASES.map(p => {
            const pt = tasks.filter(t => t.phase === p.id);
            const done = pt.filter(t => t.status === "done").length;
            const w = (pt.length / tasks.length) * 100;
            const filled = pt.length > 0 ? (done / pt.length) : 0;
            return (
              <div key={p.id} style={{ width: `${w}%`, height: "100%", position: "relative", borderRight: "1px solid #0a0e17" }}>
                <div style={{ position: "absolute", inset: 0, background: p.color + "33" }} />
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${filled*100}%`, background: p.color, transition: "width 0.4s" }} />
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
          {PHASES.map(p => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, color: "#64748b", fontFamily: "'JetBrains Mono', monospace" }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: p.color }} />
              {p.short}
            </div>
          ))}
        </div>
      </div>

      {/* Widgets row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0, borderBottom: "1px solid #1e293b" }}>
        <div style={{ padding: 20, borderRight: "1px solid #1e293b" }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Critical Path Risk</div>
          <RiskGauge tasks={tasks} />
        </div>
        <div style={{ padding: 20, borderRight: "1px solid #1e293b" }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Task Flow Distribution</div>
          <FlowSankey tasks={tasks} />
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Weekly Completion Heatmap</div>
          <MiniHeatmap tasks={tasks} />
        </div>
      </div>

      {/* Phase detail list */}
      <div>
        <div style={{
          display: "grid", gridTemplateColumns: "36px 40px 1fr 100px 140px 80px 60px",
          padding: "8px 14px", gap: 10, borderBottom: "1px solid #1e293b",
          fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#475569",
          textTransform: "uppercase", letterSpacing: 1, background: "#0f1520",
        }}>
          <span></span><span></span><span>Phase</span><span>Timeline</span><span>Progress</span><span>Critical</span><span></span>
        </div>
        {PHASES.map(p => (
          <PhaseRow
            key={p.id}
            phase={p}
            tasks={tasks.filter(t => t.phase === p.id)}
            onToggle={toggleStatus}
            expanded={expandedPhase === p.id}
            onExpand={toggleExpand}
          />
        ))}
      </div>

      {/* Footer hint */}
      <div style={{ padding: "16px 24px", borderTop: "1px solid #1e293b", fontSize: 11, color: "#475569", fontFamily: "'JetBrains Mono', monospace", textAlign: "center" }}>
        Click any phase to expand • Change task status via dropdown • All metrics update in real time
      </div>
    </div>
  );
}
