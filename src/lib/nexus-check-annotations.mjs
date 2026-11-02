// On-demand, unauthenticated GitHub check-run annotations for NEXUS JARVIS.
// Two bounded GitHub REST GETs. Never reads provider-native logs or starts CI.
import { validateCommitTarget } from './nexus-commit-checks.mjs';

export const ANNOTATIONS_SCHEMA = 'nexus.devops.check-annotations/v1';
const MAX_BYTES = 600_000;
const MAX_ANNOTATIONS = 20;
const LEVELS = new Set(['failure', 'warning', 'notice']);
const SECRET = /-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:AKIA|ASIA)[0-9A-Z]{16}\b|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|\bxox[baprs]-[A-Za-z0-9-]{10,}\b|\bAIza[0-9A-Za-z_-]{35}\b|\bsk-ant-[A-Za-z0-9_-]{20,}\b|\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b|\bBearer\s+\S+|\b(?:password|secret|api[_-]?key|access[_-]?token)\s*[:=]\s*\S+|:\/\/[^/@\s]+@/i;
const C0 = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u2069]/g;

export function validateAnnotationTarget(repository, sha, checkRunId) {
  validateCommitTarget(repository, sha);
  const id = typeof checkRunId === 'string' && /^[1-9][0-9]{0,15}$/.test(checkRunId) ?
    Number(checkRunId) : checkRunId;
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new Error('Check run ID must be a positive safe integer.');
  }
  return { repository, sha, checkRunId: id };
}

function sanitize(value, limit) {
  if (typeof value !== 'string') return '';
  // Check the complete original string: a secret beyond the truncation boundary must not leak.
  if (SECRET.test(value)) return '[redacted: possible credential]';
  return value.replace(C0, ' ').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function pathSafe(value) {
  if (typeof value !== 'string' || value.length > 350 || !value ||
      value.startsWith('/') || value.startsWith('\\') || /^[a-z]:/i.test(value) ||
      /[\\\u0000-\u001f\u007f-\u009f]/.test(value) ||
      value.split('/').some(part => !part || part === '.' || part === '..') ||
      SECRET.test(value)) return false;
  return true;
}

async function githubGet(fetcher, url) {
  try {
    const response = await fetcher(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'nexus-devops-jarvis-check-annotations',
      },
      redirect: 'error',
      signal: AbortSignal.timeout(12_000),
    });
    if (response.status === 403 || response.status === 429) return { state: 'rate_limited' };
    if (response.status === 404) return { state: 'not_found' };
    if (!response.ok) return { state: 'unavailable' };
    if (!/application\/json/i.test(response.headers.get('content-type') ?? '')) return { state: 'invalid' };
    if (Number(response.headers.get('content-length')) > MAX_BYTES || !response.body) {
      await response.body?.cancel();
      return { state: 'invalid' };
    }
    const chunks = [];
    let bytes = 0;
    const reader = response.body.getReader();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BYTES) {
        await reader.cancel();
        return { state: 'invalid' };
      }
      chunks.push(value);
    }
    return { state: 'verified', data: JSON.parse(Buffer.concat(chunks).toString('utf8')) };
  } catch {
    return { state: 'unavailable' };
  }
}

function projectAnnotation(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      !pathSafe(value.path) || !LEVELS.has(value.annotation_level) ||
      !Number.isSafeInteger(value.start_line) || value.start_line < 1 ||
      !Number.isSafeInteger(value.end_line) || value.end_line < value.start_line ||
      value.end_line > 10_000_000 || typeof value.message !== 'string') return null;
  return {
    path: value.path,
    start_line: value.start_line,
    end_line: value.end_line,
    level: value.annotation_level,
    title: sanitize(value.title, 120),
    message: sanitize(value.message, 320),
  };
}

export async function collectCheckAnnotations({
  repository, sha, checkRunId, fetcher = fetch, now = () => new Date(),
}) {
  const target = validateAnnotationTarget(repository, sha, checkRunId);
  const base = 'https://api.github.com/repos/' + repository + '/check-runs/' + target.checkRunId;
  const run = await githubGet(fetcher, base);
  if (run.state !== 'verified') return { ok: false, state: run.state };
  if (!run.data || typeof run.data !== 'object' || Array.isArray(run.data) ||
      run.data.id !== target.checkRunId ||
      typeof run.data.head_sha !== 'string' ||
      run.data.head_sha.toLowerCase() !== sha) {
    return { ok: false, state: 'identity_mismatch' };
  }
  const total = run.data.output?.annotations_count;
  if (!Number.isSafeInteger(total) || total < 0) return { ok: false, state: 'invalid' };

  let observations = [];
  if (total > 0) {
    const annotations = await githubGet(fetcher, base + '/annotations?per_page=20&page=1');
    if (annotations.state !== 'verified') return { ok: false, state: annotations.state };
    if (!Array.isArray(annotations.data) || annotations.data.length > MAX_ANNOTATIONS) {
      return { ok: false, state: 'invalid' };
    }
    observations = annotations.data.map(projectAnnotation);
    if (observations.some(v => v === null) || observations.length > total) {
      return { ok: false, state: 'invalid' };
    }
  }
  return {
    ok: true, state: 'verified',
    schema: ANNOTATIONS_SCHEMA,
    generated_at_utc: now().toISOString(),
    repository, commit_sha: sha, check_run_id: target.checkRunId,
    access: { mode: 'read_only', write_actions: [], paid_api_used: false, authentication_used: false },
    coverage: 'github_check_run_annotations_only',
    annotation_count: total,
    sampled_annotations: observations.length,
    truncated: total > observations.length,
    annotations: observations,
    source_url: 'https://github.com/' + repository + '/commit/' + sha + '/checks',
    limitations: [
      'Annotations are user-supplied CI metadata, not verified root causes or full execution logs.',
      'Only the first 20 annotations for the exact GitHub check run are considered.',
      'Provider-native CircleCI and Vercel logs are not accessed; no CI job or deployment is triggered.',
    ],
  };
}
