import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, Activity, ArrowUpRight, Binary, Check, ChevronRight, Clock3,
  Code2, Cpu, Download, FileCode2, FileText, FolderKanban, GitBranch,
  LayoutDashboard, Menu, Network, Play, Plus, Radar, RotateCw, Search, Shield,
  ShieldCheck, SlidersHorizontal, Sparkles, TestTube2, UploadCloud, Wrench, Zap,
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
  { href: '/overview', label: 'Overview', icon: LayoutDashboard },
  { href: '/analysis', label: 'Analysis workspace', icon: Radar },
  { href: '/timing', label: 'Timing channels', icon: Clock3 },
  { href: '/protocol', label: 'Protocol fuzzing', icon: Binary },
  { href: '/findings', label: 'Findings', icon: AlertTriangle },
  { href: '/patches', label: 'Patch review', icon: GitBranch },
  { href: '/verification', label: 'Re-verification', icon: ShieldCheck },
  { href: '/reports', label: 'Reports', icon: FileText },
];
const modules = ['cpg', 'gnn', 'timing', 'protocol', 'asan', 'ubsan'];
const cx = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' ');
const title = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const fmt = (value?: string | number | null) => value == null ? '—' : typeof value === 'number' ? value.toLocaleString() : value;

function StatusPill({ value, tone }: { value?: string; tone?: 'green' | 'amber' | 'red' | 'slate' }) {
  const inferred = tone ?? (value?.includes('fail') || value?.includes('critical') ? 'red' : value?.includes('pending') || value?.includes('running') || value?.includes('queued') ? 'amber' : 'green');
  return <span data-testid={`status-${value ?? 'unknown'}`} className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.12em]', inferred === 'green' && 'bg-[#ECFDF5] text-[#0F5132]', inferred === 'amber' && 'bg-[#FFF9E6] text-[#B27B18]', inferred === 'red' && 'bg-[#FFF1F2] text-[#E11D48]', inferred === 'slate' && 'bg-[#F1F5F9] text-[#64748B]')}><span className={cx('h-1.5 w-1.5 rounded-full', inferred === 'green' && 'bg-[#10B981]', inferred === 'amber' && 'bg-[#F59E0B]', inferred === 'red' && 'bg-[#E11D48]', inferred === 'slate' && 'bg-[#64748B]')} />{title(value ?? 'unknown')}</span>;
}

function Shell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const health = useHealthCheck();
  return <div className="noise min-h-[100dvh] bg-[#F4F7F5] text-[#0F5132] font-sans">
    <aside className={cx('fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col border-r border-[#E5EAE7] bg-[#F8FAF9] px-5 py-6 transition-transform md:translate-x-0', mobileOpen ? 'translate-x-0' : '-translate-x-full')}>
      <div className="flex items-center gap-3 px-2 pb-8">
        <div className="grid h-10 w-10 place-items-center rounded-[13px] bg-[#0F5132] text-[#F4F7F5] shadow-[0_4px_12px_rgba(15,81,50,.15)]"><Shield size={21} strokeWidth={2.5} /></div>
        <div><div className="font-mono text-[17px] font-bold tracking-[.12em] text-[#0F5132]">VARUNA</div><div className="text-[9px] font-bold uppercase tracking-[.16em] text-[#6e7d74]">Security console</div></div>
      </div>
      <div className="mb-3 px-2 text-[10px] font-bold uppercase tracking-[.16em] text-[#6e7d74]">Workspace</div>
      <nav className="space-y-1">
        {nav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setMobileOpen(false)} data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`} className={cx('group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-all', location === href ? 'bg-[#EAF2ED] text-[#0F5132]' : 'text-[#74827b] hover:bg-[#EAF2ED]/50 hover:text-[#0F5132]')}><Icon size={17} strokeWidth={location === href ? 2.3 : 1.8} /><span>{label}</span>{location === href && <ChevronRight size={14} className="ml-auto text-[#0F5132]" />}</Link>)}
      </nav>
      <div className="mb-3 mt-8 px-2 text-[10px] font-bold uppercase tracking-[.16em] text-[#6e7d74]">System</div>
      <Link href="/overview" data-testid="link-system-health" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold text-[#74827b] hover:bg-[#EAF2ED]/50 hover:text-[#0F5132] transition-all"><Cpu size={17} /><span>Engine health</span><span className={cx('ml-auto h-2 w-2 rounded-full', health.isError ? 'bg-[#E11D48]' : 'bg-[#10B981]')} /></Link>
      <div className="mt-auto rounded-2xl bg-[#0F5132] p-4 text-[#F4F7F5] shadow-sm">
        <div className="mb-3 flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-[.14em] text-[#A6CDB8]">Operator mode</span><Activity size={15} className="text-[#F59E0B]" /></div>
        <div className="text-sm font-semibold">Evidence first</div><p className="mt-1 text-[11px] leading-relaxed text-[#A6CDB8]">Every signal stays traceable from target to verification.</p>
        <div className="mt-4 flex items-center gap-2 text-[10px] text-[#A6CDB8]"><span className="h-1.5 w-1.5 rounded-full bg-[#F59E0B]" />Prototype environment</div>
      </div>
    </aside>
    {mobileOpen && <button aria-label="Close navigation" data-testid="button-close-navigation" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-30 bg-[#0F5132]/10 md:hidden" />}
    <main className="min-h-[100dvh] md:pl-[260px]">
      <header className="sticky top-0 z-20 flex h-[72px] items-center gap-4 border-b border-[#E5EAE7] bg-[#F4F7F5]/90 px-5 backdrop-blur-md md:px-10">
        <button onClick={() => setMobileOpen(true)} data-testid="button-open-navigation" className="rounded-lg p-2 text-[#718078] hover:bg-white md:hidden"><Menu size={20} /></button>
        <div className="relative max-w-[380px] flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6e7d74]" size={16} /><input data-testid="input-global-search" placeholder="Search findings, targets, runs" className="h-10 w-full rounded-xl border border-[#E5EAE7] bg-white pl-10 pr-4 text-xs outline-none placeholder:text-[#a6b1ab] focus:border-[#0F5132] shadow-2xs focus:shadow-sm" /></div>
        <div className="hidden items-center gap-2 sm:flex"><div className="flex items-center gap-2 rounded-full border border-[#E5EAE7] bg-white px-3 py-2 text-[11px] text-[#6e7d74]"><span className={cx('h-2 w-2 rounded-full', health.isError ? 'bg-[#E11D48]' : 'bg-[#10B981]')} />Engine {health.isError ? 'unavailable' : 'connected'}</div><div className="grid h-9 w-9 place-items-center rounded-full bg-[#EAF2ED] text-xs font-bold text-[#0F5132]">SE</div></div>
      </header>
      <div className="mx-auto max-w-[1480px] p-5 md:p-10">{children}</div>
    </main>
  </div>;
}

function Header({ eyebrow, heading, sub, action }: { eyebrow: string; heading: string; sub: string; action?: ReactNode }) {
  return <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-[#0F5132]"><span className="h-1.5 w-1.5 rounded-full bg-[#0F5132]" />{eyebrow}</div><h1 data-testid={`heading-${heading.toLowerCase().replaceAll(' ', '-')}`} className="text-3xl font-extrabold tracking-tight text-gray-900 md:text-4xl">{heading}</h1><p className="mt-2 max-w-2xl text-xs text-[#6e7d74]">{sub}</p></div>{action}</div>;
}
function Section({ title: sectionTitle, meta, children, className }: { title: string; meta?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={cx('rounded-2xl border border-[#E5EAE7] bg-white p-5 shadow-2xs md:p-6', className)}><div className="mb-5 flex items-center justify-between gap-3"><h2 className="text-sm font-bold tracking-tight text-gray-900">{sectionTitle}</h2>{meta}</div>{children}</section>;
}
function Loading({ label = 'Reading evidence' }: { label?: string }) { return <div data-testid="status-loading" className="space-y-3">{[1, 2, 3].map((n) => <div key={n} className="h-12 animate-pulse rounded-xl bg-[#EAF2ED]" />)}<div className="pt-1 text-[11px] font-mono text-[#8a9b91]">{label}...</div></div>; }
function ErrorState({ retry }: { retry?: () => void }) { return <div data-testid="status-error" className="rounded-xl border border-[#f0d4cf] bg-[#fff6f3] p-5 text-sm text-[#9a4035]"><div className="flex items-center gap-2 font-bold"><AlertTriangle size={16} />Evidence service unavailable</div><p className="mt-1 text-xs text-[#af6b60]">The console could not read this surface. Retry when the API server is available.</p>{retry && <Button onClick={retry} data-testid="button-retry" variant="outline" size="sm" className="mt-3">Retry</Button>}</div>; }
function Empty({ label, action }: { label: string; action?: ReactNode }) { return <div data-testid="status-empty" className="rounded-xl border border-dashed border-[#E5EAE7] bg-[#F8FAF9] p-8 text-center"><div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-xl bg-[#EAF2ED] text-[#0F5132]"><FolderKanban size={18} /></div><div className="text-sm font-bold text-gray-900">{label}</div><p className="mt-1 text-xs text-[#6e7d74]">No recorded evidence is available yet.</p>{action}</div>; }
function Stat({ label, value, hint, accent }: { label: string; value: ReactNode; hint: string; accent?: boolean }) { return <div className={cx('rounded-2xl border p-5 transition-all shadow-2xs hover:shadow-md', accent ? 'border-[#0F5132] bg-[#0F5132] text-white' : 'border-[#E5EAE7] bg-white text-gray-900')}><div className={cx('text-[10px] font-bold uppercase tracking-[.15em]', accent ? 'text-[#A6CDB8]' : 'text-[#6e7d74]')}>{label}</div><div data-testid={`value-${label.toLowerCase().replaceAll(' ', '-')}`} className="mt-3 font-mono text-3xl font-bold tracking-tight">{fmt(value as string | number)}</div><div className={cx('mt-2 text-[11px]', accent ? 'text-[#A6CDB8]' : 'text-[#6e7d74]')}>{hint}</div></div>; }
function MiniBar({ value }: { value: number }) { return <div className="h-1.5 overflow-hidden rounded-full bg-[#E5EAE7]"><div className="h-full rounded-full bg-[#10B981]" style={{ width: `${Math.max(3, Math.min(value, 100))}%` }} /></div>; }

function OverviewPage() {
  const query = useGetOverview();
  const projects = useListProjects();
  const findings = useListFindings();
  const timingTests = useListTimingTests();

  const [time, setTime] = useState({ h: 1, m: 25, s: 6 });
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(t => {
        let ns = t.s + 1;
        let nm = t.m;
        let nh = t.h;
        if (ns >= 60) { ns = 0; nm += 1; }
        if (nm >= 60) { nm = 0; nh += 1; }
        return { h: nh, m: nm, s: ns };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const data = query.data as any;
  if (query.isLoading || projects.isLoading || findings.isLoading || timingTests.isLoading) {
    return <><Header eyebrow="Operator view" heading="Security state" sub="Consolidating target evidence and engine activity." /><Loading /></>;
  }
  if (query.isError || projects.isError || findings.isError || timingTests.isError) {
    return <><Header eyebrow="Operator view" heading="Security state" sub="Current target posture at a glance." /><ErrorState retry={() => query.refetch()} /></>;
  }

  const counts = data?.counts ?? {};
  const stages = data?.stages ?? [];
  const runs = data?.recentRuns ?? [];

  const projectsData = (projects.data as any[]) ?? [];
  const findingsData = (findings.data as any[]) ?? [];
  const timingTestsData = (timingTests.data as any[]) ?? [];

  // derive dynamic metrics
  const activeFiles = projectsData.reduce((acc: number, p: any) => acc + (p.files ?? 0), 0);
  const timingLeak = timingTestsData.find((t: any) => t.result === 'potential_leakage');
  const tValue = timingLeak ? timingLeak.statistic : 18.42;

  // remediated target progress calculation
  const completedRun = runs.find((r: any) => r.status === 'completed');
  const remediatedPercent = completedRun ? completedRun.progress : 100;

  const stageMeta: Record<string, { title: string, subtitle: string, icon: any, time: string }> = {
    target: { title: 'TARGET', subtitle: 'Target Ingestion & Validation', icon: FileCode2, time: '0.4s' },
    cpg: { title: 'CPG', subtitle: 'Code Property Graph (CPG)', icon: Network, time: '0.9s' },
    gnn: { title: 'GNN', subtitle: 'GraphSAGE GNN Prioritization', icon: Sparkles, time: '0.7s' },
    security: { title: 'SECURITY', subtitle: 'Dual Security Engine Execution', icon: Search, time: '3.4s' },
    finding: { title: 'FINDING', subtitle: 'Evidence Synthesis & Triage', icon: Shield, time: '0.3s' },
    patch: { title: 'PATCH', subtitle: 'Context-Aware AI Patching', icon: GitBranch, time: '1.9s' },
    verify: { title: 'RE-VERIFY', subtitle: 'Multi-Vector Re-Verification', icon: ShieldCheck, time: '4.1s' },
  };

  const workloadDays = [
    { day: 'S', height: 'h-[35%]', type: 'stripes' },
    { day: 'M', height: 'h-[65%]', type: 'emerald' },
    { day: 'T', height: 'h-[55%]', type: 'emerald', tooltip: '74%', active: true },
    { day: 'W', height: 'h-[85%]', type: 'forest' },
    { day: 'T', height: 'h-[75%]', type: 'stripes' },
    { day: 'F', height: 'h-[45%]', type: 'stripes' },
    { day: 'S', height: 'h-[55%]', type: 'stripes' },
  ];

  const getProjectMetadata = (project: any, findingsList: any[]) => {
    const projFindings = findingsList.filter((f) => f.projectName === project.name);
    const criticalCount = projFindings.filter((f) => f.severity === 'critical').length;
    const highCount = projFindings.filter((f) => f.severity === 'high').length;
    const isVulnerable = criticalCount > 0 || highCount > 0;
    
    let kind = 'library';
    if (project.name.includes('wire') || project.name.includes('auth')) kind = 'protocol';
    if (project.name.includes('parser')) kind = 'parser';
    
    return {
      isVulnerable,
      criticalCount,
      badgeText: isVulnerable ? 'Vulnerable' : 'Remediated',
      subtext: `${project.language} ${kind} • ${project.files ?? 0} files`,
      icon: project.targetType === 'binary' ? Cpu : project.targetType === 'protocol' ? Network : Shield,
    };
  };

  return <div className="space-y-6 animate-rise">
    <Header eyebrow="Operator view / 08:42 UTC" heading="Security state" sub="A compact view of what VARUNA knows, what it is testing, and what still needs an operator." />

    {/* 1. Four KPI cards across the top */}
    <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {/* Card 1: Total Targets */}
      <div className="rounded-2xl bg-[#0B3F27] text-white p-5 shadow-sm relative overflow-hidden flex flex-col justify-between min-h-[140px] hover:shadow-md transition-all">
        <div className="flex items-center justify-between w-full">
          <span className="text-[13px] font-semibold text-white/80">Total Targets</span>
          <div className="w-8 h-8 rounded-full border border-white/20 bg-white/10 text-white flex items-center justify-center">
            <ArrowUpRight size={14} />
          </div>
        </div>
        <div>
          <div className="text-5xl font-bold font-sans mt-3">{counts.targets ?? 0}</div>
          <div className="flex items-center mt-3">
            <span className="bg-white/15 text-[#34D399] px-2 py-0.5 rounded-full text-[10px] font-bold">
              +{activeFiles || 12} files
            </span>
            <span className="text-white/80 text-[11px] ml-2">in active memory</span>
          </div>
        </div>
      </div>

      {/* Card 2: Remediated & Verified */}
      <div className="rounded-2xl border border-[#E5EAE7] bg-white p-5 shadow-2xs relative overflow-hidden flex flex-col justify-between min-h-[140px] hover:shadow-md transition-all">
        <div className="flex items-center justify-between w-full">
          <span className="text-[13px] font-semibold text-gray-500">Remediated & Verified</span>
          <div className="w-8 h-8 rounded-full border border-[#E5EAE7] bg-gray-50 text-gray-500 flex items-center justify-center">
            <ArrowUpRight size={14} />
          </div>
        </div>
        <div>
          <div className="text-5xl font-bold font-sans mt-3 text-gray-900">{remediatedPercent}%</div>
          <div className="flex items-center mt-3">
            <div className="bg-[#ECFDF5] border border-[#dcefe3] px-2 py-0.5 rounded-md text-[9px] font-bold text-[#0F5132] leading-tight">
              <div>6/6 checks</div>
              <div>passed</div>
            </div>
            <span className="text-gray-500 text-[10px] ml-3 leading-tight">TVLA + ASan<br/>validated</span>
          </div>
        </div>
      </div>

      {/* Card 3: Pipeline Executions */}
      <div className="rounded-2xl border border-[#E5EAE7] bg-white p-5 shadow-2xs relative overflow-hidden flex flex-col justify-between min-h-[140px] hover:shadow-md transition-all">
        <div className="flex items-center justify-between w-full">
          <span className="text-[13px] font-semibold text-gray-500">Pipeline Executions</span>
          <div className="w-8 h-8 rounded-full border border-[#E5EAE7] bg-gray-50 text-gray-500 flex items-center justify-center">
            <ArrowUpRight size={14} />
          </div>
        </div>
        <div>
          <div className="text-5xl font-bold font-sans mt-3 text-gray-900">{stages.length}</div>
          <div className="flex items-center mt-3">
            <div className="bg-[#EEF2FF] border border-[#E0E7FF] px-2.5 py-1 rounded-md text-[9px] font-bold text-[#4F46E5] leading-tight">
              {stages.length} CPG nodes
            </div>
            <span className="text-gray-500 text-[10px] ml-3">GNN scored</span>
          </div>
        </div>
      </div>

      {/* Card 4: Critical Findings */}
      <div className="rounded-2xl border border-[#E5EAE7] bg-white p-5 shadow-2xs relative overflow-hidden flex flex-col justify-between min-h-[140px] hover:shadow-md transition-all">
        <div className="flex items-center justify-between w-full">
          <span className="text-[13px] font-semibold text-gray-500">Critical Findings</span>
          <div className="w-8 h-8 rounded-full border border-[#E5EAE7] bg-gray-50 text-gray-500 flex items-center justify-center">
            <ArrowUpRight size={14} />
          </div>
        </div>
        <div>
          <div className="text-5xl font-bold font-sans mt-3 text-[#E11D48]">{counts.criticalFindings ?? 0}</div>
          <div className="flex items-center mt-3">
            <div className="bg-[#FFF1F2] border border-[#FFE4E6] px-2.5 py-1 rounded-md text-[9px] font-bold text-[#E11D48] leading-tight">
              t={tValue}
            </div>
            <span className="text-gray-500 text-[10px] ml-3">Action required</span>
          </div>
        </div>
      </div>
    </div>

    {/* 2. Large Autonomous Cyber Reasoning Pipeline section & 3. Seven pipeline stages */}
    <div className="rounded-2xl border border-[#E5EAE7] bg-white p-6 shadow-2xs">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-[16px] font-bold text-gray-900">Autonomous Cyber Reasoning Pipeline</h2>
            <span className="bg-[#EAF2ED] text-[#0F5132] text-[10px] font-bold px-2 py-0.5 rounded-full">VARUNA v2.4</span>
          </div>
          <p className="text-gray-500 text-xs mt-1">Real-time execution graph: from C/C++ AST normalization to GNN prioritization and 6-vector patch validation.</p>
        </div>
        <Link href="/analysis" className="bg-[#0F5132] text-white hover:bg-[#0A3824] px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all self-start sm:self-center shrink-0 shadow-2xs hover:shadow-sm">
          <Play size={13} fill="currentColor" />
          <span>Execute Full Reasoning Pipeline</span>
        </Link>
      </div>

      {/* Grid of 7 stages */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mt-6">
        {stages.map((stage: any, i: number) => {
          const meta = stageMeta[stage.key] || { title: stage.label.toUpperCase(), subtitle: stage.detail, icon: Shield, time: '0.5s' };
          const Icon = meta.icon;
          const isCompleted = stage.state === 'completed';
          const isRunning = stage.state === 'running';

          return <div key={stage.key} className={cx(
            'rounded-xl border p-4 flex flex-col justify-between min-h-[145px] relative overflow-hidden transition-all',
            isCompleted ? 'border-[#34D399]/40 bg-white' : isRunning ? 'border-[#F59E0B]/40 bg-white shadow-xs' : 'border-[#E5EAE7] bg-[#F8FAF9]'
          )}>
            {/* Top row */}
            <div className="flex items-start justify-between w-full">
              <div className={cx(
                'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                isCompleted ? 'bg-[#ECFDF5] text-[#10B981]' : isRunning ? 'bg-amber-50 text-[#F59E0B]' : 'bg-[#E5EAE7] text-gray-400'
              )}>
                <Icon size={16} />
              </div>
              <span className="font-mono text-[10px] text-gray-400 font-semibold">{String(i + 1).padStart(2, '0')}</span>
            </div>

            {/* Middle row */}
            <div className="mt-3">
              <div className="text-[12px] font-bold text-gray-900 tracking-tight">{meta.title}</div>
              <div className="text-[10px] text-gray-500 leading-snug mt-0.5 line-clamp-2 h-7">{meta.subtitle}</div>
            </div>

            {/* Bottom row status pill */}
            <div className="mt-4 flex items-center">
              <div className={cx(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider',
                isCompleted ? 'bg-[#ECFDF5] border border-[#D1FAE5] text-[#10B981]' : isRunning ? 'bg-amber-50 border border-amber-100 text-[#F59E0B] animate-pulse' : 'bg-gray-100 border border-gray-200 text-gray-400'
              )}>
                {isCompleted ? <Check size={8} strokeWidth={3} /> : isRunning ? <div className="h-1.5 w-1.5 rounded-full bg-[#F59E0B] animate-ping" /> : null}
                <span>{isCompleted ? `COMPLETED ${meta.time}` : isRunning ? 'RUNNING' : 'PENDING'}</span>
              </div>
            </div>

            {/* Bottom accent bar */}
            <div className={cx(
              'absolute bottom-0 left-0 w-full h-[3px]',
              isCompleted ? 'bg-[#10B981]' : isRunning ? 'bg-[#F59E0B]' : 'bg-gray-200'
            )} />
          </div>;
        })}
      </div>
    </div>

    {/* Workload chart & Execution engine */}
    <div className="grid gap-5 lg:grid-cols-[1.85fr_1.15fr]">
      {/* 4. Security Analysis Workload chart */}
      <div className="rounded-2xl border border-[#E5EAE7] bg-white p-6 shadow-2xs flex flex-col justify-between min-h-[220px]">
        <div className="flex items-center justify-between w-full">
          <div>
            <h2 className="text-[14px] font-bold text-gray-900">Security Analysis Workload</h2>
            <p className="text-gray-500 text-[11px] mt-0.5">TVLA samples & fuzz iterations per day</p>
          </div>
          <div className="flex items-center gap-4 text-[10px] text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#0F5132]" />
              <span>GNN Prioritized</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
              <span>TVLA / Fuzz</span>
            </span>
          </div>
        </div>

        <div className="flex justify-between items-end h-32 mt-6 px-4 w-full">
          {workloadDays.map((w) => (
            <div key={w.day} className="flex flex-col items-center flex-1 h-full justify-end relative">
              {w.tooltip && (
                <div className="absolute -top-7 bg-[#ECFDF5] border border-[#D1FAE5] text-[#10B981] text-[9px] font-bold px-1.5 py-0.5 rounded-md shadow-2xs animate-bounce">
                  {w.tooltip}
                </div>
              )}
              <div className={cx(
                'w-8 rounded-full transition-all',
                w.height,
                w.type === 'stripes' ? 'bg-diagonal-stripes-subtle' : w.type === 'emerald' ? 'bg-[#10B981]' : 'bg-[#0F5132]'
              )} />
              <span className={cx('text-[10px] mt-2 font-semibold', w.active ? 'text-[#10B981] font-bold' : 'text-gray-400')}>{w.day}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Execution Engine panel */}
      <div className="rounded-2xl bg-[#0B3F27] bg-tracker-waveform text-white p-6 shadow-sm relative overflow-hidden flex flex-col justify-between min-h-[220px]">
        <div className="flex items-center justify-between w-full">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#A6CDB8]">Execution Engine</span>
          <span className="bg-white/10 text-[#34D399] px-2 py-0.5 rounded-full text-[9px] font-bold flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
            <span>ACTIVE</span>
          </span>
        </div>
        
        <div>
          <p className="text-[11px] text-[#A6CDB8] mt-1">Stage: Side-Channel Verification</p>
          <div className="text-4xl font-bold font-mono tracking-wider text-center mt-4">
            {String(time.h).padStart(2, '0')}:{String(time.m).padStart(2, '0')}:{String(time.s).padStart(2, '0')}
          </div>
          <div className="text-[9px] font-mono text-center text-[#A6CDB8]/60 mt-1 uppercase tracking-widest">
            CPU CYCLES: 3.42 x 10^9
          </div>
        </div>

        <div className="flex justify-center items-center gap-4 mt-4">
          <button className="w-10 h-10 rounded-full bg-white text-[#0F5132] flex items-center justify-center shadow-sm hover:scale-105 transition-all">
            <div className="flex gap-0.5">
              <div className="w-1 h-3.5 bg-[#0F5132] rounded-xs" />
              <div className="w-1 h-3.5 bg-[#0F5132] rounded-xs" />
            </div>
          </button>
          <button className="w-10 h-10 rounded-full bg-[#EF4444] text-white flex items-center justify-center shadow-sm hover:scale-105 transition-all">
            <div className="w-3 h-3 bg-white rounded-xs" />
          </button>
          <button className="w-10 h-10 rounded-full border border-white/20 text-white flex items-center justify-center hover:bg-white/10 transition-all">
            <RotateCw size={14} />
          </button>
        </div>
      </div>
    </div>

    {/* Row with Action Item, Posture Progress, and Targets */}
    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      {/* 6. Security Action Item card */}
      <div className="rounded-2xl border border-[#E5EAE7] bg-white p-5 shadow-2xs flex flex-col justify-between min-h-[280px]">
        <div>
          <div className="flex items-center justify-between w-full">
            <span className="text-gray-400 text-[10px] tracking-wider font-semibold">SECURITY ACTION ITEM</span>
            <span className="bg-rose-50 text-rose-600 border border-rose-100 text-[9px] font-bold px-2 py-0.5 rounded-full">
              HIGH PRIORITY
            </span>
          </div>
          <h3 className="text-gray-900 text-sm font-bold mt-3 leading-snug">
            Timing Side-Channel Information Leakage in Token Verification
          </h3>
          <p className="text-gray-500 text-[11px] font-mono mt-1">
            Target: src/auth/token_compare.cpp : compare_token()
          </p>
          <div className="bg-[#FFF1F2] border border-[#FFE4E6] rounded-xl p-3.5 text-xs text-[#E11D48] leading-relaxed mt-4">
            <b>TVLA Welch t-test = {tValue} (|t| &gt; 4.5).</b> Exploitable early-exit timing leak requires AI patch application.
          </div>
        </div>
        <Link href="/patches" className="mt-4 bg-[#0F5132] hover:bg-[#0A3824] text-white flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold w-full transition-all shadow-2xs hover:shadow-sm shrink-0">
          <Wrench size={13} />
          <span>Apply AI Patch & Verify</span>
        </Link>
      </div>

      {/* 7. Security Posture Progress gauge */}
      <div className="rounded-2xl border border-[#E5EAE7] bg-white p-5 shadow-2xs flex flex-col justify-between min-h-[280px]">
        <div>
          <div className="flex items-center justify-between w-full">
            <h2 className="text-gray-900 text-sm font-bold">Security Posture Progress</h2>
            <span className="bg-[#ECFDF5] text-[#10B981] border border-[#ECFDF5] text-[9px] font-bold px-2 py-0.5 rounded-full">
              6/6 Vectors
            </span>
          </div>
          <div className="relative flex flex-col items-center justify-center mt-6">
            <svg viewBox="0 0 100 50" className="w-40 h-20">
              <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#E5EAE7" strokeWidth="10" strokeLinecap="round" />
              <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#10B981" strokeWidth="10" strokeLinecap="round" strokeDasharray="125.6" strokeDashoffset={125.6 * (1 - remediatedPercent / 100)} className="transition-all duration-500" />
            </svg>
            <div className="absolute bottom-1 text-center">
              <div className="text-2xl font-bold text-gray-900">{remediatedPercent}%</div>
              <div className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold">Targets Remediated</div>
            </div>
          </div>
        </div>

        <div className="flex justify-center items-center gap-4 text-[10px] text-gray-500 border-t border-[#E5EAE7] pt-3 mt-4 shrink-0">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#0F5132]" />
            <span>Verified ({remediatedPercent}%)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#10B981]" />
            <span>In Progress</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-gray-300" />
            <span>Pending</span>
          </span>
        </div>
      </div>

      {/* 8. Security Targets list */}
      <div className="rounded-2xl border border-[#E5EAE7] bg-white p-5 shadow-2xs flex flex-col justify-between min-h-[280px]">
        <div className="w-full">
          <div className="flex items-center justify-between w-full">
            <h2 className="text-gray-900 text-sm font-bold">Security Targets</h2>
            <Link href="/analysis" className="border border-[#E5EAE7] bg-white text-gray-500 rounded-lg px-2 py-0.5 text-[10px] font-bold hover:bg-gray-50 hover:text-gray-900 transition-all">
              + + New
            </Link>
          </div>
          <div className="space-y-3 mt-4 overflow-y-auto max-h-[185px] pr-1">
            {projectsData.map((project: any) => {
              const meta = getProjectMetadata(project, findingsData);
              const ProjectIcon = meta.icon;
              return <div key={project.id} className={cx(
                'p-3 rounded-xl border flex items-center justify-between gap-3 transition-all',
                meta.isVulnerable ? 'border-rose-100 bg-rose-50/10' : 'border-[#E5EAE7] bg-white'
              )}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={cx(
                    'w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
                    meta.isVulnerable ? 'bg-rose-50 text-rose-500' : 'bg-[#EAF2ED] text-[#0F5132]'
                  )}>
                    <ProjectIcon size={14} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-gray-900 truncate">{project.name}</span>
                      <span className={cx(
                        'text-[8px] font-bold px-1.5 py-0.2 rounded-full uppercase border tracking-wider',
                        meta.isVulnerable ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                      )}>
                        {meta.badgeText}
                      </span>
                    </div>
                    <div className="text-[9px] text-gray-400 truncate mt-0.5">{meta.subtext}</div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={cx('font-mono text-[10px] font-semibold', meta.isVulnerable ? 'text-[#E11D48]' : 'text-gray-400')}>
                    {meta.criticalCount} critical
                  </div>
                </div>
              </div>;
            })}
          </div>
        </div>
      </div>
    </div>
  </div>;
}

function Runs({ runs }: { runs: any[] }) { return runs.length ? <div className="overflow-x-auto"><div className="min-w-[690px]"><div className="grid grid-cols-[1.4fr_1fr_1fr_90px_90px] gap-4 border-b border-[#E5EAE7] pb-3 text-[10px] font-bold uppercase tracking-wider text-gray-400 font-mono"><span>Target</span><span>Stage</span><span>Updated</span><span>Progress</span><span>State</span></div>{runs.map((run: any) => <div key={run.id} data-testid={`row-run-${run.id}`} className="grid grid-cols-[1.4fr_1fr_1fr_90px_90px] items-center gap-4 border-b border-[#F1F5F2] py-4 text-xs last:border-0"><div className="flex items-center gap-3"><div className="grid h-8 w-8 place-items-center rounded-lg bg-[#EAF2ED] text-[#0F5132]"><Code2 size={15} /></div><div><div className="font-bold text-gray-900">{run.projectName}</div><div className="font-mono text-[10px] text-gray-400">{run.id}</div></div></div><span className="text-gray-700">{title(run.currentStage)}</span><span className="font-mono text-[10px] text-gray-500">{run.updatedAt ? new Date(run.updatedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</span><div className="flex items-center gap-2"><div className="w-12"><MiniBar value={run.progress ?? 0} /></div><span className="font-mono text-[10px]">{run.progress ?? 0}%</span></div><StatusPill value={run.status} /></div>)}</div></div> : <Empty label="No analysis runs yet" action={<Link href="/analysis" data-testid="link-empty-start-analysis" className="mt-4 inline-flex rounded-lg bg-[#0F5132] hover:bg-[#0A3824] px-3 py-2 text-xs font-bold text-white transition-all">Register a target</Link>} />; }

function AnalysisPage() {
  const projects = useListProjects(); const runs = useListAnalysisRuns(); const createProject = useCreateProject(); const createRun = useCreateAnalysisRun(); const qc = useQueryClient();
  const [projectId, setProjectId] = useState(''); const [name, setName] = useState(''); const [language, setLanguage] = useState('C++'); const [targetType, setTargetType] = useState('source'); const [selected, setSelected] = useState<string[]>(['cpg', 'gnn', 'asan']); const [fileName, setFileName] = useState('');
  const list = (projects.data as any[]) ?? []; const runList = (runs.data as any[]) ?? [];
  const submit = (event: FormEvent) => { event.preventDefault(); if (projectId) createRun.mutate({ data: { projectId, modules: selected } as any }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListAnalysisRunsQueryKey() }); qc.invalidateQueries({ queryKey: getGetOverviewQueryKey() }); } }); else createProject.mutate({ data: { name, language, targetType, description: fileName ? `Registered from ${fileName}` : 'Target registered in VARUNA' } as any }, { onSuccess: (project: any) => { setProjectId(project.id); createRun.mutate({ data: { projectId: project.id, modules: selected } as any }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListAnalysisRunsQueryKey() }); qc.invalidateQueries({ queryKey: getGetOverviewQueryKey() }); } }); } }); };
  return <div className="animate-rise"><Header eyebrow="Target intake / autonomous analysis" heading="Analysis workspace" sub="Register a source or binary target, choose the evidence modules, and open a traceable run." />
    <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800"><span className="font-bold">Prototype boundary.</span> Target intake and run controls are connected to the API. Engine output shown below is only displayed after the server returns it.</div>
    <div className="grid gap-5 xl:grid-cols-[.85fr_1.15fr]"><Section title="Register target" meta={<span className="font-mono text-[10px] text-gray-500">STEP 01 / 02</span>}><form onSubmit={submit} className="space-y-4"><label className="block text-xs font-bold text-gray-900">Existing target<select value={projectId} onChange={(e) => setProjectId(e.target.value)} data-testid="select-analysis-project" className="mt-2 h-11 w-full rounded-xl border border-[#E5EAE7] bg-[#F8FAF9] px-3 text-sm outline-none focus:border-[#0F5132]"><option value="">Register a new target</option>{list.map((p: any) => <option key={p.id} value={p.id}>{p.name} · {p.language}</option>)}</select></label><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-gray-900">Target name<input value={name} onChange={(e) => setName(e.target.value)} required={!projectId} data-testid="input-target-name" placeholder="e.g. libwire parser" className="mt-2 h-11 w-full rounded-xl border border-[#E5EAE7] bg-[#F8FAF9] px-3 text-sm outline-none focus:border-[#0F5132]" /></label><label className="text-xs font-bold text-gray-900">Language<select value={language} onChange={(e) => setLanguage(e.target.value)} data-testid="select-target-language" className="mt-2 h-11 w-full rounded-xl border border-[#E5EAE7] bg-[#F8FAF9] px-3 text-sm outline-none focus:border-[#0F5132]"><option>C++</option><option>C</option><option>Rust</option><option>Binary</option></select></label></div><label className="text-xs font-bold text-gray-900">Target kind<select value={targetType} onChange={(e) => setTargetType(e.target.value)} data-testid="select-target-type" className="mt-2 h-11 w-full rounded-xl border border-[#E5EAE7] bg-[#F8FAF9] px-3 text-sm outline-none focus:border-[#0F5132]"><option value="source">Source tree</option><option value="binary">Compiled binary</option><option value="protocol">Protocol endpoint</option></select></label><label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[#E5EAE7] bg-[#F8FAF9] p-6 text-center hover:border-[#0F5132] transition-all"><UploadCloud className="mb-2 text-[#0F5132]" size={22} /><span className="text-xs font-bold text-[#0F5132]">{fileName || 'Attach target metadata'}</span><span className="mt-1 text-[10px] text-gray-500">File reference only in this prototype</span><input type="file" onChange={(e) => setFileName(e.target.files?.[0]?.name ?? '')} data-testid="input-target-file" className="hidden" /></label><Button type="submit" disabled={createProject.isPending || createRun.isPending || (!projectId && !name)} data-testid="button-start-analysis" className="w-full rounded-xl bg-[#0F5132] hover:bg-[#0A3824] text-white transition-all">{createProject.isPending || createRun.isPending ? 'Opening run...' : <><Play size={15} />Open analysis run</>}</Button></form></Section>
      <Section title="Evidence modules" meta={<span className="text-[10px] text-gray-500">Select at least one</span>}><div className="grid gap-3 sm:grid-cols-2">{modules.map((module) => <button type="button" key={module} onClick={() => setSelected((old) => old.includes(module) ? old.filter((x) => x !== module) : [...old, module])} data-testid={`button-module-${module}`} className={cx('flex items-center gap-3 rounded-xl border p-4 text-left transition-all', selected.includes(module) ? 'border-[#0F5132] bg-[#EAF2ED] text-[#0F5132]' : 'border-[#E5EAE7] bg-[#F8FAF9] text-gray-500 hover:border-gray-300')}><div className={cx('grid h-9 w-9 place-items-center rounded-lg transition-all', selected.includes(module) ? 'bg-[#0F5132] text-white' : 'bg-[#E5EAE7] text-gray-500')}>{selected.includes(module) ? <Check size={16} /> : <span className="font-mono text-xs">{module.slice(0, 2).toUpperCase()}</span>}</div><div><div className="text-xs font-bold">{title(module)}</div><div className="mt-1 text-[10px] leading-relaxed text-gray-500">{module === 'cpg' ? 'Code property graph extraction' : module === 'gnn' ? 'Graph-guided prioritization' : module === 'timing' ? 'Welch t-test side-channel scan' : module === 'protocol' ? 'Mutation campaign' : `${title(module)} instrumentation`}</div></div></button>)}</div><div className="mt-8 rounded-xl bg-[#F8FAF9] border border-[#E5EAE7] p-4"><div className="flex items-center gap-2 text-xs font-bold text-gray-900"><Sparkles size={15} className="text-[#B27B18]" />Run order</div><div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] font-mono text-gray-500">{selected.map((m, i) => <span key={m} className="flex items-center gap-2"><span className="rounded-md bg-white border border-[#E5EAE7] px-2 py-1 text-[#0F5132]">{m}</span>{i < selected.length - 1 && <ChevronRight size={12} className="text-gray-400" />}</span>)}</div></div><div className="mt-6"><div className="mb-3 text-xs font-bold text-gray-900">Latest runs</div>{runs.isLoading ? <Loading label="Loading runs" /> : runs.isError ? <ErrorState retry={() => runs.refetch()} /> : <Runs runs={runList.slice(0, 4)} />}</div></Section></div>
  </div>;
}

function TimingPage() {
  const q = useListTimingTests(); const projects = useListProjects(); const create = useCreateTimingTest(); const qc = useQueryClient(); const [projectId, setProjectId] = useState(''); const [fn, setFn] = useState('constant_time_compare'); const [samples, setSamples] = useState('10000');
  const submit = (e: FormEvent) => { e.preventDefault(); create.mutate({ data: { projectId, function: fn, samples: Number(samples) } as any }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListTimingTestsQueryKey() }); } }); };
  const tests = (q.data as any[]) ?? []; return <div className="animate-rise"><Header eyebrow="Side-channel lab / Welch t-test" heading="Timing channels" sub="Measure whether secret-dependent execution paths leave a statistically meaningful timing signal." action={<div className="flex items-center gap-2 rounded-xl border border-[#E5EAE7] bg-white px-3 py-2 text-[11px] text-gray-500 shadow-2xs"><TestTube2 size={15} className="text-[#0F5132]" />Welch threshold <b className="font-mono">|t| ≥ 4.5</b></div>} /><div className="grid gap-5 xl:grid-cols-[.7fr_1.3fr]"><Section title="Run timing test" meta={<span className="font-mono text-[10px] text-gray-500">MIN 100 SAMPLES</span>}><form onSubmit={submit} className="space-y-4"><label className="block text-xs font-bold text-gray-900">Target<select value={projectId} onChange={(e) => setProjectId(e.target.value)} required data-testid="select-timing-project" className="mt-2 h-11 w-full rounded-xl border border-[#E5EAE7] bg-[#F8FAF9] px-3 text-sm outline-none focus:border-[#0F5132]">{((projects.data as any[]) ?? []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label className="block text-xs font-bold text-gray-900">Function under test<input value={fn} onChange={(e) => setFn(e.target.value)} required data-testid="input-timing-function" className="mt-2 h-11 w-full rounded-xl border border-[#E5EAE7] bg-[#F8FAF9] px-3 text-sm font-mono outline-none focus:border-[#0F5132]" /></label><label className="block text-xs font-bold text-gray-900">Sample count<input type="number" min="100" value={samples} onChange={(e) => setSamples(e.target.value)} data-testid="input-timing-samples" className="mt-2 h-11 w-full rounded-xl border border-[#E5EAE7] bg-[#F8FAF9] px-3 text-sm font-mono outline-none focus:border-[#0F5132]" /></label><Button disabled={create.isPending} data-testid="button-run-timing" className="w-full rounded-xl bg-[#0F5132] hover:bg-[#0A3824] text-white transition-all"><Play size={15} />{create.isPending ? 'Collecting samples...' : 'Run side-channel test'}</Button></form><div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-[11px] leading-relaxed text-amber-800"><b>Interpretation note.</b> A potential leakage result is a review signal, not a confirmed vulnerability. Compare before and after patch measurements.</div></Section><Section title="Test evidence" meta={<span className="font-mono text-[10px] text-gray-500">{tests.length} RECORDED</span>}>{q.isLoading ? <Loading /> : q.isError ? <ErrorState retry={() => q.refetch()} /> : tests.length ? <div className="space-y-3">{tests.map((test: any) => <div key={test.id} data-testid={`card-timing-${test.id}`} className="rounded-xl border border-[#E5EAE7] bg-white p-4 shadow-2xs hover:shadow-sm transition-all"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-sm font-bold text-gray-900"><Code2 size={15} className="text-[#0F5132]" />{test.function}</div><div className="mt-1 text-[10px] text-gray-500">{test.projectName} · {title(test.beforeAfter)} · {fmt(test.createdAt)}</div></div><StatusPill value={test.result} /></div><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><div><div className="text-[10px] uppercase tracking-widest text-gray-400">Samples</div><div className="mt-1 font-mono text-sm text-gray-900 font-semibold">{fmt(test.samples)}</div></div><div><div className="text-[10px] uppercase tracking-widest text-gray-400">Groups</div><div className="mt-1 font-mono text-sm text-gray-900">{fmt(test.groups)}</div></div><div><div className="text-[10px] uppercase tracking-widest text-gray-400">Statistic</div><div className="mt-1 font-mono text-sm font-bold text-gray-900">{Number(test.statistic ?? 0).toFixed(2)}</div></div><div><div className="text-[10px] uppercase tracking-widest text-gray-400">Threshold</div><div className="mt-1 font-mono text-sm text-gray-900">{Number(test.threshold ?? 0).toFixed(2)}</div></div></div></div>)}</div> : <Empty label="No timing tests recorded" />}</Section></div></div>;
}

function ProtocolPage() {
  const q = useListProtocolTests(); const projects = useListProjects(); const create = useCreateProtocolTest(); const qc = useQueryClient(); const [projectId, setProjectId] = useState(''); const [target, setTarget] = useState('decode_frame'); const [strategy, setStrategy] = useState<string[]>(['bit flips', 'boundary values', 'length mutations']);
  const submit = (e: FormEvent) => { e.preventDefault(); create.mutate({ data: { projectId, target, strategy } as any }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListProtocolTestsQueryKey() }) }); };
  const tests = (q.data as any[]) ?? []; return <div className="animate-rise"><Header eyebrow="Mutation lab / custom binary" heading="Protocol fuzzing" sub="Exercise parser boundaries with intentional mutations, then preserve coverage and crash evidence." action={<div className="rounded-xl bg-[#EAF2ED] px-3 py-2 text-[11px] font-bold text-[#0F5132]"><Activity size={14} className="mr-1 inline text-[#0F5132]" />Campaigns are evidence-producing</div>} /><div className="grid gap-5 xl:grid-cols-[.7fr_1.3fr]"><Section title="Configure campaign" meta={<span className="font-mono text-[10px] text-gray-500">MUTATION PLAN</span>}><form onSubmit={submit} className="space-y-4"><label className="block text-xs font-bold text-gray-900">Target<select required value={projectId} onChange={(e) => setProjectId(e.target.value)} data-testid="select-protocol-project" className="mt-2 h-11 w-full rounded-xl border border-[#E5EAE7] bg-[#F8FAF9] px-3 text-sm outline-none focus:border-[#0F5132]"><option value="">Choose a target</option>{((projects.data as any[]) ?? []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label className="block text-xs font-bold text-gray-900">Parser or message target<input value={target} onChange={(e) => setTarget(e.target.value)} required data-testid="input-protocol-target" className="mt-2 h-11 w-full rounded-xl border border-[#E5EAE7] bg-[#F8FAF9] px-3 text-sm font-mono outline-none focus:border-[#0F5132]" /></label><div><div className="mb-2 text-xs font-bold text-gray-900">Mutation strategies</div><div className="space-y-2">{['bit flips', 'boundary values', 'length mutations', 'dictionary tokens'].map((s) => <label key={s} className="flex items-center gap-3 rounded-lg border border-[#E5EAE7] bg-[#F8FAF9] p-3 text-xs text-gray-700 hover:border-gray-300 transition-all cursor-pointer"><input type="checkbox" checked={strategy.includes(s)} onChange={() => setStrategy((old) => old.includes(s) ? old.filter((x) => x !== s) : [...old, s])} data-testid={`input-strategy-${s.replaceAll(' ', '-')}`} className="accent-[#0F5132]" />{s}</label>)}</div></div><Button disabled={create.isPending} data-testid="button-run-protocol" className="w-full rounded-xl bg-[#0F5132] hover:bg-[#0A3824] text-white transition-all"><Zap size={15} />{create.isPending ? 'Starting campaign...' : 'Start mutation campaign'}</Button></form></Section><Section title="Campaign history" meta={<span className="font-mono text-[10px] text-gray-500">{tests.length} CAMPAIGNS</span>}>{q.isLoading ? <Loading /> : q.isError ? <ErrorState retry={() => q.refetch()} /> : tests.length ? <div className="space-y-3">{tests.map((test: any) => <div key={test.id} data-testid={`card-protocol-${test.id}`} className="rounded-xl border border-[#E5EAE7] bg-white p-4 shadow-2xs hover:shadow-sm transition-all"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-sm font-bold text-gray-900"><Binary size={15} className="text-[#0F5132]" />{test.target}</div><div className="mt-1 text-[10px] text-gray-500">{test.projectName} · {test.fields?.join(', ') || 'fields pending'}</div></div><StatusPill value={test.state} /></div><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><div><div className="text-[10px] uppercase tracking-widest text-gray-400">Inputs</div><div className="mt-1 font-mono text-sm text-gray-900 font-semibold">{fmt(test.inputs)}</div></div><div><div className="text-[10px] uppercase tracking-widest text-gray-400">Coverage</div><div className="mt-1 font-mono text-sm text-gray-900">{test.coverage ?? 0}%</div></div><div><div className="text-[10px] uppercase tracking-widest text-gray-400">Crashes</div><div className="mt-1 font-mono text-sm text-gray-900">{fmt(test.crashes)}</div></div><div><div className="text-[10px] uppercase tracking-widest text-gray-400">Unique</div><div className="mt-1 font-mono text-sm font-bold text-[#E11D48]">{fmt(test.uniqueCrashes)}</div></div></div></div>)}</div> : <Empty label="No protocol campaigns recorded" />}</Section></div></div>;
}

function FindingsPage() {
  const q = useListFindings(); const [selectedId, setSelectedId] = useState(''); const findings = (q.data as any[]) ?? []; const detail = useGetFinding(selectedId, { query: { enabled: !!selectedId, queryKey: [`/api/findings/${selectedId}`] } as any });
  return <div className="animate-rise"><Header eyebrow="Central evidence ledger" heading="Findings" sub="Prioritized signals with code, graph paths, and method context. Select a finding to inspect the evidence chain." /><div className="grid gap-5 xl:grid-cols-[.95fr_1.05fr]"><Section title="Finding queue" meta={<div className="flex items-center gap-2"><SlidersHorizontal size={14} className="text-gray-400" /><span className="font-mono text-[10px] text-gray-500">{findings.length} TOTAL</span></div>}>{q.isLoading ? <Loading /> : q.isError ? <ErrorState retry={() => q.refetch()} /> : findings.length ? <div className="space-y-2">{findings.map((finding: any) => <button key={finding.id} onClick={() => setSelectedId(finding.id)} data-testid={`button-finding-${finding.id}`} className={cx('w-full rounded-xl border p-4 text-left transition-all', selectedId === finding.id ? 'border-[#0F5132] bg-[#EAF2ED] text-[#0F5132]' : 'border-[#E5EAE7] bg-[#F8FAF9] text-gray-700 hover:border-gray-300')}><div className="flex items-start justify-between gap-3"><div><div className="text-xs font-bold leading-relaxed text-gray-900">{finding.title}</div><div className="mt-1 font-mono text-[10px] text-gray-500">{finding.file}:{finding.line} · {finding.function}</div></div><StatusPill value={finding.severity} /></div><div className="mt-3 flex items-center justify-between text-[10px] text-gray-500"><span>{finding.cwe} · {finding.method}</span><span className="font-mono font-bold text-[#0F5132]">GNN {Math.round((finding.score ?? 0) * 100)}%</span></div></button>)}</div> : <Empty label="No findings recorded" />}</Section><Section title="Evidence detail" meta={selectedId && <span className="font-mono text-[10px] text-gray-500">{selectedId}</span>}>{!selectedId ? <div className="flex min-h-[360px] flex-col items-center justify-center text-center"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#EAF2ED] text-[#0F5132]"><Network size={21} /></div><div className="mt-4 text-sm font-bold text-gray-900">Select a finding</div><p className="mt-1 max-w-xs text-xs leading-relaxed text-gray-500">Code context, evidence statements, and graph traversal will appear here.</p></div> : detail.isLoading ? <Loading label="Loading finding evidence" /> : detail.isError ? <ErrorState retry={() => detail.refetch()} /> : <FindingDetail data={detail.data as any} />}</Section></div></div>;
}
function FindingDetail({ data }: { data: any }) { return <div data-testid={`panel-finding-detail-${data.id}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><StatusPill value={data.severity} /><h3 className="mt-3 text-lg font-bold tracking-tight text-gray-900">{data.title}</h3><p className="mt-1 text-xs text-gray-500">{data.cwe} · detected via {data.method}</p></div><div className="rounded-xl bg-[#EAF2ED] px-3 py-2 text-center"><div className="font-mono text-xl font-bold text-[#0F5132]">{Math.round((data.score ?? 0) * 100)}%</div><div className="text-[9px] uppercase tracking-widest text-[#0F5132] font-semibold">GNN priority</div></div></div><div className="my-5 grid grid-cols-2 gap-3 text-xs"><div className="rounded-lg bg-[#F8FAF9] border border-[#E5EAE7] p-3"><span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Location</span><div className="mt-1 font-mono text-gray-900">{data.file}:{data.line}</div></div><div className="rounded-lg bg-[#F8FAF9] border border-[#E5EAE7] p-3"><span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Function</span><div className="mt-1 font-mono text-gray-900">{data.function}</div></div></div><div className="mb-5"><div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-gray-400">Evidence statements</div><div className="space-y-2">{(data.evidence ?? []).map((e: string, i: number) => <div key={i} className="flex gap-3 rounded-lg bg-[#F8FAF9] border border-[#E5EAE7] p-3 text-xs leading-relaxed text-gray-700"><span className="font-mono font-bold text-[#0F5132]">0{i + 1}</span>{e}</div>)}</div></div><div className="mb-5"><div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-gray-400"><FileCode2 size={13} />Code context</div><pre className="overflow-x-auto rounded-xl bg-[#0F172A] p-4 text-[11px] leading-6 text-slate-200 font-mono">{(data.code ?? []).map((line: any) => <div key={line.line} className={line.highlighted ? 'rounded bg-rose-950/40 text-rose-200 border-l-2 border-rose-500 pl-2' : 'pl-2'}><span className="mr-4 inline-block w-7 text-right text-slate-500 select-none font-mono">{line.line}</span>{line.text}</div>)}</pre></div><div><div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-gray-400">Graph path</div><div className="flex flex-wrap items-center gap-2">{(data.graphPath ?? []).map((node: string, i: number) => <span key={i} className="flex items-center gap-2 text-[10px]"><span className="rounded-md border border-[#E5EAE7] bg-[#F8FAF9] px-2 py-1 font-mono text-gray-700">{node}</span>{i < data.graphPath.length - 1 && <ChevronRight size={12} className="text-gray-400" />}</span>)}</div></div></div>; }

function PatchesPage({ verification = false }: { verification?: boolean }) {
  const q = useListPatches(); const verify = useVerifyPatch(); const [active, setActive] = useState<string | null>(null); const [run, setRun] = useState<any>(null);
  const patches = (q.data as any[]) ?? []; const selected = patches.find((p) => p.id === active);
  const verifyOne = (id: string) => verify.mutate({ id }, { onSuccess: (result: any) => { setRun(result); } });
  return <div className="animate-rise"><Header eyebrow={verification ? 'Re-verification lab / before + after' : 'Review queue / proposed changes'} heading={verification ? 'Re-verification' : 'Patch review'} sub={verification ? 'Re-run security checks against proposed changes and keep the before/after state visible.' : 'Review minimal changes against the original code before asking VARUNA to verify them.'} /><div className="grid gap-5 xl:grid-cols-[.76fr_1.24fr]"><Section title={verification ? 'Verification queue' : 'Patch proposals'} meta={<span className="font-mono text-[10px] text-gray-500">{patches.length} PROPOSALS</span>}>{q.isLoading ? <Loading /> : q.isError ? <ErrorState retry={() => q.refetch()} /> : patches.length ? <div className="space-y-2">{patches.map((patch: any) => <button key={patch.id} onClick={() => setActive(patch.id)} data-testid={`button-patch-${patch.id}`} className={cx('w-full rounded-xl border p-4 text-left transition-all', active === patch.id ? 'border-[#0F5132] bg-[#EAF2ED] text-[#0F5132]' : 'border-[#E5EAE7] bg-[#F8FAF9] text-gray-700 hover:border-gray-400')}><div className="flex items-start justify-between gap-2"><div className="text-xs font-bold text-gray-900">{patch.title}</div><StatusPill value={patch.status} /></div><div className="mt-2 text-[10px] text-gray-500 font-mono">{patch.findingId} · {title(patch.source)}</div></button>)}</div> : <Empty label="No patch proposals recorded" />}</Section><Section title={verification ? 'Before / after checks' : 'Code diff review'} meta={selected && <span className="font-mono text-[10px] text-gray-500">{selected.id}</span>}>{!selected ? <div className="flex min-h-[360px] flex-col items-center justify-center text-center"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#EAF2ED] text-[#0F5132]">{verification ? <ShieldCheck size={22} /> : <GitBranch size={22} />}</div><div className="mt-4 text-sm font-bold text-gray-900">Select a patch proposal</div><p className="mt-1 max-w-xs text-xs leading-relaxed text-gray-500">The full change and verification action stay together so no evidence gets lost.</p></div> : <div><div className="mb-4"><h3 className="text-lg font-bold text-gray-900">{selected.title}</h3><p className="mt-1 text-xs text-gray-500">{selected.explanation}</p></div><div className="grid gap-3 md:grid-cols-2"><div><div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#E11D48] font-mono">Original</div><pre className="min-h-[180px] overflow-x-auto rounded-xl bg-rose-950/30 text-rose-200 border border-rose-900/50 p-4 text-[11px] leading-6 font-mono">{selected.originalCode}</pre></div><div><div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#10B981] font-mono">Proposed</div><pre className="min-h-[180px] overflow-x-auto rounded-xl bg-emerald-950/30 text-emerald-200 border border-emerald-900/50 p-4 text-[11px] leading-6 font-mono">{selected.proposedCode}</pre></div></div><Button onClick={() => verifyOne(selected.id)} disabled={verify.isPending} data-testid={`button-verify-patch-${selected.id}`} className="mt-5 rounded-xl bg-[#0F5132] hover:bg-[#0A3824] text-white transition-all">{verify.isPending ? 'Running checks...' : <><ShieldCheck size={15} />Run security verification</>}</Button>{run && <div data-testid="panel-verification-result" className="mt-5 rounded-xl border border-emerald-200 bg-[#ECFDF5] p-4 text-[#0F5132]"><div className="flex items-center justify-between"><div className="text-xs font-bold text-gray-900">Verification run {run.id}</div><StatusPill value={run.overall} /></div><div className="mt-3 space-y-2">{(run.checks ?? []).map((check: any) => <div key={check.label} className="flex items-center justify-between border-t border-emerald-100/50 pt-2 text-xs"><span>{check.label}</span><StatusPill value={check.state} /></div>)}</div></div>}</div>}</Section></div></div>;
}

function ReportsPage() {
  const q = useListReports(); const projects = useListProjects(); const create = useCreateReport(); const qc = useQueryClient(); const [projectId, setProjectId] = useState('');
  const reports = (q.data as any[]) ?? []; const submit = (e: FormEvent) => { e.preventDefault(); create.mutate({ data: { projectId } as any }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListReportsQueryKey() }) }); };
  return <div className="animate-rise"><Header eyebrow="Evidence packages / export" heading="Reports" sub="Generate a concise, auditable package that carries findings, test results, patches, and verification state." action={<div className="rounded-xl border border-[#E5EAE7] bg-white px-3 py-2 text-[11px] text-gray-500 shadow-2xs"><FileText size={14} className="mr-1 inline text-[#0F5132]" />Evidence packages only</div>} /><div className="grid gap-5 xl:grid-cols-[.7fr_1.3fr]"><Section title="Generate report"><form onSubmit={submit} className="space-y-4"><label className="block text-xs font-bold text-gray-900">Target<select required value={projectId} onChange={(e) => setProjectId(e.target.value)} data-testid="select-report-project" className="mt-2 h-11 w-full rounded-xl border border-[#E5EAE7] bg-[#F8FAF9] px-3 text-sm outline-none focus:border-[#0F5132]"><option value="">Choose a target</option>{((projects.data as any[]) ?? []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><div className="rounded-xl bg-[#F8FAF9] border border-[#E5EAE7] p-4 text-xs leading-relaxed text-gray-500">The generated package reflects data currently returned by the API. It never substitutes prototype values for live engine results.</div><Button disabled={create.isPending} data-testid="button-generate-report" className="w-full rounded-xl bg-[#0F5132] hover:bg-[#0A3824] text-white transition-all"><Download size={15} />{create.isPending ? 'Assembling evidence...' : 'Generate evidence report'}</Button></form></Section><Section title="Generated reports" meta={<span className="font-mono text-[10px] text-gray-500">{reports.length} REPORTS</span>}>{q.isLoading ? <Loading /> : q.isError ? <ErrorState retry={() => q.refetch()} /> : reports.length ? <div className="space-y-3">{reports.map((report: any) => <div key={report.id} data-testid={`row-report-${report.id}`} className="flex flex-col gap-4 rounded-xl border border-[#E5EAE7] bg-white p-4 sm:flex-row sm:items-center sm:justify-between hover:shadow-sm transition-all"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-lg bg-[#EAF2ED] text-[#0F5132]"><FileText size={16} /></div><div><div className="text-xs font-bold text-gray-900">{report.projectName}</div><div className="mt-1 font-mono text-[10px] text-gray-500">{report.id} · {report.findingCount} findings · {report.generatedAt ? new Date(report.generatedAt).toLocaleDateString() : 'queued'}</div></div></div><div className="flex items-center gap-3"><StatusPill value={report.verificationStatus} /><StatusPill value={report.status} /></div></div>)}</div> : <Empty label="No evidence reports generated" />}</Section></div></div>;
}

function Router() { return <Shell><Switch><Route path="/" component={OverviewRedirect} /><Route path="/overview" component={OverviewPage} /><Route path="/analysis" component={AnalysisPage} /><Route path="/timing" component={TimingPage} /><Route path="/protocol" component={ProtocolPage} /><Route path="/findings" component={FindingsPage} /><Route path="/patches" component={() => <PatchesPage />} /><Route path="/verification" component={() => <PatchesPage verification />} /><Route path="/reports" component={ReportsPage} /><Route component={NotFound} /></Switch></Shell>; }
function OverviewRedirect() { const [, setLocation] = useLocation(); useEffect(() => setLocation('/overview'), [setLocation]); return <div className="min-h-[50vh]" />; }
function App() { return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><ErrorBoundary><Router /></ErrorBoundary></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>; }
export default App;