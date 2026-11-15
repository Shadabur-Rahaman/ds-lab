import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const repo = 'D:/10_PROJECTS/ds-lab-publish';
export const remote = 'https://github.com/Shadabur-Rahaman/ds-lab.git';
export const slug = 'Shadabur-Rahaman/ds-lab';
export const liveUrl = 'https://shadabur-rahaman.github.io/ds-lab/';
export const mailbox = path.join(repo, '.ds-lab-release');
export const ready = path.join(mailbox, 'ready.json');
export const verified = path.join(mailbox, 'host-verified.json');
const sha = /^[a-f0-9]{40}$/;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const source = /^(?:(?:src|tests)\/(?:[\w-]+\/)*[\w.-]+\.(?:tsx?|css|mdx|mjs|js)|public\/(?:datasets\/[\w-]+\.csv|python-worker\.js)|supabase\/migrations\/[\w-]+\.sql|scripts\/(?:RELEASE\.md|[\w-]+\.(?:mjs|ps1))|(?:AGENTS|README)\.md|\.gitignore|index\.html|(?:package(?:-lock)?|tsconfig)\.json|(?:playwright|vite)\.config\.ts)$/;
const secret = /-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|(?:AKIA|ASIA)[A-Z0-9]{16}|sk-(?:proj-)?[A-Za-z0-9_-]{24,}|xox[baprs]-[A-Za-z0-9-]{12,}|eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)\b|(?:password|client[_-]?secret|api[_-]?key|access[_-]?token)\s*[:=]\s*['"][^'"\s]{8,}['"]/i;

export function git(args, cwd = repo, options = {}) {
  return execFileSync(process.env.DS_LAB_RELEASE_GIT || 'git', args, {
    cwd, encoding: 'utf8', windowsHide: true, timeout: 90_000,
    maxBuffer: 16 * 1024 * 1024, ...options,
  });
}

export function assertMailbox() {
  fs.mkdirSync(mailbox, { recursive: true });
  if (!fs.lstatSync(mailbox).isDirectory() || fs.lstatSync(mailbox).isSymbolicLink()) {
    throw new Error('Release mailbox must be a real directory.');
  }
}

export function assertRepo() {
  if (fs.realpathSync(repo).replaceAll('\\', '/').toLowerCase() !== repo.toLowerCase()
      || git(['rev-parse', '--show-toplevel']).trim().toLowerCase() !== repo.toLowerCase()
      || git(['symbolic-ref', 'HEAD']).trim() !== 'refs/heads/main'
      || git(['remote', 'get-url', '--all', 'origin']).trim() !== remote
      || git(['remote', 'get-url', '--all', '--push', 'origin']).trim() !== remote) {
    throw new Error('Expected the canonical checkout, main branch and exact GitHub origin.');
  }
  for (const state of ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-apply', 'rebase-merge', 'sequencer', 'index.lock']) {
    if (fs.existsSync(path.resolve(repo, git(['rev-parse', '--git-path', state]).trim()))) {
      throw new Error(`Git operation in progress (${state}).`);
    }
  }
  if (git(['ls-files', '-u'])) throw new Error('The index contains merge conflicts.');
  return git(['rev-parse', 'HEAD']).trim();
}

export function scanText(text) {
  if (secret.test(text)) throw new Error('Potential secret detected in selected content or message.');
}

export function filePath(file) {
  if (typeof file !== 'string' || !source.test(file)
      || file.split('/').some(part => part.startsWith('.') && part !== '.gitignore'
        || /(?:^|[._-])(?:secrets?|credentials?|id_rsa|id_ed25519)(?:[._-]|$)/i.test(part))) {
    throw new Error('Path is outside the release source allowlist.');
  }
  let current = repo;
  const parts = file.split('/');
  for (const [index, part] of parts.entries()) {
    current = path.join(current, part);
    const item = fs.lstatSync(current, { throwIfNoEntry: false });
    if (item && (item.isSymbolicLink() || (index < parts.length - 1 && !item.isDirectory()))) {
      throw new Error(`Invalid source path: ${file}`);
    }
  }
  if (fs.existsSync(current) && fs.realpathSync(current) !== current) {
    throw new Error(`Source path must use its exact spelling: ${file}`);
  }
  return current;
}

export function readSource(file) {
  const absolute = filePath(file);
  const item = fs.lstatSync(absolute, { throwIfNoEntry: false });
  if (!item) return { sha256: null, bytes: null };
  if (!item.isFile() || item.nlink !== 1 || item.size > 10 * 1024 * 1024) {
    throw new Error(`Expected a regular source file under 10 MiB: ${file}`);
  }
  const bytes = fs.readFileSync(absolute);
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  if (text.includes('\0')) throw new Error(`Expected a text source file: ${file}`);
  scanText(text);
  return { sha256: hash(bytes), bytes };
}

export function validateManifest(manifest) {
  if (manifest?.version !== 1 || typeof manifest.base !== 'string' || !sha.test(manifest.base)
      || typeof manifest.message !== 'string' || !/^[^\x00-\x1f\x7f]{1,200}$/.test(manifest.message)
      || !manifest.message.trim() || !Array.isArray(manifest.files)
      || manifest.files.length < 1 || manifest.files.length > 250) {
    throw new Error('Invalid release manifest.');
  }
  scanText(manifest.message);
  const names = new Set();
  for (const entry of manifest.files) {
    filePath(entry.path);
    if (names.has(entry.path.toLowerCase()) ||
        (entry.sha256 !== null && (typeof entry.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(entry.sha256)))) {
      throw new Error('Duplicate path or invalid file fingerprint.');
    }
    names.add(entry.path.toLowerCase());
  }
  return manifest;
}

export function inspect(manifest) {
  validateManifest(manifest);
  if (assertRepo() !== manifest.base) throw new Error('Local HEAD changed since the manifest was created.');
  const statuses = git(['status', '--porcelain=v1', '-z', '--no-renames', '--untracked-files=no'])
    .split('\0').filter(Boolean);
  const changed = new Set(statuses.map(line => line.slice(3)));
  const selected = new Set(manifest.files.map(entry => entry.path));
  if ([...changed].some(file => !selected.has(file))) throw new Error('Tracked changes exist outside the manifest.');
  const files = manifest.files.map(entry => {
    const contents = readSource(entry.path);
    if (contents.sha256 !== entry.sha256) throw new Error(`Source changed since handoff: ${entry.path}`);
    const status = statuses.find(line => line.slice(3) === entry.path);
    if (status && status[0] !== ' ' && git(['--literal-pathspecs', 'diff', '--name-only', '--', entry.path])) {
      throw new Error(`Staged and working-tree versions differ: ${entry.path}`);
    }
    if (!changed.has(entry.path) && (!contents.bytes
        || git(['--literal-pathspecs', 'status', '--porcelain=v1', '-z', '--untracked-files=all', '--', entry.path])
          !== `?? ${entry.path}\0`)) {
      throw new Error(`Expected an exact changed or new source file: ${entry.path}`);
    }
    return { ...entry, ...contents };
  });
  return files;
}

export function makeManifest(message, files) {
  const manifest = {
    version: 1,
    base: assertRepo(),
    message,
    files: files.sort().map(file => ({ path: file, sha256: readSource(file).sha256 })),
  };
  inspect(manifest);
  return manifest;
}

export function publishManifest(manifest, destination = ready) {
  const temporary = path.join(path.dirname(destination), `ready-${randomUUID()}.tmp`);
  fs.writeFileSync(temporary, JSON.stringify(manifest), { flag: 'wx', flush: true });
  try {
    // Windows File.Move in the same directory publishes without replacing an existing file.
    // Node's rename would replace it. Pass paths as data, never as PowerShell source.
    const powershell = path.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    execFileSync(powershell, [
      '-NoProfile', '-NonInteractive', '-Command',
      "$ErrorActionPreference = 'Stop'; [IO.File]::Move($env:DSLAB_MANIFEST_TEMP, $env:DSLAB_MANIFEST_READY)",
    ], {
      env: { ...process.env, DSLAB_MANIFEST_TEMP: path.resolve(temporary), DSLAB_MANIFEST_READY: path.resolve(destination) },
      encoding: 'utf8', windowsHide: true, timeout: 30_000, stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    if (fs.existsSync(destination)) throw new Error('A release is already pending.');
    throw new Error(`Could not publish release manifest: ${error.stderr?.trim() || error.message}`);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    assertMailbox();
    if (process.argv[2] === '--status') {
      console.log(fs.existsSync(ready) ? 'Release pending. Wait before editing.' :
        fs.existsSync(verified) ? 'Host installation verified. No release pending.' : 'Host installation has not been verified.');
      process.exitCode = fs.existsSync(ready) ? 2 : 0;
    } else {
      if (!fs.existsSync(verified)) throw new Error('Complete the one-time Windows installation before queuing.');
      if (fs.existsSync(ready)) throw new Error('A release is already pending.');
      const manifest = makeManifest(process.argv[2], process.argv.slice(3));
      publishManifest(manifest);
      console.log('Release manifest queued.');
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
