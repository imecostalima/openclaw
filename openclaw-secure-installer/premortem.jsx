import { useState } from "react";

const SEVERITY = { critical: "#ef4444", high: "#f97316", medium: "#fbbf24", low: "#34d399" };
const LIKELIHOOD = { "Very High": "#ef4444", High: "#f97316", Medium: "#fbbf24", Low: "#34d399", "Very Low": "#64748b" };
const PHASES = { build: "#a78bfa", run: "#38bdf8", scale: "#fbbf24", change: "#fb923c", attack: "#ef4444" };

const assumptions = [
  {
    id: "A1", assumption: "Apple Virtualization.framework provides sufficient isolation",
    violations: [
      { by: "Bugs", detail: "Hypervisor escape CVE in macOS; VM boundary not kernel-level like Xen" },
      { by: "Adversaries", detail: "Nation-state actors have demonstrated hypervisor escapes (e.g., VENOM, CVE-2015-3456). Apple's framework is newer and less battle-tested than KVM/Xen." },
      { by: "Time", detail: "As macOS updates, Virtualization.framework API may change or introduce regressions. No long-term stability guarantee." },
    ],
  },
  {
    id: "A2", assumption: "OpenClaw's upstream codebase remains available and maintained",
    violations: [
      { by: "Incentives", detail: "Steinberger is a solo maintainer with no revenue model. Burnout, acquihire, or loss of interest could halt development." },
      { by: "Legal", detail: "Anthropic already sent one trademark complaint. Further legal pressure could force another rename or project shutdown." },
      { by: "Scale", detail: "145K+ stars but no corporate backing. Community contributions don't guarantee security-focused maintenance." },
    ],
  },
  {
    id: "A3", assumption: "LLM APIs (Claude, GPT) remain accessible and affordable for security scanning",
    violations: [
      { by: "Cost", detail: "API pricing changes, rate limit tightening, or subscription model shifts could 5-10x costs overnight." },
      { by: "Scale", detail: "Daily releases × diff review × memory scan × forensic dissection. At scale, API costs compound non-linearly." },
      { by: "Adversaries", detail: "API key exfiltration from the VM (despite isolation) could burn budget or get the key revoked." },
    ],
  },
  {
    id: "A4", assumption: "LLM-based memory integrity scans reliably detect prompt injection",
    violations: [
      { by: "Adversaries", detail: "Prompt injection is an unsolved problem. Sophisticated payloads (fragmented, encoded, time-shifted) evade LLM detection. Palo Alto documented logic-bomb-style attacks that look benign at scan time." },
      { by: "Bugs", detail: "LLM false negatives: the scanning model may miss injection patterns it wasn't trained on or that exploit its own blind spots." },
      { by: "Time", detail: "Adversary techniques evolve. Today's scan patterns become tomorrow's evasion templates." },
    ],
  },
  {
    id: "A5", assumption: "VirusTotal + Cisco Skill Scanner catch malicious skills before they reach our VM",
    violations: [
      { by: "Adversaries", detail: "VirusTotal admits 'scanning won't catch everything.' Skills using natural language manipulation (not code-level malware) bypass signature-based detection." },
      { by: "Time", detail: "Zero-day skills: first deployment window before VT re-scan catches them. Daily re-scanning still has a 24-hour gap." },
      { by: "Scale", detail: "4,000+ skills and growing. Automated attacker campaigns submit new malicious skills every few minutes." },
    ],
  },
  {
    id: "A6", assumption: "The forensic dissection pipeline produces actionable Immunity Ledger entries",
    violations: [
      { by: "Bugs", detail: "LLM hallucination: the dissection model may fabricate IOCs that don't correspond to real attack patterns, leading to false positives in the blocklist." },
      { by: "Users", detail: "Operator ignores dissection reports or doesn't act on recommendations. Immunity Ledger grows but isn't applied." },
      { by: "Adversaries", detail: "Attacker deliberately poisons the forensic archive (e.g., by planting false IOCs in memory before reset) to cause the new seed to block legitimate services." },
    ],
  },
  {
    id: "A7", assumption: "Checkpoint integrity verification prevents restoring compromised state",
    violations: [
      { by: "Adversaries", detail: "Slow-burn poisoning: attacker modifies state in tiny increments that fall below the LLM integrity scan's detection threshold, accumulating over weeks until the checkpoint itself is poisoned." },
      { by: "Bugs", detail: "Hash collision or implementation flaw in the checkpoint signing chain allows a tampered checkpoint to appear verified." },
      { by: "Time", detail: "Over months, the 'known-good' baseline drifts as organic state changes accumulate, making it harder to distinguish legitimate evolution from adversarial manipulation." },
    ],
  },
  {
    id: "A8", assumption: "The egress firewall allowlist is sufficient to prevent data exfiltration",
    violations: [
      { by: "Adversaries", detail: "Exfiltration via allowed channels: attacker encodes stolen data in legitimate API calls to api.anthropic.com or github.com (DNS tunneling, steganographic payloads in API parameters)." },
      { by: "Users", detail: "Operator adds new domains to allowlist for convenience (e.g., Mem0 API, Notion API), expanding the attack surface." },
      { by: "Scale", detail: "More integrations = more allowed domains = more exfiltration paths. The allowlist grows monotonically." },
    ],
  },
  {
    id: "A9", assumption: "macOS Keychain provides secure seed storage",
    violations: [
      { by: "Adversaries", detail: "Physical access to the Mac mini + user password (or biometric bypass) grants Keychain access. No HSM-level protection." },
      { by: "Bugs", detail: "macOS Keychain vulnerabilities have been discovered historically (e.g., KeySteal, CVE-2019-8526). Apple Silicon Secure Enclave helps but isn't bulletproof." },
      { by: "Users", detail: "User exports seed/mnemonic and stores it in plaintext (notes app, email, screenshot). Social engineering targets the backup, not the Keychain." },
    ],
  },
  {
    id: "A10", assumption: "OpenClaw's commit signatures reliably identify legitimate maintainer releases",
    violations: [
      { by: "Adversaries", detail: "Maintainer key compromise. If Steinberger's GPG key is stolen, all subsequent signed releases are attacker-controlled and pass verification." },
      { by: "Scale", detail: "As more contributors get signing keys, the attack surface for key compromise grows." },
      { by: "Incentives", detail: "npm supply chain attack: even if GitHub commits are signed, the npm package could be compromised independently (as seen in event-stream, ua-parser-js incidents)." },
    ],
  },
];

const failureModes = [
  {
    id: "F1", category: "Security/Privacy", phase: "attack",
    name: "Time-shifted memory poisoning escapes all checkpoints",
    trigger: "Attacker injects fragmented prompt injection payload via trusted integration (email, Slack). Fragments are benign individually but assemble into an exploit when the agent's state aligns. The poison survives micro-checkpoints, state images, and even golden images because it was present when those checkpoints were verified.",
    likelihood: "Medium", impact: "critical", blastRadius: "Total agent compromise + all services the agent has credentials for. Blast radius extends to every golden image in the archive if undetected long enough.",
    detectability: "Very Low. Designed to be invisible to point-in-time scans. Only detectable by comparing memory state across multiple temporal checkpoints and looking for slow semantic drift.",
    earlySignals: "Anomalous memory growth patterns; entries in MEMORY.md that the user doesn't recognize; subtle behavioral changes in agent responses (e.g., agent starts preferring certain tools or refusing others).",
    mitigation: "Cross-temporal memory diffing: compare not just current vs. last checkpoint but current vs. N-3 golden image. Flag any content that appeared post-ingestion of external documents. Ultimate kill-switch: manual memory audit triggered by behavioral anomaly alert.",
    top3: true,
  },
  {
    id: "F2", category: "Dependencies", phase: "change",
    name: "OpenClaw project abandoned or maintainer compromised",
    trigger: "Steinberger burns out, gets acquihired, or faces legal pressure. Alternatively, his GitHub/npm credentials are stolen. Project goes unmaintained or releases poisoned updates.",
    likelihood: "Medium", impact: "critical", blastRadius: "All users of the installer who have auto-update enabled. If maintainer credentials are stolen, the trust scoring model passes the poisoned release because the commit signature is valid.",
    detectability: "Medium. Abandonment is visible (commit frequency drops). Credential theft is invisible until the poisoned release is analyzed.",
    earlySignals: "GitHub commit frequency dropping below 1/week for 3+ weeks; maintainer not responding to security advisories; unusual release patterns (e.g., large release after long silence); npm package published from a new IP/device.",
    mitigation: "Version-pin with 48-hour lag. If no releases for 30 days, freeze at current golden image indefinitely. For credential theft: require multi-signal verification (commit sig + npm 2FA + community confirmation). Kill-switch: manual update-only mode if anomaly detected.",
    top3: true,
  },
  {
    id: "F3", category: "Architecture", phase: "run",
    name: "Exfiltration via allowed egress channels",
    trigger: "Compromised skill or prompt injection encodes stolen data (API keys, memory contents) inside legitimate-looking API calls to allowed domains (api.anthropic.com, github.com). Data is smuggled in API parameters, headers, or encoded in seemingly benign requests.",
    likelihood: "High", impact: "high", blastRadius: "All credentials and memory accessible to the agent. Data reaches attacker via the legitimate API as a relay (or via DNS queries to allowed resolvers).",
    detectability: "Low. Traffic looks legitimate. Only detectable by deep packet inspection or anomalous request pattern analysis (unusual payload sizes, unusual API endpoints within allowed domains).",
    earlySignals: "Spike in API call volume not correlated with user activity; requests to unusual endpoints on allowed domains; outbound data volume exceeding expected agent activity; API provider reports unusual usage patterns.",
    mitigation: "Rate-limit egress by request volume and payload size. Monitor API call patterns for anomalies. Implement request signing so the host can verify the agent isn't making unauthorized calls. Kill-switch: drop the VM's network interface entirely on anomaly detection.",
    top3: true,
  },
  {
    id: "F4", category: "Operations", phase: "run",
    name: "Checkpoint storage exhaustion silently disables safety net",
    trigger: "Golden images (4-8 GB each) + forensic archives + daily state images accumulate. Mac mini's storage fills up. Checkpoint system starts silently failing or auto-pruning golden images below the 3-minimum threshold.",
    likelihood: "Medium", impact: "high", blastRadius: "Loss of rollback capability. Next incident requires full seed reset instead of golden restore, losing weeks of accumulated state.",
    detectability: "High. Disk space monitoring is straightforward.",
    earlySignals: "Disk utilization above 80%; checkpoint write failures in logs; golden image count dropping; state image creation taking longer than usual.",
    mitigation: "Alert at 70% disk. Auto-compress older state images. Move forensic archives to external storage. Never auto-prune below 3 golden images—instead, halt new checkpoint creation and alert operator.",
  },
  {
    id: "F5", category: "Cost/Latency", phase: "scale",
    name: "LLM API costs become unsustainable",
    trigger: "API pricing increases, or release cadence accelerates (multiple releases/day), or forensic dissections become frequent due to recurring incidents. Monthly costs jump from $15 to $100+.",
    likelihood: "Medium", impact: "medium", blastRadius: "Security scanning degrades or is disabled. Updates applied without full verification. Memory integrity scans skipped.",
    detectability: "High. Cost is directly measurable.",
    earlySignals: "Monthly API spend exceeding $30; model provider pricing announcements; increasing frequency of forensic dissection events.",
    mitigation: "Tiered scanning: full LLM review for major releases, hash-only for patches. Cache diff review results. Use smaller/cheaper models for routine scans, reserve SOTA for suspicious diffs. Fallback: signature-only verification mode with manual review.",
  },
  {
    id: "F6", category: "People/Process", phase: "run",
    name: "Operator fatigue leads to security bypass",
    trigger: "After months of uneventful operation, operator starts approving updates without reading threat reports, ignoring questions in the Kanban board, dismissing low-severity alerts. An update that the pipeline flagged as 'advisory-level suspicious' is waved through.",
    likelihood: "High", impact: "high", blastRadius: "One bad update inside the VM. Contained by isolation but may persist until next checkpoint verification catches it.",
    detectability: "Medium. Measurable by tracking time-to-respond on alerts and approval patterns.",
    earlySignals: "Alert acknowledgment time increasing; open questions in Kanban aging beyond 7 days; forensic reports going unread; operator approving updates faster than reading time allows.",
    mitigation: "Auto-block updates that exceed advisory threshold if operator hasn't reviewed within 48 hours. Weekly summary digest (not per-event alerts) to reduce noise. Gamify: track 'days since last unreviewed alert' metric.",
  },
  {
    id: "F7", category: "Architecture", phase: "build",
    name: "VM isolation introduces unacceptable latency for messaging integrations",
    trigger: "NAT + egress firewall + encrypted disk + VM overhead add 200-500ms latency to every message round-trip. WhatsApp/Telegram integrations feel sluggish. User disables VM or moves OpenClaw to bare metal 'temporarily.'",
    likelihood: "Medium", impact: "high", blastRadius: "If OpenClaw exits the VM, the entire security architecture is bypassed. All isolation, checkpoints, and forensics become irrelevant.",
    detectability: "High. Latency is directly measurable and user-reported.",
    earlySignals: "Message response times > 3 seconds; user complaints about 'slow bot'; temptation to 'just run it on the host for now'.",
    mitigation: "Performance budget: VM overhead must stay < 100ms. Use virtio networking, memory-backed disk cache, and pre-warmed VM. If latency is unacceptable, use container isolation (Docker with gVisor) as intermediate step—less isolation than VM but better than bare metal.",
  },
  {
    id: "F8", category: "Legal/Compliance", phase: "change",
    name: "API provider ToS change prohibits automated security scanning",
    trigger: "Anthropic, OpenAI, or Google updates terms of service to restrict automated code review, vulnerability scanning, or forensic analysis via their APIs. The LLM-assisted diff review and dissection pipeline become non-compliant.",
    likelihood: "Low", impact: "high", blastRadius: "Core security mechanism (LLM-based verification) must be redesigned or replaced.",
    detectability: "High. ToS changes are publicly announced.",
    earlySignals: "API provider blog posts about 'acceptable use' updates; rate limit changes specifically targeting non-conversational usage patterns; community reports of account suspensions for scanning use cases.",
    mitigation: "Abstract the LLM layer: support multiple providers with automatic failover. Maintain a local model fallback (Llama/Mistral on Mac mini's GPU) for basic scanning. The local model won't match SOTA but provides baseline coverage.",
  },
  {
    id: "F9", category: "Data", phase: "run",
    name: "Forensic dissection produces hallucinated IOCs that block legitimate services",
    trigger: "The LLM analyzing a compromised archive hallucinates a false IOC (e.g., misidentifies a legitimate API endpoint as C2 infrastructure). This false IOC enters the Immunity Ledger and the egress firewall blocks a critical service.",
    likelihood: "Medium", impact: "medium", blastRadius: "Agent loses access to a legitimate integration (e.g., Gmail API, Slack API). Operator may not realize why until they manually audit the Immunity Ledger.",
    detectability: "Medium. Manifests as sudden integration failures after a reset.",
    earlySignals: "Integration failures immediately following a forensic-informed reset; Immunity Ledger entries that reference domains/IPs not found in any public threat intelligence; egress firewall blocking requests to known-good services.",
    mitigation: "Immunity Ledger entries require confidence scoring. Only auto-apply IOCs above 0.8 confidence. Below that, flag for operator review. All auto-applied IOCs have a 72-hour trial period—if they cause integration failures, auto-revert and flag.",
  },
  {
    id: "F10", category: "Value/Market", phase: "scale",
    name: "OpenClaw becomes irrelevant; better-secured alternatives emerge",
    trigger: "A well-funded company ships a managed, sandboxed AI agent platform with built-in security (e.g., Anthropic ships Claude Agent, or Apple builds agents into macOS). OpenClaw's open-source advantage evaporates. The installer protects a tool nobody uses anymore.",
    likelihood: "Medium", impact: "medium", blastRadius: "Wasted development effort. The 12-week build produces a product with no users.",
    detectability: "High. Market shifts are publicly visible.",
    earlySignals: "OpenClaw GitHub stars plateauing; major tech company announcing competing agent platform; community migration discussions; Steinberger pivoting to a new project.",
    mitigation: "Design the installer architecture to be agent-agnostic where possible. The VM isolation, checkpoint, and forensic archive layers are generic—they could wrap any agentic system. The seed/reset mechanism is agent-independent. If OpenClaw dies, the architecture survives with a different agent core.",
  },
];

const top3 = failureModes.filter(f => f.top3);

function Badge({ text, color }) {
  return (
    <span style={{
      display: "inline-block", fontSize: 10, fontWeight: 700,
      fontFamily: "'JetBrains Mono', monospace",
      padding: "2px 8px", borderRadius: 4,
      background: color + "22", color, border: `1px solid ${color}44`,
    }}>{text}</span>
  );
}

function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 20 }}>
      <button onClick={() => setOpen(!open)} style={{
        width: "100%", textAlign: "left", background: "#111827",
        border: "1px solid #1e293b", borderRadius: 8, padding: "12px 16px",
        color: "#f8fafc", fontSize: 15, fontWeight: 700, cursor: "pointer",
        display: "flex", alignItems: "center", gap: 10,
        fontFamily: "'DM Sans', sans-serif",
      }}>
        <span style={{ color: "#38bdf8", fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>{open ? "▾" : "▸"}</span>
        {title}
      </button>
      {open && <div style={{ padding: "16px 0 0 0" }}>{children}</div>}
    </div>
  );
}

function AssumptionCard({ a }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      background: "#111827", border: "1px solid #1e293b", borderRadius: 8,
      marginBottom: 8, overflow: "hidden",
    }}>
      <div onClick={() => setOpen(!open)} style={{
        padding: "10px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
      }}>
        <span style={{ color: "#38bdf8", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{a.id}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", flex: 1 }}>{a.assumption}</span>
        <span style={{ color: "#64748b", fontSize: 11 }}>{a.violations.length} violation vectors</span>
        <span style={{ color: "#64748b", fontSize: 12 }}>{open ? "▾" : "▸"}</span>
      </div>
      {open && (
        <div style={{ padding: "0 14px 14px", borderTop: "1px solid #1e293b" }}>
          {a.violations.map((v, i) => (
            <div key={i} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: i < a.violations.length - 1 ? "1px solid #1e293b22" : "none" }}>
              <Badge text={v.by} color={
                v.by === "Adversaries" ? "#ef4444" : v.by === "Bugs" ? "#f97316" : v.by === "Time" ? "#a78bfa" :
                v.by === "Users" ? "#fbbf24" : v.by === "Scale" ? "#38bdf8" : v.by === "Incentives" ? "#fb923c" :
                v.by === "Cost" ? "#fbbf24" : v.by === "Legal" ? "#818cf8" : "#64748b"
              } />
              <span style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>{v.detail}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FailureModeCard({ f }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      background: "#111827", border: `1px solid ${f.top3 ? "#ef444444" : "#1e293b"}`,
      borderLeft: `3px solid ${PHASES[f.phase]}`, borderRadius: 8,
      marginBottom: 10, overflow: "hidden",
      boxShadow: f.top3 ? "0 0 12px rgba(239,68,68,0.08)" : "none",
    }}>
      <div onClick={() => setOpen(!open)} style={{
        padding: "12px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
      }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, color: "#64748b", flexShrink: 0 }}>{f.id}</span>
        {f.top3 && <Badge text="TOP 3" color="#ef4444" />}
        <Badge text={f.phase.toUpperCase()} color={PHASES[f.phase]} />
        <Badge text={f.category} color="#64748b" />
        <span style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", flex: 1, minWidth: 200 }}>{f.name}</span>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <Badge text={`L: ${f.likelihood}`} color={LIKELIHOOD[f.likelihood]} />
          <Badge text={`I: ${f.impact}`} color={SEVERITY[f.impact]} />
        </div>
        <span style={{ color: "#64748b", fontSize: 12 }}>{open ? "▾" : "▸"}</span>
      </div>
      {open && (
        <div style={{ padding: "0 14px 14px", borderTop: "1px solid #1e293b" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
            {[
              { label: "Trigger", text: f.trigger, color: "#f97316" },
              { label: "Blast Radius", text: f.blastRadius, color: "#ef4444" },
              { label: "Detectability", text: f.detectability, color: "#a78bfa" },
              { label: "Early Signals", text: f.earlySignals, color: "#fbbf24" },
            ].map((item, i) => (
              <div key={i} style={{ background: "#0a0e17", borderRadius: 6, padding: "10px 12px", border: "1px solid #1e293b" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: item.color, fontFamily: "'JetBrains Mono', monospace", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>{item.label}</div>
                <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>{item.text}</div>
              </div>
            ))}
          </div>
          <div style={{ background: "#0c4a6e22", borderRadius: 6, padding: "10px 12px", marginTop: 12, border: "1px solid #0c4a6e44" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#38bdf8", fontFamily: "'JetBrains Mono', monospace", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Mitigation / Kill-Switch</div>
            <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>{f.mitigation}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function Top3Detail({ f }) {
  return (
    <div style={{
      background: "#111827", border: "1px solid #ef444433", borderRadius: 10,
      padding: 20, marginBottom: 16,
      boxShadow: "0 0 20px rgba(239,68,68,0.06)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <Badge text={f.id} color="#ef4444" />
        <Badge text={f.phase.toUpperCase()} color={PHASES[f.phase]} />
        <h3 style={{ fontSize: 15, fontWeight: 700, color: "#f8fafc", margin: 0 }}>{f.name}</h3>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ gridColumn: "1 / -1", background: "#0a0e17", borderRadius: 8, padding: 14, border: "1px solid #1e293b" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#f97316", fontFamily: "'JetBrains Mono', monospace", marginBottom: 6 }}>LEADING INDICATORS</div>
          <div style={{ fontSize: 13, color: "#e2e8f0", lineHeight: 1.7 }}>{f.earlySignals}</div>
        </div>
        <div style={{ gridColumn: "1 / -1", background: "#0c4a6e15", borderRadius: 8, padding: 14, border: "1px solid #0c4a6e44" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#38bdf8", fontFamily: "'JetBrains Mono', monospace", marginBottom: 6 }}>CONTAINMENT PLAN</div>
          <div style={{ fontSize: 13, color: "#e2e8f0", lineHeight: 1.7 }}>{f.mitigation}</div>
        </div>
      </div>
    </div>
  );
}

export default function PreMortem() {
  const [tab, setTab] = useState("assumptions");

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: "#0a0e17", minHeight: "100vh", color: "#e2e8f0" }}>
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      <div style={{ padding: "24px 28px 16px", borderBottom: "1px solid #1e293b", background: "linear-gradient(180deg, #0f1520, #0a0e17)" }}>
        <h1 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700, margin: "0 0 4px" }}>
          <span style={{ color: "#ef4444" }}>⚠</span> Pre-Mortem & Failure Mode Analysis
        </h1>
        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 14 }}>
          OpenClaw Secure Installer — "What must be true, and how can each assumption be violated?"
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {[
            { id: "assumptions", label: "Assumptions (10)", color: "#a78bfa" },
            { id: "failures", label: "Failure Modes (10)", color: "#f97316" },
            { id: "top3", label: "Top 3 Deep Dive", color: "#ef4444" },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 11, padding: "7px 16px",
              border: `1px solid ${tab === t.id ? t.color : "#1e293b"}`,
              background: tab === t.id ? t.color + "22" : "#111827",
              color: tab === t.id ? t.color : "#64748b",
              borderRadius: 6, cursor: "pointer", fontWeight: tab === t.id ? 700 : 400,
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: "20px 28px", maxWidth: 1000 }}>
        {tab === "assumptions" && (
          <>
            <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.7, marginBottom: 20, padding: "14px 16px", background: "#111827", borderRadius: 8, border: "1px solid #1e293b" }}>
              <strong style={{ color: "#a78bfa" }}>Question:</strong> "What must be true for this to succeed, and how can each of those assumptions be violated—by bugs, users, scale, time, incentives, and adversaries?"
              <br /><br />
              The following 10 critical assumptions underpin the entire architecture. Click each to see how it can be violated. If <em>any</em> of these assumptions fails without a fallback, the system's security guarantees degrade.
            </div>
            {assumptions.map(a => <AssumptionCard key={a.id} a={a} />)}
          </>
        )}

        {tab === "failures" && (
          <>
            <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.7, marginBottom: 20, padding: "14px 16px", background: "#111827", borderRadius: 8, border: "1px solid #1e293b" }}>
              <strong style={{ color: "#f97316" }}>Scenario:</strong> "It's 6–12 months later and this project disappointed or caused an incident. What happened?"
              <br /><br />
              10 failure modes across <Badge text="BUILD" color={PHASES.build} /> <Badge text="RUN" color={PHASES.run} /> <Badge text="SCALE" color={PHASES.scale} /> <Badge text="CHANGE" color={PHASES.change} /> <Badge text="ATTACK" color={PHASES.attack} />. Click each for full analysis including trigger, blast radius, detectability, early signals, and mitigation/kill-switch.
            </div>
            {failureModes.map(f => <FailureModeCard key={f.id} f={f} />)}
          </>
        )}

        {tab === "top3" && (
          <>
            <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.7, marginBottom: 20, padding: "14px 16px", background: "#111827", borderRadius: 8, border: "1px solid #ef444422" }}>
              <strong style={{ color: "#ef4444" }}>Top 3 Failure Modes</strong> — the ones with the highest combination of likelihood × impact × low detectability. For each: leading indicators that something is going wrong, and a concrete containment plan.
            </div>
            {top3.map(f => <Top3Detail key={f.id} f={f} />)}
          </>
        )}
      </div>
    </div>
  );
}
