# Security Review: openclaw-secure-installer

**Reviewer:** Claude (automated security analysis)
**Date:** 2026-02-10
**Scope:** All files in `openclaw-secure-installer/`
**Classification:** Internal

---

## Files Reviewed

| File | Type | Size |
|------|------|------|
| `dashboard.jsx` | React component | 22 KB |
| `kanban.jsx` | React component | 25 KB |
| `gantt.html` | Standalone HTML/JS | 23 KB |
| `premortem.jsx` | React component | 30 KB |
| `desktop.ini` | Windows metadata | 246 B |
| `openclaw-secure-installer-v2.0-final.docx` | Architecture spec | 33 KB |

---

## Part A: Code-Level Security Findings

### A1. XSS via innerHTML in gantt.html (Medium Severity)

**File:** `gantt.html`, lines 531–541

The Gantt chart constructs DOM elements using `innerHTML` with interpolated data values:

```js
el.innerHTML = `<div class="task-dot" style="background:${row.color}"></div>${row.name}`;
el.innerHTML += '<span class="dep-tag">CRITICAL</span>';
```

While the data is currently hardcoded in the same file, this pattern is fragile. If task data is ever loaded from an external source (an API, a shared JSON file, or URL parameters), the `row.name` and `row.desc` fields would be rendered as raw HTML, enabling stored XSS.

**Recommendation:** Replace `innerHTML` assignments with `textContent` for user-facing strings, or use `document.createElement` + `appendChild`. Alternatively, sanitize all interpolated values with a function that escapes `<`, `>`, `"`, `'`, and `&`.

**Token impact:** None. This is a frontend code change with no LLM involvement.

---

### A2. Implicit Global `event` in gantt.html (Low Severity)

**File:** `gantt.html`, line 649

```js
function setView(view) {
  currentView = view;
  document.querySelectorAll('.controls button').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');  // implicit global
  render(view);
}
```

The `event` variable is not passed as a parameter; it relies on the deprecated implicit global `window.event`. This fails in strict mode and in Firefox in some configurations.

**Recommendation:** Change the onclick handlers to `onclick="setView('all', event)"` and update the function signature to `function setView(view, event)`.

**Token impact:** None.

---

### A3. No Input Validation or Length Limits in kanban.jsx (Medium Severity)

**File:** `kanban.jsx`, lines 150–158, 207–218

The Kanban board allows adding questions and blockers via free-text input with only a `.trim()` check:

```js
const addQuestion = () => {
  if (!newQ.trim()) return;
  onUpdate({ ...card, questions: [...card.questions, { text: newQ.trim(), ... }] });
};
```

There is no maximum length validation. A user (or automated agent interacting with this UI) could inject arbitrarily large strings, causing rendering issues or memory exhaustion. More critically, if these values are ever persisted or rendered in a context that interprets HTML/markdown, they become an XSS vector.

**Recommendation:** Add input length limits (e.g., 500 characters for questions, 1000 for blockers). If rendering in any HTML context, sanitize output.

**Token impact:** None directly. If question/blocker text is ever fed into an LLM for analysis (e.g., during a review workflow), unbounded input could cause unnecessary token consumption. A 500-character limit per entry would cap this at ~125 tokens per entry.

---

### A4. External Resource Loading Without Subresource Integrity (Medium Severity)

**Files:** All four frontend files (`dashboard.jsx:262`, `kanban.jsx:291`, `gantt.html:7`, `premortem.jsx:330`)

All files load Google Fonts via an external `<link>` tag:

```html
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:..." rel="stylesheet" />
```

No `integrity` attribute or `crossorigin` attribute is set. If the Google Fonts CDN were compromised (or a DNS hijack occurred), an attacker could inject arbitrary CSS, which can exfiltrate data via `background-image: url(...)` selectors or rewrite the UI to facilitate phishing.

Additionally, the JSX files embed this `<link>` tag inside the component body rather than in `<head>`, which is non-standard and may cause layout shifts.

**Recommendation:**
- Self-host the fonts. Download JetBrains Mono and DM Sans, include them in the project's static assets.
- If CDN loading is required, add `integrity` and `crossorigin="anonymous"` attributes.
- Move the `<link>` tag out of the component body into the application's `<head>`.

**Token impact:** None.

---

### A5. Information Leak via desktop.ini (Low Severity)

**File:** `desktop.ini`

This Windows metadata file reveals:
- The development environment uses Windows with Google Drive File Stream v120.0.1.0
- The specific icon resource path: `C:\Program Files\Google Drive File Stream\120.0.1.0\GoogleDriveFS.exe,27`

This leaks internal tooling details and should not be committed to version control.

**Recommendation:** Remove `desktop.ini` from the repository and add it to `.gitignore`.

**Token impact:** None.

---

### A6. Sensitive Internal Document in Repository (High Severity)

**File:** `openclaw-secure-installer-v2.0-final.docx`

This document is classified as "Internal – Strategic Planning" and contains:
- Specific CVE identifiers and their patch status
- Named attacker accounts on ClawHub (hightower6eu, sakaen736jih)
- Detailed architectural weaknesses and residual risks
- Named individuals (Peter Steinberger, Jamieson O'Reilly)
- Cost estimates and operational budget details
- Explicit documentation of what the system *cannot* defend against

If this repository is (or becomes) publicly accessible, this document provides an adversary with a detailed blueprint of:
1. Which attacks the system is vulnerable to (the documented residual risks)
2. The exact detection thresholds (anomaly scores, trust decay rates)
3. The operator engagement patterns to exploit (the 72-hour timeout windows)

**Recommendation:** Remove the .docx from the code repository. Store it in a separate, access-controlled document management system. If it must be referenced from the repo, include only a link and access instructions, not the content.

**Token impact:** None directly, but if the document content is ever ingested into an LLM context (e.g., for code generation assistance), it is ~8,500 tokens. Removing it from the repo reduces the risk of accidental LLM ingestion.

---

### A7. No State Persistence — All Progress Lost on Refresh (Low Severity)

**Files:** `dashboard.jsx`, `kanban.jsx`

Both components use `useState` with hardcoded initial values. All task status changes, questions, blockers, and progress are lost on page refresh. This is a UX issue but has a security dimension: if these tools are used to track actual security operations (incident response, update approvals), loss of state means loss of audit trail.

**Recommendation:** Add persistence via `localStorage` (minimum) or a backend API. If `localStorage` is used, be aware that stored data is accessible to any script on the same origin — do not persist sensitive data like security findings or incident details without encryption.

**Token impact:** None.

---

## Part B: Architectural Security Findings (from the North Star Document)

The v2.0 architecture document is thorough and well-reasoned. The following findings identify gaps or weaknesses not fully addressed.

### B1. Seed Generation Uses /dev/urandom, Not Secure Enclave (High Severity)

**Document Section:** 3.8.1

The document states: "256-bit random seed from host's hardware RNG (/dev/urandom on macOS)."

`/dev/urandom` on macOS is a CSPRNG (Yarrow/Fortuna) and is cryptographically adequate, but it is **not** hardware-backed in the way the document implies. On Apple Silicon Macs, the Secure Enclave Processor (SEP) provides hardware-backed key generation and storage that is resistant to software-only attacks — even if macOS itself is compromised, the SEP protects keys.

**Recommendation:** Generate the master seed using the Secure Enclave via the `SecKeyCreateRandomKey` API with `kSecAttrTokenIDSecureEnclave`. This ensures the seed never exists in main memory in plaintext and is hardware-protected against extraction.

**Token impact:** None. This is a cryptographic implementation change.

---

### B2. No Master Seed Rotation Mechanism (High Severity)

**Document Section:** 3.8

The entire key hierarchy is derived from a single 256-bit seed via HKDF. If this seed is ever compromised (physical access, Keychain vulnerability, mnemonic exposure), every derived key is compromised. The document provides no mechanism for rotating the master seed without a full scorched-earth reset.

**Recommendation:** Design a seed rotation protocol:
1. Generate a new seed
2. Re-derive all keys from the new seed
3. Re-encrypt all checkpoints and archives with new keys
4. Securely destroy the old seed
5. Issue a new BIP-39 mnemonic

This should be a planned operational procedure, not just an emergency response.

**Token impact:** If the rotation procedure includes a post-rotation integrity scan (recommended), this would cost ~$0.10–$0.30 in LLM API tokens per rotation event (~500–2,000 tokens for the integrity verification prompt + response). Expected frequency: quarterly or semi-annually.

---

### B3. Forensic Dissection Pipeline Vulnerable to Prompt Injection from Archived Images (High Severity)

**Document Section:** 3.5

The dissection pipeline runs LLM analysis against archived compromised images: "Memory Forensics: LLM deep review searching for fragmented prompt injection payloads."

This creates a second-order prompt injection risk: the compromised memory files being analyzed may contain prompt injection payloads specifically crafted to manipulate the forensic LLM. An attacker who knows the architecture (see finding A6) could embed payloads designed to:
- Cause the forensic LLM to report "clean" findings
- Generate false IOCs that block legitimate services (acknowledged in F9 but not linked to this attack vector)
- Exfiltrate data through the forensic LLM's API call itself

**Recommendation:**
1. Pre-process archived memory files by stripping all instruction-like patterns before LLM ingestion (regex-based removal of common injection preambles)
2. Use a structured extraction prompt that constrains the LLM's output to a strict JSON schema, reducing the attack surface for injection
3. Run the forensic LLM with a system prompt that explicitly instructs it to treat all input as untrusted data, never as instructions
4. Cross-validate findings between two different LLM providers (e.g., Claude + GPT) — an injection crafted for one model is less likely to fool both

**Token impact:** Cross-validation doubles forensic dissection token costs: from ~$0.20–$1.00 to ~$0.40–$2.00 per reset event. At expected frequency (rare — a few times per year), total annual added cost: ~$2–$10, or ~2,000–10,000 additional tokens per event.

---

### B4. No Mutual TLS or Certificate Pinning for Egress Connections (Medium Severity)

**Document Section:** 3.1.1, 3.4

The egress firewall uses domain-based allowlisting (api.anthropic.com, github.com, etc.) but the document does not mention TLS certificate verification, pinning, or mutual TLS.

Without certificate pinning, an attacker with network position (e.g., compromised router, rogue DNS) can MITM connections to allowed domains using a fraudulent certificate from a compromised CA. The egress anomaly engine scores request patterns but cannot detect a man-in-the-middle if the TLS handshake appears normal.

**Recommendation:**
1. Pin TLS certificates (or public keys) for all allowlisted domains
2. Reject connections where the certificate chain doesn't match the pinned set
3. Log and alert on any certificate mismatch — it's a strong signal of MITM

**Token impact:** None. This is a network-level implementation.

---

### B5. No Integrity Verification of the Host OS (Medium Severity)

**Document Section:** 3.1

The architecture assumes macOS is trustworthy: the seed is stored in macOS Keychain, the egress engine runs on the host, the forensic archive is on the host. If macOS itself is compromised (rootkit, persistence implant), every security layer is bypassed because the attacker controls the trust root.

**Recommendation:**
1. Enable macOS Secure Boot and verify it is enforced
2. Enable FileVault full-disk encryption on the host
3. Use macOS's built-in Endpoint Security framework to monitor for unauthorized kernel extensions or system modifications
4. Periodically verify system integrity via `csrutil status` (SIP) and `profiles status` (MDM)
5. Document the threat model boundary: "If macOS is compromised, the VM isolation guarantee does not hold"

**Token impact:** None. These are OS-level configurations.

---

### B6. 72-Hour Timeout Window Creates a Predictable Attack Window (Medium Severity)

**Document Section:** 3.7.5

The graduated autonomy model specifies that Tier 3 items not addressed within 72 hours are automatically handled with safe defaults (updates deferred, entries quarantined, throttle maintained). While safe-by-default is the right principle, the 72-hour window is predictable.

An attacker who can observe the operator's engagement patterns (e.g., by monitoring response times to test alerts) can time attacks for periods when the operator is likely to be unresponsive. They know that after 72 hours, the system will auto-quarantine rather than auto-investigate.

**Recommendation:**
1. Randomize the timeout window between 48–96 hours (unpredictable to an observer)
2. Do not expose the countdown timer or timeout status via any channel accessible from within the VM
3. Add escalation: if multiple Tier 3 items timeout simultaneously, escalate to an out-of-band alert (SMS, phone call) rather than silently auto-handling

**Token impact:** None.

---

### B7. Allowlist Growth Is Monotonic — No Mechanism to Remove Domains (Medium Severity)

**Document Section:** 3.4, Assumption A8

The document acknowledges that "more integrations = more allowed domains = more exfiltration paths" and that "the allowlist grows monotonically." However, no mechanism is described for:
- Reviewing and pruning unused domains from the allowlist
- Automatically removing domains for integrations that haven't been used in N days
- Alerting when the allowlist exceeds a threshold size

**Recommendation:**
1. Track last-used timestamp per allowlisted domain
2. Auto-expire domains unused for 30 days (move to a "dormant" list requiring re-approval)
3. Set a maximum allowlist size (e.g., 15 domains). Require explicit removal before adding new ones.
4. Weekly digest should include allowlist size and last-used dates

**Token impact:** If the allowlist review is LLM-assisted (summarizing which integrations are active), this would add ~200–500 tokens per weekly digest cycle, or ~$0.01–$0.03/week (~$0.50–$1.50/year).

---

### B8. No Supply Chain Protection for the Installer Itself (High Severity)

**Document Section:** 4, 7

The architecture thoroughly addresses OpenClaw's supply chain (commit signatures, LLM diff review, sandbox testing) but does not address the supply chain of the installer (ocsi CLI) itself. If an attacker can compromise the installer binary or its distribution channel, they control:
- Seed generation (they can use a known seed)
- Key derivation (they can exfiltrate derived keys)
- Egress rules (they can allowlist attacker domains)
- Forensic pipeline (they can suppress findings)

**Recommendation:**
1. Sign the `ocsi` CLI binary with a known key (code signing certificate)
2. Publish checksums via multiple independent channels
3. Implement reproducible builds so users can verify the binary matches the source
4. Apply the same commit signature verification to the installer repo that is applied to OpenClaw updates

**Token impact:** None for the signing infrastructure. If an LLM-assisted review of installer updates is added (mirroring the OpenClaw update pipeline), this would add ~$0.05–$0.30 per installer update, or ~$0.50–$3.00/year at monthly release cadence (~500–2,000 tokens per review).

---

### B9. BIP-39 Mnemonic Creates an Offline Attack Surface (Low Severity)

**Document Section:** 3.8.1

The BIP-39 mnemonic backup phrase is a 12- or 24-word sequence that can reconstruct the entire key hierarchy. Unlike the Keychain-stored seed (which benefits from hardware protection), the mnemonic exists in the physical world — written on paper, possibly photographed, possibly stored in a notes app.

Social engineering attacks targeting the mnemonic are documented extensively in the cryptocurrency space. The document does not address mnemonic handling procedures.

**Recommendation:**
1. Document secure mnemonic storage procedures (metal backup plates, safety deposit box)
2. Warn users explicitly: "Anyone with your recovery phrase can reconstruct your entire system"
3. Consider Shamir's Secret Sharing (SLIP-39) to split the mnemonic across multiple locations, requiring M-of-N fragments to reconstruct
4. Implement a "mnemonic verification" flow that periodically asks the user to confirm they still have access to their backup

**Token impact:** If mnemonic verification includes an LLM-assisted user guidance flow, this adds ~100–300 tokens per verification event. Expected frequency: quarterly. Annual added cost: ~$0.02–$0.06.

---

### B10. trust.openclaw.ai as Single Point of Trust (Low Severity)

**Document Section:** 3.6.1

The threat intelligence scan queries "trust.openclaw.ai" as one of its data sources. If this domain is compromised (DNS hijack, server compromise), it could report that a malicious update is safe.

**Recommendation:** Never use trust.openclaw.ai as a sole signal. Ensure it is always cross-referenced against NVD, GHSA, and community sources. Add certificate pinning for this domain specifically.

**Token impact:** None.

---

## Part C: Token Usage Impact Summary

The table below estimates the additional LLM token consumption caused by each recommended change, in the context of the OpenClaw agent's ongoing operation.

| Recommendation | Tokens per Event | Event Frequency | Annual Token Cost Estimate |
|---|---|---|---|
| B2: Seed rotation integrity scan | 500–2,000 | 2–4x/year | 1,000–8,000 tokens |
| B3: Cross-validated forensic dissection | 2,000–10,000 | 2–5x/year | 4,000–50,000 tokens |
| B7: Allowlist review in weekly digest | 200–500 | 52x/year | 10,400–26,000 tokens |
| B8: Installer update LLM review | 500–2,000 | 12x/year | 6,000–24,000 tokens |
| B9: Mnemonic verification guidance | 100–300 | 4x/year | 400–1,200 tokens |
| A3: Input length caps (indirect) | Saves ~125 tokens/entry | Ongoing | Net savings |
| **Total additional tokens/year** | | | **~21,800–109,200 tokens** |

**Converted to approximate API cost** (at ~$3/M input tokens, ~$15/M output tokens for a Sonnet-class model):

- **Low estimate:** ~$0.15–$0.40/year additional
- **High estimate:** ~$0.80–$2.00/year additional

This is negligible relative to the document's estimated baseline of $11–$30/month ($132–$360/year).

The most significant token cost addition is **B3 (cross-validated forensic dissection)** because it doubles the per-event cost of the forensic pipeline. However, since forensic dissection only runs on reset events (expected to be rare), the absolute cost remains very low.

**B7 (allowlist review)** contributes the most in aggregate due to weekly frequency, but at 200–500 tokens per cycle, it is still minimal.

---

## Summary of Findings by Severity

| Severity | Count | IDs |
|----------|-------|-----|
| High | 4 | A6, B1, B3, B8 |
| Medium | 5 | A1, A3, A4, B4, B5, B6, B7 |
| Low | 4 | A2, A5, A7, B9, B10 |

**Priority actions (High severity):**
1. **A6:** Remove the .docx from the repository — it is an adversary's blueprint
2. **B1:** Use Secure Enclave for seed generation, not /dev/urandom
3. **B3:** Harden the forensic dissection pipeline against prompt injection from archived images
4. **B8:** Implement supply chain protections for the installer itself

---

*End of review.*
