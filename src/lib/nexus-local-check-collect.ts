import { lstatSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, parse, resolve } from 'node:path';
import type { LocalFacts } from './nexus-local-check.ts';

/**
 * Bounded, read-only file collector for the local project check. It only lists and reads
 * files: no child process, no git command, no network, and symbolic links are never
 * followed (a hostile project could point one at a private file). Content is returned
 * to the analyser and never written anywhere.
 */
export const MAX_FILES = 4000;
export const MAX_DEPTH = 10;
export const MAX_FILE_BYTES = 256 * 1024;
export const MAX_TOTAL_BYTES = 24 * 1024 * 1024;

const SKIP_DIRS = new Set([
  '.git', 'node_modules', '.next', 'dist', 'build', 'out', 'coverage', 'venv', '.venv', 'env', '__pycache__',
  '.cache', 'target', 'vendor', '.idea', '.turbo', '.pytest_cache', '.mypy_cache', '.gradle',
]);
const TEXT_EXT = new Set([
  'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'py', 'json', 'yml', 'yaml', 'toml', 'ini', 'cfg', 'conf', 'sh', 'ps1',
  'txt', 'properties', 'xml', 'tf', 'go', 'rs', 'java', 'rb', 'php', 'cs', 'env', 'md', 'gradle', 'kt', 'swift',
]);
const ALWAYS_TEXT = /^(Dockerfile(\..+)?|[^/]+\.dockerfile|\.gitignore|\.dockerignore|\.env(\..+)?|Makefile|Pipfile)$/i;

export function assertScannableRoot(input: string): string {
  const root = resolve(input);
  if (parse(root).root === root) throw new Error('refusing to scan a filesystem root');
  let st;
  try { st = statSync(root); } catch { throw new Error('path does not exist'); }
  if (!st.isDirectory()) throw new Error('path is not a directory');
  return root;
}

function readGit(root: string): LocalFacts['git'] {
  const gitPath = join(root, '.git');
  let st;
  try { st = lstatSync(gitPath); } catch { return { present: false, headRef: null, detached: false, remoteUrls: [] }; }
  if (!st.isDirectory()) return { present: true, headRef: null, detached: false, remoteUrls: [] };
  let headRef: string | null = null; let detached = false; const remoteUrls: string[] = [];
  try {
    const head = readFileSync(join(gitPath, 'HEAD'), 'utf8').trim();
    const m = /^ref:\s*refs\/heads\/(.+)$/.exec(head);
    if (m) headRef = m[1]; else if (/^[0-9a-f]{40,64}$/.test(head)) detached = true;
  } catch { /* unreadable HEAD is simply unknown */ }
  try {
    const cfg = readFileSync(join(gitPath, 'config'), 'utf8');
    for (const m of cfg.matchAll(/^\s*url\s*=\s*(.+?)\s*$/gm)) remoteUrls.push(m[1]);
  } catch { /* no config */ }
  return { present: true, headRef, detached, remoteUrls: remoteUrls.slice(0, 10) };
}

export function collectLocalFacts(input: string): LocalFacts {
  const root = assertScannableRoot(input);
  const files: string[] = []; const text: Record<string, string> = {};
  let truncated = false; let skippedLarge = 0; let total = 0;

  // Breadth-first and files-before-folders: when a budget runs out, the project root and shallow folders
  // (manifests, README, workflows) have already been read instead of being starved by one huge sub-folder.
  const queue: { dir: string; rel: string; depth: number }[] = [{ dir: root, rel: '', depth: 0 }];
  const visit = (dir: string, rel: string, depth: number): void => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    const ordered = [...entries.filter(e => !e.isDirectory()), ...entries.filter(e => e.isDirectory())];
    for (const entry of ordered) {
      if (truncated) return;
      if (files.length >= MAX_FILES) { truncated = true; return; }
      if (entry.isSymbolicLink()) continue;
      const relPath = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name) || depth >= MAX_DEPTH) continue;
        queue.push({ dir: join(dir, entry.name), rel: relPath, depth: depth + 1 });
        continue;
      }
      if (!entry.isFile()) continue;
      files.push(relPath);
      const ext = entry.name.includes('.') ? entry.name.slice(entry.name.lastIndexOf('.') + 1).toLowerCase() : '';
      if (!ALWAYS_TEXT.test(entry.name) && !TEXT_EXT.has(ext)) continue;
      const abs = join(dir, entry.name);
      let size: number;
      try { size = lstatSync(abs).size; } catch { continue; }
      if (size > MAX_FILE_BYTES) { skippedLarge += 1; continue; }
      if (total + size > MAX_TOTAL_BYTES) { truncated = true; return; }
      try {
        const content = readFileSync(abs, 'utf8');
        if (content.includes('\u0000')) continue;
        text[relPath] = content; total += size;
      } catch { /* unreadable file is skipped */ }
    }
  };
  for (let i = 0; i < queue.length && !truncated; i += 1) visit(queue[i].dir, queue[i].rel, queue[i].depth);
  return {
    rootName: basename(root), filesScanned: files.length, truncated, skippedLarge, files, text, git: readGit(root),
  };
}
