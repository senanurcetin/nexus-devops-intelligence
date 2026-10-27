'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  Activity, AlertCircle, ArrowRight, ArrowUpRight, CheckCircle2,
  Check, Copy, Download, GitBranch, GitPullRequest, RefreshCw, ShieldCheck, TriangleAlert,
} from 'lucide-react';
import { isConfirmedWorkflowFailure, type PublicActionsSummary } from '@/lib/github-public-actions';
import type { PublicPullSummary, PullAttention } from '@/lib/nexus-public-prs';
import { recommendInvestigations } from '@/lib/nexus-recommendations';
import { readPublicPanel, emptyPanel, formatPublicPanelDiagnosticReport, type Panel } from '@/lib/nexus-panel-request';
import { isPublicActionsSample, isPublicPullSample } from '@/lib/nexus-panel-validation';
import { filteredWorkflowRuns, workflowOutcome, workflowOutcomeCount, workflowOutcomes, type WorkflowFilter } from '@/lib/nexus-workflow-visuals';
import { filteredPublicPulls, pullBucket, pullBucketCount, pullBuckets, type PullFilter } from '@/lib/nexus-pr-visuals';
import { createPublicSampleExport, createSampleFilename, serializePublicSampleCsv } from '@/lib/nexus-public-sample-export';
import { createAuditBrief, createAuditBriefFilename } from '@/lib/nexus-audit-brief';
import { createInvestigationHandoff } from '@/lib/nexus-investigation-handoff';
import { assessRepositoryRiskPosture } from '@/lib/nexus-risk-posture';
import { buildRepositoryShareUrl, canonicalRepositoryPageUrl, readRepositoryLink, normalizeRepositoryInput } from '@/lib/nexus-repository-link';
import { isPublicPrVerification, type PublicPrVerification } from '@/lib/nexus-pr-evidence';
import { isPublicRunEvidence, type PublicRunEvidence } from '@/lib/nexus-workflow-run-evidence';
import { isPublicWorkflowTrend, type PublicWorkflowTrend } from '@/lib/nexus-workflow-trends';

const DEFAULT_REPOSITORY = 'senanurcetin/ot-sentinel';

const attentionMeta: Record<PullAttention, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-slate-600/30 text-slate-300' },
  conflict: { label: 'Merge conflict', className: 'bg-rose-400/15 text-rose-300' },
  blocked: { label: 'Merge restricted', className: 'bg-amber-400/15 text-amber-300' },
  behind: { label: 'Behind base', className: 'bg-amber-400/15 text-amber-300' },
  unstable: { label: 'Unstable', className: 'bg-amber-400/15 text-amber-300' },
  clear: { label: 'Clean (reported)', className: 'bg-emerald-400/15 text-emerald-300' },
  unknown: { label: 'Not verified', className: 'bg-slate-600/30 text-slate-300' },
};

function Card({ index, label, value, detail, tone = 'default' }: {
  index: number; label: string; value: string | number; detail: string; tone?: 'default' | 'warning';
}) {
  return (
    <div className={'nexus-devops-card rounded-2xl border border-slate-800 bg-slate-900/90 p-5' +
      (tone === 'warning' ? ' nexus-devops-warning' : '')}>
      <div className="nexus-devops-card-head">
        <p className="text-sm text-slate-300">{label}</p>
        <span className="nexus-devops-card-index" aria-hidden="true">{String(index).padStart(2, '0')}</span>
      </div>
      <div className={'nexus-devops-card-value mt-2 text-3xl font-semibold tabular-nums ' +
        (tone === 'warning' ? 'text-amber-300' : 'text-white')}>{value}</div>
      <p className="nexus-devops-card-detail mt-2 text-xs leading-5 text-slate-400">{detail}</p>
    </div>
  );
}

export default function NexusDeveloperPreview() {
  const [repository, setRepository] = useState(DEFAULT_REPOSITORY);
  const [selectedRepo, setSelectedRepo] = useState(DEFAULT_REPOSITORY);
  const [actions, setActions] = useState<Panel<PublicActionsSummary>>(emptyPanel);
  const [pulls, setPulls] = useState<Panel<PublicPullSummary>>(emptyPanel);
  const [actionsLoading, setActionsLoading] = useState(false);
  const [pullsLoading, setPullsLoading] = useState(false);
  const [pullsSlow, setPullsSlow] = useState(false);
  const [prEvidence, setPrEvidence] = useState<Panel<PublicPrVerification>>(emptyPanel);
  const [prEvidenceKey, setPrEvidenceKey] = useState<string | null>(null);
  const [prEvidenceOpen, setPrEvidenceOpen] = useState(false);
  const [prEvidenceLoading, setPrEvidenceLoading] = useState(false);
  const prEvidenceController = useRef<AbortController | null>(null);
  const [runEvidence, setRunEvidence] = useState<Panel<PublicRunEvidence>>(emptyPanel);
  const [runEvidenceKey, setRunEvidenceKey] = useState<string | null>(null);
  const [runEvidenceOpen, setRunEvidenceOpen] = useState(false);
  const [runEvidenceLoading, setRunEvidenceLoading] = useState(false);
  const runEvidenceController = useRef<AbortController | null>(null);
  const [trend, setTrend] = useState<Panel<PublicWorkflowTrend>>(emptyPanel);
  const [trendKey, setTrendKey] = useState<string | null>(null);
  const [trendOpen, setTrendOpen] = useState(false);
  const [trendLoading, setTrendLoading] = useState(false);
  const trendController = useRef<AbortController | null>(null);
  const [actionsReceivedAt, setActionsReceivedAt] = useState<string | null>(null);
  const [pullsReceivedAt, setPullsReceivedAt] = useState<string | null>(null);
  const loading = actionsLoading || pullsLoading;
  const [formError, setFormError] = useState('');
  const [shareStatus, setShareStatus] = useState('');
  const [shareFallback, setShareFallback] = useState('');
  const [diagnosticsCopyStatus, setDiagnosticsCopyStatus] = useState('');
  const [diagnosticsCopyFallback, setDiagnosticsCopyFallback] = useState('');
  const activeRepositoryRef = useRef<string | null>(null);
  // Invalidate delayed clipboard completions when either source is refreshed,
  // reselected or cleared. An old receipt must never reappear on a new repo.
  const copyEvidenceGeneration = useRef(0);
  const [workflowFilter, setWorkflowFilter] = useState<WorkflowFilter>('all');
  const [pullFilter, setPullFilter] = useState<PullFilter>('all');
  const [exportError, setExportError] = useState('');
  const [copyStatus, setCopyStatus] = useState<{ key: string; message: string; ok: boolean } | null>(null);
  const controllers = useRef<{ actions: AbortController | null; prs: AbortController | null }>({
    actions: null, prs: null,
  });
  const pullsSlowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshPanel = useCallback((kind: 'actions' | 'prs', repo: string) => {
    copyEvidenceGeneration.current++;
    setCopyStatus(null);
    setDiagnosticsCopyStatus('');
    setDiagnosticsCopyFallback('');
    if (kind === 'actions') {
      trendController.current?.abort();
      trendController.current = null;
      setTrend(emptyPanel());
      setTrendKey(null);
      setTrendOpen(false);
      setTrendLoading(false);
      runEvidenceController.current?.abort();
      runEvidenceController.current = null;
      setRunEvidence(emptyPanel());
      setRunEvidenceKey(null);
      setRunEvidenceOpen(false);
      setRunEvidenceLoading(false);
    }
    if (kind === 'prs') {
      prEvidenceController.current?.abort();
      prEvidenceController.current = null;
      setPrEvidence(emptyPanel());
      setPrEvidenceKey(null);
      setPrEvidenceOpen(false);
      setPrEvidenceLoading(false);
    }
    controllers.current[kind]?.abort();
    const next = new AbortController();
    controllers.current[kind] = next;
    const params = new URLSearchParams({ repository: repo }).toString();
    if (kind === 'actions') {
      setActionsLoading(true);
      setActions(emptyPanel());
      setActionsReceivedAt(null);
      void readPublicPanel<PublicActionsSummary>(`/api/public-actions?${params}`, next.signal,
        fetch, (data): data is PublicActionsSummary => isPublicActionsSample(data, repo))
        .then(result => {
          if (controllers.current.actions === next && !next.signal.aborted) {
            setActions(result);
            if (result.data) setActionsReceivedAt(new Date().toISOString());
          }
        })
        .finally(() => {
          if (controllers.current.actions === next && !next.signal.aborted) setActionsLoading(false);
        });
    } else {
      // An optional slow-load hint is tied to this request generation. Do not
      // carry a timer or stale waiting message over when switching repositories.
      if (pullsSlowTimer.current !== null) clearTimeout(pullsSlowTimer.current);
      setPullsSlow(false);
      setPullsLoading(true);
      setPulls(emptyPanel());
      setPullsReceivedAt(null);
      pullsSlowTimer.current = setTimeout(() => {
        if (controllers.current.prs === next && !next.signal.aborted) setPullsSlow(true);
      }, 2500);
      void readPublicPanel<PublicPullSummary>(`/api/public-prs?${params}`, next.signal,
        fetch, (data): data is PublicPullSummary => isPublicPullSample(data, repo))
        .then(result => {
          if (controllers.current.prs === next && !next.signal.aborted) {
            setPulls(result);
            if (result.data) setPullsReceivedAt(new Date().toISOString());
          }
        })
        .finally(() => {
          if (controllers.current.prs === next && !next.signal.aborted) {
            if (pullsSlowTimer.current !== null) clearTimeout(pullsSlowTimer.current);
            pullsSlowTimer.current = null;
            setPullsSlow(false);
            setPullsLoading(false);
          }
        });
    }
  }, []);

  const load = useCallback((repo: string) => {
    const trimmed = repo.trim();
    activeRepositoryRef.current = trimmed;
    setSelectedRepo(trimmed);
    setShareStatus('');
    setShareFallback('');
    setDiagnosticsCopyStatus('');
    setDiagnosticsCopyFallback('');
    setWorkflowFilter('all');
    setPullFilter('all');
    setExportError('');
    setCopyStatus(null);
    setActionsReceivedAt(null);
    setPullsReceivedAt(null);
    refreshPanel('actions', trimmed);
    refreshPanel('prs', trimmed);
  }, [refreshPanel]);

  const clearInvalidSelection = useCallback(() => {
    copyEvidenceGeneration.current++;
    controllers.current.actions?.abort();
    controllers.current.prs?.abort();
    prEvidenceController.current?.abort();
    prEvidenceController.current = null;
    runEvidenceController.current?.abort();
    runEvidenceController.current = null;
    trendController.current?.abort();
    trendController.current = null;
    setTrend(emptyPanel());
    setTrendKey(null);
    setTrendOpen(false);
    setTrendLoading(false);
    setRunEvidence(emptyPanel());
    setRunEvidenceKey(null);
    setRunEvidenceOpen(false);
    setRunEvidenceLoading(false);
    setPrEvidence(emptyPanel());
    setPrEvidenceKey(null);
    setPrEvidenceOpen(false);
    setPrEvidenceLoading(false);
    controllers.current = { actions: null, prs: null };
    if (pullsSlowTimer.current !== null) clearTimeout(pullsSlowTimer.current);
    pullsSlowTimer.current = null;
    activeRepositoryRef.current = null;
    setActions(emptyPanel());
    setPulls(emptyPanel());
    setActionsLoading(false);
    setPullsLoading(false);
    setPullsSlow(false);
    setActionsReceivedAt(null);
    setPullsReceivedAt(null);
    setWorkflowFilter('all');
    setPullFilter('all');
    setCopyStatus(null);
    setExportError('');
    setShareStatus('');
    setShareFallback('');
    setRepository('');
    setSelectedRepo('');
    setFormError('Invalid repository in shared link. Enter a public owner/repository to continue.');
  }, []);

  useEffect(() => {
    function syncLocation() {
      const selected = readRepositoryLink(window.location.search);
      // Scrub unrelated query parameters and fragments without a reload,
      // duplicate GitHub fetch or additional Upstash admission. An invalid
      // repo remains invalid in UI state even after its URL is sanitized.
      const canonicalUrl = canonicalRepositoryPageUrl(window.location.href, selected);
      if (canonicalUrl !== window.location.href) {
        window.history.replaceState(null, '', canonicalUrl);
      }
      if (selected.kind === 'invalid') {
        clearInvalidSelection();
        return;
      }
      const nextRepo = selected.kind === 'valid' ? selected.repository : DEFAULT_REPOSITORY;
      setRepository(nextRepo);
      setFormError('');
      setShareStatus('');
      setShareFallback('');
      // Browser Back/Forward over an unchanged selection must not consume
      // another Redis origin admission or duplicate any GitHub GET.
      if (activeRepositoryRef.current !== nextRepo) load(nextRepo);
    }
    syncLocation();
    window.addEventListener('popstate', syncLocation);
    return () => {
      window.removeEventListener('popstate', syncLocation);
      controllers.current.actions?.abort();
      controllers.current.prs?.abort();
      prEvidenceController.current?.abort();
      runEvidenceController.current?.abort();
      trendController.current?.abort();
      activeRepositoryRef.current = null;
      if (pullsSlowTimer.current !== null) clearTimeout(pullsSlowTimer.current);
    };
  }, [load, clearInvalidSelection]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    let nextRepo: string;
    try {
      nextRepo = normalizeRepositoryInput(repository);
      const shareUrl = buildRepositoryShareUrl(window.location.href, nextRepo);
      if (nextRepo !== activeRepositoryRef.current) {
        window.history.pushState(null, '', shareUrl);
        load(nextRepo);
      } else {
        // A second click on the same already-selected repository changes
        // only the shareable URL; per-panel Refresh remains user-initiated.
        window.history.replaceState(null, '', shareUrl);
      }
      setRepository(nextRepo);
      setFormError('');
      setShareStatus('');
      setShareFallback('');
    } catch {
      setFormError('Enter owner/repository or a public https://github.com/owner/repository URL.');
    }
  }

  async function copyDiagnostics() {
    // No fetch: only sanitized, already-received browser response receipts.
    const generation = copyEvidenceGeneration.current;
    const repositoryAtStart = activeRepositoryRef.current;
    const summary = formatPublicPanelDiagnosticReport(actions.receipt, pulls.receipt);
    const stillCurrent = () => copyEvidenceGeneration.current === generation &&
      activeRepositoryRef.current === repositoryAtStart;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(summary);
      if (!stillCurrent()) return;
      setDiagnosticsCopyStatus('Diagnostic summary copied. No API requests sent.');
      setDiagnosticsCopyFallback('');
    } catch {
      if (!stillCurrent()) return;
      setDiagnosticsCopyStatus('Clipboard unavailable. Select and copy the text below.');
      setDiagnosticsCopyFallback(summary);
    }
  }

  async function copyRepositoryLink() {
    if (!activeRepositoryRef.current) return;
    const generation = copyEvidenceGeneration.current;
    const repositoryAtStart = activeRepositoryRef.current;
    const url = buildRepositoryShareUrl(window.location.href, repositoryAtStart);
    const stillCurrent = () => copyEvidenceGeneration.current === generation &&
      activeRepositoryRef.current === repositoryAtStart;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(url);
      if (!stillCurrent()) return;
      setShareStatus('Repository link copied. It opens a fresh public sample, not saved results.');
      setShareFallback('');
    } catch {
      if (!stillCurrent()) return;
      setShareStatus('Clipboard unavailable. Select and copy the link below.');
      setShareFallback(url);
    }
  }

  const validRuns = actions.data?.inspected_runs ?? 0;
  const successRatio = validRuns ? Math.round((actions.data!.successful_runs / validRuns) * 100) : null;
  const runs = actions.data?.runs ?? [];
  const visibleRuns = filteredWorkflowRuns(actions.data, workflowFilter);
  const prList = pulls.data?.pull_requests ?? [];
  const visiblePulls = filteredPublicPulls(pulls.data, pullFilter);
  const recommendations = recommendInvestigations(actions.data, pulls.data);
  const riskPosture = assessRepositoryRiskPosture({
    repository: selectedRepo,
    actions: actions.data, pulls: pulls.data,
    actionsReceivedAt, prsReceivedAt: pullsReceivedAt,
    asOf: new Date(),
  });
  const canExport = !loading && Boolean(actions.data || pulls.data);

  function inspectUtcTrend() {
    // Seven-day history is never requested by initial load/filter/CSV or URL hydration.
    if (!selectedRepo || loading || trendLoading) return;
    const end = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const key = selectedRepo + ':' + end;
    if (trendKey === key && trend.data) {
      setTrendOpen(!trendOpen);
      return;
    }
    trendController.current?.abort();
    const controller = new AbortController();
    trendController.current = controller;
    setTrend(emptyPanel());
    setTrendKey(key);
    setTrendOpen(true);
    setTrendLoading(true);
    const query = new URLSearchParams({ repository: selectedRepo, end });
    void readPublicPanel<PublicWorkflowTrend>(
      '/api/public-workflow-trends?' + query,
      controller.signal, fetch,
      (data): data is PublicWorkflowTrend =>
        isPublicWorkflowTrend(data, selectedRepo, end),
    ).then(result => {
      if (trendController.current === controller && !controller.signal.aborted) {
        setTrend(result);
      }
    }).finally(() => {
      if (trendController.current === controller && !controller.signal.aborted) {
        setTrendLoading(false);
      }
    });
  }

  function inspectFailedRun(id: number) {
    // The job API is never called on initial load, filters, URL navigation or exports.
    if (loading || runEvidenceLoading || !actions.data ||
        !actions.data.runs.some(r => r.id === id && r.status === 'completed' &&
          isConfirmedWorkflowFailure(r.conclusion))) return;
    const key = selectedRepo + ':' + id;
    if (runEvidenceKey === key && runEvidence.data) {
      setRunEvidenceOpen(!runEvidenceOpen);
      return;
    }
    runEvidenceController.current?.abort();
    const controller = new AbortController();
    runEvidenceController.current = controller;
    setRunEvidence(emptyPanel());
    setRunEvidenceKey(key);
    setRunEvidenceOpen(true);
    setRunEvidenceLoading(true);
    const params = new URLSearchParams({ repository: selectedRepo, id: String(id) });
    void readPublicPanel<PublicRunEvidence>(
      '/api/public-workflow-evidence?' + params,
      controller.signal, fetch,
      (data): data is PublicRunEvidence => isPublicRunEvidence(data, selectedRepo, id),
    ).then(result => {
      if (runEvidenceController.current === controller && !controller.signal.aborted) {
        setRunEvidence(result);
      }
    }).finally(() => {
      if (runEvidenceController.current === controller && !controller.signal.aborted) {
        setRunEvidenceLoading(false);
      }
    });
  }

  function inspectPrVerification(number: number) {
    // PR detail GETs are NEVER triggered by initial load, filter, export, or URL hydration.
    if (loading || prEvidenceLoading || !pulls.data ||
        !pulls.data.pull_requests.some(pr => pr.number === number)) return;
    const key = selectedRepo + ':' + number;
    if (prEvidenceKey === key && prEvidence.data) {
      setPrEvidenceOpen(!prEvidenceOpen);
      return;
    }
    prEvidenceController.current?.abort();
    const controller = new AbortController();
    prEvidenceController.current = controller;
    setPrEvidenceKey(key);
    setPrEvidenceOpen(true);
    setPrEvidence(emptyPanel());
    setPrEvidenceLoading(true);
    const query = new URLSearchParams({ repository: selectedRepo, number: String(number) });
    void readPublicPanel<PublicPrVerification>(
      '/api/public-pr-verification?' + query.toString(),
      controller.signal, fetch,
      (data): data is PublicPrVerification => isPublicPrVerification(data, selectedRepo, number),
    ).then(result => {
      if (prEvidenceController.current === controller && !controller.signal.aborted) {
        setPrEvidence(result);
      }
    }).finally(() => {
      if (prEvidenceController.current === controller && !controller.signal.aborted) {
        setPrEvidenceLoading(false);
      }
    });
  }

  async function copyEvidenceLink(key: string, url: string) {
    const generation = copyEvidenceGeneration.current;
    const repositoryAtStart = activeRepositoryRef.current;
    const stillCurrent = () => copyEvidenceGeneration.current === generation &&
      activeRepositoryRef.current === repositoryAtStart;
    try {
      // Only canonical, source-validated GitHub URLs reach these controls.
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(url);
      if (!stillCurrent()) return;
      setCopyStatus({ key, ok: true, message: 'GitHub source link copied.' });
    } catch {
      if (!stillCurrent()) return;
      setCopyStatus({ key, ok: false, message: 'Clipboard unavailable. Use Review source to open the GitHub record.' });
    }
  }

  function downloadSample(format: 'csv' | 'json' | 'md' | 'queue') {
    setExportError('');
    if (!canExport) return;
    try {
      const input = {
        repository: selectedRepo,
        actions: actions.data,
        prs: pulls.data,
        actionsReceivedAt, prsReceivedAt: pullsReceivedAt,
        workflowFilter, pullFilter,
        exportedAt: new Date().toISOString(),
      };
      const snapshot = createPublicSampleExport(input);
      const handoff = format === 'queue' ? createInvestigationHandoff(input) : null;
      const serialized = format === 'csv'
        ? '\uFEFF' + serializePublicSampleCsv(snapshot)
        : format === 'md' ? createAuditBrief(snapshot)
          : format === 'queue' ? handoff!.markdown : JSON.stringify(snapshot, null, 2) + '\n';
      const file = new Blob([serialized], {
        type: format === 'csv' ? 'text/csv;charset=utf-8'
          : format === 'md' || format === 'queue'
            ? 'text/markdown;charset=utf-8' : 'application/json;charset=utf-8',
      });
      const blobUrl = URL.createObjectURL(file);
      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = format === 'md' ? createAuditBriefFilename(snapshot)
        : format === 'queue' ? handoff!.filename
          : createSampleFilename(snapshot.repository, snapshot.exported_at_utc, format);
      document.body.appendChild(anchor);
      try {
        anchor.click();
      } finally {
        anchor.remove();
        // Keep the object URL alive long enough for browsers to capture the download.
        window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      }
    } catch {
      setExportError('Export could not be prepared from verified source data. Try again after the panels load.');
    }
  }

  return (
    <main className="nexus-devops min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:py-14">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <Link href="/" aria-label="NEXUS Developer Intelligence home"
            className="nexus-devops-brand inline-flex items-center gap-3 text-white">
            <span className="nexus-devops-mark" aria-hidden="true">NX</span>
            <span className="nexus-devops-lockup">
              <span className="nexus-devops-company">NEXUS</span>
              <span className="nexus-devops-sublabel">DEVOPS INTELLIGENCE</span>
            </span>
          </Link>
          <a href="https://github.com/senanurcetin/nexus-devops-intelligence" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-[#4ea8ff]">
            Open-source code <ArrowUpRight className="h-4 w-4" />
          </a>
        </header>

        <div className="nexus-devops-hero mb-8 grid gap-8 lg:grid-cols-[1.5fr_1fr] lg:items-end">
          <div>
            <div className="nexus-devops-eyebrow mb-3">NEXUS / REPOSITORY OPERATIONS · 06</div>
            <div className="nexus-devops-hero-badge mb-4 inline-flex items-center gap-2 rounded-full border border-[#4ea8ff]/30 bg-[#4ea8ff]/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-[#4ea8ff]">
              <ShieldCheck className="h-4 w-4" /> Public API · Read-only preview
            </div>
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Engineering signals. <span className="text-[#4ea8ff]">Linked to evidence.</span>
            </h1>
            <p className="nexus-devops-hero-description mt-5 max-w-2xl text-base leading-7 text-slate-400">
              Inspect sampled GitHub workflow outcomes and reported PR merge states with direct source links.
              Read-only analysis: no workflow execution or repository writes.
            </p>
            <div className="nexus-devops-hero-facts" aria-label="Dashboard data boundaries">
              <span><span aria-hidden="true" className="nexus-devops-fact-dot" /> Public GitHub REST</span>
              <span>Maximum 10 runs / 5 PRs</span>
              <span>No account access required</span>
            </div>
          </div>
          <div className="nexus-devops-evidence-note rounded-2xl border border-slate-800 bg-slate-900/75 p-5 text-sm leading-6 text-slate-400">
            <div className="nexus-devops-note-title mb-2 flex items-center gap-2 font-semibold text-slate-200">
              <GitBranch className="h-4 w-4 text-[#4ea8ff]" /> Source coverage
            </div>
            <p className="nexus-devops-boundary-copy">
              Sampled results: up to 10 workflow runs and 5 open PRs. Merge states may be pending.
              No token, AI diagnosis, account-wide billing data or deployment claim.
            </p>
            <div className="nexus-devops-data-state" role="status" aria-live="polite"
              data-state={loading ? 'loading' : actions.error && pulls.error ? 'failed' : actions.error || pulls.error ? 'warning' : actions.data && pulls.data ? 'ready' : 'idle'}>
              <span className="nexus-devops-state-dot" aria-hidden="true" />
              {loading ? 'FETCHING PUBLIC GITHUB SAMPLES'
                : actions.error && pulls.error ? 'BOTH SOURCE PANELS UNAVAILABLE'
                : actions.error || pulls.error ? 'PARTIAL DATA · REVIEW PANEL ERRORS'
                : actions.data && pulls.data ? 'BOTH SOURCE PANELS LOADED'
                : 'AWAITING SOURCE RESPONSES'}
            </div>
            {(actions.error || pulls.error) && !loading && (
              <button type="button" onClick={() => {
                // Retry only the failed sources: preserve verified sibling data
                // and avoid needless anonymous GitHub / Redis usage.
                if (actions.error) refreshPanel('actions', selectedRepo);
                if (pulls.error) refreshPanel('prs', selectedRepo);
              }}
                className="nexus-devops-retry"
                aria-label={actions.error && pulls.error ? 'Retry both GitHub source panels'
                  : actions.error ? 'Retry GitHub Actions source panel'
                    : 'Retry GitHub PR source panel'}>
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                {actions.error && pulls.error ? 'Retry public data'
                  : actions.error ? 'Retry Actions data' : 'Retry PR data'}
              </button>
            )}
            <div className="nexus-devops-receipts" aria-label="Last successful source responses">
              <p className="nexus-devops-receipts-heading">Source responses · browser local time</p>
              <p className="nexus-devops-received-at">
                Actions: {actionsReceivedAt ? new Date(actionsReceivedAt).toLocaleTimeString() :
                  actionsLoading ? 'loading' : 'no verified response for this selection'}
              </p>
              <p className="nexus-devops-received-at">
                PRs: {pullsReceivedAt ? new Date(pullsReceivedAt).toLocaleTimeString() :
                  pullsLoading ? 'loading' : 'no verified response for this selection'}
              </p>
            </div>
            <details className="nexus-devops-diagnostics mt-3 rounded-lg border border-[#365b81] px-3 py-2 text-xs text-slate-300">
              <summary className="cursor-pointer font-semibold text-[#8fc7ff]">
                Request diagnostics · no new requests
              </summary>
              <p className="mt-2 text-slate-400">
                Values below come only from responses already received in this browser.
                CDN MISS/BYPASS or shared-redis mode does not prove independent
                serverless instances or SSO enforcement.
              </p>
              <dl className="mt-2 grid gap-2">
                {([
                  ['Actions', actions.receipt],
                  ['PRs', pulls.receipt],
                ] as const).map(([label, receipt]) => (
                  <div key={label} className="min-w-0 border-t border-[#365b81] pt-2">
                    <dt className="font-semibold text-slate-200">{label}</dt>
                    <dd className="mt-1 break-words text-slate-300">
                      {receipt ?
                        `HTTP ${receipt.status} · CDN ${receipt.cache} · admission ${receipt.admission} · limit source ${receipt.limitSource}` :
                        'No HTTP response observed for this selection'}
                    </dd>
                  </div>
                ))}
              </dl>
              <button type="button" onClick={copyDiagnostics}
                disabled={!actions.receipt && !pulls.receipt}
                className="mt-3 inline-flex min-h-10 items-center rounded-lg border border-[#477caf] bg-[#102947] px-3 py-2 font-semibold text-[#b9ddff] hover:bg-[#17395e] disabled:cursor-not-allowed disabled:opacity-50">
                Copy safe diagnostics · no API requests
              </button>
              {diagnosticsCopyStatus && (
                <p role="status" className="mt-2 text-slate-200">
                  {diagnosticsCopyStatus}
                </p>
              )}
              {diagnosticsCopyFallback && (
                <textarea readOnly rows={6}
                  aria-label="Safe diagnostics to select and copy"
                  className="mt-2 w-full rounded-lg border border-[#477caf] bg-[#091a2e] p-2 text-xs text-slate-200"
                  value={diagnosticsCopyFallback} />
              )}
            </details>
          </div>
        </div>

        <section aria-label="Repository search" className="nexus-devops-search rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
          <form onSubmit={onSubmit} aria-busy={loading} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex-1 text-sm font-medium text-slate-300">
              Public GitHub repository
              <input value={repository} onChange={event => { setRepository(event.target.value); setFormError(''); setShareStatus(''); setShareFallback(''); }}
                maxLength={240} required autoComplete="off" placeholder="owner/repository or https://github.com/owner/repository"
                aria-invalid={Boolean(formError)} aria-describedby={formError ? 'repository-error' : 'repository-hint'}
                className="mt-2 block w-full rounded-xl border border-[#365b81] bg-[#071829] px-4 py-3 text-base text-slate-100 outline-none focus:border-[#4ea8ff] focus:ring-2 focus:ring-[#4ea8ff]/20" />
            </label>
            <button type="submit"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#4ea8ff] px-6 py-3 text-sm font-semibold text-[#071829] hover:bg-[#90ccff] disabled:opacity-50">
              <RefreshCw className={'h-4 w-4 ' + (loading ? 'animate-spin' : '')} />
              {loading ? 'Analyzing…' : 'Analyze repository'}
            </button>
          </form>
          {formError ? <p id="repository-error" className="mt-3 text-sm text-rose-300" role="alert">{formError}</p>
            : <p id="repository-hint" className="mt-3 text-xs text-slate-400">Use owner/repository or paste a public GitHub repository URL; no tokens or subpage links.</p>}
          <p className="mt-3 text-xs text-slate-400" aria-live="polite">
            {loading ? 'Reading public GitHub REST API records…' : selectedRepo ? `Selected: ${selectedRepo}` : 'No repository selected.'}
          </p>
          <div className="nexus-devops-share mt-4 flex flex-wrap items-center gap-3 border-t border-slate-700/60 pt-4">
            <button type="button" disabled={!selectedRepo} onClick={() => { void copyRepositoryLink(); }}
              className="nexus-devops-share-button inline-flex min-h-10 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold">
              <Copy aria-hidden="true" className="h-4 w-4" /> Copy repository link
            </button>
            <p className="min-w-0 flex-1 text-xs leading-5 text-slate-400">
              Share only this public repository selection. Opening a link starts a new sample, not a saved report.
            </p>
          </div>
          {shareStatus && <p role="status" aria-live="polite" className="mt-2 text-xs text-[#aedbff]">{shareStatus}</p>}
          {shareFallback && <input aria-label="Shareable repository link" readOnly
            value={shareFallback} onFocus={event => event.currentTarget.select()}
            className="mt-2 block w-full min-w-0 rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-xs text-slate-200" />}
        </section>

        <nav className="nexus-devops-command-nav" aria-label="Dashboard sections">
          <span className="nexus-devops-command-nav-caption">JUMP TO</span>
          <a href="#overview" className="nexus-devops-command-link"><span aria-hidden="true">01</span> Overview</a>
          <a href="#intelligence" className="nexus-devops-command-link"><span aria-hidden="true">02</span> Intelligence</a>
          <a href="#investigations" className="nexus-devops-command-link"><span aria-hidden="true">03</span> Investigations</a>
          <a href="#evidence" className="nexus-devops-command-link"><span aria-hidden="true">04</span> Source records</a>
          <span className="nexus-devops-command-current" title={selectedRepo}>Selected / {selectedRepo}</span>
        </nav>

        <div id="overview" className="nexus-devops-section mb-3 mt-7">01 / Public repository metrics</div>
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Sample statistics">
          <Card index={1} label="Workflow runs inspected" value={actions.data?.inspected_runs ?? (actionsLoading ? '…' : '—')}
            detail="Up to ten most recent runs" />
          <Card index={2} label="Successful in sample" value={successRatio === null ? '—' : `${successRatio}%`}
            detail={validRuns ? `${actions.data!.successful_runs} of ${validRuns} inspected runs` : 'No verified workflow sample'} />
          <Card index={3} label="Open PRs inspected" value={pulls.data?.inspected_prs ?? (pullsLoading ? '…' : '—')}
            detail={pulls.data?.more_open_prs ? 'More open PRs exist beyond this sample' : 'Up to five open PRs'} />
          <Card index={4} label="PRs needing inspection" value={pulls.data?.needs_attention ?? (pullsLoading ? '…' : '—')}
            detail={pulls.data ? `${pulls.data.conflicts} confirmed conflict(s); ${pulls.data.unknown} unknown status(es)` : 'Only GitHub-reported states'}
            tone={Boolean(pulls.data?.needs_attention) ? 'warning' : 'default'} />
        </section>

        <section className="nexus-devops-export mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl p-4 sm:p-5"
          aria-label="Export verified public sample">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-widest text-[#8cc9ff]">READ-ONLY / CLIENT EXPORT</p>
            <h2 className="mt-1 text-base font-semibold text-slate-100">Export inspected sample</h2>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-300">
              Downloads only currently visible, filtered records from verified source panels.
              Includes repository, UTC receipt time, sample limits and applied filters.
              The Markdown audit brief adds bounded source-linked investigation notes, not a release decision.
              No new GitHub or Redis request. This is not a repository-wide report.
            </p>
            {!canExport && <p className="mt-2 text-xs text-slate-400" role="status">
              {loading ? 'Wait for the source panels to finish loading.' : 'No verified sample available to export.'}
            </p>}
            {exportError && <p className="mt-2 text-xs text-rose-300" role="alert">{exportError}</p>}
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <button type="button" onClick={() => downloadSample('csv')} disabled={!canExport}
              className="nexus-devops-export-button inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold sm:flex-none">
              <Download aria-hidden="true" className="h-4 w-4" /> Export CSV
            </button>
            <button type="button" onClick={() => downloadSample('json')} disabled={!canExport}
              className="nexus-devops-export-button inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold sm:flex-none">
              <Download aria-hidden="true" className="h-4 w-4" /> Export JSON
            </button>
            <button type="button" onClick={() => downloadSample('md')} disabled={!canExport}
              className="nexus-devops-export-button inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold sm:flex-none">
              <Download aria-hidden="true" className="h-4 w-4" /> Audit Brief (.md)
            </button>
          </div>
        </section>

        <section aria-label="Optional complete seven-day UTC workflow trend"
          className="nexus-devops-trend mb-6 rounded-2xl p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="nexus-devops-insights-kicker">ON-DEMAND / GITHUB ACTIONS / UTC</p>
              <h2 className="mt-2 text-lg font-semibold text-white">Seven completed days · workflow volume</h2>
              <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-300">
                A single additional public GitHub request only when selected. Daily counts use
                creation dates and currently reported outcomes; they do not establish historical
                pass rates. If GitHub returns a partial window, no trend chart is shown.
              </p>
            </div>
            <button type="button" onClick={inspectUtcTrend} disabled={!selectedRepo || loading || trendLoading}
              aria-expanded={trendOpen}
              className="nexus-devops-trend-button inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold">
              <Activity aria-hidden="true" className="h-4 w-4" />
              {trendOpen && trend.data ? 'Hide 7-day UTC trend' : trendLoading ? 'Loading UTC trend…' : 'Load 7-day UTC trend'}
            </button>
          </div>
          {trendOpen && (
            <div className="mt-5 border-t border-slate-700/60 pt-5">
              {trendLoading && <p role="status" className="text-xs text-slate-300">
                Checking one GitHub date-filtered page for complete UTC coverage…
              </p>}
              {trend.error && <p role="alert" className="text-xs text-rose-300">
                {trend.error} No daily trend is shown.
              </p>}
              {trend.data && (
                <div>
                  <p className="text-xs font-semibold text-[#a6d3fa]">
                    {trend.data.start_utc} through {trend.data.end_utc} UTC ·
                    {trend.data.inspected_runs} of {trend.data.total_matching_runs} returned ·
                    {trend.data.coverage === 'complete' ? 'Complete returned window' : 'Incomplete coverage'}
                  </p>
                  {trend.data.coverage === 'complete' ? (
                    <div className="nexus-devops-trend-scroll mt-4 overflow-x-auto" role="region" tabIndex={0}
                      aria-label="Seven-day UTC workflow count table, scroll horizontally if needed">
                      <table className="nexus-devops-trend-table w-full min-w-[680px] text-left text-xs">
                        <caption className="sr-only">
                          Seven UTC creation days with currently reported successful, failed, pending and other workflow counts
                        </caption>
                        <thead><tr>
                          <th scope="col">UTC day</th><th scope="col">Daily volume</th>
                          <th scope="col">Success</th><th scope="col">Failed</th>
                          <th scope="col">Pending</th><th scope="col">Other</th>
                        </tr></thead>
                        <tbody>
                          {trend.data.days.map(day => {
                            const maxVolume = Math.max(1, ...trend.data!.days.map(d => d.total));
                            return (
                              <tr key={day.day_utc}>
                                <th scope="row" className="font-medium">{day.day_utc.slice(5)}</th>
                                <td>
                                  <div className="flex items-center gap-2">
                                    <span className="nexus-devops-trend-total tabular-nums">{day.total}</span>
                                    <div className="nexus-devops-trend-track" aria-hidden="true">
                                      {(['success','failed','pending','other'] as const).map(state => day[state] ? (
                                        <span key={state}
                                          className={'nexus-devops-outcome-fill--' + state}
                                          style={{ width: (100 * day[state] / maxVolume) + '%' }} />
                                      ) : null)}
                                    </div>
                                  </div>
                                </td>
                                <td className="tabular-nums">{day.success}</td>
                                <td className="tabular-nums">{day.failed}</td>
                                <td className="tabular-nums">{day.pending}</td>
                                <td className="tabular-nums">{day.other}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : <p role="status" className="mt-4 text-sm font-medium text-amber-200">
                    Only part of this seven-day window was returned. No chart or inferred
                    daily success rate is displayed.
                  </p>}
                  <p className="mt-4 text-xs leading-5 text-slate-400">{trend.data.scope_note}</p>
                </div>
              )}
            </div>
          )}
        </section>

        <div id="intelligence" className="nexus-devops-section mb-3 mt-9">02 / Source intelligence / sampled</div>
        <div className="nexus-devops-intelligence-grid">
          <section className="nexus-devops-insights rounded-2xl p-5 sm:p-6" aria-labelledby="workflow-insights-title">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="nexus-devops-insights-kicker">GITHUB ACTIONS / SAMPLE EVIDENCE</p>
              <h2 id="workflow-insights-title" className="mt-2 text-xl font-semibold tracking-tight text-white">
                Workflow outcome composition
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                Only the most recent {actions.data?.inspected_runs ?? 'up to 10'} runs returned by GitHub.
                This is a sampled distribution, not a historical trend or reliability score.
              </p>
            </div>
            <span className="nexus-devops-sample-tag">
              {actions.data ? actions.data.inspected_runs + ' / 10 sampled' : actionsLoading ? 'Loading sample' : 'Sample unavailable'}
            </span>
          </div>
          {actions.data && actions.data.inspected_runs > 0 ? (
            <div className="nexus-devops-insight-body mt-6 grid gap-6">
              <div className="min-w-0">
                <div className="mb-3 flex items-end justify-between gap-3">
                  <p className="nexus-devops-chart-caption text-xs font-semibold uppercase tracking-wider text-slate-300">Outcome distribution</p>
                  <p className="text-xs tabular-nums text-slate-400">{actions.data.inspected_runs} inspected</p>
                </div>
                <div className="nexus-devops-outcome-bar" role="img"
                  aria-label={workflowOutcomes.map(outcome =>
                    outcome.label + ': ' + workflowOutcomeCount(actions.data!, outcome.key)).join(', ') + ' in the sampled workflow runs'}>
                  {workflowOutcomes.map(outcome => {
                    const count = workflowOutcomeCount(actions.data!, outcome.key);
                    return count ? <span key={outcome.key}
                      className={'nexus-devops-outcome-fill nexus-devops-outcome-fill--' + outcome.key}
                      style={{ width: (100 * count / actions.data!.inspected_runs) + '%' }}
                      aria-hidden="true" /> : null;
                  })}
                </div>
                <div className="nexus-devops-composition-grid mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
                  {workflowOutcomes.map(outcome => (
                    <div key={outcome.key} className="nexus-devops-composition-item min-w-0">
                      <p className="flex items-center gap-2 text-xs text-slate-300">
                        <span aria-hidden="true" className={'nexus-devops-outcome-dot nexus-devops-outcome-fill--' + outcome.key} />
                        {outcome.shortLabel}
                      </p>
                      <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
                        {workflowOutcomeCount(actions.data!, outcome.key)}
                        <span className="ml-2 text-xs font-normal text-slate-400">
                          {Math.round(100 * workflowOutcomeCount(actions.data!, outcome.key) / actions.data!.inspected_runs)}%
                        </span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="nexus-devops-run-sequence min-w-0">
                <div className="flex items-end justify-between gap-3">
                  <p className="nexus-devops-chart-caption text-xs font-semibold uppercase tracking-wider text-slate-300">Recent run sequence</p>
                  <p className="text-xs text-slate-400">Latest listed → older</p>
                </div>
                <ol className="mt-4 grid grid-cols-5 gap-2 sm:grid-cols-10 lg:grid-cols-5 xl:grid-cols-10"
                  aria-label="Recently listed workflow runs in GitHub API order">
                  {runs.map((run, index) => (
                    <li key={run.id}>
                      <a href={run.html_url} target="_blank" rel="noopener noreferrer"
                        className={'nexus-devops-run-tick nexus-devops-run-tick--' + workflowOutcome(run)}
                        aria-label={'Open sampled run ' + (index + 1) + ': ' + run.name + ', ' +
                          workflowOutcome(run) + ', ' + run.created_at.slice(0, 10)}
                        title={'Run #' + run.id + ': ' + workflowOutcome(run)}>
                        <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                      </a>
                    </li>
                  ))}
                </ol>
                <p className="mt-4 text-xs leading-5 text-slate-400">
                  Each numbered tile opens GitHub evidence. Positions indicate listing order,
                  not equally spaced time intervals. Pending and cancelled runs are not counted as failures.
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-5 rounded-xl border border-slate-700/70 bg-slate-950/40 px-4 py-4 text-sm text-slate-300">
              {actionsLoading ? 'Loading the GitHub workflow sample…'
                : actions.error ? 'Workflow evidence is unavailable. Review the Actions panel error and retry.'
                  : actions.data ? 'No workflow runs were returned in this sample. No percentages or trend are inferred.'
                    : 'Awaiting a verified GitHub Actions response. No sample analysis is displayed yet.'}
            </p>
          )}
        </section>

        <section className="nexus-devops-pr-insights rounded-2xl p-5 sm:p-6" aria-labelledby="pr-insights-title">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="nexus-devops-insights-kicker">GITHUB PULL REQUESTS / MERGE-STATE EVIDENCE</p>
              <h2 id="pr-insights-title" className="mt-2 text-xl font-semibold tracking-tight text-white">
                Open PR review landscape
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                A breakdown of up to five recently listed open PRs. GitHub-reported merge states
                are not approvals, verified CI outcomes or a prediction of merge safety.
              </p>
            </div>
            <span className="nexus-devops-sample-tag">
              {pulls.data ? pulls.data.inspected_prs + ' / 5 inspected' : pullsLoading ? 'Loading PR sample' : 'Sample unavailable'}
            </span>
          </div>
          {pulls.data && pulls.data.inspected_prs > 0 ? (
            <div className="nexus-devops-insight-body mt-6 grid gap-6">
              <div className="min-w-0">
                <div className="mb-3 flex items-end justify-between gap-2">
                  <p className="nexus-devops-chart-caption text-xs font-semibold uppercase tracking-wider text-slate-300">Merge-state composition</p>
                  <p className="text-xs tabular-nums text-slate-400">{pulls.data.inspected_prs} inspected</p>
                </div>
                <div className="nexus-devops-pr-bar" role="img"
                  aria-label={pullBuckets.map(bucket =>
                    bucket.label + ': ' + pullBucketCount(pulls.data!, bucket.key)).join(', ') + ' in the inspected PR sample'}>
                  {pullBuckets.map(bucket => {
                    const count = pullBucketCount(pulls.data!, bucket.key);
                    return count ? <span key={bucket.key}
                      className={'nexus-devops-pr-fill nexus-devops-pr-fill--' + bucket.key}
                      style={{ width: (100 * count / pulls.data!.inspected_prs) + '%' }}
                      aria-hidden="true" /> : null;
                  })}
                </div>
                <div className="nexus-devops-composition-grid mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {pullBuckets.map(bucket => (
                    <div key={bucket.key} className="nexus-devops-composition-item min-w-0">
                      <p className="flex items-center gap-2 text-xs text-slate-300">
                        <span aria-hidden="true" className={'nexus-devops-pr-dot nexus-devops-pr-fill--' + bucket.key} />
                        {bucket.shortLabel}
                      </p>
                      <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
                        {pullBucketCount(pulls.data!, bucket.key)}
                        <span className="ml-2 text-xs font-normal text-slate-400">
                          {Math.round(100 * pullBucketCount(pulls.data!, bucket.key) / pulls.data!.inspected_prs)}%
                        </span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="nexus-devops-pr-sequence min-w-0">
                <div className="flex items-end justify-between gap-3">
                  <p className="nexus-devops-chart-caption text-xs font-semibold uppercase tracking-wider text-slate-300">Recently listed PRs</p>
                  <p className="text-xs text-slate-400">API order</p>
                </div>
                <ol className="mt-4 grid grid-cols-5 gap-2" aria-label="Open pull requests in GitHub API listing order">
                  {prList.map(pr => (
                    <li key={pr.number}>
                      <a href={pr.html_url} target="_blank" rel="noopener noreferrer"
                        className={'nexus-devops-pr-tick nexus-devops-pr-tick--' + pullBucket(pr)}
                        aria-label={'Open PR #' + pr.number + ': ' + attentionMeta[pr.attention].label}
                        title={'PR #' + pr.number + ': ' + attentionMeta[pr.attention].label}>
                        <span aria-hidden="true">{'#' + pr.number}</span>
                      </a>
                    </li>
                  ))}
                </ol>
                <p className="mt-4 text-xs leading-5 text-slate-400">
                  Restrictions group blocked, behind and unstable states. Unknown remains
                  unverified; clean does not imply merge approval. Tiles open the source PR.
                </p>
                {pulls.data.more_open_prs && <p className="mt-2 text-xs font-semibold text-amber-200">
                  More open PRs exist beyond this five-item sample.
                </p>}
              </div>
            </div>
          ) : (
            <p className="mt-5 rounded-xl border border-slate-700/70 bg-slate-950/40 px-4 py-4 text-sm text-slate-300">
              {pullsLoading ? 'Loading GitHub merge-state evidence…'
                : pulls.error ? 'PR evidence is unavailable. Review the PR panel error and retry.'
                  : pulls.data ? 'No open PRs in this sample; no percentages or merge conclusions are inferred.'
                    : 'Awaiting a verified GitHub PR sample. No merge-state summary is displayed yet.'}
            </p>
          )}
        </section>
        </div>

        <div className="nexus-devops-section mb-3 mt-9">03 / Investigation queue / sampled only</div>
        <section id="investigations" className="nexus-devops-investigations rounded-2xl border border-slate-800 bg-slate-900/70 p-5 sm:p-6" aria-labelledby="next-title">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 id="next-title" className="flex items-center gap-2 text-base font-semibold">
                {recommendations.some(r => r.severity === 'high') ?
                  <TriangleAlert className="h-5 w-5 text-amber-300" /> :
                  <CheckCircle2 className="h-5 w-5 text-[#4ea8ff]" />}
                Suggested investigations
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                Prioritized from the displayed GitHub sample only; these are not AI diagnoses or permission to merge.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => downloadSample('queue')} disabled={!canExport}
                aria-label="Download source-linked investigation handoff Markdown"
                className="nexus-devops-export-button inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold">
                <Download aria-hidden="true" className="h-4 w-4" /> Investigation Handoff (.md)
              </button>
              <a href="https://docs.github.com/en/rest/actions/workflow-runs"
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium text-[#4ea8ff] hover:text-white">
                GitHub API docs <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
          <div aria-label="Bounded evidence risk assessment"
            data-risk-posture={riskPosture.state}
            className="mt-5 rounded-xl border border-slate-700/70 bg-slate-950/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#a6d3fa]">Source-backed posture · not a risk score</p>
            <p className="mt-2 text-sm font-semibold text-slate-100">{riskPosture.headline}</p>
            <div className="mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-2">
              <p>Actions: {riskPosture.workflow.freshness} · {riskPosture.workflow.inspected} inspected · {riskPosture.workflow.failed} failed
                {riskPosture.workflow.truncated ? ' · additional runs uninspected' : ''}</p>
              <p>PRs: {riskPosture.pullRequests.freshness} · {riskPosture.pullRequests.inspected} inspected · {riskPosture.pullRequests.conflicts} conflicts
                {riskPosture.pullRequests.reviewStates + riskPosture.pullRequests.unknown > 0
                  ? ' · ' + (riskPosture.pullRequests.reviewStates + riskPosture.pullRequests.unknown) + ' need review'
                  : ''}
              </p>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              {riskPosture.evidenceLimitations.join(' · ')}. An unobserved issue is never proof that CI or a PR is safe.
            </p>
          </div>
          {recommendations.length > 0 ? (
            <ol className="nexus-devops-queue mt-5 grid gap-3 lg:grid-cols-2">
              {recommendations.map(item => (
                <li key={item.key} className="nexus-devops-queue-item flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-4"
                  data-severity={item.severity}>
                  <div className="min-w-0 flex-1">
                    <div className="nexus-devops-queue-meta flex flex-wrap items-center gap-2">
                      <span className="nexus-devops-queue-severity">{item.severity} / triage</span>
                      <span className="nexus-devops-queue-source">{item.sourceLabel} · GitHub REST</span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-100">{item.title}</p>
                    <p className="mt-2 text-xs font-semibold text-[#a6d3fa]">{item.reportedSignal}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-300">{item.explanation}</p>
                    <p className="mt-2 text-xs leading-5 text-slate-400"><strong className="text-slate-300">Why prioritized:</strong> {item.severityReason}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-400"><strong className="text-slate-300">Verify next:</strong> {item.nextStep}</p>
                    {copyStatus?.key === item.key &&
                      <p className={'mt-2 text-xs ' + (copyStatus.ok ? 'text-emerald-300' : 'text-amber-300')}
                        role="status" aria-live="polite">{copyStatus.message}</p>}
                  </div>
                  <div className="nexus-devops-queue-actions flex flex-wrap items-center gap-2">
                    <a href={item.url} target="_blank" rel="noopener noreferrer"
                      aria-label={'Review ' + item.sourceLabel + ' on GitHub'}
                      className="nexus-devops-queue-action inline-flex min-h-10 items-center gap-1 text-xs font-medium text-[#4ea8ff] hover:text-[#cee8ff]">
                      Review source <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
                    </a>
                    <button type="button" onClick={() => { void copyEvidenceLink(item.key, item.url); }}
                      aria-label={'Copy GitHub link for ' + item.sourceLabel}
                      className="nexus-devops-queue-action inline-flex min-h-10 items-center gap-1 text-xs font-medium text-[#b5dfff] hover:text-white">
                      {copyStatus?.key === item.key && copyStatus.ok ?
                        <Check aria-hidden="true" className="h-4 w-4" /> :
                        <Copy aria-hidden="true" className="h-4 w-4" />}
                      Copy link
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-5 text-sm leading-6 text-slate-400">
              {actions.data && pulls.data ?
                'No confirmed failures or merge blockers in these samples. Other runs, checks and PRs may require attention.' :
                'Not enough verified API data to make a recommendation. Check the source panels for errors.'}
            </p>
          )}
          <p className="mt-4 text-xs text-slate-400">No repository changes are made by this preview.</p>
        </section>


        <div id="evidence" className="nexus-devops-section mb-3 mt-9">04 / GitHub source records / original evidence</div>
        <div className="grid gap-6 lg:grid-cols-2">
          <section aria-labelledby="workflow-title" aria-busy={actionsLoading} className="nexus-devops-evidence min-w-0 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/75">
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 p-5">
              <div>
                <h2 id="workflow-title" className="flex items-center gap-2 text-lg font-semibold">
                  <Activity className="h-5 w-5 text-[#4ea8ff]" /> GitHub Actions
                </h2>
                <p className="mt-1 text-xs text-slate-400">Recent runs · GitHub REST API</p>
              </div>
              <div className="nexus-devops-evidence-controls flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => refreshPanel('actions', selectedRepo)}
                  disabled={actionsLoading} aria-label="Refresh GitHub Actions" title="Refresh GitHub Actions"
                  className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-slate-700 text-slate-300 hover:border-[#4ea8ff] hover:text-[#4ea8ff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4ea8ff] disabled:cursor-wait disabled:opacity-50">
                  <RefreshCw aria-hidden="true" className={'h-4 w-4 ' + (actionsLoading ? 'animate-spin' : '')} />
                </button>
                <a href={`https://github.com/${selectedRepo}/actions`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-[#4ea8ff] hover:text-white">
                  History <ArrowUpRight className="h-4 w-4" />
                </a>
              </div>
            </div>
            <span role="status" className="sr-only">{actions.data ? `Loaded ${actions.data.inspected_runs} workflow runs.` : actionsLoading ? 'Loading workflow history.' : ''}</span>
            {actions.error && <p className="m-5 flex gap-2 rounded-xl bg-rose-950/30 p-4 text-sm text-rose-300" role="alert">
              <AlertCircle className="h-4 w-4 shrink-0" />{actions.error}</p>}
            {actions.data && actions.data.inspected_runs > 0 && (
              <div className="border-b border-slate-800 px-5 pb-4 pt-4">
                <div role="group" aria-label="Filter sampled workflow runs" className="flex flex-wrap gap-2">
                  {(['all', ...workflowOutcomes.map(outcome => outcome.key)] as WorkflowFilter[]).map(filter => (
                    <button key={filter} type="button" onClick={() => setWorkflowFilter(filter)}
                      aria-pressed={workflowFilter === filter}
                      className="nexus-devops-filter">
                      {filter === 'all' ? 'All' : workflowOutcomes.find(outcome => outcome.key === filter)!.shortLabel}
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-xs tabular-nums text-slate-400" role="status" aria-live="polite">
                  Showing {visibleRuns.length} of {actions.data.inspected_runs} sampled runs
                  {workflowFilter === 'all' ? '' : ' · Filter: ' + workflowFilter}.
                  No additional GitHub requests.
                </p>
              </div>
            )}
            <ul className="divide-y divide-slate-800/80">
              {visibleRuns.map(run => (
                <li key={run.id} className="nexus-devops-event min-w-0 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="nexus-devops-source-title text-sm font-medium text-slate-200">{run.name}</p>
                      <p className="mt-1 text-xs text-slate-400">{run.event} · {run.created_at.slice(0, 10)} · #{run.id}</p>
                    </div>
                    <div className="nexus-devops-run-actions ml-auto flex flex-wrap items-center gap-3">
                      <span className={'text-xs nexus-devops-outcome-text--' + workflowOutcome(run)}>
                        {run.conclusion ?? run.status}
                      </span>
                      <a href={run.html_url} target="_blank" rel="noopener noreferrer"
                        aria-label={`View GitHub Actions run ${run.id}`} className="text-slate-400 hover:text-[#4ea8ff]">
                        <ArrowUpRight className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                  {run.status === 'completed' && isConfirmedWorkflowFailure(run.conclusion) && (
                    <div className="mt-3 border-t border-slate-700/50 pt-3">
                      <button type="button" disabled={actionsLoading || runEvidenceLoading}
                        onClick={() => inspectFailedRun(run.id)}
                        aria-expanded={runEvidenceOpen && runEvidenceKey === selectedRepo + ':' + run.id}
                        className="nexus-devops-run-inspect inline-flex min-h-10 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold">
                        <ShieldCheck aria-hidden="true" className="h-4 w-4" />
                        {runEvidenceOpen && runEvidenceKey === selectedRepo + ':' + run.id && runEvidence.data
                          ? 'Hide job & step evidence' : 'Inspect job & step evidence'}
                      </button>
                      <p className="mt-2 text-xs leading-5 text-slate-400">
                        On demand only: at most 2 public GitHub GETs and one NEXUS origin rate-limit decision. No logs are downloaded.
                      </p>
                    </div>
                  )}
                  {runEvidenceOpen && runEvidenceKey === selectedRepo + ':' + run.id && (
                    <div className="nexus-devops-run-details mt-3 rounded-xl p-4"
                      role="region" aria-label={'Workflow job evidence for run #' + run.id}>
                      {runEvidenceLoading && <p role="status" className="text-xs text-slate-300">
                        Checking the latest public run attempt and its sampled jobs…
                      </p>}
                      {runEvidence.error && <p role="alert" className="text-xs text-rose-300">
                        {runEvidence.error}{' '}
                        <a href={run.html_url} target="_blank" rel="noopener noreferrer"
                          className="underline">Verify the run directly on GitHub</a>.
                      </p>}
                      {runEvidence.data && (
                        <div className="space-y-3">
                          <p className="text-xs leading-5 text-slate-300">
                            Attempt {runEvidence.data.run_attempt} · commit{' '}
                            <code className="font-mono text-[#a6d3fa]">{runEvidence.data.head_sha.slice(0, 12)}</code>
                            {' '}· {runEvidence.data.inspected_jobs} of {runEvidence.data.total_jobs} jobs sampled.
                          </p>
                          {runEvidence.data.jobs.length ? (
                            <ul className="space-y-3">
                              {runEvidence.data.jobs.map(job => (
                                <li key={job.id} className="rounded-lg border border-slate-700/70 p-3">
                                  <p className="nexus-devops-source-title text-xs font-semibold text-slate-100">
                                    {job.name} · {job.conclusion ?? job.status}
                                  </p>
                                  {job.steps.length > 0 && (
                                    <ol className="mt-2 space-y-1">
                                      {job.steps.map(step => (
                                        <li key={step.number} className="nexus-devops-source-title text-xs text-slate-300">
                                          {step.number}. {step.name} · {step.conclusion ?? step.status}
                                        </li>
                                      ))}
                                    </ol>
                                  )}
                                  {job.additional_steps_not_shown && <p className="mt-2 text-xs text-amber-200">
                                    Additional steps are not shown; review the GitHub run.
                                  </p>}
                                </li>
                              ))}
                            </ul>
                          ) : <p className="text-xs text-slate-400">
                            No jobs returned in this sample. This is not evidence that a workflow passed.
                          </p>}
                          <p className="text-xs leading-5 text-slate-400">{runEvidence.data.scope_note}</p>
                          <a href={run.html_url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex min-h-10 items-center text-xs font-semibold text-[#a6d3fa] hover:underline">
                            Review logs on GitHub <ArrowUpRight aria-hidden="true" className="ml-1 h-4 w-4" />
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {actions.data && runs.length === 0 && <p className="p-5 text-sm text-slate-400">No workflow runs in this sample.</p>}
            {actions.data && runs.length > 0 && visibleRuns.length === 0 &&
              <p className="p-5 text-sm text-slate-400">No {workflowFilter} runs in the inspected sample. Other GitHub history was not checked.</p>}
            {!actions.data && !actions.error && <p className="p-5 text-sm text-slate-400">{actionsLoading ? 'Loading workflow history…' : 'No workflow data loaded.'}</p>}
            {actions.data && <p className="border-t border-slate-800 p-5 text-xs leading-5 text-slate-400">
              {actions.data.scope_note} GitHub reports {actions.data.total_matching_runs} matching workflow runs. In the sample: {actions.data.failed_runs} failed, {actions.data.pending_runs} pending, and {actions.data.other_outcome_runs} other outcomes.
            </p>}
          </section>

          <section aria-labelledby="pulls-title" aria-busy={pullsLoading} className="nexus-devops-evidence min-w-0 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/75">
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 p-5">
              <div>
                <h2 id="pulls-title" className="flex items-center gap-2 text-lg font-semibold">
                  <GitPullRequest className="h-5 w-5 text-[#4ea8ff]" /> PR Intelligence
                </h2>
                <p className="mt-1 text-xs text-slate-400">Recent open pull requests · GitHub-reported merge states</p>
              </div>
              <div className="nexus-devops-evidence-controls flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => refreshPanel('prs', selectedRepo)}
                  disabled={pullsLoading} aria-label="Refresh pull requests" title="Refresh pull requests"
                  className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-slate-700 text-slate-300 hover:border-[#4ea8ff] hover:text-[#4ea8ff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4ea8ff] disabled:cursor-wait disabled:opacity-50">
                  <RefreshCw aria-hidden="true" className={'h-4 w-4 ' + (pullsLoading ? 'animate-spin' : '')} />
                </button>
                <a href={`https://github.com/${selectedRepo}/pulls`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-[#4ea8ff] hover:text-white">
                  Open PRs <ArrowUpRight className="h-4 w-4" />
                </a>
              </div>
            </div>
            <span role="status" className="sr-only">{pulls.data ? `Loaded ${pulls.data.inspected_prs} pull requests.` : pullsSlow ? 'Pull request checks are taking longer than usual. GitHub requests are limited to two at a time.' : pullsLoading ? 'Loading pull requests.' : ''}</span>
             {pullsSlow && pullsLoading && <p className="mx-5 mt-4 rounded-lg border border-amber-500/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
               Still waiting for GitHub PR details. NEXUS checks at most two at a time to reduce API load; the Actions panel remains usable.
             </p>}
            {pulls.error && <p className="m-5 flex gap-2 rounded-xl bg-rose-950/30 p-4 text-sm text-rose-300" role="alert">
              <AlertCircle className="h-4 w-4 shrink-0" />{pulls.error}</p>}
            {pulls.data && pulls.data.inspected_prs > 0 && (
              <div className="border-b border-slate-800 px-5 pb-4 pt-4">
                <div role="group" aria-label="Filter sampled pull requests" className="flex flex-wrap gap-2">
                  {(['all', ...pullBuckets.map(bucket => bucket.key)] as PullFilter[]).map(filter => (
                    <button key={filter} type="button" onClick={() => setPullFilter(filter)}
                      aria-pressed={pullFilter === filter}
                      className="nexus-devops-filter">
                      {filter === 'all' ? 'All' : pullBuckets.find(bucket => bucket.key === filter)!.shortLabel}
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-xs tabular-nums text-slate-400" role="status" aria-live="polite">
                  Showing {visiblePulls.length} of {pulls.data.inspected_prs} sampled PRs
                  {pullFilter === 'all' ? '' : ' · Filter: ' + pullFilter}.
                  No additional GitHub requests.
                </p>
              </div>
            )}
            <ul className="divide-y divide-slate-800/80">
              {visiblePulls.map(pr => (
                <li key={pr.number} className="nexus-devops-event p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <a href={pr.html_url} target="_blank" rel="noopener noreferrer"
                      className="nexus-devops-source-title max-w-full min-w-0 flex-1 text-sm font-medium text-slate-200 hover:text-[#4ea8ff]">
                      #{pr.number} · {pr.title} <ArrowUpRight className="inline h-3.5 w-3.5" />
                    </a>
                    <span className={'shrink-0 rounded-full px-2.5 py-1 text-xs ' + attentionMeta[pr.attention].className}>
                      {attentionMeta[pr.attention].label}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-400">{pr.explanation}</p>
                  <p className="mt-2 text-xs text-slate-400">{pr.author} · Updated {pr.updated_at.slice(0, 10)}</p>
                  <div className="mt-3 border-t border-slate-700/50 pt-3">
                    <button type="button"
                      disabled={pullsLoading || prEvidenceLoading}
                      onClick={() => inspectPrVerification(pr.number)}
                      aria-expanded={prEvidenceOpen && prEvidenceKey === selectedRepo + ':' + pr.number}
                      className="nexus-devops-pr-verify-btn inline-flex min-h-10 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold">
                      <ShieldCheck aria-hidden="true" className="h-4 w-4" />
                      {prEvidenceOpen && prEvidenceKey === selectedRepo + ':' + pr.number && prEvidence.data
                        ? 'Hide check & review events' : 'Inspect check & review events'}
                    </button>
                    <p className="mt-2 text-xs text-slate-400">
                      On demand only: at most 3 additional public GitHub GETs for this PR,
                      plus one NEXUS origin rate-limit decision. Nothing runs automatically.
                    </p>
                  </div>
                  {prEvidenceOpen && prEvidenceKey === selectedRepo + ':' + pr.number && (
                    <div className="nexus-devops-pr-verification mt-3 rounded-xl p-4"
                      role="region" aria-label={'GitHub evidence for PR #' + pr.number}>
                      {prEvidenceLoading && <p role="status" className="text-xs text-slate-300">
                        Loading this PR’s public checks and review events…
                      </p>}
                      {prEvidence.error && <p role="alert" className="text-xs text-rose-300">
                        {prEvidence.error} <a href={pr.html_url} target="_blank" rel="noopener noreferrer"
                          className="underline">Verify directly on GitHub</a>.
                      </p>}
                      {prEvidence.data && (
                        <div className="space-y-4">
                          <p className="text-xs text-slate-300">
                            Commit <code className="font-mono text-[#a6d3fa]">{prEvidence.data.head_sha.slice(0, 12)}</code>.
                            {prEvidence.data.inspected_check_runs} of {prEvidence.data.total_check_runs} check runs sampled;
                            {prEvidence.data.inspected_review_events} chronological review events sampled
                            {prEvidence.data.more_review_events_may_exist ? ' (more may exist)' : ''}.
                          </p>
                          <div>
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-[#a6d3fa]">Check run outcomes</h3>
                            {prEvidence.data.check_runs.length ? (
                              <ul className="mt-2 space-y-2">
                                {prEvidence.data.check_runs.map(check => (
                                  <li key={check.id} className="text-xs text-slate-300">
                                    <span className="font-medium text-slate-100">{check.name}</span>
                                    {' · '}{check.status}{check.conclusion === null ? '' : ' · ' + check.conclusion}
                                  </li>
                                ))}
                              </ul>
                            ) : <p className="mt-2 text-xs text-slate-400">
                              No check runs returned in this sample. This does not prove checks passed.
                            </p>}
                          </div>
                          <div>
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-[#a6d3fa]">Review events</h3>
                            {prEvidence.data.review_events.length ? (
                              <ul className="mt-2 space-y-2">
                                {prEvidence.data.review_events.map(review => (
                                  <li key={review.id} className="text-xs text-slate-300">
                                    <span className="font-medium text-slate-100">{review.author}</span>
                                    {' · '}{review.state}{review.submitted_at ? ' · ' + review.submitted_at.slice(0, 10) : ''}
                                  </li>
                                ))}
                              </ul>
                            ) : <p className="mt-2 text-xs text-slate-400">
                              No review events returned in this sample; current required approvals remain unknown.
                            </p>}
                          </div>
                          <p className="text-xs leading-5 text-slate-400">{prEvidence.data.scope_note}</p>
                          <a className="inline-flex min-h-10 items-center text-xs font-semibold text-[#a6d3fa] hover:underline"
                            href={pr.html_url} target="_blank" rel="noopener noreferrer">
                            Check latest status on GitHub <ArrowUpRight aria-hidden="true" className="ml-1 h-4 w-4" />
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {pulls.data && prList.length === 0 && <p className="p-5 text-sm text-slate-400">No open PRs found.</p>}
            {pulls.data && prList.length > 0 && visiblePulls.length === 0 &&
              <p className="p-5 text-sm text-slate-400">No {pullFilter} PRs in the inspected sample. Other open PRs were not checked.</p>}
            {!pulls.data && !pulls.error && <p className="p-5 text-sm text-slate-400">{pullsLoading ? 'Loading pull requests…' : 'No PR data loaded.'}</p>}
            {pulls.data && <p className="border-t border-slate-800 p-5 text-xs leading-5 text-slate-400">
              {pulls.data.scope_note}
            </p>}
          </section>
        </div>

        <footer className="mt-9 border-t border-slate-800 pt-6 text-xs leading-6 text-slate-400">
          Public repositories only; anonymous GET requests; sample sizes and unknown states are explicit.
          Not a production reliability rating, a security audit, or a GitHub billing statement.
        </footer>
      </div>
    </main>
  );
}
