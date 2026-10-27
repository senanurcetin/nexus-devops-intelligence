import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,writeFile,symlink,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assessPreviewInventory,readPreviewInventory } from '../scripts/verify-preview-inventory.mjs';

const sha = 'a'.repeat(40), prior = 'b'.repeat(40);
const projectId = 'prj_sbU4ylt4OV4fLkcog3VpSr2fEXYe';
const now = new Date('2026-10-27T20:00:00.000Z');
const sample=()=>({
  schema_version:1, observed_at_utc:'2026-10-27T19:55:00.000Z',
  project:{id:projectId,name:'nexus-devops-intelligence',
    ssoProtection:{enabled:true,deploymentType:'all_except_custom_domains'}},
  preview:{id:'dpl_9sq98XLM2DZAgyBFZoFVUde2NucT',
    state:'READY',target:null,project:{id:projectId},
    meta:{githubCommitSha:prior,githubCommitRef:'main',
      githubOrg:'senanurcetin',githubRepo:'nexus-devops-intelligence'}},
});
const run=(snapshot,overrides={})=>assessPreviewInventory(snapshot,{
  expectedSha:sha,expectedProjectId:projectId,now,cleanCheckout:true,...overrides,
});
test('Old READY preview is HOLD even when SSO protection is configured',()=>{
 const result=run(sample());
 assert.equal(result.evidence_gate,'HOLD');
 assert.equal(result.reason,'preview_source_sha_drift');
 assert.equal(result.sso_configured,true);
 assert.equal(result.exact_source_match,false);
 assert.equal(result.release_authorized,false);
 assert.equal(result.live_sso_http_acceptance,'NOT_VERIFIED');
});
test('Even exact SHA does not certify real SSO HTTP or distributed Redis',()=>{
 const s=sample();s.preview.meta.githubCommitSha=sha;
 const r=run(s);
 assert.equal(r.reason,'source_aligned_but_live_acceptance_required');
 assert.equal(r.exact_source_match,true);
 assert.equal(r.release_authorized,false);
 assert.equal(r.independent_redis_acceptance,'NOT_VERIFIED');
});
test('Unprotected, not READY, unclean tree and unexpected branch cannot pass',()=>{
 const s=sample();s.preview.meta.githubCommitSha=sha;
 s.project.ssoProtection.enabled=false;
 assert.equal(run(s).reason,'sso_configuration_unverified');
 s.project.ssoProtection.enabled=true;
 s.preview.state='BUILDING';
 assert.equal(run(s).reason,'preview_not_ready');
 s.preview.state='READY';
 s.preview.meta.githubCommitRef='feature/test';
 assert.equal(run(s).reason,'unexpected_git_branch');
 s.preview.meta.githubCommitRef='main';
 assert.equal(run(s,{cleanCheckout:false}).reason,'dirty_tracked_source');
});
test('Wrong project, wrong repository identity, wrong target and invalid ref rejected',()=>{
 const s=sample();s.preview.project.id='prj_another123456789';assert.throws(()=>run(s));
 const r=sample();r.preview.meta.githubRepo='other';assert.throws(()=>run(r));
 const t=sample();t.preview.target='production';assert.throws(()=>run(t));
 const x=sample();x.preview.meta.githubCommitSha='broken';assert.throws(()=>run(x));
});
test('Snapshot freshness, schema and SSO shape required',()=>{
 const d=sample();d.observed_at_utc='2026-10-25T19:00:00.000Z';assert.throws(()=>run(d));
 const f=sample();f.observed_at_utc='2026-10-28T19:00:00.000Z';assert.throws(()=>run(f));
 const n=sample();n.schema_version=99;assert.throws(()=>run(n));
 const a=sample();delete a.project.ssoProtection;assert.throws(()=>run(a));
});
test('File reader rejects malformed JSON, symlink and oversize inventory',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'nexus-preview-'));
 const path=join(dir,'snapshot.json');
 try{
  await writeFile(path,JSON.stringify(sample()));
  assert.equal((await readPreviewInventory(path)).schema_version,1);
  const link=join(dir,'alias.json');await symlink(path,link);
  await assert.rejects(readPreviewInventory(link),/bounded regular file/);
  await writeFile(path,'{corrupted');
  await assert.rejects(readPreviewInventory(path),/malformed/);
  await writeFile(path,'a'.repeat(70*1024));
  await assert.rejects(readPreviewInventory(path),/bounded regular file/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
