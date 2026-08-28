import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';

const run = promisify(execFile);

const MAX_SCANNED_BYTES = 2_000_000;
const ALLOW_MARKER = 'release-check:allow';

// The prefix repeats: real names are multi-segment (`HKUST_MCP_API_KEY`).
const CREDENTIAL_NAME = String.raw`(?:[A-Z][A-Z0-9]*[_-])*(?:API[_-]?KEY|ACCESS[_-]?TOKEN|AUTH[_-]?TOKEN|REFRESH[_-]?TOKEN|CLIENT[_-]?SECRET|SECRET[_-]?KEY|PRIVATE[_-]?KEY|TOKEN|SECRET|PASSWORD|PASSWD)`;

// Conservative on purpose, in two ways. Only `=`, never `NAME: value` — source
// registries and fixtures legitimately carry key-ish object properties. And the
// value must look like a literal: either env/shell/CLI style with no spaces
// (`DEMO_TOKEN=abc`, release-check:allow) or a quoted string (`const apiKey =
// 'sk-…'`). Reading a credential out of config is normal code, so the common
// `const apiKey = options.apiKey` shape must stay quiet. A guard that cries
// wolf gets switched off. Any line may opt out with the release-check:allow
// marker, which is how this file's own examples stay quiet.
const CREDENTIAL_ASSIGNMENT = new RegExp(
  String.raw`\b${CREDENTIAL_NAME}\b(?:=(\S+)|\s*=\s*(["'\`][^"'\`]*["'\`]))`,
  'i',
);

const PLACEHOLDER_VALUE =
  /^(?:replace[-_ ]?with|your[-_ ]|example|placeholder|changeme|change[-_ ]me|dummy|fake|sample|test[-_ ]|redacted|none|null|undefined|true|false|""|''|<[^>]*>|\$\{[^}]*\}|\$[A-Z_]+|x{3,}|\.{3}|\*{3,})/i;

const FORBIDDEN_PATHS = [
  { rule: 'tracked environment file', test: (file) => /(?:^|\/)\.env(?:\.|$)/.test(file) },
  { rule: 'tracked calendar export', test: (file) => /\.(?:ics|ical|ifb)$/i.test(file) },
  { rule: 'tracked contact or profile export', test: (file) => /\.(?:vcf|mbox|eml|pst|ost)$/i.test(file) },
  { rule: 'tracked key material', test: (file) => /\.(?:pem|p12|pfx|jks|keystore|asc)$/i.test(file) },
];

function unquote(value) {
  return value.replace(/^["'`]+/, '').replace(/["'`,;)]+$/, '');
}

/**
 * Classify one line of tracked text. Returns rule names only — never the
 * matched value, so findings stay safe to paste into an issue or a CI log.
 *
 * @param {string} text
 * @returns {Promise<string[]>}
 */
export async function scanTrackedText(text) {
  if (text.includes(ALLOW_MARKER)) {
    return [];
  }

  const match = CREDENTIAL_ASSIGNMENT.exec(text);
  if (!match) {
    return [];
  }

  const value = unquote(match[1] ?? match[2]);
  return value === '' || PLACEHOLDER_VALUE.test(value) ? [] : ['credential-like assignment'];
}

async function listTrackedFiles(cwd) {
  const { stdout } = await run('git', ['ls-files', '-z'], { cwd, maxBuffer: 32 * 1024 * 1024 });
  return stdout.split('\0').filter(Boolean);
}

async function readTextFile(cwd, file) {
  const buffer = await readFile(path.join(cwd, file));
  if (buffer.byteLength > MAX_SCANNED_BYTES || buffer.subarray(0, 8000).includes(0)) {
    return null;
  }

  return buffer.toString('utf8');
}

async function auditProduction(cwd) {
  try {
    await run('npm', ['audit', '--omit=dev', '--json'], { cwd, maxBuffer: 32 * 1024 * 1024 });
    return { ran: true, vulnerabilities: 0 };
  } catch (error) {
    // npm audit exits non-zero when it finds something; the JSON is still on stdout.
    const report = JSON.parse(error.stdout ?? '{}');
    const counts = report?.metadata?.vulnerabilities;
    if (!counts) {
      throw error;
    }

    return { ran: true, vulnerabilities: counts.total ?? 0, breakdown: counts };
  }
}

/**
 * @param {{ cwd?: string, audit?: boolean }} [options]
 * @returns {Promise<{ ok: boolean, findings: Array<{ file: string, line?: number, rule: string }>, scannedFiles: number, audit: object }>}
 */
export async function runReleaseCheck({ cwd = process.cwd(), audit = true } = {}) {
  const files = await listTrackedFiles(cwd);
  const findings = [];
  let scannedFiles = 0;

  for (const file of files) {
    for (const { rule, test } of FORBIDDEN_PATHS) {
      if (test(file)) {
        findings.push({ file, rule });
      }
    }

    const text = await readTextFile(cwd, file);
    if (text === null) {
      continue;
    }

    scannedFiles += 1;
    const lines = text.split('\n');
    for (const [index, line] of lines.entries()) {
      for (const rule of await scanTrackedText(line)) {
        findings.push({ file, line: index + 1, rule });
      }
    }
  }

  const auditResult = audit ? await auditProduction(cwd) : { ran: false };
  const ok = findings.length === 0 && (auditResult.vulnerabilities ?? 0) === 0;

  return { ok, findings, scannedFiles, audit: auditResult };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await runReleaseCheck();

  console.log(`release-check: scanned ${result.scannedFiles} tracked text files`);
  for (const finding of result.findings) {
    console.error(`  ${finding.rule}: ${finding.file}${finding.line ? `:${finding.line}` : ''}`);
  }

  if (result.audit.ran) {
    console.log(`release-check: npm audit --omit=dev reported ${result.audit.vulnerabilities} vulnerabilities`);
  }

  if (!result.ok) {
    console.error('release-check: FAILED');
    process.exit(1);
  }

  console.log('release-check: OK');
}
