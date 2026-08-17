# VARUNA Security Console

VARUNA is an evidence-first cybersecurity analysis console for graph-guided code reasoning, timing side-channel testing, protocol fuzzing, patch review, and security re-verification.

The console is designed to help security operators register analysis targets, start automated/guided analysis runs, inspect security pipeline progress, review evidence-backed findings, execute side-channel/protocol fuzzing campaigns, review code patches, and compile detailed PDF/HTML reports.

---

## 🚀 Key Features

*   **Graph-Guided Code Reasoning**: Connects abstract syntax tree (AST) code representations with control-flow graphs for precise vulnerability analysis.
*   **Timing Side-Channel testing**: Supports Transient Execution and TVLA (Test Vector Leakage Assessment) testing workspace.
*   **Protocol Fuzzing Campaigns**: Provides structured fuzzing dashboards to analyze state machine violations and crashes.
*   **Patch Review & Verification**: Displays differential patch analysis along with automated triggers to re-verify vulnerabilities.
*   **Comprehensive Reporting**: Compiles evidence, metrics, and findings into structured reports for security audits.

---

## 🛠️ Technology Stack

VARUNA is built as a multi-package monorepo using **pnpm workspaces**:

*   **Frontend**: React, Vite, Tailwind CSS, Lucide icons, Radix UI primitives, Recharts (for charts), and Wouter (routing).
*   **Backend API**: Node.js, Express 5, and Pino (logging).
*   **Database**: PostgreSQL + Drizzle ORM.
*   **Data Validation & Types**: Zod, TypeScript 5.9, and Orval (API client generation from OpenAPI specification).

---

## 📁 Repository Structure

```
├── artifacts/
│   ├── varuna-console/       # React/Vite operator console dashboard & workflow routes
│   ├── api-server/           # Express API server for prototype endpoints & mockup data
│   └── mockup-sandbox/       # Isolated mockup workspace for UI testing
├── lib/
│   ├── api-client-react/     # Generated typed React Query hooks (via Orval)
│   ├── api-spec/             # OpenAPI 3.0 configuration (openapi.yaml)
│   ├── api-zod/              # Zod validation schemas compiled from OpenAPI spec
│   └── db/                   # Database configuration, schema, and migrations
├── scripts/                  # Workspace utility scripts
├── package.json              # Monorepo workspace configuration
├── pnpm-workspace.yaml       # Workspace directories & Shared package catalog
└── README.md                 # Project documentation
```

---

## ⚙️ Getting Started

### Prerequisites

*   **Node.js**: `v24` or higher
*   **Package Manager**: `pnpm` (enforced via preinstall checks)
*   **Database**: PostgreSQL server instance

### Environment Variables

Create `.env` files where required. The core environment configuration:

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `DATABASE_URL` | Postgres connection string | `postgresql://user:pass@localhost:5432/varuna` |
| `PORT` | Running port for servers | `5000` (API Server) / `3000` (Console) |
| `BASE_PATH` | Base URL path for assets | `/` |

---

## 🏃 Run & Operate

Ensure all dependencies are installed before running scripts:
```bash
pnpm install
```

### Development Commands

| Command | Action |
| :--- | :--- |
| `pnpm --filter @workspace/api-server run dev` | Start the Express API Server (default port: `5000`) |
| `pnpm --filter @workspace/varuna-console dev` | Start the React Operator Console in development mode |
| `pnpm run typecheck` | Perform complete TypeScript type-checking across all workspace modules |
| `pnpm run build` | Validate all packages and compile production builds |
| `pnpm --filter @workspace/api-spec run codegen` | Regenerate API client hooks and Zod schemas from `openapi.yaml` |
| `pnpm --filter @workspace/db run push` | Push Drizzle schema changes directly to the PostgreSQL database |

---

## 🏗️ Architecture & Development Workflow

1.  **OpenAPI-First Contract**: The API definition is maintained in [`lib/api-spec/openapi.yaml`](file:///Users/sarthak/Desktop/varuna-crs/lib/api-spec/openapi.yaml). When you modify the API contracts, always regenerate the types and client hooks:
    ```bash
    pnpm --filter @workspace/api-spec run codegen
    ```
2.  **Modular Adapters**: The API prototype uses a modular adapter design. Real analyzers (like Joern, AFL++, TVLA, llama.cpp, ASan) can be attached by implementing the service boundaries defined under [`artifacts/api-server/src/routes/varuna.ts`](file:///Users/sarthak/Desktop/varuna-crs/artifacts/api-server/src/routes/varuna.ts).
3.  **Local Mockup / Sandbox**: For visual components and design iterations, you can run and view the mockup console using:
    ```bash
    pnpm --filter @workspace/mockup-sandbox dev
    ```

---

## ⚠️ Important Notes

*   **Build Environment Requirements**: Building Vite production outputs manually requires setting `PORT` and `BASE_PATH` (e.g., `PORT=3000 BASE_PATH=/ pnpm run build`).
*   **Database Migrations**: During local development, schema changes can be pushed directly to your local database using `pnpm --filter @workspace/db run push`.
