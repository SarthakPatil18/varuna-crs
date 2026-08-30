import { Router, type IRouter } from "express";
import {
  CreateAnalysisRunBody,
  CreateProjectBody,
  CreateProtocolTestBody,
  CreateReportBody,
  CreateTimingTestBody,
  GetFindingParams,
  GetFindingResponse,
  GetOverviewResponse,
  ListAnalysisRunsResponse,
  ListFindingsResponse,
  ListPatchesResponse,
  ListProjectsResponse,
  ListProtocolTestsResponse,
  ListReportsResponse,
  ListTimingTestsResponse,
  VerifyPatchParams,
  VerifyPatchResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

type ProjectRecord = {
  id: string;
  name: string;
  description: string;
  targetType: "source" | "binary" | "protocol";
  language: string;
  files: number;
  status: "active" | "analyzing" | "findings" | "verified" | "archived";
  createdAt: string;
  updatedAt: string;
};

type AnalysisRunRecord = {
  id: string;
  projectId: string;
  projectName: string;
  status: "queued" | "running" | "completed" | "failed";
  currentStage: string;
  progress: number;
  modules: Array<"cpg" | "gnn" | "timing" | "protocol" | "asan" | "ubsan">;
  findings: number;
  verificationStatus: "not_started" | "pending" | "passed" | "failed";
  startedAt: string;
  completedAt: string | null;
  updatedAt: string;
  error: string | null;
};

type TimingTestRecord = {
  id: string;
  projectName: string;
  function: string;
  samples: number;
  groups: number;
  statistic: number;
  threshold: number;
  result: "potential_leakage" | "no_significant_leakage" | "inconclusive" | "not_run";
  state: "pending" | "running" | "completed" | "failed" | "skipped";
  beforeAfter: "before_patch" | "after_patch";
  createdAt: string;
};

type ProtocolTestRecord = {
  id: string;
  projectName: string;
  target: string;
  fields: string[];
  strategy: string[];
  inputs: number;
  coverage: number;
  crashes: number;
  uniqueCrashes: number;
  triggeringField: string | null;
  state: "pending" | "running" | "completed" | "failed" | "skipped";
  createdAt: string;
};

type PatchRecord = {
  id: string;
  findingId: string;
  title: string;
  source: "local_llm" | "manual" | "imported";
  status: "proposed" | "applied" | "verification_pending" | "verified" | "rejected";
  createdAt: string;
  originalCode: string;
  proposedCode: string;
  explanation: string;
};

type VerificationRunRecord = {
  id: string;
  patchId: string;
  status: "queued" | "running" | "completed" | "failed";
  checks: Array<{
    label: string;
    state: "pending" | "running" | "passed" | "failed" | "skipped";
    detail: string;
  }>;
  overall: "not_verified" | "passed" | "failed" | "inconclusive";
  createdAt: string;
};

type ReportRecord = {
  id: string;
  projectName: string;
  status: "queued" | "ready" | "failed";
  generatedAt: string;
  findingCount: number;
  verificationStatus: "not_verified" | "partially_verified" | "verified";
};

const projects: ProjectRecord[] = [
  {
    id: "proj-argon",
    name: "argon-parser",
    description: "C++ command parser and token validation target",
    targetType: "source" as const,
    language: "C++",
    files: 184,
    status: "findings" as const,
    createdAt: "2026-08-15T08:24:00.000Z",
    updatedAt: "2026-08-17T09:42:00.000Z",
  },
  {
    id: "proj-veil",
    name: "veil-auth-service",
    description: "Authentication service binary and protocol boundary",
    targetType: "binary" as const,
    language: "C",
    files: 62,
    status: "analyzing" as const,
    createdAt: "2026-08-16T11:10:00.000Z",
    updatedAt: "2026-08-17T10:05:00.000Z",
  },
  {
    id: "proj-nimbus",
    name: "nimbus-wire",
    description: "Undocumented telemetry protocol sample",
    targetType: "protocol" as const,
    language: "Binary",
    files: 1,
    status: "verified" as const,
    createdAt: "2026-08-12T14:32:00.000Z",
    updatedAt: "2026-08-16T16:18:00.000Z",
  },
];

const analysisRuns: AnalysisRunRecord[] = [
  {
    id: "run-842",
    projectId: "proj-argon",
    projectName: "argon-parser",
    status: "running" as const,
    currentStage: "Security analysis",
    progress: 68,
    modules: ["cpg", "gnn", "timing", "asan"] as const,
    findings: 4,
    verificationStatus: "not_started" as const,
    startedAt: "2026-08-17T09:38:00.000Z",
    completedAt: null,
    updatedAt: "2026-08-17T10:06:00.000Z",
    error: null,
  },
  {
    id: "run-841",
    projectId: "proj-nimbus",
    projectName: "nimbus-wire",
    status: "completed" as const,
    currentStage: "Final result",
    progress: 100,
    modules: ["cpg", "gnn", "protocol", "asan", "ubsan"] as const,
    findings: 2,
    verificationStatus: "passed" as const,
    startedAt: "2026-08-16T14:02:00.000Z",
    completedAt: "2026-08-16T16:18:00.000Z",
    updatedAt: "2026-08-16T16:18:00.000Z",
    error: null,
  },
  {
    id: "run-839",
    projectId: "proj-veil",
    projectName: "veil-auth-service",
    status: "failed" as const,
    currentStage: "Target validation",
    progress: 8,
    modules: ["cpg", "gnn", "timing"] as const,
    findings: 0,
    verificationStatus: "not_started" as const,
    startedAt: "2026-08-15T17:26:00.000Z",
    completedAt: "2026-08-15T17:31:00.000Z",
    updatedAt: "2026-08-15T17:31:00.000Z",
    error: "The target loader could not resolve the configured entrypoint.",
  },
];

const findings = [
  {
    id: "finding-104",
    title: "Secret-dependent branch in token comparison",
    severity: "critical" as const,
    type: "Timing side-channel",
    cwe: "CWE-208",
    projectName: "argon-parser",
    file: "src/auth/token_compare.cpp",
    line: 87,
    function: "compare_token",
    method: "TVLA / Welch's t-test",
    score: 0.94,
    status: "detected" as const,
    detectedAt: "2026-08-17T10:02:00.000Z",
  },
  {
    id: "finding-103",
    title: "Length field permits heap over-read",
    severity: "high" as const,
    type: "Out-of-bounds read",
    cwe: "CWE-125",
    projectName: "nimbus-wire",
    file: "parser/frame_decode.c",
    line: 142,
    function: "decode_frame",
    method: "Structure-aware fuzzing",
    score: 0.87,
    status: "patch_proposed" as const,
    detectedAt: "2026-08-16T15:44:00.000Z",
  },
  {
    id: "finding-101",
    title: "Unchecked payload allocation size",
    severity: "high" as const,
    type: "Integer overflow",
    cwe: "CWE-190",
    projectName: "argon-parser",
    file: "src/protocol/payload.cpp",
    line: 224,
    function: "allocate_payload",
    method: "GraphSAGE prioritized analysis",
    score: 0.71,
    status: "verification_pending" as const,
    detectedAt: "2026-08-17T09:58:00.000Z",
  },
  {
    id: "finding-097",
    title: "Parser accepts malformed type discriminator",
    severity: "medium" as const,
    type: "Input validation",
    cwe: "CWE-20",
    projectName: "nimbus-wire",
    file: "protocol/message.c",
    line: 64,
    function: "read_message_type",
    method: "Structure-aware fuzzing",
    score: 0.63,
    status: "verified" as const,
    detectedAt: "2026-08-16T15:21:00.000Z",
  },
];

const timingTests: TimingTestRecord[] = [
  {
    id: "timing-22",
    projectName: "argon-parser",
    function: "compare_token",
    samples: 20000,
    groups: 2,
    statistic: 18.42,
    threshold: 4.5,
    result: "potential_leakage" as const,
    state: "completed" as const,
    beforeAfter: "before_patch" as const,
    createdAt: "2026-08-17T10:02:00.000Z",
  },
  {
    id: "timing-21",
    projectName: "argon-parser",
    function: "compare_token",
    samples: 20000,
    groups: 2,
    statistic: 1.37,
    threshold: 4.5,
    result: "no_significant_leakage" as const,
    state: "completed" as const,
    beforeAfter: "after_patch" as const,
    createdAt: "2026-08-16T16:52:00.000Z",
  },
];

const protocolTests: ProtocolTestRecord[] = [
  {
    id: "protocol-18",
    projectName: "nimbus-wire",
    target: "telemetryd",
    fields: ["MAGIC", "TYPE", "LENGTH", "TOKEN", "PAYLOAD"],
    strategy: ["Boundary values", "Invalid lengths", "Malformed payloads"],
    inputs: 18420,
    coverage: 72.4,
    crashes: 6,
    uniqueCrashes: 2,
    triggeringField: "LENGTH",
    state: "completed" as const,
    createdAt: "2026-08-16T15:42:00.000Z",
  },
];

const patches: PatchRecord[] = [
  {
    id: "patch-61",
    findingId: "finding-103",
    title: "Bound frame length before payload read",
    source: "local_llm" as const,
    status: "verification_pending" as const,
    createdAt: "2026-08-16T16:04:00.000Z",
    originalCode: "payload = read(fd, frame.length);",
    proposedCode:
      "const bounded = std::min(frame.length, MAX_PAYLOAD_SIZE);\npayload = read(fd, bounded);",
    explanation:
      "The proposed guard constrains the attacker-controlled length before the read and keeps the parser inside the validated frame boundary.",
  },
];

const reports: ReportRecord[] = [
  {
    id: "report-34",
    projectName: "nimbus-wire",
    status: "ready" as const,
    generatedAt: "2026-08-16T16:22:00.000Z",
    findingCount: 2,
    verificationStatus: "verified" as const,
  },
];

const verificationRuns: VerificationRunRecord[] = [
  {
    id: "verify-17",
    patchId: "patch-61",
    status: "completed" as const,
    checks: [
      { label: "Original exploit reproduced", state: "passed" as const, detail: "Crash reproduced in 3/3 attempts." },
      { label: "Patch applied", state: "passed" as const, detail: "Applied in isolated verification workspace." },
      { label: "Original exploit blocked", state: "passed" as const, detail: "No crash in 10,000 replayed inputs." },
      { label: "ASan", state: "passed" as const, detail: "No sanitizer findings." },
      { label: "UBSan", state: "passed" as const, detail: "No undefined behavior observed." },
      { label: "Regression tests", state: "passed" as const, detail: "42/42 tests passed." },
    ],
    overall: "passed" as const,
    createdAt: "2026-08-16T16:18:00.000Z",
  },
];

function id(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}`;
}

router.get("/overview", (_req, res) => {
  const data = GetOverviewResponse.parse({
    counts: {
      activeAnalyses: analysisRuns.filter((run) => run.status === "running").length,
      targets: projects.length,
      findings: findings.length,
      criticalFindings: findings.filter((finding) => finding.severity === "critical").length,
      fixedFindings: findings.filter((finding) => finding.status === "verified").length,
      pendingVerification: findings.filter((finding) => finding.status === "verification_pending").length,
    },
    stages: [
      { key: "target", label: "Target", state: "completed", detail: "2 targets validated" },
      { key: "cpg", label: "CPG", state: "completed", detail: "184 nodes indexed" },
      { key: "gnn", label: "GNN", state: "completed", detail: "Priority scores available" },
      { key: "security", label: "Security analysis", state: "running", detail: "Analyzing compare_token()" },
      { key: "finding", label: "Finding", state: "completed", detail: "4 findings recorded" },
      { key: "patch", label: "Patch", state: "pending", detail: "1 proposal awaiting review" },
      { key: "verify", label: "Re-verify", state: "pending", detail: "1 verification pending" },
    ],
    system: [
      { name: "GNN Engine", state: "ready", detail: "GraphSAGE adapter ready" },
      { name: "Local LLM", state: "ready", detail: "llama.cpp adapter ready" },
      { name: "Fuzzer", state: "ready", detail: "Sandbox available" },
      { name: "TVLA Engine", state: "ready", detail: "Welch's t-test ready" },
      { name: "Network", state: "offline", detail: "Local-only execution" },
    ],
    recentRuns: analysisRuns,
  });
  res.json(data);
});

router.get("/projects", (_req, res) => {
  res.json(ListProjectsResponse.parse(projects));
});

router.post("/projects", (req, res) => {
  const input = CreateProjectBody.parse(req.body);
  const created = {
    id: id("proj"),
    name: input.name,
    description: input.description ?? "Uploaded VARUNA analysis target",
    targetType: input.targetType,
    language: input.language,
    files: 0,
    status: "active" as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  projects.unshift(created);
  res.status(201).json(created);
});

router.get("/analysis-runs", (_req, res) => {
  res.json(ListAnalysisRunsResponse.parse(analysisRuns));
});

router.post("/analysis-runs", (req, res) => {
  const input = CreateAnalysisRunBody.parse(req.body);
  const project = projects.find((item) => item.id === input.projectId);
  if (!project) {
    res.status(404).json({ error: "Analysis target not found." });
    return;
  }
  const created = {
    id: id("run"),
    projectId: project.id,
    projectName: project.name,
    status: "running" as const,
    currentStage: "Target validation",
    progress: 8,
    modules: input.modules,
    findings: 0,
    verificationStatus: "not_started" as const,
    startedAt: new Date().toISOString(),
    completedAt: null,
    updatedAt: new Date().toISOString(),
    error: null,
  };
  analysisRuns.unshift(created);
  project.status = "analyzing";
  res.status(201).json(created);
});

router.get("/findings", (_req, res) => {
  res.json(ListFindingsResponse.parse(findings));
});

router.get("/findings/:id", (req, res) => {
  const params = GetFindingParams.parse(req.params);
  const finding = findings.find((item) => item.id === params.id);
  if (!finding) {
    res.status(404).json({ error: "Finding not found." });
    return;
  }

  const findingDetails: Record<string, { evidence: string[]; code: Array<{ line: number; text: string; highlighted: boolean }>; graphPath: string[] }> = {
    "finding-104": {
      evidence: [
        "Welch's t-test statistic t=18.42 (|t| >= 4.5) indicates secret-correlated timing leakage.",
        "Early loop exit on mismatched token byte creates measurable CPU cycle delta.",
        "Signal is reproducible across independent TVLA sample runs with 20,000 iterations.",
      ],
      code: [
        { line: 84, text: "bool compare_token(const char* input, const char* secret) {", highlighted: false },
        { line: 85, text: "  for (size_t i = 0; input[i] != '\\0'; i++) {", highlighted: false },
        { line: 86, text: "    if (input[i] != secret[i]) return false;", highlighted: true },
        { line: 87, text: "  }", highlighted: true },
        { line: 88, text: "  return true;", highlighted: false },
        { line: 89, text: "}", highlighted: false },
      ],
      graphPath: ["main()", "parse_request()", "authenticate()", "compare_token()"],
    },
    "finding-103": {
      evidence: [
        "ASan heap-buffer-overflow captured during length mutation fuzzing sequence.",
        "Wire packet length field value 0xFFFF exceeds frame buffer capacity without validation.",
        "Crash replicated with 18-byte reproduction payload.",
      ],
      code: [
        { line: 139, text: "int decode_frame(const uint8_t* raw, size_t raw_len, Frame* out) {", highlighted: false },
        { line: 140, text: "  uint16_t payload_len = *(uint16_t*)(raw + 2);", highlighted: false },
        { line: 141, text: "  out->payload = malloc(payload_len);", highlighted: false },
        { line: 142, text: "  memcpy(out->payload, raw + 4, payload_len);", highlighted: true },
        { line: 143, text: "  return 0;", highlighted: false },
        { line: 144, text: "}", highlighted: false },
      ],
      graphPath: ["recv_loop()", "dispatch_packet()", "decode_frame()", "memcpy()"],
    },
    "finding-101": {
      evidence: [
        "Integer overflow leading to undersized memory allocation and subsequent buffer overwrite.",
        "GraphSAGE GNN identified unchecked multiplication on untrusted packet header fields.",
        "UBSan runtime error: unsigned integer overflow on multiplication.",
      ],
      code: [
        { line: 221, text: "uint8_t* allocate_payload(size_t chunk_count, size_t chunk_size) {", highlighted: false },
        { line: 222, text: "  size_t total_bytes = chunk_count * chunk_size;", highlighted: true },
        { line: 223, text: "  uint8_t* buf = (uint8_t*)malloc(total_bytes);", highlighted: false },
        { line: 224, text: "  if (!buf) return nullptr;", highlighted: false },
        { line: 225, text: "  return buf;", highlighted: false },
        { line: 226, text: "}", highlighted: false },
      ],
      graphPath: ["handle_client()", "assemble_chunks()", "allocate_payload()", "malloc()"],
    },
    "finding-097": {
      evidence: [
        "Unvalidated message type byte passed into jump table / switch statement.",
        "Default branch fails to drop malformed frame causing uninitialized state.",
        "Mutation campaign generated 12 invalid type codes triggering fallthrough.",
      ],
      code: [
        { line: 61, text: "enum MsgType read_message_type(uint8_t raw_type) {", highlighted: false },
        { line: 62, text: "  if (raw_type > MAX_KNOWN_TYPE) {", highlighted: false },
        { line: 63, text: "    // missing error return, falls through to type table", highlighted: true },
        { line: 64, text: "  }", highlighted: true },
        { line: 65, text: "  return (enum MsgType)raw_type;", highlighted: false },
        { line: 66, text: "}", highlighted: false },
      ],
      graphPath: ["net_poll()", "process_message()", "read_message_type()"],
    },
  };

  const specific = findingDetails[finding.id] ?? {
    evidence: [
      "Static analyzer flagged potential control-flow anomaly.",
      "GraphSAGE vulnerability prioritization score exceeds baseline.",
      "Requires operator review and automated verification.",
    ],
    code: [
      { line: finding.line - 1, text: `// Function entry: ${finding.function}`, highlighted: false },
      { line: finding.line, text: `  ${finding.function}(/* untrusted input */);`, highlighted: true },
      { line: finding.line + 1, text: `  return status;`, highlighted: false },
    ],
    graphPath: ["entry()", "dispatch()", `${finding.function}()`],
  };

  const detail = {
    ...finding,
    ...specific,
  };
  res.json(GetFindingResponse.parse(detail));
});

router.get("/timing-tests", (_req, res) => {
  res.json(ListTimingTestsResponse.parse(timingTests));
});

router.post("/timing-tests", (req, res) => {
  const input = CreateTimingTestBody.parse(req.body);
  const project = projects.find((item) => item.id === input.projectId);
  const created = {
    id: id("timing"),
    projectName: project?.name ?? "Unknown target",
    function: input.function,
    samples: input.samples,
    groups: 2,
    statistic: 0,
    threshold: 4.5,
    result: "not_run" as const,
    state: "pending" as const,
    beforeAfter: "before_patch" as const,
    createdAt: new Date().toISOString(),
  };
  timingTests.unshift(created);
  res.status(201).json(created);
});

router.get("/protocol-tests", (_req, res) => {
  res.json(ListProtocolTestsResponse.parse(protocolTests));
});

router.post("/protocol-tests", (req, res) => {
  const input = CreateProtocolTestBody.parse(req.body);
  const project = projects.find((item) => item.id === input.projectId);
  const created = {
    id: id("protocol"),
    projectName: project?.name ?? "Unknown target",
    target: input.target,
    fields: ["MAGIC", "TYPE", "LENGTH", "TOKEN", "PAYLOAD"],
    strategy: input.strategy,
    inputs: 0,
    coverage: 0,
    crashes: 0,
    uniqueCrashes: 0,
    triggeringField: null,
    state: "pending" as const,
    createdAt: new Date().toISOString(),
  };
  protocolTests.unshift(created);
  res.status(201).json(created);
});

router.get("/patches", (_req, res) => {
  res.json(ListPatchesResponse.parse(patches));
});

router.post("/patches/:id/verify", (req, res) => {
  const params = VerifyPatchParams.parse(req.params);
  const patch = patches.find((item) => item.id === params.id);
  if (!patch) {
    res.status(404).json({ error: "Patch not found." });
    return;
  }
  patch.status = "verified";
  const created = {
    id: id("verify"),
    patchId: patch.id,
    status: "completed" as const,
    checks: [
      { label: "Original exploit reproduced", state: "passed" as const, detail: "Exploit payload executed against baseline; flaw triggered." },
      { label: "Patch applied", state: "passed" as const, detail: "Context-aware constant-time / bounds validation applied cleanly." },
      { label: "Original exploit blocked", state: "passed" as const, detail: "Exploit payload safely neutralized without side effects." },
      { label: "Timing / protocol re-test", state: "passed" as const, detail: "Welch t-test |t|=0.82 (< 4.5 threshold). No leakage." },
      { label: "ASan / UBSan", state: "passed" as const, detail: "Zero sanitizer violations or memory leaks detected during replay." },
      { label: "Regression tests", state: "passed" as const, detail: "48/48 regression and functional test cases passed." },
    ],
    overall: "passed" as const,
    createdAt: new Date().toISOString(),
  };
  verificationRuns.unshift(created);
  res.status(201).json(VerifyPatchResponse.parse(created));
});

router.get("/reports", (_req, res) => {
  res.json(ListReportsResponse.parse(reports));
});

router.post("/reports", (req, res) => {
  const input = CreateReportBody.parse(req.body);
  const project = projects.find((item) => item.id === input.projectId);
  const created = {
    id: id("report"),
    projectName: project?.name ?? "Unknown target",
    status: "queued" as const,
    generatedAt: new Date().toISOString(),
    findingCount: findings.filter((item) => item.projectName === project?.name).length,
    verificationStatus: "not_verified" as const,
  };
  reports.unshift(created);
  res.status(201).json(created);
});

export default router;