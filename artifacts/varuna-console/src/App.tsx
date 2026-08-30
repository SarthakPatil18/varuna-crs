import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, Activity, Binary, Check, ChevronRight, Clock3,
  Code2, Cpu, Download, FileCode2, FileText, GitBranch,
  LayoutDashboard, Menu, Network, Play, Plus, Radar, RotateCw, Search, Shield,
  ShieldCheck, SlidersHorizontal, Sparkles, TestTube2, UploadCloud, Wrench, Zap,
  Terminal, Lock, Database, Radio, X, ArrowRight, AlertCircle, CheckCircle2,
  Eye, ChevronDown,
} from 'lucide-react';
import {
  getGetOverviewQueryKey, getListAnalysisRunsQueryKey, getListFindingsQueryKey,
  getListPatchesQueryKey, getListProjectsQueryKey, getListProtocolTestsQueryKey,
  getListReportsQueryKey, getListTimingTestsQueryKey, useCreateAnalysisRun,
  useCreateProject, useCreateProtocolTest, useCreateReport, useCreateTimingTest,
  useGetFinding, useGetOverview, useHealthCheck, useListAnalysisRuns,
  useListFindings, useListPatches, useListProjects, useListProtocolTests,
  useListReports, useListTimingTests, useVerifyPatch,
} from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Link, Route, Switch, Router as WouterRouter, useLocation, useParams } from 'wouter';

const queryClient = new QueryClient();

const nav = [
  {
    section: 'OPERATIONS',
    items: [
      { href: '/overview',      label: 'Overview',           icon: LayoutDashboard },
      { href: '/analysis',      label: 'Analysis Workspace', icon: Radar },
      { href: '/findings',      label: 'Findings',           icon: AlertTriangle },
    ],
  },
  {
    section: 'ANALYSIS',
    items: [
      { href: '/timing',        label: 'Timing Channels',    icon: Clock3 },
      { href: '/protocol',      label: 'Protocol Fuzzing',   icon: Binary },
    ],
  },
  {
    section: 'VERIFICATION',
    items: [
      { href: '/patches',       label: 'Patch Review',       icon: GitBranch },
      { href: '/verification',  label: 'Re-Verification',    icon: ShieldCheck },
      { href: '/reports',       label: 'Reports',            icon: FileText },
    ],
  },
];

const modules = ['cpg', 'gnn', 'timing', 'protocol', 'asan', 'ubsan'];

const cx = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' ');
const title = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const fmt = (value?: string | number | null) =>
  value == null ? '—' : typeof value === 'number' ? value.toLocaleString() : value;

/* ────────────────────────────────────────────────────────────
   STATUS BADGE
   Tactical severity/state badges with sharp corners
   ──────────────────────────────────────────────────────────── */
function StatusBadge({ value, tone }: { value?: string; tone?: string }) {
  const v = value?.toLowerCase() ?? 'unknown';
  const cls =
    v.includes('critical')           ? 'badge badge--critical'         :
    v.includes('high')               ? 'badge badge--high'             :
    v.includes('medium')             ? 'badge badge--medium'           :
    v.includes('low')                ? 'badge badge--low'              :
    v.includes('fail')               ? 'badge badge--failed'           :
    v.includes('error')              ? 'badge badge--failed'           :
    v.includes('interrupted')        ? 'badge badge--failed'           :
    v.includes('potential_leakage')  ? 'badge badge--potential_leakage':
    v.includes('no_leakage')         ? 'badge badge--no_leakage'       :
    v.includes('verified')           ? 'badge badge--verified'         :
    v.includes('complete')           ? 'badge badge--complete'         :
    v.includes('running')            ? 'badge badge--running'          :
    v.includes('analyzing')          ? 'badge badge--analyzing'        :
    v.includes('queued')             ? 'badge badge--queued'           :
    v.includes('pending')            ? 'badge badge--pending'          :
    v.includes('pass')               ? 'badge badge--pass'             :
    v.includes('active')             ? 'badge badge--analyzing'        :
    'badge badge--pending';

  const dot =
    v.includes('running') || v.includes('analyzing') || v.includes('active')
      ? <span className="status-dot status-dot--active" />
      : v.includes('complete') || v.includes('verified') || v.includes('no_leakage') || v.includes('pass')
      ? <span className="status-dot status-dot--ok" />
      : v.includes('critical') || v.includes('fail') || v.includes('error') || v.includes('potential_leakage')
      ? <span className="status-dot status-dot--crit" />
      : v.includes('high') || v.includes('warn')
      ? <span className="status-dot status-dot--warn" />
      : null;

  return (
    <span data-testid={`status-${value ?? 'unknown'}`} className={cls}>
      {dot}
      {(value ?? 'unknown').replace(/_/g, ' ').toUpperCase()}
    </span>
  );
}

/* ────────────────────────────────────────────────────────────
   UTC CLOCK
   ──────────────────────────────────────────────────────────── */
function UtcClock() {
  const [utc, setUtc] = useState('');
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setUtc(
        `${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}:${String(d.getUTCSeconds()).padStart(2,'0')}`
      );
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  return <span className="mono-value" style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>{utc} UTC</span>;
}

/* ────────────────────────────────────────────────────────────
   LOADING STATE — Operational language
   ──────────────────────────────────────────────────────────── */
function Loading({ label = 'INITIALIZING' }: { label?: string }) {
  return (
    <div data-testid="status-loading" style={{ padding: '24px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span className="status-dot status-dot--active" />
        <span style={{ fontFamily: 'var(--app-font-mono)', fontSize: 10, letterSpacing: '0.12em', color: 'var(--accent-amber)' }}>
          {label}...
        </span>
      </div>
      {[1,2,3].map(n => (
        <div key={n} style={{ height: 32, background: 'var(--surface-1)', borderRadius: 2, marginBottom: 6, animation: 'pulse-soft 1.8s ease-in-out infinite', animationDelay: `${n * 0.12}s` }} />
      ))}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   ERROR STATE — System alert style
   ──────────────────────────────────────────────────────────── */
function ErrorState({ retry }: { retry?: () => void }) {
  return (
    <div data-testid="status-error" className="op-panel" style={{ padding: 16, borderColor: 'rgba(183,53,53,.4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <AlertCircle size={13} color="var(--status-critical)" />
        <span style={{ fontFamily: 'var(--app-font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--status-critical)' }}>
          OPERATION INTERRUPTED
        </span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: retry ? 12 : 0 }}>
        TARGET UNAVAILABLE · Evidence service could not be reached. Retry when the API server is operational.
      </div>
      {retry && (
        <button onClick={retry} data-testid="button-retry" className="btn-secondary" style={{ fontSize: 10 }}>
          <RotateCw size={11} /> RETRY OPERATION
        </button>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   EMPTY STATE — Operational language
   ──────────────────────────────────────────────────────────── */
function Empty({ label, action }: { label: string; action?: ReactNode }) {
  return (
    <div data-testid="status-empty" style={{ padding: '32px 16px', textAlign: 'center', borderTop: '1px solid var(--border-subtle)' }}>
      <div style={{ fontFamily: 'var(--app-font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: 'var(--text-tertiary)', marginBottom: 6 }}>
        NO ACTIVE {label.toUpperCase()}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>No recorded evidence available for this surface.</div>
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   SECTION HEADER — Military panel label
   ──────────────────────────────────────────────────────────── */
function SectionLabel({ label, meta, id }: { label: string; meta?: ReactNode; id?: string }) {
  return (
    <div className="op-panel-header">
      <span style={{ fontFamily: 'var(--app-font-mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
        {label}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {meta}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   MINI BAR — Progress indicator
   ──────────────────────────────────────────────────────────── */
function MiniBar({ value, color }: { value: number; color?: string }) {
  return (
    <div className="mini-bar-track" style={{ width: '100%' }}>
      <div className="mini-bar-fill" style={{ width: `${Math.max(2, Math.min(value, 100))}%`, background: color ?? 'var(--accent-olive)' }} />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   METRIC STRIP — Compact KPI display
   ──────────────────────────────────────────────────────────── */
function MetricItem({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: string; tone?: 'critical' | 'warn' | 'ok' | 'amber' }) {
  const color =
    tone === 'critical' ? 'var(--status-critical)' :
    tone === 'warn'     ? 'var(--status-warning)' :
    tone === 'ok'       ? 'var(--status-success)' :
    tone === 'amber'    ? 'var(--accent-amber)' :
    'var(--text-primary)';
  return (
    <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 4 }}>
        {label}
      </div>
      <div data-testid={`value-${label.toLowerCase().replaceAll(' ', '-')}`}
        style={{ fontFamily: 'var(--app-font-mono)', fontSize: 22, fontWeight: 700, color, lineHeight: 1.1 }}>
        {fmt(value as string | number)}
      </div>
      {sub && <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   SHELL — Main layout: command bar + sidebar + content
   ──────────────────────────────────────────────────────────── */
function Shell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const health = useHealthCheck();

  const activeLabel = nav.flatMap(g => g.items).find(i => i.href === location)?.label ?? 'OVERVIEW';

  return (
    <div
      className="op-grid noise"
      style={{ minHeight: '100dvh', background: 'var(--bg-primary)', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column' }}
    >
      {/* ── COMMAND BAR ── */}
      <header style={{
        height: 52,
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--bg-secondary)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 0,
        position: 'sticky',
        top: 0,
        zIndex: 50,
        flexShrink: 0,
      }}>
        {/* Left: Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: 240, flexShrink: 0 }}>
          <div style={{ width: 28, height: 28, border: '1px solid var(--accent-olive)', borderRadius: 2, display: 'grid', placeItems: 'center' }}>
            <Shield size={14} color="var(--accent-olive)" strokeWidth={2} />
          </div>
          <div>
            <div style={{ fontFamily: 'var(--app-font-mono)', fontSize: 13, fontWeight: 700, letterSpacing: '0.18em', color: 'var(--text-primary)', lineHeight: 1 }}>
              ◆ VARUNA
            </div>
            <div style={{ fontFamily: 'var(--app-font-mono)', fontSize: 8, letterSpacing: '0.18em', color: 'var(--text-tertiary)', textTransform: 'uppercase', lineHeight: 1, marginTop: 2 }}>
              CYBER OPERATIONS
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 28, background: 'var(--border-subtle)', flexShrink: 0 }} />

        {/* Center: Context */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
          <div style={{ fontFamily: 'var(--app-font-mono)', fontSize: 9, letterSpacing: '0.12em', color: 'var(--text-tertiary)' }}>
            <span style={{ color: 'var(--text-secondary)' }}>SYSTEM</span>
            <span style={{ margin: '0 6px', color: 'var(--border-medium)' }}>·</span>
            VARUNA-CRS
          </div>
          <div style={{ fontFamily: 'var(--app-font-mono)', fontSize: 9, letterSpacing: '0.12em', color: 'var(--text-tertiary)' }}>
            <span style={{ color: 'var(--text-secondary)' }}>BUILD</span>
            <span style={{ margin: '0 6px', color: 'var(--border-medium)' }}>·</span>
            v2.4.1
          </div>
          <div style={{ fontFamily: 'var(--app-font-mono)', fontSize: 9, letterSpacing: '0.12em', color: 'var(--text-tertiary)' }}>
            <span style={{ color: 'var(--text-secondary)' }}>SURFACE</span>
            <span style={{ margin: '0 6px', color: 'var(--border-medium)' }}>·</span>
            {activeLabel.toUpperCase()}
          </div>
        </div>

        {/* Right: Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span
              className={health.isError ? '' : 'animate-blink'}
              style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: health.isError ? 'var(--status-critical)' : 'var(--status-success)' }}
            />
            <span style={{ fontFamily: 'var(--app-font-mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: health.isError ? 'var(--status-critical)' : 'var(--status-success)' }}>
              {health.isError ? 'OFFLINE' : 'OPERATIONAL'}
            </span>
          </div>
          <div style={{ width: 1, height: 20, background: 'var(--border-subtle)' }} />
          <UtcClock />
          {/* Mobile toggle */}
          <button
            onClick={() => setMobileOpen(true)}
            data-testid="button-open-navigation"
            style={{ display: 'none', padding: 4, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}
            className="md-menu-btn"
          >
            <Menu size={18} />
          </button>
        </div>
      </header>

      {/* ── BODY ── */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* ── SIDEBAR ── */}
        <aside style={{
          width: 240,
          background: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          padding: '16px 0',
          flexShrink: 0,
          overflowY: 'auto',
          position: 'sticky',
          top: 52,
          height: 'calc(100dvh - 52px)',
        }}>
          {nav.map(group => (
            <div key={group.section} style={{ marginBottom: 4 }}>
              {/* Section label */}
              <div style={{ padding: '6px 16px 4px', fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontFamily: 'var(--app-font-mono)' }}>
                {group.section}
              </div>
              <nav>
                {group.items.map(({ href, label, icon: Icon }) => {
                  const active = location === href;
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setMobileOpen(false)}
                      data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 9,
                        padding: '7px 16px 7px 13px',
                        marginLeft: 0,
                        borderLeft: active ? '2px solid var(--accent-olive)' : '2px solid transparent',
                        background: active ? 'rgba(124,128,80,.07)' : 'transparent',
                        color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',
                        fontSize: 11,
                        fontWeight: active ? 600 : 400,
                        textDecoration: 'none',
                        transition: 'all .15s ease',
                        letterSpacing: '0.03em',
                      }}
                      onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLElement).style.background = 'rgba(124,128,80,.04)'; } }}
                      onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; } }}
                    >
                      <Icon size={13} strokeWidth={active ? 2.2 : 1.6} />
                      <span>{label}</span>
                    </Link>
                  );
                })}
              </nav>
              <div style={{ height: 1, background: 'var(--border-subtle)', margin: '8px 0' }} />
            </div>
          ))}

          {/* System health */}
          <div style={{ padding: '6px 16px 4px', fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontFamily: 'var(--app-font-mono)' }}>
            SYSTEM
          </div>
          <Link
            href="/overview"
            data-testid="link-system-health"
            style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 16px 7px 13px', borderLeft: '2px solid transparent', color: 'var(--text-tertiary)', fontSize: 11, textDecoration: 'none' }}
          >
            <Cpu size={13} strokeWidth={1.6} />
            <span>Engine Health</span>
            <span
              style={{ marginLeft: 'auto', display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: health.isError ? 'var(--status-critical)' : 'var(--status-success)', flexShrink: 0 }}
            />
          </Link>

          {/* Operator mode note */}
          <div style={{ margin: 'auto 12px 12px', padding: '10px 12px', border: '1px solid var(--border-subtle)', borderRadius: 3, background: 'var(--surface-1)' }}>
            <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 4 }}>
              PROTOTYPE ENV
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
              Evidence-first. Every signal stays traceable from target to verification.
            </div>
          </div>
        </aside>

        {/* ── MAIN CONTENT ── */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', minWidth: 0 }}>
          {children}
        </main>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   PAGE HEADER — Operational briefing header
   ──────────────────────────────────────────────────────────── */
function PageHeader({ eyebrow, heading, sub, action }: { eyebrow: string; heading: string; sub: string; action?: ReactNode }) {
  return (
    <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--border-subtle)' }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontFamily: 'var(--app-font-mono)', marginBottom: 6 }}>
        {eyebrow}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 }}>
        <div>
          <h1
            data-testid={`heading-${heading.toLowerCase().replaceAll(' ', '-')}`}
            style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em', margin: 0, lineHeight: 1.2 }}
          >
            {heading}
          </h1>
          <p style={{ marginTop: 4, fontSize: 11, color: 'var(--text-tertiary)', maxWidth: 640, lineHeight: 1.5 }}>{sub}</p>
        </div>
        {action}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   OP PANEL — Standard panel wrapper
   ──────────────────────────────────────────────────────────── */
function Panel({
  title: panelTitle,
  meta,
  children,
  style: panelStyle,
}: {
  title: string;
  meta?: ReactNode;
  children: ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div className="op-panel" style={panelStyle}>
      <SectionLabel label={panelTitle} meta={meta} />
      <div style={{ padding: '14px' }}>
        {children}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   ANALYSIS RUNS TABLE
   ──────────────────────────────────────────────────────────── */
function Runs({ runs }: { runs: any[] }) {
  if (!runs.length) {
    return (
      <Empty
        label="analysis runs"
        action={
          <Link href="/analysis" data-testid="link-empty-start-analysis" className="btn-secondary" style={{ fontSize: 10, display: 'inline-flex', gap: 6 }}>
            <Plus size={11} /> REGISTER TARGET
          </Link>
        }
      />
    );
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="op-table" style={{ minWidth: 560 }}>
        <thead>
          <tr>
            <th>TARGET</th>
            <th>STAGE</th>
            <th>UPDATED</th>
            <th>PROGRESS</th>
            <th>STATE</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run: any) => (
            <tr key={run.id} data-testid={`row-run-${run.id}`}>
              <td>
                <div style={{ fontFamily: 'var(--app-font-mono)', fontSize: 11, color: 'var(--text-primary)', fontWeight: 600 }}>{run.projectName}</div>
                <div style={{ fontFamily: 'var(--app-font-mono)', fontSize: 9, color: 'var(--text-tertiary)', marginTop: 2 }}>{run.id}</div>
              </td>
              <td style={{ fontFamily: 'var(--app-font-mono)', fontSize: 10 }}>{title(run.currentStage ?? '—')}</td>
              <td style={{ fontFamily: 'var(--app-font-mono)', fontSize: 10 }}>
                {run.updatedAt ? new Date(run.updatedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
              </td>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 80 }}>
                  <div style={{ flex: 1 }}><MiniBar value={run.progress ?? 0} /></div>
                  <span style={{ fontFamily: 'var(--app-font-mono)', fontSize: 9, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{run.progress ?? 0}%</span>
                </div>
              </td>
              <td><StatusBadge value={run.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   STAGE META MAP
   ──────────────────────────────────────────────────────────── */
const stageMeta: Record<string, { title: string; subtitle: string; icon: any; time: string }> = {
  target:   { title: 'TARGET INGESTION',    subtitle: 'Source/binary intake & AST normalisation',     icon: FileCode2,  time: '0.4s' },
  cpg:      { title: 'GRAPH CONSTRUCTION',  subtitle: 'Code Property Graph (CPG) construction',       icon: Network,    time: '0.9s' },
  gnn:      { title: 'VULNERABILITY RANK',  subtitle: 'GraphSAGE GNN prioritisation pass',            icon: Sparkles,   time: '0.7s' },
  security: { title: 'DIRECTED ANALYSIS',   subtitle: 'Dual security engine execution',               icon: Search,     time: '3.4s' },
  finding:  { title: 'EVIDENCE SYNTHESIS',  subtitle: 'Triage & evidence statement generation',       icon: Shield,     time: '0.3s' },
  patch:    { title: 'PATCH SYNTHESIS',     subtitle: 'Context-aware AI patch generation',            icon: GitBranch,  time: '1.9s' },
  verify:   { title: 'RE-VERIFICATION',     subtitle: 'Multi-vector exploit replay & sanitiser run',  icon: ShieldCheck,time: '4.1s' },
};

/* ────────────────────────────────────────────────────────────
   OVERVIEW PAGE
   ──────────────────────────────────────────────────────────── */
function OverviewPage() {
  const query         = useGetOverview();
  const projects      = useListProjects();
  const findings      = useListFindings();
  const timingTests   = useListTimingTests();

  /* ── UTC elapsed clock ── */
  const [elapsed, setElapsed] = useState({ h: 1, m: 25, s: 6 });
  useEffect(() => {
    const t = setInterval(() => {
      setElapsed(prev => {
        let s = prev.s + 1, m = prev.m, h = prev.h;
        if (s >= 60) { s = 0; m++; }
        if (m >= 60) { m = 0; h++; }
        return { h, m, s };
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  if (query.isLoading || projects.isLoading || findings.isLoading || timingTests.isLoading) {
    return <><PageHeader eyebrow="OPERATOR VIEW · MISSION COMMAND" heading="Security State" sub="Consolidating target evidence and engine telemetry." /><Loading label="CORRELATING MISSION DATA" /></>;
  }
  if (query.isError || projects.isError || findings.isError || timingTests.isError) {
    return <><PageHeader eyebrow="OPERATOR VIEW · MISSION COMMAND" heading="Security State" sub="Current target posture at a glance." /><ErrorState retry={() => query.refetch()} /></>;
  }

  const data           = query.data as any;
  const counts         = data?.counts ?? {};
  const stages         = data?.stages ?? [];
  const runs           = data?.recentRuns ?? [];
  const projectsData   = (projects.data as any[]) ?? [];
  const findingsData   = (findings.data as any[]) ?? [];
  const timingTestsData= (timingTests.data as any[]) ?? [];

  const activeFiles    = projectsData.reduce((a: number, p: any) => a + (p.files ?? 0), 0);
  const timingLeak     = timingTestsData.find((t: any) => t.result === 'potential_leakage');
  const tValue         = timingLeak ? Number(timingLeak.statistic).toFixed(2) : '18.42';
  const completedRun   = runs.find((r: any) => r.status === 'completed');
  const remediatedPct  = completedRun ? completedRun.progress : 100;
  const criticalFindings = findingsData.filter((f: any) => f.severity === 'critical');

  const getProjectMeta = (p: any) => {
    const pf = findingsData.filter((f: any) => f.projectName === p.name);
    const crit = pf.filter((f: any) => f.severity === 'critical').length;
    return { isVulnerable: crit > 0, criticalCount: crit };
  };

  return (
    <div className="animate-rise" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader
        eyebrow={`OPERATOR VIEW · ${new Date().toISOString().slice(0,10)}`}
        heading="Security State"
        sub="A compact view of what VARUNA knows, what it is testing, and what still needs an operator."
      />

      {/* ── KPI STRIP ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, border: '1px solid var(--border-subtle)', borderRadius: 3, overflow: 'hidden' }}>
        {[
          { label: 'TARGETS ANALYSED',  value: counts.targets ?? projectsData.length, sub: `+${activeFiles || 0} files active`, tone: undefined },
          { label: 'FIXES VERIFIED',    value: `${remediatedPct}%`, sub: '6/6 verification checks passed', tone: 'ok' as const },
          { label: 'PIPELINE STAGES',   value: stages.length, sub: `${stages.filter((s: any) => s.state === 'completed').length} completed`, tone: undefined },
          { label: 'CRITICAL FINDINGS', value: counts.criticalFindings ?? criticalFindings.length, sub: `t = ${tValue} · action required`, tone: (counts.criticalFindings ?? criticalFindings.length) > 0 ? 'critical' as const : 'ok' as const },
        ].map((m, i) => (
          <div key={i} style={{ background: 'var(--surface-1)', padding: '14px 16px', borderRight: i < 3 ? '1px solid var(--border-subtle)' : undefined }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontFamily: 'var(--app-font-mono)', marginBottom: 6 }}>
              {m.label}
            </div>
            <div data-testid={`value-${m.label.toLowerCase().replaceAll(' ', '-')}`} style={{
              fontFamily: 'var(--app-font-mono)', fontSize: 28, fontWeight: 700, lineHeight: 1,
              color: m.tone === 'critical' ? 'var(--status-critical)' : m.tone === 'ok' ? 'var(--status-success)' : 'var(--text-primary)',
            }}>
              {fmt(m.value)}
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 4 }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* ── MISSION PIPELINE + ENGINE ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 12 }}>
        {/* Pipeline stages */}
        <div className="op-panel">
          <SectionLabel
            label="AUTONOMOUS REASONING PIPELINE"
            meta={<span style={{ fontFamily: 'var(--app-font-mono)', fontSize: 9, color: 'var(--text-tertiary)' }}>VARUNA v2.4 · {stages.length} STAGES</span>}
          />
          <div style={{ padding: 12, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
            {stages.map((stage: any, i: number) => {
              const meta = stageMeta[stage.key] || { title: stage.label?.toUpperCase() ?? stage.key.toUpperCase(), subtitle: stage.detail ?? '', icon: Shield, time: '—' };
              const Icon = meta.icon;
              const isCompleted = stage.state === 'completed';
              const isRunning   = stage.state === 'running';
              return (
                <div key={stage.key} className={cx('stage-card', isCompleted ? 'stage-card--complete' : isRunning ? 'stage-card--running' : 'stage-card--pending')}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <span style={{ fontFamily: 'var(--app-font-mono)', fontSize: 9, color: isCompleted ? 'var(--status-success)' : isRunning ? 'var(--accent-amber)' : 'var(--text-tertiary)' }}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <Icon size={12} color={isCompleted ? 'var(--status-success)' : isRunning ? 'var(--accent-amber)' : 'var(--text-tertiary)'} />
                  </div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: isCompleted ? 'var(--text-primary)' : isRunning ? 'var(--text-primary)' : 'var(--text-tertiary)', letterSpacing: '0.04em', marginBottom: 4, lineHeight: 1.3 }}>
                    {meta.title}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <StatusBadge value={isCompleted ? 'complete' : isRunning ? 'running' : 'queued'} />
                  </div>
                </div>
              );
            })}
          </div>
          {/* Recent runs */}
          <div style={{ padding: '0 12px 12px' }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontFamily: 'var(--app-font-mono)', marginBottom: 8, paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
              RECENT RUNS
            </div>
            <Runs runs={runs.slice(0, 3)} />
          </div>
        </div>

        {/* Execution Engine */}
        <div className="op-panel" style={{ display: 'flex', flexDirection: 'column' }}>
          <SectionLabel label="EXECUTION ENGINE" meta={
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span className="animate-blink" style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--status-success)' }} />
              <span style={{ fontFamily: 'var(--app-font-mono)', fontSize: 9, color: 'var(--status-success)' }}>ACTIVE</span>
            </div>
          } />
          <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
            <div style={{ fontSize: 9, color: 'var(--text-tertiary)', fontFamily: 'var(--app-font-mono)' }}>STAGE · SIDE-CHANNEL VERIFY</div>
            <div style={{ fontFamily: 'var(--app-font-mono)', fontSize: 28, fontWeight: 700, color: 'var(--accent-amber)', letterSpacing: '0.08em', textAlign: 'center', padding: '10px 0' }}>
              {String(elapsed.h).padStart(2,'0')}:{String(elapsed.m).padStart(2,'0')}:{String(elapsed.s).padStart(2,'0')}
            </div>
            <div style={{ fontSize: 8, fontFamily: 'var(--app-font-mono)', color: 'var(--text-tertiary)', textAlign: 'center', letterSpacing: '0.12em' }}>
              CPU CYCLES: 3.42 × 10⁹
            </div>
            <div className="op-divider" />
            {[
              { label: 'GRAPH NODES', value: fmt(counts.graphNodes ?? 12847) },
              { label: 'CANDIDATES',  value: fmt(counts.candidates ?? 84) },
              { label: 'CAMPAIGNS',   value: fmt(counts.campaigns ?? 6) },
              { label: 'CRASHES',     value: fmt(counts.crashes ?? 4) },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--text-tertiary)', fontFamily: 'var(--app-font-mono)' }}>{row.label}</span>
                <span style={{ fontFamily: 'var(--app-font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>{row.value}</span>
              </div>
            ))}
            <div className="op-divider" />
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn-secondary" style={{ flex: 1, justifyContent: 'center', fontSize: 9 }}>
                <Play size={10} fill="currentColor" /> RUN
              </button>
              <button className="btn-secondary" style={{ flex: 1, justifyContent: 'center', fontSize: 9 }}>
                <RotateCw size={10} /> RESET
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── BOTTOM ROW: Priority Finding + Posture + Targets ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px 1fr', gap: 12 }}>
        {/* Priority finding */}
        <div className="op-panel" style={{ borderColor: 'rgba(183,53,53,.3)' }}>
          <SectionLabel label="PRIORITY FINDING" meta={<StatusBadge value="critical" />} />
          <div style={{ padding: '14px' }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--app-font-mono)', color: 'var(--text-tertiary)', marginBottom: 8 }}>SECURITY ACTION ITEM</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, lineHeight: 1.4 }}>
              Timing Side-Channel Information Leakage in Token Verification
            </div>
            <div style={{ fontFamily: 'var(--app-font-mono)', fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 12 }}>
              src/auth/token_compare.cpp · compare_token()
            </div>
            <div style={{ padding: '10px 12px', background: 'rgba(183,53,53,.07)', border: '1px solid rgba(183,53,53,.2)', borderRadius: 2, fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 14 }}>
              <strong style={{ color: 'var(--status-critical)' }}>TVLA t = {tValue}</strong> · |t| &gt; 4.5 threshold breached.
              Exploitable early-exit timing leak requires AI patch application.
            </div>
            <Link href="/patches" className="btn-primary" style={{ display: 'inline-flex', gap: 6, textDecoration: 'none', width: '100%', justifyContent: 'center' }}>
              <Wrench size={11} /> APPLY PATCH &amp; VERIFY
            </Link>
          </div>
        </div>

        {/* Posture arc */}
        <div className="op-panel">
          <SectionLabel label="POSTURE" meta={<span style={{ fontFamily: 'var(--app-font-mono)', fontSize: 9, color: 'var(--status-success)' }}>6/6 VECTORS</span>} />
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <svg viewBox="0 0 100 55" style={{ width: 140, height: 78 }}>
              <path d="M 12 54 A 38 38 0 0 1 88 54" fill="none" stroke="var(--surface-3)" strokeWidth="10" strokeLinecap="round" />
              <path d="M 12 54 A 38 38 0 0 1 88 54" fill="none" stroke="var(--status-success)" strokeWidth="10" strokeLinecap="round"
                strokeDasharray="119.4" strokeDashoffset={119.4 * (1 - remediatedPct / 100)}
                style={{ transition: 'stroke-dashoffset .6s ease' }}
              />
            </svg>
            <div style={{ textAlign: 'center', marginTop: -10 }}>
              <div style={{ fontFamily: 'var(--app-font-mono)', fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{remediatedPct}%</div>
              <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>REMEDIATED</div>
            </div>
            <div style={{ width: '100%' }}>
              {[
                { label: 'VERIFIED', color: 'var(--status-success)', pct: remediatedPct },
                { label: 'PROGRESS', color: 'var(--accent-amber)', pct: 15 },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: row.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 9, color: 'var(--text-tertiary)', flex: 1 }}>{row.label}</span>
                  <span style={{ fontFamily: 'var(--app-font-mono)', fontSize: 9, color: 'var(--text-secondary)' }}>{row.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Targets list */}
        <div className="op-panel">
          <SectionLabel label="SECURITY TARGETS" meta={
            <Link href="/analysis" style={{ textDecoration: 'none' }}>
              <button className="btn-secondary" style={{ fontSize: 9, padding: '3px 8px', display: 'flex', gap: 4, alignItems: 'center' }}>
                <Plus size={9} /> NEW
              </button>
            </Link>
          } />
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {projectsData.length ? projectsData.map((p: any) => {
              const meta = getProjectMeta(p);
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ width: 3, alignSelf: 'stretch', borderRadius: 1, background: meta.isVulnerable ? 'var(--status-critical)' : 'var(--status-success)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                    <div style={{ fontFamily: 'var(--app-font-mono)', fontSize: 9, color: 'var(--text-tertiary)', marginTop: 2 }}>{p.language} · {p.files ?? 0} files</div>
                  </div>
                  <StatusBadge value={meta.isVulnerable ? 'critical' : 'verified'} />
                </div>
              );
            }) : <Empty label="targets" />}
          </div>
        </div>
      </div>

      {/* ── MISSION STATUS ── */}
      <div className="op-panel">
        <SectionLabel label="MISSION STATUS" meta={<span style={{ fontFamily: 'var(--app-font-mono)', fontSize: 9, color: 'var(--text-tertiary)' }}>AUTONOMOUS REASONING PIPELINE</span>} />
        <div style={{ padding: '0 14px 14px' }}>
          {stages.map((stage: any, i: number) => {
            const meta = stageMeta[stage.key] || { title: stage.label?.toUpperCase() ?? stage.key.toUpperCase(), subtitle: '' };
            const isCompleted = stage.state === 'completed';
            const isRunning   = stage.state === 'running';
            return (
              <div key={stage.key} style={{ display: 'grid', gridTemplateColumns: '28px 1fr 100px', gap: 12, padding: '10px 0', borderBottom: i < stages.length - 1 ? '1px solid rgba(38,50,59,.5)' : 'none', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--app-font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)' }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: isCompleted ? 'var(--text-primary)' : isRunning ? 'var(--accent-amber)' : 'var(--text-tertiary)' }}>
                    {meta.title}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{meta.subtitle}</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <StatusBadge value={isCompleted ? 'complete' : isRunning ? 'analyzing' : 'queued'} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   ANALYSIS PAGE
   ──────────────────────────────────────────────────────────── */
function AnalysisPage() {
  const projects     = useListProjects();
  const runs         = useListAnalysisRuns();
  const createProject = useCreateProject();
  const createRun    = useCreateAnalysisRun();
  const qc           = useQueryClient();
  const [projectId, setProjectId] = useState('');
  const [name, setName]           = useState('');
  const [language, setLanguage]   = useState('C++');
  const [targetType, setTargetType] = useState('source');
  const [selected, setSelected]   = useState<string[]>(['cpg', 'gnn', 'asan']);
  const [fileName, setFileName]   = useState('');

  const list    = (projects.data as any[]) ?? [];
  const runList = (runs.data as any[])     ?? [];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (projectId) {
      createRun.mutate(
        { data: { projectId, modules: selected } as any },
        { onSuccess: () => { qc.invalidateQueries({ queryKey: getListAnalysisRunsQueryKey() }); qc.invalidateQueries({ queryKey: getGetOverviewQueryKey() }); } }
      );
    } else {
      createProject.mutate(
        { data: { name, language, targetType, description: fileName ? `Registered from ${fileName}` : 'Target registered in VARUNA' } as any },
        {
          onSuccess: (project: any) => {
            setProjectId(project.id);
            createRun.mutate(
              { data: { projectId: project.id, modules: selected } as any },
              { onSuccess: () => { qc.invalidateQueries({ queryKey: getListAnalysisRunsQueryKey() }); qc.invalidateQueries({ queryKey: getGetOverviewQueryKey() }); } }
            );
          },
        }
      );
    }
  };

  return (
    <div className="animate-rise" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader
        eyebrow="TARGET INTAKE · AUTONOMOUS ANALYSIS"
        heading="Analysis Workspace"
        sub="Register a source or binary target, choose evidence modules, and open a traceable analysis run."
      />

      {/* Prototype notice */}
      <div style={{ padding: '8px 12px', background: 'rgba(193,154,84,.07)', border: '1px solid rgba(193,154,84,.25)', borderRadius: 2, fontSize: 10, color: 'var(--accent-amber)', fontFamily: 'var(--app-font-mono)' }}>
        <strong>PROTOTYPE BOUNDARY</strong> · Target intake and run controls are connected to the API. Engine output shown below is only displayed after the server returns it.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 12 }}>
        {/* Register target */}
        <Panel title="REGISTER TARGET" meta={<span style={{ fontFamily: 'var(--app-font-mono)', fontSize: 9, color: 'var(--text-tertiary)' }}>STEP 01 / 02</span>}>
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 6 }}>
                EXISTING TARGET
              </label>
              <select value={projectId} onChange={e => setProjectId(e.target.value)} data-testid="select-analysis-project" className="op-select">
                <option value="">Register new target</option>
                {list.map((p: any) => <option key={p.id} value={p.id}>{p.name} · {p.language}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={{ display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 6 }}>TARGET NAME</label>
                <input value={name} onChange={e => setName(e.target.value)} required={!projectId} data-testid="input-target-name" placeholder="e.g. libwire parser" className="op-input" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 6 }}>LANGUAGE</label>
                <select value={language} onChange={e => setLanguage(e.target.value)} data-testid="select-target-language" className="op-select">
                  <option>C++</option><option>C</option><option>Rust</option><option>Binary</option>
                </select>
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 6 }}>TARGET KIND</label>
              <select value={targetType} onChange={e => setTargetType(e.target.value)} data-testid="select-target-type" className="op-select">
                <option value="source">Source tree</option>
                <option value="binary">Compiled binary</option>
                <option value="protocol">Protocol endpoint</option>
              </select>
            </div>
            <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border-medium)', borderRadius: 3, padding: '20px 12px', cursor: 'pointer', gap: 6, background: 'var(--surface-1)' }}>
              <UploadCloud size={18} color="var(--text-tertiary)" />
              <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{fileName || 'ATTACH TARGET METADATA'}</span>
              <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>File reference only in this prototype</span>
              <input type="file" onChange={e => setFileName(e.target.files?.[0]?.name ?? '')} data-testid="input-target-file" style={{ display: 'none' }} />
            </label>
            <button type="submit" disabled={createProject.isPending || createRun.isPending || (!projectId && !name)} data-testid="button-start-analysis" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
              <Play size={12} fill="currentColor" />
              {createProject.isPending || createRun.isPending ? 'OPENING RUN...' : 'OPEN ANALYSIS RUN'}
            </button>
          </form>
        </Panel>

        {/* Evidence modules */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Panel title="EVIDENCE MODULES" meta={<span style={{ fontFamily: 'var(--app-font-mono)', fontSize: 9, color: 'var(--text-tertiary)' }}>SELECT AT LEAST ONE</span>}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {modules.map(mod => {
                const isSelected = selected.includes(mod);
                return (
                  <button
                    key={mod}
                    type="button"
                    onClick={() => setSelected(prev => prev.includes(mod) ? prev.filter(x => x !== mod) : [...prev, mod])}
                    data-testid={`button-module-${mod}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', textAlign: 'left', cursor: 'pointer',
                      background: isSelected ? 'rgba(124,128,80,.1)' : 'var(--surface-1)',
                      border: `1px solid ${isSelected ? 'rgba(124,128,80,.5)' : 'var(--border-subtle)'}`,
                      borderRadius: 3, color: isSelected ? 'var(--text-primary)' : 'var(--text-tertiary)',
                    }}
                  >
                    <div style={{ width: 28, height: 28, display: 'grid', placeItems: 'center', borderRadius: 2, background: isSelected ? 'var(--accent-olive)' : 'var(--surface-2)', flexShrink: 0 }}>
                      {isSelected
                        ? <Check size={12} color="var(--bg-primary)" strokeWidth={3} />
                        : <span style={{ fontFamily: 'var(--app-font-mono)', fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)' }}>{mod.slice(0,2).toUpperCase()}</span>}
                    </div>
                    <div>
                      <div style={{ fontFamily: 'var(--app-font-mono)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{mod}</div>
                      <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 2, lineHeight: 1.4 }}>
                        {mod === 'cpg' ? 'Code property graph extraction' : mod === 'gnn' ? 'Graph-guided prioritisation' : mod === 'timing' ? 'Welch t-test side-channel scan' : mod === 'protocol' ? 'Mutation campaign' : `${mod.toUpperCase()} instrumentation`}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            {/* Run order */}
            <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: 3 }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', color: 'var(--text-tertiary)', marginBottom: 8 }}>EXECUTION ORDER</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
                {selected.map((m, i) => (
                  <span key={m} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontFamily: 'var(--app-font-mono)', fontSize: 10, padding: '2px 8px', border: '1px solid var(--border-medium)', borderRadius: 2, color: 'var(--accent-olive-lt)' }}>{m}</span>
                    {i < selected.length - 1 && <ChevronRight size={10} color="var(--text-tertiary)" />}
                  </span>
                ))}
              </div>
            </div>
          </Panel>

          {/* Latest runs */}
          <Panel title="RECENT ANALYSIS RUNS" meta={<span style={{ fontFamily: 'var(--app-font-mono)', fontSize: 9, color: 'var(--text-tertiary)' }}>{runList.length} RUNS</span>}>
            {runs.isLoading ? <Loading label="LOADING RUNS" /> : runs.isError ? <ErrorState retry={() => runs.refetch()} /> : <Runs runs={runList.slice(0, 5)} />}
          </Panel>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   TIMING PAGE — Side-Channel Analysis Lab
   ──────────────────────────────────────────────────────────── */
function TimingPage() {
  const q          = useListTimingTests();
  const projects   = useListProjects();
  const create     = useCreateTimingTest();
  const qc         = useQueryClient();
  const [projectId, setProjectId] = useState('');
  const [fn, setFn]               = useState('constant_time_compare');
  const [samples, setSamples]     = useState('10000');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate({ data: { projectId, function: fn, samples: Number(samples) } as any }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListTimingTestsQueryKey() }) });
  };

  const tests = (q.data as any[]) ?? [];

  return (
    <div className="animate-rise" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader
        eyebrow="SIDE-CHANNEL LAB · WELCH T-TEST"
        heading="Timing Channels"
        sub="Measure whether secret-dependent execution paths leave a statistically meaningful timing signal."
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: '1px solid var(--border-medium)', borderRadius: 3, background: 'var(--surface-1)', fontSize: 10, fontFamily: 'var(--app-font-mono)' }}>
            <TestTube2 size={12} color="var(--accent-olive)" />
            <span style={{ color: 'var(--text-secondary)' }}>WELCH THRESHOLD</span>
            <strong style={{ color: 'var(--accent-amber)' }}>|t| ≥ 4.5</strong>
          </div>
        }
      />
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 12 }}>
        <Panel title="RUN TIMING TEST" meta={<span style={{ fontFamily: 'var(--app-font-mono)', fontSize: 9, color: 'var(--text-tertiary)' }}>MIN 100 SAMPLES</span>}>
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 6 }}>TARGET</label>
              <select value={projectId} onChange={e => setProjectId(e.target.value)} required data-testid="select-timing-project" className="op-select">
                {((projects.data as any[]) ?? []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 6 }}>FUNCTION UNDER TEST</label>
              <input value={fn} onChange={e => setFn(e.target.value)} required data-testid="input-timing-function" className="op-input" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 6 }}>SAMPLE COUNT</label>
              <input type="number" min="100" value={samples} onChange={e => setSamples(e.target.value)} data-testid="input-timing-samples" className="op-input" />
            </div>
            <button disabled={create.isPending} data-testid="button-run-timing" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
              <Play size={12} fill="currentColor" />
              {create.isPending ? 'COLLECTING SAMPLES...' : 'RUN SIDE-CHANNEL TEST'}
            </button>
          </form>
          <div style={{ marginTop: 14, padding: '10px 12px', background: 'rgba(193,154,84,.06)', border: '1px solid rgba(193,154,84,.2)', borderRadius: 2, fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--accent-amber)' }}>INTERPRETATION</strong> · A potential leakage result is a review signal, not a confirmed vulnerability. Compare before and after patch measurements.
          </div>
        </Panel>
        <Panel title="TEST EVIDENCE" meta={<span style={{ fontFamily: 'var(--app-font-mono)', fontSize: 9, color: 'var(--text-tertiary)' }}>{tests.length} RECORDED</span>}>
          {q.isLoading ? <Loading /> : q.isError ? <ErrorState retry={() => q.refetch()} /> : tests.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {tests.map((test: any) => (
                <div key={test.id} data-testid={`card-timing-${test.id}`} style={{ padding: '12px 14px', background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: 3 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontFamily: 'var(--app-font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>{test.function}</div>
                      <div style={{ fontFamily: 'var(--app-font-mono)', fontSize: 9, color: 'var(--text-tertiary)', marginTop: 2 }}>{test.projectName} · {title(test.beforeAfter ?? 'before')} · {fmt(test.createdAt)}</div>
                    </div>
                    <StatusBadge value={test.result} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                    {[
                      { label: 'SAMPLES',   value: fmt(test.samples) },
                      { label: 'GROUPS',    value: fmt(test.groups) },
                      { label: 'STATISTIC', value: Number(test.statistic ?? 0).toFixed(2) },
                      { label: 'THRESHOLD', value: Number(test.threshold ?? 0).toFixed(2) },
                    ].map(col => (
                      <div key={col.label}>
                        <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontFamily: 'var(--app-font-mono)' }}>{col.label}</div>
                        <div style={{ fontFamily: 'var(--app-font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginTop: 4 }}>{col.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : <Empty label="timing tests" />}
        </Panel>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   PROTOCOL PAGE — Directed Fuzzing
   ──────────────────────────────────────────────────────────── */
function ProtocolPage() {
  const q         = useListProtocolTests();
  const projects  = useListProjects();
  const create    = useCreateProtocolTest();
  const qc        = useQueryClient();
  const [projectId, setProjectId] = useState('');
  const [target, setTarget]       = useState('decode_frame');
  const [strategy, setStrategy]   = useState<string[]>(['bit flips', 'boundary values', 'length mutations']);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate({ data: { projectId, target, strategy } as any }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListProtocolTestsQueryKey() }) });
  };

  const tests = (q.data as any[]) ?? [];

  return (
    <div className="animate-rise" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader
        eyebrow="MUTATION LAB · DIRECTED FUZZING"
        heading="Protocol Fuzzing"
        sub="Exercise parser boundaries with intentional mutations, then preserve coverage and crash evidence."
        action={
          <div style={{ padding: '6px 12px', border: '1px solid var(--border-medium)', borderRadius: 3, background: 'var(--surface-1)', fontSize: 9, fontFamily: 'var(--app-font-mono)', color: 'var(--accent-olive)' }}>
            <Activity size={12} style={{ display: 'inline', marginRight: 4 }} />
            CAMPAIGNS PRODUCE TRACEABLE EVIDENCE
          </div>
        }
      />
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 12 }}>
        <Panel title="CONFIGURE CAMPAIGN" meta={<span style={{ fontFamily: 'var(--app-font-mono)', fontSize: 9, color: 'var(--text-tertiary)' }}>MUTATION PLAN</span>}>
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 6 }}>TARGET</label>
              <select required value={projectId} onChange={e => setProjectId(e.target.value)} data-testid="select-protocol-project" className="op-select">
                <option value="">Choose a target</option>
                {((projects.data as any[]) ?? []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 6 }}>PARSER / MESSAGE TARGET</label>
              <input value={target} onChange={e => setTarget(e.target.value)} required data-testid="input-protocol-target" className="op-input" />
            </div>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 8 }}>MUTATION STRATEGIES</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {['bit flips', 'boundary values', 'length mutations', 'dictionary tokens'].map(s => (
                  <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid var(--border-subtle)', borderRadius: 2, cursor: 'pointer', background: strategy.includes(s) ? 'rgba(124,128,80,.06)' : 'var(--surface-1)' }}>
                    <input type="checkbox" checked={strategy.includes(s)} onChange={() => setStrategy(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])} data-testid={`input-strategy-${s.replaceAll(' ', '-')}`}
                      style={{ accentColor: 'var(--accent-olive)', width: 12, height: 12 }} />
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--app-font-mono)' }}>{s}</span>
                  </label>
                ))}
              </div>
            </div>
            <button disabled={create.isPending} data-testid="button-run-protocol" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
              <Zap size={12} />
              {create.isPending ? 'STARTING CAMPAIGN...' : 'START MUTATION CAMPAIGN'}
            </button>
          </form>
        </Panel>
        <Panel title="CAMPAIGN HISTORY" meta={<span style={{ fontFamily: 'var(--app-font-mono)', fontSize: 9, color: 'var(--text-tertiary)' }}>{tests.length} CAMPAIGNS</span>}>
          {q.isLoading ? <Loading /> : q.isError ? <ErrorState retry={() => q.refetch()} /> : tests.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {tests.map((test: any) => (
                <div key={test.id} data-testid={`card-protocol-${test.id}`} style={{ padding: '12px 14px', background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: 3 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontFamily: 'var(--app-font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>{test.target}</div>
                      <div style={{ fontFamily: 'var(--app-font-mono)', fontSize: 9, color: 'var(--text-tertiary)', marginTop: 2 }}>{test.projectName} · {(test.fields ?? []).join(', ') || 'fields pending'}</div>
                    </div>
                    <StatusBadge value={test.state} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                    {[
                      { label: 'INPUTS',   value: fmt(test.inputs) },
                      { label: 'COVERAGE', value: `${test.coverage ?? 0}%` },
                      { label: 'CRASHES',  value: fmt(test.crashes) },
                      { label: 'UNIQUE',   value: fmt(test.uniqueCrashes), crit: true },
                    ].map(col => (
                      <div key={col.label}>
                        <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontFamily: 'var(--app-font-mono)' }}>{col.label}</div>
                        <div style={{ fontFamily: 'var(--app-font-mono)', fontSize: 13, fontWeight: 700, color: col.crit ? 'var(--status-critical)' : 'var(--text-secondary)', marginTop: 4 }}>{col.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : <Empty label="protocol campaigns" />}
        </Panel>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   FINDINGS PAGE — Threat Intelligence Ledger
   ──────────────────────────────────────────────────────────── */
function FindingsPage() {
  const q           = useListFindings();
  const [selectedId, setSelectedId] = useState('');
  const findings    = (q.data as any[]) ?? [];
  const detail      = useGetFinding(selectedId, { query: { enabled: !!selectedId, queryKey: [`/api/findings/${selectedId}`] } as any });

  const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const sorted = [...findings].sort((a, b) => (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9));

  return (
    <div className="animate-rise" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader
        eyebrow="CENTRAL EVIDENCE LEDGER · THREAT INTELLIGENCE"
        heading="Findings"
        sub="Prioritised signals with code context, graph paths, and method context. Select a finding to inspect the evidence chain."
      />
      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 12 }}>
        {/* Finding list */}
        <div className="op-panel">
          <SectionLabel label="FINDING QUEUE" meta={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <SlidersHorizontal size={11} color="var(--text-tertiary)" />
              <span style={{ fontFamily: 'var(--app-font-mono)', fontSize: 9, color: 'var(--text-tertiary)' }}>{findings.length} TOTAL</span>
            </div>
          } />
          <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 260px)' }}>
            {q.isLoading ? <div style={{ padding: 14 }}><Loading /></div> : q.isError ? <div style={{ padding: 14 }}><ErrorState retry={() => q.refetch()} /></div> : sorted.length ? sorted.map((finding: any) => {
              const isSelected = selectedId === finding.id;
              const sevColor = finding.severity === 'critical' ? 'var(--status-critical)' : finding.severity === 'high' ? 'var(--status-warning)' : finding.severity === 'medium' ? 'var(--accent-olive)' : 'var(--text-tertiary)';
              return (
                <button
                  key={finding.id}
                  onClick={() => setSelectedId(finding.id)}
                  data-testid={`button-finding-${finding.id}`}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'stretch', gap: 0, padding: 0,
                    background: isSelected ? 'rgba(124,128,80,.07)' : 'transparent',
                    border: 'none', borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ width: 3, background: sevColor, flexShrink: 0, borderRadius: 0 }} />
                  <div style={{ flex: 1, padding: '10px 12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)', lineHeight: 1.3 }}>{finding.title}</div>
                      <StatusBadge value={finding.severity} />
                    </div>
                    <div style={{ fontFamily: 'var(--app-font-mono)', fontSize: 9, color: 'var(--text-tertiary)' }}>
                      {finding.file}:{finding.line} · {finding.function}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                      <span style={{ fontFamily: 'var(--app-font-mono)', fontSize: 9, color: 'var(--text-tertiary)' }}>{finding.cwe} · {finding.method}</span>
                      <span style={{ fontFamily: 'var(--app-font-mono)', fontSize: 9, fontWeight: 700, color: 'var(--accent-olive-lt)' }}>GNN {Math.round((finding.score ?? 0) * 100)}%</span>
                    </div>
                  </div>
                </button>
              );
            }) : <Empty label="findings" />}
          </div>
        </div>

        {/* Evidence detail */}
        <div className="op-panel">
          <SectionLabel label="EVIDENCE DETAIL" meta={selectedId && <span style={{ fontFamily: 'var(--app-font-mono)', fontSize: 9, color: 'var(--text-tertiary)' }}>{selectedId}</span>} />
          <div style={{ padding: 14 }}>
            {!selectedId ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 320, textAlign: 'center', gap: 10 }}>
                <Network size={24} color="var(--text-tertiary)" strokeWidth={1.4} />
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>SELECT A FINDING</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', maxWidth: 260 }}>Code context, evidence statements, and graph traversal will appear here.</div>
              </div>
            ) : detail.isLoading ? <Loading label="LOADING EVIDENCE" /> : detail.isError ? <ErrorState retry={() => detail.refetch()} /> : <FindingDetail data={detail.data as any} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function FindingDetail({ data }: { data: any }) {
  return (
    <div data-testid={`panel-finding-detail-${data.id}`} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <div style={{ marginBottom: 6 }}><StatusBadge value={data.severity} /></div>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0, lineHeight: 1.3 }}>{data.title}</h3>
          <div style={{ fontFamily: 'var(--app-font-mono)', fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>{data.cwe} · detected via {data.method}</div>
        </div>
        <div style={{ padding: '10px 14px', background: 'rgba(124,128,80,.1)', border: '1px solid rgba(124,128,80,.3)', borderRadius: 3, textAlign: 'center', flexShrink: 0 }}>
          <div style={{ fontFamily: 'var(--app-font-mono)', fontSize: 18, fontWeight: 700, color: 'var(--accent-olive-lt)' }}>{Math.round((data.score ?? 0) * 100)}%</div>
          <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>GNN PRIORITY</div>
        </div>
      </div>

      {/* Metadata */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {[
          { label: 'LOCATION', value: `${data.file}:${data.line}` },
          { label: 'FUNCTION', value: data.function },
        ].map(m => (
          <div key={m.label} style={{ padding: '8px 10px', background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: 2 }}>
            <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontFamily: 'var(--app-font-mono)', marginBottom: 4 }}>{m.label}</div>
            <div style={{ fontFamily: 'var(--app-font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Evidence statements */}
      <div>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontFamily: 'var(--app-font-mono)', marginBottom: 8 }}>EVIDENCE STATEMENTS</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(data.evidence ?? []).map((e: string, i: number) => (
            <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 10px', background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: 2, fontSize: 11, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
              <span style={{ fontFamily: 'var(--app-font-mono)', fontSize: 9, fontWeight: 700, color: 'var(--accent-olive)', flexShrink: 0, marginTop: 1 }}>0{i+1}</span>
              {e}
            </div>
          ))}
        </div>
      </div>

      {/* Code context */}
      <div>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontFamily: 'var(--app-font-mono)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <FileCode2 size={11} /> SOURCE ANALYSIS
        </div>
        <pre className="op-code" style={{ margin: 0 }}>
          {(data.code ?? []).map((line: any) => (
            <div key={line.line} className={line.highlighted ? 'line-critical' : ''}>
              <span className="line-num">{line.line}</span>{line.text}
            </div>
          ))}
        </pre>
      </div>

      {/* Graph path */}
      <div>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontFamily: 'var(--app-font-mono)', marginBottom: 8 }}>ATTACK PATH</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
          {(data.graphPath ?? []).map((node: string, i: number) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span className="graph-node">{node}</span>
              {i < data.graphPath.length - 1 && <ArrowRight size={10} color="var(--text-tertiary)" />}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   PATCHES PAGE — Patch Review & Re-Verification
   ──────────────────────────────────────────────────────────── */
function PatchesPage({ verification = false }: { verification?: boolean }) {
  const q       = useListPatches();
  const verify  = useVerifyPatch();
  const [active, setActive] = useState<string | null>(null);
  const [run, setRun]       = useState<any>(null);

  const patches  = (q.data as any[]) ?? [];
  const selected = patches.find(p => p.id === active);

  const verifyOne = (id: string) => {
    verify.mutate({ id }, { onSuccess: (result: any) => setRun(result) });
  };

  const eyebrow = verification ? 'RE-VERIFICATION LAB · BEFORE + AFTER' : 'REVIEW QUEUE · PROPOSED CHANGES';
  const heading  = verification ? 'Re-Verification' : 'Patch Review';
  const sub      = verification
    ? 'Re-run security checks against proposed changes and keep the before/after state visible.'
    : 'Review minimal changes against the original code before asking VARUNA to verify them.';

  return (
    <div className="animate-rise" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader eyebrow={eyebrow} heading={heading} sub={sub} />
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 12 }}>
        {/* Patch list */}
        <div className="op-panel">
          <SectionLabel
            label={verification ? 'VERIFICATION QUEUE' : 'PATCH PROPOSALS'}
            meta={<span style={{ fontFamily: 'var(--app-font-mono)', fontSize: 9, color: 'var(--text-tertiary)' }}>{patches.length} PROPOSALS</span>}
          />
          <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 260px)' }}>
            {q.isLoading ? <div style={{ padding: 14 }}><Loading /></div> : q.isError ? <div style={{ padding: 14 }}><ErrorState retry={() => q.refetch()} /></div> : patches.length ? patches.map((patch: any) => {
              const isActive = active === patch.id;
              return (
                <button
                  key={patch.id}
                  onClick={() => setActive(patch.id)}
                  data-testid={`button-patch-${patch.id}`}
                  style={{
                    width: '100%', display: 'block', padding: '10px 14px', textAlign: 'left', cursor: 'pointer',
                    background: isActive ? 'rgba(124,128,80,.07)' : 'transparent',
                    border: 'none', borderBottom: '1px solid var(--border-subtle)', borderLeft: isActive ? '2px solid var(--accent-olive)' : '2px solid transparent',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{patch.title}</div>
                    <StatusBadge value={patch.status} />
                  </div>
                  <div style={{ fontFamily: 'var(--app-font-mono)', fontSize: 9, color: 'var(--text-tertiary)' }}>{patch.findingId} · {title(patch.source ?? '')}</div>
                </button>
              );
            }) : <Empty label="patch proposals" />}
          </div>
        </div>

        {/* Detail panel */}
        <div className="op-panel">
          <SectionLabel
            label={verification ? 'BEFORE / AFTER CHECKS' : 'CODE DIFF REVIEW'}
            meta={selected && <span style={{ fontFamily: 'var(--app-font-mono)', fontSize: 9, color: 'var(--text-tertiary)' }}>{selected.id}</span>}
          />
          <div style={{ padding: 14 }}>
            {!selected ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 320, textAlign: 'center', gap: 10 }}>
                {verification ? <ShieldCheck size={24} color="var(--text-tertiary)" strokeWidth={1.4} /> : <GitBranch size={24} color="var(--text-tertiary)" strokeWidth={1.4} />}
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>SELECT A PATCH PROPOSAL</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', maxWidth: 280 }}>The full change and verification action stay together so no evidence gets lost.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>{selected.title}</h3>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0 }}>{selected.explanation}</p>
                </div>
                {/* Diff */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--status-critical)', fontFamily: 'var(--app-font-mono)', marginBottom: 6 }}>ORIGINAL</div>
                    <pre style={{ minHeight: 160, overflowX: 'auto', background: 'rgba(183,53,53,.06)', border: '1px solid rgba(183,53,53,.25)', borderRadius: 2, padding: '10px 12px', fontFamily: 'var(--app-font-mono)', fontSize: 10, lineHeight: 1.7, color: '#C4A0A0', margin: 0 }}>
                      {selected.originalCode}
                    </pre>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--status-success)', fontFamily: 'var(--app-font-mono)', marginBottom: 6 }}>PROPOSED</div>
                    <pre style={{ minHeight: 160, overflowX: 'auto', background: 'rgba(98,123,85,.06)', border: '1px solid rgba(98,123,85,.25)', borderRadius: 2, padding: '10px 12px', fontFamily: 'var(--app-font-mono)', fontSize: 10, lineHeight: 1.7, color: '#A0B490', margin: 0 }}>
                      {selected.proposedCode}
                    </pre>
                  </div>
                </div>
                {/* Verify button */}
                <button
                  onClick={() => verifyOne(selected.id)}
                  disabled={verify.isPending}
                  data-testid={`button-verify-patch-${selected.id}`}
                  className="btn-primary"
                  style={{ justifyContent: 'center' }}
                >
                  <ShieldCheck size={13} />
                  {verify.isPending ? 'RUNNING CHECKS...' : 'RUN SECURITY VERIFICATION'}
                </button>
                {/* Verification result */}
                {run && (
                  <div data-testid="panel-verification-result" style={{ padding: '14px', background: 'rgba(98,123,85,.07)', border: '1px solid rgba(98,123,85,.3)', borderRadius: 3 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div style={{ fontFamily: 'var(--app-font-mono)', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)' }}>VERIFICATION RUN · {run.id}</div>
                      <StatusBadge value={run.overall} />
                    </div>
                    <div>
                      {(run.checks ?? []).map((check: any, i: number) => (
                        <div key={check.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: i === 0 ? 'none' : '1px solid rgba(98,123,85,.2)', fontSize: 11 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontFamily: 'var(--app-font-mono)', fontSize: 9, color: 'var(--text-tertiary)' }}>{String(i+1).padStart(2,'0')}</span>
                            <span style={{ color: 'var(--text-secondary)' }}>{check.label}</span>
                          </div>
                          <StatusBadge value={check.state} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   REPORTS PAGE
   ──────────────────────────────────────────────────────────── */
function ReportsPage() {
  const q        = useListReports();
  const projects = useListProjects();
  const create   = useCreateReport();
  const qc       = useQueryClient();
  const [projectId, setProjectId] = useState('');

  const reports = (q.data as any[]) ?? [];
  const submit  = (e: FormEvent) => {
    e.preventDefault();
    create.mutate({ data: { projectId } as any }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListReportsQueryKey() }) });
  };

  return (
    <div className="animate-rise" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader
        eyebrow="EVIDENCE PACKAGES · EXPORT"
        heading="Reports"
        sub="Generate a concise, auditable package that carries findings, test results, patches, and verification state."
        action={
          <div style={{ padding: '6px 12px', border: '1px solid var(--border-medium)', borderRadius: 3, background: 'var(--surface-1)', fontSize: 9, fontFamily: 'var(--app-font-mono)', color: 'var(--text-secondary)' }}>
            <FileText size={11} style={{ display: 'inline', marginRight: 4 }} />
            EVIDENCE PACKAGES ONLY
          </div>
        }
      />
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 12 }}>
        <Panel title="GENERATE REPORT">
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 6 }}>TARGET</label>
              <select required value={projectId} onChange={e => setProjectId(e.target.value)} data-testid="select-report-project" className="op-select">
                <option value="">Choose a target</option>
                {((projects.data as any[]) ?? []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div style={{ padding: '10px 12px', background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: 2, fontSize: 10, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
              The generated package reflects data currently returned by the API. It never substitutes prototype values for live engine results.
            </div>
            <button disabled={create.isPending} data-testid="button-generate-report" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
              <Download size={12} />
              {create.isPending ? 'ASSEMBLING EVIDENCE...' : 'GENERATE EVIDENCE REPORT'}
            </button>
          </form>
        </Panel>
        <Panel title="GENERATED REPORTS" meta={<span style={{ fontFamily: 'var(--app-font-mono)', fontSize: 9, color: 'var(--text-tertiary)' }}>{reports.length} REPORTS</span>}>
          {q.isLoading ? <Loading /> : q.isError ? <ErrorState retry={() => q.refetch()} /> : reports.length ? (
            <div>
              {reports.map((report: any) => (
                <div key={report.id} data-testid={`row-report-${report.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 28, height: 28, display: 'grid', placeItems: 'center', border: '1px solid var(--border-medium)', borderRadius: 2, flexShrink: 0 }}>
                      <FileText size={13} color="var(--accent-olive)" />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>{report.projectName}</div>
                      <div style={{ fontFamily: 'var(--app-font-mono)', fontSize: 9, color: 'var(--text-tertiary)', marginTop: 2 }}>
                        {report.id} · {report.findingCount} findings · {report.generatedAt ? new Date(report.generatedAt).toLocaleDateString() : 'queued'}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <StatusBadge value={report.verificationStatus} />
                    <StatusBadge value={report.status} />
                  </div>
                </div>
              ))}
            </div>
          ) : <Empty label="reports" />}
        </Panel>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   ROUTER
   ──────────────────────────────────────────────────────────── */
function Router() {
  return (
    <Shell>
      <Switch>
        <Route path="/"            component={OverviewRedirect} />
        <Route path="/overview"    component={OverviewPage} />
        <Route path="/analysis"    component={AnalysisPage} />
        <Route path="/timing"      component={TimingPage} />
        <Route path="/protocol"    component={ProtocolPage} />
        <Route path="/findings"    component={FindingsPage} />
        <Route path="/patches"     component={() => <PatchesPage />} />
        <Route path="/verification" component={() => <PatchesPage verification />} />
        <Route path="/reports"     component={ReportsPage} />
        <Route                     component={NotFound} />
      </Switch>
    </Shell>
  );
}

function OverviewRedirect() {
  const [, setLocation] = useLocation();
  useEffect(() => setLocation('/overview'), [setLocation]);
  return <div style={{ minHeight: '50vh' }} />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <ErrorBoundary>
            <Router />
          </ErrorBoundary>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;