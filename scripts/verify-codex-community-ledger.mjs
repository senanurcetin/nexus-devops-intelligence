import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const LEDGER = resolve(ROOT, 'docs/codex-community-ledger.json');
const STATUSES = new Set(['PLANNED', 'DRAFT', 'PUBLISHED_IN_REPO', 'EXTERNALLY_SHARED', 'FEEDBACK_RECORDED']);

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + 'T00:00:00.000Z');
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validHttpsUrl(value) {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

/** Offline shape check only: links are not fetched and third-party authorship is not proven. */
function isOwnRepositoryOrFileLink(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (host === 'raw.githubusercontent.com') return true;
    if (host !== 'github.com') return false;
    const path = url.pathname.toLowerCase();
    return /^\/senanurcetin\/nexus-devops-intelligence(?:\/|$)/.test(path) ||
      /^\/[^/]+\/[^/]+\/(?:blob|tree)(?:\/|$)/.test(path);
  } catch {
    return false;
  }
}

function canonicalHttpsUrl(value) {
  if (!validHttpsUrl(value)) return null;
  return new URL(value).href;
}

function checkedArtifact(path, root) {
  if (typeof path !== 'string' || !/^docs\/CODEX_[A-Za-z0-9_]+\.md$/.test(path)) {
    return 'artifact must be a repository-relative docs/CODEX_*.md file';
  }
  const candidate = resolve(root, path);
  const rel = relative(root, candidate);
  if (isAbsolute(rel) || rel === '..' || rel.startsWith('..' + sep)) return 'artifact escapes repository';
  if (!existsSync(candidate) || !statSync(candidate).isFile()) return 'artifact does not exist';
  const realRoot = realpathSync(root);
  const realCandidate = realpathSync(candidate);
  const realRel = relative(realRoot, realCandidate);
  if (isAbsolute(realRel) || realRel === '..' || realRel.startsWith('..' + sep)) {
    return 'artifact symlink escapes repository';
  }
  return null;
}

/** Validate documentary evidence, not the external reachability of supplied URLs. */
export function validateCommunityLedger(ledger, { root = ROOT } = {}) {
  const errors = [];
  if (!ledger || typeof ledger !== 'object' || Array.isArray(ledger)) return ['ledger must be an object'];
  if (ledger.schema_version !== 1) errors.push('schema_version must be 1');
  if (!Array.isArray(ledger.months) || ledger.months.length !== 6) {
    return [...errors, 'ledger must contain exactly six monthly records'];
  }

  ledger.months.forEach((entry, index) => {
    const expected = new Date(Date.UTC(2026, 10 + index, 1)).toISOString().slice(0, 7);
    const prefix = `month[${index}]`;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      errors.push(`${prefix}: entry must be an object`);
      return;
    }
    if (entry.month !== expected) errors.push(`${prefix}: month must be ${expected}`);
    if (typeof entry.topic !== 'string' || entry.topic.trim().length < 12) errors.push(`${prefix}: topic is missing`);
    if (!STATUSES.has(entry.status)) {
      errors.push(`${prefix}: unsupported status`);
      return;
    }

    const isPublished = ['PUBLISHED_IN_REPO', 'EXTERNALLY_SHARED', 'FEEDBACK_RECORDED'].includes(entry.status);
    const isShared = ['EXTERNALLY_SHARED', 'FEEDBACK_RECORDED'].includes(entry.status);
    if (entry.artifact != null) {
      const artifactError = checkedArtifact(entry.artifact, root);
      if (artifactError) errors.push(`${prefix}: ${artifactError}`);
    } else if (isPublished || entry.status === 'DRAFT') {
      errors.push(`${prefix}: published/draft content requires an artifact`);
    }
    if (isPublished) {
      if (!validDate(entry.published_at) || entry.published_at.slice(0, 7) !== expected) {
        errors.push(`${prefix}: published_at must be a valid date in that month`);
      }
      if (!validHttpsUrl(entry.source_pr) || !/^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+$/.test(entry.source_pr)) {
        errors.push(`${prefix}: source_pr must link to an actual GitHub PR URL`);
      }
    } else if (entry.published_at != null) {
      errors.push(`${prefix}: unpublished content cannot claim published_at`);
    }

    if (isShared) {
      if (!validHttpsUrl(entry.share_url)) errors.push(`${prefix}: shared content requires an HTTPS share_url`);
      if (!validDate(entry.shared_at)) {
        errors.push(`${prefix}: shared content requires a valid shared_at date`);
      } else if (validDate(entry.published_at) && entry.shared_at < entry.published_at) {
        errors.push(`${prefix}: shared_at cannot precede published_at`);
      }
      if (isOwnRepositoryOrFileLink(entry.share_url)) {
        errors.push(`${prefix}: a repository file URL does not prove external community sharing`);
      }
    } else if (entry.share_url != null || entry.shared_at != null) {
      errors.push(`${prefix}: no external share URL/date without external-share status`);
    }

    if (!Array.isArray(entry.feedback_urls)) {
      errors.push(`${prefix}: feedback_urls must be an array`);
    } else {
      if (entry.feedback_urls.some(url => !validHttpsUrl(url))) errors.push(`${prefix}: feedback URL must be HTTPS`);
      if (entry.status === 'FEEDBACK_RECORDED' && entry.feedback_urls.length === 0) {
        errors.push(`${prefix}: feedback status requires cited feedback`);
      }
      if (entry.status === 'FEEDBACK_RECORDED') {
        const usedForOtherEvidence = [entry.share_url, entry.source_pr]
          .map(canonicalHttpsUrl).filter(Boolean);
        if (entry.feedback_urls.some(url => usedForOtherEvidence.includes(canonicalHttpsUrl(url)))) {
          errors.push(`${prefix}: feedback URL must differ from the shared post or source PR`);
        }
      }
      if (entry.status !== 'FEEDBACK_RECORDED' && entry.feedback_urls.length > 0) {
        errors.push(`${prefix}: promote to FEEDBACK_RECORDED before recording feedback links`);
      }
    }
  });
  return errors;
}

function main() {
  let data;
  try {
    data = JSON.parse(readFileSync(LEDGER, 'utf8'));
  } catch (error) {
    console.error('Unable to read community ledger:', error.message);
    process.exitCode = 1;
    return;
  }
  const errors = validateCommunityLedger(data);
  if (errors.length) {
    for (const error of errors) console.error('LEDGER ERROR:', error);
    process.exitCode = 1;
    return;
  }
  const summary = Object.fromEntries([...STATUSES].map(status => [status, data.months.filter(x => x.status === status).length]));
  console.log('Codex community ledger verified (offline, schema only):', JSON.stringify(summary));
  console.log('External URLs are not automatically checked for reachability or independent audience.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
