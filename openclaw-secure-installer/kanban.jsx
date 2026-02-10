import { useState, useCallback, useRef, useEffect } from "react";

const PHASES = {
  p1: { name: "P1", full: "VM Provisioning", color: "#f472b6" },
  p2: { name: "P2", full: "Seed & Keychain", color: "#a78bfa" },
  p3: { name: "P3", full: "Micro-checkpoints", color: "#34d399" },
  p4: { name: "P4", full: "State Images", color: "#fbbf24" },
  p5: { name: "P5", full: "Threat-Aware Update", color: "#38bdf8" },
  p6: { name: "P6", full: "Golden Images", color: "#fb923c" },
  p7: { name: "P7", full: "Forensic Archive", color: "#f87171" },
  p8: { name: "P8", full: "Recovery Modes", color: "#818cf8" },
  p9: { name: "P9", full: "CLI/Docs/Hardening", color: "#2dd4bf" },
};

const COLUMNS = [
  { id: "backlog", name: "Backlog", icon: "📋" },
  { id: "todo", name: "To Do", icon: "📌" },
  { id: "inprogress", name: "In Progress", icon: "🔨" },
  { id: "review", name: "Review", icon: "🔍" },
  { id: "done", name: "Done", icon: "✅" },
];

const initialCards = [
  // P1
  { id: "t1", title: "Hypervisor selection & PoC", phase: "p1", column: "todo", critical: true, weeks: "W1–W2", desc: "Evaluate UTM vs Tart on Apple Silicon", questions: [], blockers: [] },
  { id: "t2", title: "Base Ubuntu 24.04 arm64 image", phase: "p1", column: "backlog", critical: false, weeks: "W1–W2", desc: "Minimal server install, hardened kernel", questions: [], blockers: [] },
  { id: "t3", title: "Network isolation & egress firewall", phase: "p1", column: "backlog", critical: false, weeks: "W1–W2", desc: "NAT + iptables allowlist for API endpoints", questions: [], blockers: [] },
  { id: "t4", title: "Encrypted QCOW2 disk + snapshots", phase: "p1", column: "backlog", critical: true, weeks: "W2", desc: "LUKS encryption, snapshot API integration", questions: [], blockers: [] },
  // P2
  { id: "t5", title: "Seed generation (256-bit CSPRNG)", phase: "p2", column: "backlog", critical: false, weeks: "W2–W3", desc: "Hardware RNG, HKDF-SHA256 derivation", questions: [], blockers: [] },
  { id: "t6", title: "HKDF key hierarchy derivation", phase: "p2", column: "backlog", critical: true, weeks: "W3", desc: "VM key, identity token, signing keys, vault key", questions: [], blockers: [] },
  { id: "t7", title: "macOS Keychain integration", phase: "p2", column: "backlog", critical: false, weeks: "W3", desc: "Secure seed storage, never inside VM", questions: [], blockers: [] },
  { id: "t8", title: "BIP-39 mnemonic backup", phase: "p2", column: "backlog", critical: false, weeks: "W3–W4", desc: "Recovery phrase generation & verification", questions: [], blockers: [] },
  // P3
  { id: "t9", title: "State layer mapping", phase: "p3", column: "backlog", critical: false, weeks: "W3–W4", desc: "Map ~/clawd/, ~/.openclaw/, skills, SQLite", questions: [], blockers: [] },
  { id: "t10", title: "Hourly incremental diff agent", phase: "p3", column: "backlog", critical: true, weeks: "W4", desc: "Cron-based diff + SHA-256 integrity hashing", questions: [], blockers: [] },
  { id: "t11", title: "Micro-checkpoint storage (7-day)", phase: "p3", column: "backlog", critical: false, weeks: "W4", desc: "In-VM storage, auto-pruning, ~5MB each", questions: [], blockers: [] },
  { id: "t12", title: "Micro-rollback restore procedure", phase: "p3", column: "backlog", critical: false, weeks: "W4–W5", desc: "CLI rollback to any hourly checkpoint", questions: [], blockers: [] },
  // P4
  { id: "t13", title: "Full state tar pipeline (encrypted)", phase: "p4", column: "backlog", critical: false, weeks: "W4–W5", desc: "Atomic capture to seed-encrypted tar on host", questions: [], blockers: [] },
  { id: "t14", title: "LLM memory integrity scan", phase: "p4", column: "backlog", critical: true, weeks: "W5", desc: "Detect prompt injection, base64 blobs, anomalies", questions: [], blockers: [] },
  { id: "t15", title: "Skill hash audit (VT cross-ref)", phase: "p4", column: "backlog", critical: false, weeks: "W5", desc: "Hash all skills vs VirusTotal-verified versions", questions: [], blockers: [] },
  { id: "t16", title: "Config drift detection baseline", phase: "p4", column: "backlog", critical: false, weeks: "W5–W6", desc: "Signed baseline, alert on unauthorized changes", questions: [], blockers: [] },
  // P5
  { id: "t17", title: "GitHub release metadata fetcher", phase: "p5", column: "backlog", critical: false, weeks: "W5–W6", desc: "Tags, changelogs, commit diffs via GitHub API", questions: [], blockers: [] },
  { id: "t18", title: "GPG/SSH commit sig verification", phase: "p5", column: "backlog", critical: true, weeks: "W6", desc: "Pinned maintainer keys, reject unsigned", questions: [], blockers: [] },
  { id: "t19", title: "CVE/GHSA threat intelligence", phase: "p5", column: "backlog", critical: false, weeks: "W6–W7", desc: "Query NVD, GHSA, trust.openclaw.ai", questions: [], blockers: [] },
  { id: "t20", title: "LLM-assisted diff review", phase: "p5", column: "backlog", critical: true, weeks: "W6–W7", desc: "SOTA model reviews code diff for suspicious patterns", questions: [], blockers: [] },
  { id: "t21", title: "Sandbox test sub-VM", phase: "p5", column: "backlog", critical: false, weeks: "W7", desc: "Disposable clone + Cisco Skill Scanner", questions: [], blockers: [] },
  { id: "t22", title: "Trust scoring model", phase: "p5", column: "backlog", critical: false, weeks: "W7", desc: "Weighted signals: sig + CVE + sentiment + VT", questions: [], blockers: [] },
  // P6
  { id: "t23", title: "Full VM QCOW2 snapshot pipeline", phase: "p6", column: "backlog", critical: false, weeks: "W7–W8", desc: "Complete disk snapshot, compressed & encrypted", questions: [], blockers: [] },
  { id: "t24", title: "Post-snapshot threat pipeline", phase: "p6", column: "backlog", critical: true, weeks: "W8", desc: "Full CVE + skill + diff + sandbox verification", questions: [], blockers: [] },
  { id: "t25", title: "Golden image retention (min 3)", phase: "p6", column: "backlog", critical: false, weeks: "W8", desc: "Storage management, pruning policy", questions: [], blockers: [] },
  // P7
  { id: "t26", title: "Append-only encrypted archive vol", phase: "p7", column: "backlog", critical: true, weeks: "W8–W9", desc: "Immutable write-once storage, separate key", questions: [], blockers: [] },
  { id: "t27", title: "Pre-reset state capture automation", phase: "p7", column: "backlog", critical: true, weeks: "W9", desc: "Freeze & archive before ANY reset tier", questions: [], blockers: [] },
  { id: "t28", title: "LLM dissection pipeline", phase: "p7", column: "backlog", critical: false, weeks: "W9–W10", desc: "Memory forensics: fragmented payloads, identity manipulation", questions: [], blockers: [] },
  { id: "t29", title: "Skill autopsy & config drift", phase: "p7", column: "backlog", critical: false, weeks: "W9–W10", desc: "Tampering detection, unauthorized integrations", questions: [], blockers: [] },
  { id: "t30", title: "Network forensics (egress logs)", phase: "p7", column: "backlog", critical: false, weeks: "W9–W10", desc: "C2 detection, exfiltration patterns", questions: [], blockers: [] },
  { id: "t31", title: "Timeline reconstruction engine", phase: "p7", column: "backlog", critical: false, weeks: "W9–W10", desc: "Correlate timestamps across all state layers", questions: [], blockers: [] },
  { id: "t32", title: "Immunity Ledger + IOC blocklist", phase: "p7", column: "backlog", critical: true, weeks: "W10", desc: "Distill incidents → IOCs, signatures, rules", questions: [], blockers: [] },
  { id: "t33", title: "Hot-patch delivery to running VM", phase: "p7", column: "backlog", critical: false, weeks: "W10", desc: "Live firewall/scanner updates, no reset needed", questions: [], blockers: [] },
  // P8
  { id: "t34", title: "Micro-rollback CLI", phase: "p8", column: "backlog", critical: false, weeks: "W9–W10", desc: "< 1 hour time loss recovery", questions: [], blockers: [] },
  { id: "t35", title: "State restore CLI", phase: "p8", column: "backlog", critical: false, weeks: "W10", desc: "< 24 hour time loss, re-scan skills", questions: [], blockers: [] },
  { id: "t36", title: "Golden restore CLI", phase: "p8", column: "backlog", critical: false, weeks: "W10", desc: "< 7 day time loss, full VM restore", questions: [], blockers: [] },
  { id: "t37", title: "Seed reset w/ forensic capture", phase: "p8", column: "backlog", critical: true, weeks: "W10–W11", desc: "Archive → destroy → reprovision → Immunity Ledger", questions: [], blockers: [] },
  // P9
  { id: "t38", title: "Unified installer CLI (ocsi)", phase: "p9", column: "backlog", critical: false, weeks: "W10–W11", desc: "ocsi install|update|checkpoint|reset|forensic", questions: [], blockers: [] },
  { id: "t39", title: "User docs & runbooks", phase: "p9", column: "backlog", critical: false, weeks: "W11–W12", desc: "Installation guide, security runbooks, playbooks", questions: [], blockers: [] },
  { id: "t40", title: "Integration test suite", phase: "p9", column: "backlog", critical: true, weeks: "W11–W12", desc: "End-to-end: install → compromise → recover → inoculate", questions: [], blockers: [] },
  { id: "t41", title: "Penetration testing & hardening", phase: "p9", column: "backlog", critical: false, weeks: "W11–W12", desc: "Red team, VM escape attempts, injection battery", questions: [], blockers: [] },
];

function PhaseBadge({ phase }) {
  const p = PHASES[phase];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 10, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
      background: p.color + "22", color: p.color, padding: "2px 7px",
      borderRadius: 4, border: `1px solid ${p.color}44`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: p.color }} />
      {p.name}
    </span>
  );
}

function Card({ card, onDragStart, onOpenDetail }) {
  const p = PHASES[card.phase];
  const hasQuestions = card.questions.length > 0;
  const hasBlockers = card.blockers.length > 0;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, card.id)}
      onClick={() => onOpenDetail(card.id)}
      style={{
        background: "#111827",
        border: `1px solid ${hasBlockers ? "#ef4444" : "#1e293b"}`,
        borderLeft: `3px solid ${p.color}`,
        borderRadius: 8,
        padding: "10px 12px",
        marginBottom: 8,
        cursor: "grab",
        transition: "all 0.15s",
        boxShadow: hasBlockers ? "0 0 8px rgba(239,68,68,0.15)" : "none",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "#1a2234"; e.currentTarget.style.transform = "translateY(-1px)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "#111827"; e.currentTarget.style.transform = "none"; }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <PhaseBadge phase={card.phase} />
        {card.critical && (
          <span style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace", color: "#ef4444", background: "#ef444422", padding: "1px 5px", borderRadius: 3, fontWeight: 700 }}>
            CRITICAL
          </span>
        )}
        <span style={{ marginLeft: "auto", fontSize: 10, color: "#64748b", fontFamily: "'JetBrains Mono', monospace" }}>{card.weeks}</span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", lineHeight: 1.4, marginBottom: 4 }}>{card.title}</div>
      <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.4 }}>{card.desc}</div>
      {(hasQuestions || hasBlockers) && (
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          {hasQuestions && (
            <span style={{ fontSize: 10, color: "#fbbf24", background: "#fbbf2418", padding: "2px 6px", borderRadius: 3 }}>
              ❓ {card.questions.length} question{card.questions.length > 1 ? "s" : ""}
            </span>
          )}
          {hasBlockers && (
            <span style={{ fontSize: 10, color: "#ef4444", background: "#ef444418", padding: "2px 6px", borderRadius: 3 }}>
              🚫 {card.blockers.length} blocker{card.blockers.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function DetailModal({ card, onClose, onUpdate }) {
  const [newQ, setNewQ] = useState("");
  const [newB, setNewB] = useState("");
  if (!card) return null;
  const p = PHASES[card.phase];

  const addQuestion = () => {
    if (!newQ.trim()) return;
    onUpdate({ ...card, questions: [...card.questions, { text: newQ.trim(), ts: new Date().toLocaleString(), resolved: false }] });
    setNewQ("");
  };
  const addBlocker = () => {
    if (!newB.trim()) return;
    onUpdate({ ...card, blockers: [...card.blockers, { text: newB.trim(), ts: new Date().toLocaleString(), resolved: false }] });
    setNewB("");
  };
  const toggleQ = (i) => {
    const qs = [...card.questions];
    qs[i] = { ...qs[i], resolved: !qs[i].resolved };
    onUpdate({ ...card, questions: qs });
  };
  const toggleB = (i) => {
    const bs = [...card.blockers];
    bs[i] = { ...bs[i], resolved: !bs[i].resolved };
    onUpdate({ ...card, blockers: bs });
  };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: "#0f1520", border: "1px solid #1e293b", borderRadius: 12,
        width: "100%", maxWidth: 560, maxHeight: "85vh", overflow: "auto",
        padding: 24, boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <PhaseBadge phase={card.phase} />
          {card.critical && <span style={{ fontSize: 10, color: "#ef4444", background: "#ef444422", padding: "2px 6px", borderRadius: 3, fontWeight: 700, fontFamily: "monospace" }}>CRITICAL</span>}
          <span style={{ marginLeft: "auto", fontSize: 11, color: "#64748b", fontFamily: "monospace" }}>{card.weeks}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#64748b", fontSize: 20, cursor: "pointer", padding: "0 4px" }}>✕</button>
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#f8fafc", marginBottom: 8 }}>{card.title}</h2>
        <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6, marginBottom: 20 }}>{card.desc}</p>
        <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>Phase: <span style={{ color: p.color }}>{p.full}</span></div>

        {/* Questions */}
        <div style={{ marginTop: 20, borderTop: "1px solid #1e293b", paddingTop: 16 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "#fbbf24", marginBottom: 10 }}>❓ Questions ({card.questions.filter(q => !q.resolved).length} open)</h3>
          {card.questions.map((q, i) => (
            <div key={i} onClick={() => toggleQ(i)} style={{
              display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 10px",
              background: q.resolved ? "#1a2234" : "#fbbf2408", borderRadius: 6, marginBottom: 6,
              cursor: "pointer", border: `1px solid ${q.resolved ? "#1e293b" : "#fbbf2433"}`,
            }}>
              <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{q.resolved ? "☑" : "☐"}</span>
              <div>
                <div style={{ fontSize: 12, color: q.resolved ? "#64748b" : "#e2e8f0", textDecoration: q.resolved ? "line-through" : "none" }}>{q.text}</div>
                <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>{q.ts}</div>
              </div>
            </div>
          ))}
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <input
              value={newQ} onChange={(e) => setNewQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addQuestion()}
              placeholder="Add a question..."
              style={{ flex: 1, background: "#111827", border: "1px solid #1e293b", borderRadius: 6, padding: "7px 10px", color: "#e2e8f0", fontSize: 12, outline: "none" }}
            />
            <button onClick={addQuestion} style={{
              background: "#fbbf24", color: "#000", border: "none", borderRadius: 6, padding: "7px 14px",
              fontWeight: 700, fontSize: 11, cursor: "pointer",
            }}>Ask</button>
          </div>
        </div>

        {/* Blockers */}
        <div style={{ marginTop: 20, borderTop: "1px solid #1e293b", paddingTop: 16 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "#ef4444", marginBottom: 10 }}>🚫 Blockers ({card.blockers.filter(b => !b.resolved).length} active)</h3>
          {card.blockers.map((b, i) => (
            <div key={i} onClick={() => toggleB(i)} style={{
              display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 10px",
              background: b.resolved ? "#1a2234" : "#ef444408", borderRadius: 6, marginBottom: 6,
              cursor: "pointer", border: `1px solid ${b.resolved ? "#1e293b" : "#ef444433"}`,
            }}>
              <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{b.resolved ? "☑" : "☐"}</span>
              <div>
                <div style={{ fontSize: 12, color: b.resolved ? "#64748b" : "#e2e8f0", textDecoration: b.resolved ? "line-through" : "none" }}>{b.text}</div>
                <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>{b.ts}</div>
              </div>
            </div>
          ))}
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <input
              value={newB} onChange={(e) => setNewB(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addBlocker()}
              placeholder="Add a blocker..."
              style={{ flex: 1, background: "#111827", border: "1px solid #1e293b", borderRadius: 6, padding: "7px 10px", color: "#e2e8f0", fontSize: 12, outline: "none" }}
            />
            <button onClick={addBlocker} style={{
              background: "#ef4444", color: "#fff", border: "none", borderRadius: 6, padding: "7px 14px",
              fontWeight: 700, fontSize: 11, cursor: "pointer",
            }}>Flag</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function KanbanBoard() {
  const [cards, setCards] = useState(initialCards);
  const [dragId, setDragId] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [phaseFilter, setPhaseFilter] = useState("all");

  const onDragStart = useCallback((e, id) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const onDrop = useCallback((e, colId) => {
    e.preventDefault();
    if (!dragId) return;
    setCards((prev) => prev.map((c) => c.id === dragId ? { ...c, column: colId } : c));
    setDragId(null);
  }, [dragId]);

  const onDragOver = useCallback((e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }, []);

  const updateCard = useCallback((updated) => {
    setCards((prev) => prev.map((c) => c.id === updated.id ? updated : c));
  }, []);

  const filteredCards = phaseFilter === "all" ? cards : cards.filter((c) => c.phase === phaseFilter);
  const detailCard = detailId ? cards.find((c) => c.id === detailId) : null;

  const stats = {
    total: filteredCards.length,
    done: filteredCards.filter((c) => c.column === "done").length,
    blocked: filteredCards.filter((c) => c.blockers.some((b) => !b.resolved)).length,
    questions: filteredCards.reduce((n, c) => n + c.questions.filter((q) => !q.resolved).length, 0),
  };

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: "#0a0e17", minHeight: "100vh", color: "#e2e8f0" }}>
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ padding: "20px 24px 14px", borderBottom: "1px solid #1e293b", background: "linear-gradient(180deg, #0f1520 0%, #0a0e17 100%)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <h1 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700, margin: 0 }}>
            <span style={{ color: "#38bdf8" }}>▸</span> OpenClaw Secure Installer — <span style={{ color: "#38bdf8" }}>Kanban</span>
          </h1>
          <div style={{ display: "flex", gap: 12, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
            <span style={{ background: "#111827", padding: "4px 10px", borderRadius: 4, border: "1px solid #1e293b" }}>
              Progress: <span style={{ color: "#34d399", fontWeight: 700 }}>{stats.done}/{stats.total}</span>
            </span>
            {stats.blocked > 0 && (
              <span style={{ background: "#ef444418", padding: "4px 10px", borderRadius: 4, border: "1px solid #ef444444", color: "#ef4444" }}>
                🚫 {stats.blocked} blocked
              </span>
            )}
            {stats.questions > 0 && (
              <span style={{ background: "#fbbf2418", padding: "4px 10px", borderRadius: 4, border: "1px solid #fbbf2444", color: "#fbbf24" }}>
                ❓ {stats.questions} open
              </span>
            )}
          </div>
        </div>
        {/* Phase filter */}
        <div style={{ display: "flex", gap: 4, marginTop: 12, flexWrap: "wrap" }}>
          <button onClick={() => setPhaseFilter("all")} style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 10, padding: "4px 10px",
            border: `1px solid ${phaseFilter === "all" ? "#38bdf8" : "#1e293b"}`,
            background: phaseFilter === "all" ? "#0c4a6e" : "#111827",
            color: phaseFilter === "all" ? "#38bdf8" : "#64748b",
            borderRadius: 5, cursor: "pointer",
          }}>ALL</button>
          {Object.entries(PHASES).map(([id, ph]) => (
            <button key={id} onClick={() => setPhaseFilter(id)} style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 10, padding: "4px 10px",
              border: `1px solid ${phaseFilter === id ? ph.color : "#1e293b"}`,
              background: phaseFilter === id ? ph.color + "22" : "#111827",
              color: phaseFilter === id ? ph.color : "#64748b",
              borderRadius: 5, cursor: "pointer",
            }}>{ph.name}</button>
          ))}
        </div>
      </div>

      {/* Board */}
      <div style={{ display: "flex", gap: 0, overflow: "auto", padding: 0, minHeight: "calc(100vh - 120px)" }}>
        {COLUMNS.map((col) => {
          const colCards = filteredCards.filter((c) => c.column === col.id);
          return (
            <div
              key={col.id}
              onDrop={(e) => onDrop(e, col.id)}
              onDragOver={onDragOver}
              style={{
                flex: 1, minWidth: 240, borderRight: "1px solid #1e293b",
                display: "flex", flexDirection: "column",
              }}
            >
              <div style={{
                padding: "12px 14px", borderBottom: "1px solid #1e293b",
                background: "#111827", display: "flex", alignItems: "center", gap: 8,
                position: "sticky", top: 0, zIndex: 5,
              }}>
                <span style={{ fontSize: 14 }}>{col.icon}</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, color: "#e2e8f0" }}>{col.name}</span>
                <span style={{
                  marginLeft: "auto", fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
                  background: "#1a2234", color: "#64748b", padding: "2px 7px", borderRadius: 10,
                }}>{colCards.length}</span>
              </div>
              <div style={{ padding: 10, flex: 1, minHeight: 100 }}>
                {colCards.map((card) => (
                  <Card key={card.id} card={card} onDragStart={onDragStart} onOpenDetail={setDetailId} />
                ))}
                {colCards.length === 0 && (
                  <div style={{
                    padding: 20, textAlign: "center", color: "#334155", fontSize: 12,
                    border: "1px dashed #1e293b", borderRadius: 8, fontStyle: "italic",
                  }}>
                    Drop cards here
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {detailCard && (
        <DetailModal
          card={detailCard}
          onClose={() => setDetailId(null)}
          onUpdate={(c) => { updateCard(c); }}
        />
      )}
    </div>
  );
}
