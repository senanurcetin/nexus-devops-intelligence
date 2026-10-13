'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  Activity, AlertCircle, ArrowRight, ArrowUpRight, CheckCircle2,
  GitBranch, GitPullRequest, RefreshCw, ShieldCheck, TriangleAlert,
} from 'lucide-react';
import { parsePublicRepository, type PublicActionsSummary } from '@/lib/github-public-actions';
import type { PublicPullSummary, PullAttention } from '@/lib/nexus-public-prs';
import { recommendInvestigations } from '@/lib/nexus-recommendations';
import { readPublicPanel, emptyPanel, type Panel } from '@/lib/nexus-panel-request';
import { isPublicActionsSample, isPublicPullSample } from '@/lib/nexus-panel-validation';
import { filteredWorkflowRuns, workflowOutcome, workflowOutcomeCount, workflowOutcomes, type WorkflowFilter } from '@/lib/nexus-workflow-visuals';
import { filteredPublicPulls, pullBucket, pullBucketCount, pullBuckets, type PullFilter } from '@/lib/nexus-pr-visuals';

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
  const [actionsReceivedAt, setActionsReceivedAt] = useState<string | null>(null);
  const [pullsReceivedAt, setPullsReceivedAt] = useState<string | null>(null);
  const loading = actionsLoading || pullsLoading;
  const [formError, setFormError] = useState('');
  const [workflowFilter, setWorkflowFilter] = useState<WorkflowFilter>('all');
  const [pullFilter, setPullFilter] = useState<PullFilter>('all');
  const controllers = useRef<{ actions: AbortController | null; prs: AbortController | null }>({
    actions: null, prs: null,
  });
  const pullsSlowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshPanel = useCallback((kind: 'actions' | 'prs', repo: string) => {
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
            if (result.data) setActionsReceivedAt(new Date().toLocaleTimeString());
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
            if (result.data) setPullsReceivedAt(new Date().toLocaleTimeString());
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
    setSelectedRepo(trimmed);
    setWorkflowFilter('all');
    setPullFilter('all');
    setActionsReceivedAt(null);
    setPullsReceivedAt(null);
    refreshPanel('actions', trimmed);
    refreshPanel('prs', trimmed);
  }, [refreshPanel]);

  useEffect(() => {
    load(DEFAULT_REPOSITORY);
    return () => {
      controllers.current.actions?.abort();
      controllers.current.prs?.abort();
      if (pullsSlowTimer.current !== null) clearTimeout(pullsSlowTimer.current);
    };
  }, [load]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextRepo = repository.trim();
    try {
      parsePublicRepository(nextRepo);
    } catch {
      setFormError('Enter a public GitHub repository as owner/repository.');
      return;
    }
    setFormError('');
    void load(nextRepo);
  }

  const validRuns = actions.data?.inspected_runs ?? 0;
  const successRatio = validRuns ? Math.round((actions.data!.successful_runs / validRuns) * 100) : null;
  const runs = actions.data?.runs ?? [];
  const visibleRuns = filteredWorkflowRuns(actions.data, workflowFilter);
  const prList = pulls.data?.pull_requests ?? [];
  const visiblePulls = filteredPublicPulls(pulls.data, pullFilter);
  const recommendations = recommendInvestigations(actions.data, pulls.data);

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
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#4ea8ff]/30 bg-[#4ea8ff]/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-[#4ea8ff]">
              <ShieldCheck className="h-4 w-4" /> Public API · Read-only preview
            </div>
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Engineering signals. <span className="text-[#4ea8ff]">Linked to evidence.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-400">
              Inspect sampled GitHub workflow outcomes and reported merge states in one source-linked dashboard.
              Investigate signals, then open the original records. No workflow execution or repository writes.
            </p>
            <div className="nexus-devops-hero-facts" aria-label="Dashboard data boundaries">
              <span><span aria-hidden="true" className="nexus-devops-fact-dot" /> Public GitHub REST</span>
              <span>Maximum 10 runs / 5 PRs</span>
              <span>No account access required</span>
            </div>
          </div>
          <div className="nexus-devops-evidence-note rounded-2xl border border-slate-800 bg-slate-900/75 p-5 text-sm leading-6 text-slate-400">
            <div className="mb-2 flex items-center gap-2 font-semibold text-slate-200">
              <GitBranch className="h-4 w-4 text-[#4ea8ff]" /> Limited public preview
            </div>
            Results are samples: up to 10 workflow runs and 5 open PRs. Merge states can be pending.
            No token, AI diagnosis, account-wide billing data or deployment claim.
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
              <p className="nexus-devops-received-at">
                Actions: {actionsReceivedAt ? `received at ${actionsReceivedAt} (browser local time)` :
                  actionsLoading ? 'loading' : 'no verified response for this selection'}
              </p>
              <p className="nexus-devops-received-at">
                PRs: {pullsReceivedAt ? `received at ${pullsReceivedAt} (browser local time)` :
                  pullsLoading ? 'loading' : 'no verified response for this selection'}
              </p>
            </div>
          </div>
        </div>

        <section aria-label="Repository search" className="nexus-devops-search rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
          <form onSubmit={onSubmit} aria-busy={loading} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex-1 text-sm font-medium text-slate-300">
              Public GitHub repository
              <input value={repository} onChange={event => { setRepository(event.target.value); setFormError(''); }}
                maxLength={200} required autoComplete="off" placeholder="owner/repository"
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
            : <p id="repository-hint" className="mt-3 text-xs text-slate-400">Use an owner/repository name; public repositories only.</p>}
          <p className="mt-3 text-xs text-slate-400" aria-live="polite">
            {loading ? 'Reading public GitHub REST API records…' : `Selected: ${selectedRepo}`}
          </p>
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
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">Outcome distribution</p>
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
                <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
                  {workflowOutcomes.map(outcome => (
                    <div key={outcome.key} className="min-w-0">
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
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">Recent run sequence</p>
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
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">Merge-state composition</p>
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
                <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
                  {pullBuckets.map(bucket => (
                    <div key={bucket.key} className="min-w-0">
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
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">Recently listed PRs</p>
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
            <a href="https://docs.github.com/en/rest/actions/workflow-runs"
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-[#4ea8ff] hover:text-white">
              GitHub API docs <ArrowRight className="h-4 w-4" />
            </a>
          </div>
          {recommendations.length > 0 ? (
            <ol className="nexus-devops-queue mt-5 grid gap-3 lg:grid-cols-2">
              {recommendations.map(item => (
                <li key={item.key} className="nexus-devops-queue-item flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-4"
                  data-severity={item.severity}>
                  <div className="min-w-0 flex-1">
                    <span className="nexus-devops-queue-severity">{item.severity} / evidence-backed</span>
                    <p className="mt-2 text-sm font-semibold text-slate-100">{item.title}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">{item.explanation}</p>
                  </div>
                  <a href={item.url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#4ea8ff] hover:text-[#cee8ff]">
                    Review <ArrowUpRight className="h-4 w-4" />
                  </a>
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
                <li key={run.id} className="nexus-devops-event flex flex-wrap items-start justify-between gap-3 p-5">
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
