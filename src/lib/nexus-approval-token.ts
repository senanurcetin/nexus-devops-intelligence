// Single-use approval token for NEXUS DevOps write actions (gap request NG-19).
//
// Contract (see docs/DEVOPS_WRITE_ACTIONS.md): Jarvis creates an approval request whose payload is the exact action
// descriptor ({ action, params }); after Sena's single-use Telegram approval, Jarvis spends its own grant
// (approvals.gate.require_approval) and mints  nxa1.<base64url(claims JSON)>.<hex HMAC-SHA256>  with the shared secret.
// This module VERIFIES the token and burns its `jti` exactly once before any write happens. Verification is
// fail-closed: every problem yields a short, safe refusal code and nothing is spent.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { mkdirSync, openSync, closeSync, writeSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const APPROVAL_TOKEN_PREFIX = 'nxa1';
export const MAX_TOKEN_TTL_SECONDS = 900;
const JTI = /^[A-Za-z0-9_-]{8,64}$/;
const MIN_SECRET_LENGTH = 32;

export type ApprovalRefusal =
  | 'no_token' | 'malformed_token' | 'secret_missing' | 'bad_signature' | 'bad_claims' | 'expired' | 'not_yet_valid'
  | 'ttl_too_long' | 'wrong_action' | 'payload_mismatch' | 'replayed' | 'used_store_unavailable';

export class ApprovalRefused extends Error {
  readonly reason: ApprovalRefusal;
  constructor(reason: ApprovalRefusal) { super(reason); this.name = 'ApprovalRefused'; this.reason = reason; }
}

export type ApprovalClaims = {
  v: 1;
  jti: string; // jarvis approval grant id (unique, single use)
  rid: string; // jarvis approval request id
  act: string; // action name, e.g. "rerun_workflow"
  ph: string; // sha256 hex of canonicalJson(payload) — same function as jarvis approvals.store.payload_hash
  iat: number; // issued-at, unix seconds
  exp: number; // expiry, unix seconds
};

/** Same bytes as jarvis `canonical_json`: sorted keys, compact separators, no ASCII escaping. Floats are refused. */
export function canonicalJson(value: unknown): string {
  const walk = (v: unknown): unknown => {
    if (v === null || typeof v === 'string' || typeof v === 'boolean') return v;
    if (typeof v === 'number') {
      if (!Number.isSafeInteger(v)) throw new Error('canonicalJson: only safe integers are allowed');
      return v;
    }
    if (Array.isArray(v)) return v.map(walk);
    if (typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(v as object).sort()) {
        const item = (v as Record<string, unknown>)[key];
        if (item === undefined) throw new Error('canonicalJson: undefined is not allowed');
        out[key] = walk(item);
      }
      return out;
    }
    throw new Error('canonicalJson: unsupported value');
  };
  return JSON.stringify(walk(value));
}

export function payloadHash(payload: unknown): string {
  return createHash('sha256').update(canonicalJson(payload), 'utf8').digest('hex');
}

const b64u = (buf: Buffer) => buf.toString('base64url');
const sign = (secret: string, body: string) => createHmac('sha256', secret).update(body, 'utf8').digest();

/** Minting lives in Jarvis in production; it is here so tests and the docs share one reference implementation. */
export function mintApprovalToken(secret: string, claims: ApprovalClaims): string {
  const body = b64u(Buffer.from(JSON.stringify(claims), 'utf8'));
  return `${APPROVAL_TOKEN_PREFIX}.${body}.${sign(secret, `${APPROVAL_TOKEN_PREFIX}.${body}`).toString('hex')}`;
}

export type VerifyInput = {
  token: unknown;
  secret: string | undefined;
  action: string;
  payload: unknown;
  now: Date;
};

/** Pure verification: signature, claims shape, window, action and payload binding. Does NOT check replay. */
export function verifyApprovalToken(input: VerifyInput): ApprovalClaims {
  if (typeof input.token !== 'string' || input.token.length === 0) throw new ApprovalRefused('no_token');
  if (typeof input.secret !== 'string' || input.secret.length < MIN_SECRET_LENGTH) throw new ApprovalRefused('secret_missing');
  if (input.token.length > 2048) throw new ApprovalRefused('malformed_token');
  const parts = input.token.split('.');
  if (parts.length !== 3 || parts[0] !== APPROVAL_TOKEN_PREFIX || !/^[A-Za-z0-9_-]+$/.test(parts[1]) ||
      !/^[0-9a-f]{64}$/.test(parts[2])) throw new ApprovalRefused('malformed_token');
  const expected = sign(input.secret, `${parts[0]}.${parts[1]}`);
  const given = Buffer.from(parts[2], 'hex');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new ApprovalRefused('bad_signature');
  let claims: ApprovalClaims;
  try { claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')); } catch { throw new ApprovalRefused('bad_claims'); }
  const c = claims as Partial<ApprovalClaims> | null;
  if (!c || typeof c !== 'object' || c.v !== 1 || typeof c.jti !== 'string' || !JTI.test(c.jti) ||
      typeof c.rid !== 'string' || c.rid.length === 0 || c.rid.length > 128 || typeof c.act !== 'string' ||
      typeof c.ph !== 'string' || !/^[0-9a-f]{64}$/.test(c.ph) || !Number.isSafeInteger(c.iat) ||
      !Number.isSafeInteger(c.exp)) throw new ApprovalRefused('bad_claims');
  const nowS = Math.floor(input.now.getTime() / 1000);
  if (c.exp! <= nowS) throw new ApprovalRefused('expired');
  if (c.iat! > nowS + 60) throw new ApprovalRefused('not_yet_valid');
  if (c.exp! - c.iat! > MAX_TOKEN_TTL_SECONDS) throw new ApprovalRefused('ttl_too_long');
  if (c.act !== input.action) throw new ApprovalRefused('wrong_action');
  let expectedHash: string;
  try { expectedHash = payloadHash(input.payload); } catch { throw new ApprovalRefused('payload_mismatch'); }
  const a = Buffer.from(c.ph!, 'utf8');
  const b = Buffer.from(expectedHash, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new ApprovalRefused('payload_mismatch');
  return claims;
}

/** Burn-once registry for token ids. */
export interface UsedTokenStore { burn(jti: string): void }

/** In-memory store (tests, single process). */
export class MemoryUsedTokenStore implements UsedTokenStore {
  private readonly seen = new Set<string>();
  burn(jti: string): void {
    if (this.seen.has(jti)) throw new ApprovalRefused('replayed');
    this.seen.add(jti);
  }
}

/** Durable store: one exclusively-created marker file per jti, so replays are refused across processes and restarts. */
export class FileUsedTokenStore implements UsedTokenStore {
  constructor(private readonly dir: string) {}
  burn(jti: string): void {
    if (!JTI.test(jti)) throw new ApprovalRefused('bad_claims');
    try {
      mkdirSync(this.dir, { recursive: true });
      const path = join(this.dir, `${jti}.used`);
      if (existsSync(path)) throw new ApprovalRefused('replayed');
      const fd = openSync(path, 'wx'); // atomic: exactly one caller can create it
      try { writeSync(fd, new Date().toISOString() + '\n'); } finally { closeSync(fd); }
    } catch (error) {
      if (error instanceof ApprovalRefused) throw error;
      if ((error as NodeJS.ErrnoException)?.code === 'EEXIST') throw new ApprovalRefused('replayed');
      throw new ApprovalRefused('used_store_unavailable');
    }
  }
}

/** Verify then burn (burn-first: a crash after this point can only waste an approval, never reuse it). */
export function consumeApprovalToken(input: VerifyInput, store: UsedTokenStore): ApprovalClaims {
  const claims = verifyApprovalToken(input);
  store.burn(claims.jti);
  return claims;
}
