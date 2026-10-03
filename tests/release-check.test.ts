import {mkdtempSync,writeFileSync,rmSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import { describe, expect, it } from 'vitest';

import { runReleaseCheck, scanTrackedText } from '../scripts/release-check.mjs';

describe('release secret guard', () => {
  it('flags a credential-like assignment but not an ordinary URL setting', async () => {
    await expect(scanTrackedText('DEMO_TOKEN=abc')).resolves.toContain('credential-like assignment'); // release-check:allow
    await expect(scanTrackedText('sourceUrl=https://library.hkust.edu.hk')).resolves.toEqual([]);
  });

  it('matches multi-segment credential names', async () => {
    await expect(scanTrackedText('HKUST_MCP_API_KEY=s3cr3t-real-looking-value-9f2a')).resolves.toContain( // release-check:allow
      'credential-like assignment',
    );
  });

  it('accepts documented placeholder values', async () => {
    await expect(scanTrackedText("HKUST_MCP_API_KEY='replace-with-a-long-random-secret'")).resolves.toEqual([]);
    await expect(scanTrackedText('HKUST_GRAPH_ACCESS_TOKEN=<your-token>')).resolves.toEqual([]);
  });

  it('never echoes the matched value, only the rule name', async () => {
    const findings = await scanTrackedText('CLIENT_SECRET=hunter2-not-a-real-value'); // release-check:allow

    expect(findings).toHaveLength(1);
    expect(findings.join(' ')).not.toContain('hunter2');
  });

  it('reports no findings across tracked and nonignored untracked source', async () => {
    const result = await runReleaseCheck({ cwd: process.cwd(), audit: false });

    expect(result.findings).toEqual([]);
    expect(result.ok).toBe(true);
  });
});


it('scans new release files, keeps ignored credentials out and does not reveal matched values',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'release-worktree-'));
 try{
  execFileSync('git',['init','--quiet'],{cwd:dir});writeFileSync(join(dir,'.gitignore'),'ignored.env\n');
  writeFileSync(join(dir,'tracked.txt'),'safe');execFileSync('git',['add','tracked.txt','.gitignore'],{cwd:dir});
  writeFileSync(join(dir,'new-source.js'),"const CLIENT_SECRET = 'synthetic-regression-value';"); // release-check:allow
  writeFileSync(join(dir,'.env.release'),'EXAMPLE=yes');writeFileSync(join(dir,'ignored.env'),'PRIVATE_KEY=synthetic-ignored-value'); // release-check:allow
  const result=await runReleaseCheck({cwd:dir,audit:false});expect(result.ok).toBe(false);
  expect(result.findings).toEqual(expect.arrayContaining([{file:'new-source.js',line:1,rule:'credential-like assignment'},{file:'.env.release',rule:'release environment file'}]));
  expect(JSON.stringify(result)).not.toContain('synthetic-regression-value');expect(JSON.stringify(result)).not.toContain('ignored.env');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
it('deduplicates staged files, tolerates working-tree removal and flags links without reading their targets',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'release-worktree-'));
 try{
  execFileSync('git',['init','--quiet'],{cwd:dir});writeFileSync(join(dir,'keep.txt'),'safe');writeFileSync(join(dir,'gone.txt'),'removed');execFileSync('git',['add','.'],{cwd:dir});rmSync(join(dir,'gone.txt'));
  symlinkSync('/nonexistent-release-fixture',join(dir,'link'));const result=await runReleaseCheck({cwd:dir,audit:false});expect(result.scannedFiles).toBe(1);expect(result.findings).toEqual([{file:'link',rule:'symlink requires release review'}]);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
