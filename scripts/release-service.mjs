import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertMailbox, assertRepo, git, inspect, liveUrl, makeManifest, ready, remote, repo, scanText, slug, verified } from './release-manifest.mjs';

const state = path.dirname(fileURLToPath(import.meta.url));
const dry = process.argv[2] === '--dry-run';
const check = process.argv[2] === '--check-host';
const hostConfig = path.join(state, 'host-config.json');
const installed = fs.existsSync(hostConfig) ? JSON.parse(fs.readFileSync(hostConfig, 'utf8')) : {};
const env = {
  ...process.env,
  GIT_TERMINAL_PROMPT: '0',
  GIT_OPTIONAL_LOCKS: '0',
  GCM_INTERACTIVE: 'Never',
  GH_PROMPT_DISABLED: '1',
  CI: 'true',
  DS_LAB_BASE: '/ds-lab/',
  DS_TEST_STATIC: '1',
};
if (installed.path) env.PATH = installed.path;
if (installed.npmCli) env.DS_LAB_NPM_CLI = installed.npmCli;
if (installed.gitExe) env.DS_LAB_RELEASE_GIT = installed.gitExe;
for (const name of Object.keys(env)) {
  if (/^(GIT_(?:DIR|WORK_TREE|INDEX_FILE|COMMON_DIR|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES|CONFIG.*)|NODE_OPTIONS|PLAYWRIGHT_JSON_.*|PWDEBUG)$/i.test(name)) {
    delete env[name];
  }
}
// Imported Git helpers also run with a known environment.
for (const name of Object.keys(process.env)) {
  if (!(name in env)) delete process.env[name];
}
Object.assign(process.env, env);

function run(program, args, { cwd = repo, timeout = 90_000, output } = {}) {
  const executable = program === 'git' ? installed.gitExe : program === 'gh' ? installed.ghExe : program;
  const fd = output ? fs.openSync(output, 'a') : null;
  try {
    const result = spawnSync(executable || program, args, {
      cwd, env, timeout, encoding: 'utf8', windowsHide: true,
      stdio: ['ignore', fd ?? 'pipe', fd ?? 'pipe'],
    });
    if (result.error || result.status !== 0) {
      throw new Error(`${program} ${args.slice(0, 2).join(' ')} failed (${result.error?.code ?? result.status}).`);
    }
    return result.stdout?.trim();
  } finally {
    if (fd !== null) fs.closeSync(fd);
  }
}

function npm(args, cwd, output, extra = {}) {
  // Call npm-cli with Node so command arguments never pass through cmd.exe.
  const candidates = [
    process.env.DS_LAB_NPM_CLI,
    path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'),
  ];
  const cli = candidates.find(candidate => candidate && fs.existsSync(candidate));
  if (!cli) throw new Error('Cannot locate npm-cli.js beside Node. Set DS_LAB_NPM_CLI during installation.');
  Object.assign(env, extra);
  try {
    run(process.execPath, [cli, ...args], { cwd, output, timeout: 12 * 60_000 });
  } finally {
    for (const name of Object.keys(extra)) delete env[name];
  }
}

function remoteHead() {
  const result = run('git', ['ls-remote', '--exit-code', remote, 'refs/heads/main']);
  if (!/^[a-f0-9]{40}\trefs\/heads\/main$/.test(result)) throw new Error('Unexpected remote main response.');
  return result.split('\t')[0];
}

function verifyHost(probePush = false) {
  assertRepo();
  run('gh', ['auth', 'status', '--hostname', 'github.com']);
  run('gh', ['workflow', 'view', 'pages.yml', '--repo', slug]);
  remoteHead();
  npm(['--version'], repo);
  if (probePush) {
    run('git', ['-c', 'push.followTags=false', 'push', '--dry-run', '--no-verify',
      '--recurse-submodules=no', 'origin', 'HEAD:refs/heads/main']);
  }
}

function writeJson(target, record) {
  const temp = `${target}.${randomUUID()}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(record, null, 2), { flush: true });
  fs.renameSync(temp, target);
}

function save(record) {
  if (dry) {
    console.log(JSON.stringify(record));
    return;
  }
  writeJson(path.join(state, `${record.id}.json`), { ...record, updated: new Date().toISOString() });
}

const runtimeTests = new Set([
  'executes Python, reports an exception and restarts after stopping',
  'grades the foundations and statistics challenges',
  'executes pandas and grades the cleaning challenge',
]);

function assertTests(report, live = false) {
  const counts = {};
  const runtimeCoverage = new Set();
  function visit(suite) {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const runtime = suite.title === 'real Pyodide' && runtimeTests.has(spec.title);
        if (!live && runtime && test.expectedStatus === 'skipped' && test.status === 'skipped') {
          runtimeCoverage.add(`${test.projectName}:${spec.title}`);
          continue;
        }
        if (test.expectedStatus !== 'passed' || test.status !== 'expected'
            || test.results.length !== 1 || test.results[0].status !== 'passed'
            || (live && (!runtime || test.projectName !== 'desktop'))) {
          throw new Error('Playwright reported a skipped, retried or non-passing test.');
        }
        counts[test.projectName] = (counts[test.projectName] ?? 0) + 1;
        if (live) runtimeCoverage.add(spec.title);
      }
    }
    for (const child of suite.suites ?? []) visit(child);
  }
  for (const suite of report.suites ?? []) visit(suite);
  const covered = live ? runtimeCoverage.size === runtimeTests.size && counts.desktop === runtimeTests.size
    : counts.desktop && counts.mobile && ['desktop', 'mobile'].every(project =>
      [...runtimeTests].every(title => runtimeCoverage.has(`${project}:${title}`)));
  if (!covered || report.errors?.length || report.stats?.flaky) {
    throw new Error('Missing successful desktop/mobile Playwright coverage.');
  }
  return counts;
}

function syncCanonical(manifest, bundle, commit, indexBefore) {
  git(['bundle', 'unbundle', bundle]);
  inspect(manifest);
  if (git(['diff', '--cached', '--raw', '-z']) !== indexBefore) {
    throw new Error('Canonical index changed during validation. The pushed commit needs local reconciliation.');
  }
  // Advance only main with a compare-and-swap, then update only the index.
  git(['update-ref', '-m', 'DS LAB automated release', 'refs/heads/main', commit, manifest.base]);
  git(['read-tree', '--reset', commit]);
  if (git(['for-each-ref', '--format=%(objectname)', 'refs/remotes/origin/main']).trim() === manifest.base) {
    git(['update-ref', 'refs/remotes/origin/main', commit, manifest.base]);
  }
}

function release(manifest, record) {
  const files = inspect(manifest);
  const indexBefore = git(['diff', '--cached', '--raw', '-z']);
  if (!dry) {
    verifyHost();
    if (remoteHead() !== manifest.base) throw new Error('Remote main differs from the approved base.');
  }
  const snapshot = fs.mkdtempSync(path.join(os.tmpdir(), 'ds-lab-release-'));
  const output = dry ? path.join(os.tmpdir(), `ds-lab-dry-${randomUUID()}.log`) : path.join(state, `${record.id}.log`);
  record.output = output;
  const isolatedGit = args => git(args, snapshot);
  try {
    isolatedGit(['init', '--quiet']);
    const baseBundle = path.join(snapshot, '.git', 'base.bundle');
    git(['bundle', 'create', baseBundle, 'refs/heads/main']);
    isolatedGit(['bundle', 'unbundle', baseBundle]);
    fs.unlinkSync(baseBundle);
    const hooks = path.join(snapshot, '.git', 'release-hooks');
    fs.mkdirSync(hooks);
    isolatedGit(['config', 'core.hooksPath', hooks.replaceAll('\\', '/')]);
    isolatedGit(['checkout', '--quiet', '--detach', manifest.base]);
    isolatedGit(['remote', 'add', 'origin', remote]);
    if (isolatedGit(['remote', 'get-url', '--all', '--push', 'origin']).trim() !== remote) {
      throw new Error('Git configuration rewrites the release push destination.');
    }
    for (const { path: file, bytes } of files) {
      const target = path.join(snapshot, file);
      if (bytes === null) {
        fs.unlinkSync(target);
      } else {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, bytes);
      }
    }
    const selected = files.map(file => file.path);
    isolatedGit(['--literal-pathspecs', 'add', '--', ...selected]);
    const staged = isolatedGit(['diff', '--cached', '--name-only', '-z', '--no-renames']).split('\0').filter(Boolean);
    if (staged.length !== selected.length || selected.some(file => !staged.includes(file))) {
      throw new Error('Snapshot staged paths differ from the approved manifest.');
    }
    isolatedGit(['diff', '--cached', '--check']);
    for (const { path: file, bytes } of files) {
      if (bytes !== null) scanText(isolatedGit(['show', `:${file}`]));
    }
    const tree = isolatedGit(['write-tree']).trim();
    save(record);
    npm(['ci', '--prefer-offline', '--ignore-scripts', '--no-audit', '--no-fund'], snapshot, output);
    if (!dry) {
      run(process.execPath, ['node_modules/@playwright/test/cli.js', 'install', 'chromium'],
        { cwd: snapshot, output, timeout: 5 * 60_000 });
    }
    npm(['run', 'build'], snapshot, output);
    if (!fs.existsSync(path.join(snapshot, 'dist/index.html'))) throw new Error('Build did not produce dist/index.html.');
    record.build = 'passed';
    save(record);
    const report = path.join(snapshot, '.git', 'playwright-report.json');
    npm(['run', 'test:e2e', '--', '--reporter=json', '--forbid-only', '--retries=0'], snapshot, output,
      { PLAYWRIGHT_JSON_OUTPUT_FILE: report });
    record.playwright = { static: assertTests(JSON.parse(fs.readFileSync(report, 'utf8'))) };
    save(record);
    fs.unlinkSync(report);
    delete env.DS_TEST_STATIC;
    try {
      npm(['run', 'test:e2e', '--', '--reporter=json', '--forbid-only', '--retries=0',
        '--project=desktop', '--grep', 'real Pyodide'], snapshot, output, { PLAYWRIGHT_JSON_OUTPUT_FILE: report });
      record.playwright.liveRuntime = assertTests(JSON.parse(fs.readFileSync(report, 'utf8')), true);
    } finally {
      env.DS_TEST_STATIC = '1';
    }
    if (isolatedGit(['write-tree']).trim() !== tree || isolatedGit(['diff', '--name-only'])) {
      throw new Error('Build or tests changed the selected tree.');
    }
    inspect(manifest);
    if (dry) {
      record.status = 'dry-run-passed';
      return;
    }
    if (git(['diff', '--cached', '--raw', '-z']) !== indexBefore || remoteHead() !== manifest.base) {
      throw new Error('Canonical index or remote main changed during validation.');
    }
    const author = git(['var', 'GIT_AUTHOR_IDENT']).trim().match(/^(.*) <([^<>]+)> \d+ [+-]\d+$/);
    if (!author) throw new Error('Git author name and email are required.');
    const identity = ['-c', `user.name=${author[1]}`, '-c', `user.email=${author[2]}`];
    const commit = isolatedGit([...identity, 'commit-tree', tree, '-p', manifest.base, '-m', manifest.message]).trim();
    if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Unexpected commit identity.');
    const candidateBundle = path.join(snapshot, '.git', 'candidate.bundle');
    isolatedGit(['update-ref', 'refs/heads/release-candidate', commit]);
    isolatedGit(['bundle', 'create', candidateBundle, 'refs/heads/release-candidate', `^${manifest.base}`]);
    fs.writeFileSync(path.join(hooks, 'pre-push'), [
      '#!/bin/sh',
      'IFS=" " read -r local_ref local_sha remote_ref remote_sha || exit 1',
      `[ "$local_sha" = "${commit}" ] && [ "$remote_ref" = refs/heads/main ] && [ "$remote_sha" = "${manifest.base}" ] || exit 1`,
      'if IFS= read -r extra; then exit 1; fi',
      '',
    ].join('\n'));
    inspect(manifest);
    if (git(['diff', '--cached', '--raw', '-z']) !== indexBefore) {
      throw new Error('Canonical index changed before push.');
    }
    record.commit = commit;
    record.status = 'push-started';
    record.deadline = Date.now() + 40 * 60_000;
    save(record);
    try {
      run('git', ['-c', `core.hooksPath=${hooks.replaceAll('\\', '/')}`, '-c', 'push.followTags=false',
        'push', '--recurse-submodules=no', 'origin', `${commit}:refs/heads/main`], { cwd: snapshot, output });
    } catch (error) {
      if (remoteHead() !== commit) throw error;
    }
    record.status = 'monitoring';
    save(record);
    try {
      syncCanonical(manifest, candidateBundle, commit, indexBefore);
      record.localSync = 'passed';
    } catch (error) {
      record.localSync = 'failed';
      record.localError = error.message;
    }
  } finally {
    fs.rmSync(snapshot, { recursive: true, force: true });
  }
}

async function monitor(record) {
  try {
    const runs = JSON.parse(run('gh', ['run', 'list', '--repo', slug, '--workflow', 'pages.yml',
      '--branch', 'main', '--event', 'push', '--commit', record.commit, '--limit', '1',
      '--json', 'headSha,status,conclusion,url']));
    const runInfo = runs.find(item => item.headSha === record.commit);
    if (runInfo) {
      record.workflowUrl = runInfo.url;
      if (runInfo.status === 'completed') {
        record.conclusion = runInfo.conclusion;
        if (runInfo.conclusion !== 'success') {
          record.status = 'deployment-failed';
          return;
        }
        const response = await fetch(liveUrl, { signal: AbortSignal.timeout(20_000) });
        if (response.ok && /<title>[^<]*DS LAB/i.test(await response.text())) {
          record.status = 'deployed';
          delete record.monitorError;
          return;
        }
        record.monitorError = 'Live homepage could not be confirmed.';
      }
    }
  } catch (error) {
    record.monitorError = error.message;
  }
  if (Date.now() >= record.deadline) record.status = 'deployment-unverified';
}

async function tick() {
  assertMailbox();
  const probe = path.join(state, 'verify-install');
  if (fs.existsSync(probe)) {
    try {
      verifyHost(true);
      writeJson(verified, { version: 1, verifiedAt: new Date().toISOString() });
      writeJson(path.join(state, 'install-result.json'), { ok: true });
    } catch (error) {
      writeJson(path.join(state, 'install-result.json'), { ok: false, error: error.message });
    }
    fs.unlinkSync(probe);
    return;
  }
  if (!fs.existsSync(ready)) return;
  const item = fs.lstatSync(ready);
  if (!item.isFile() || item.isSymbolicLink() || item.size > 100_000) {
    fs.renameSync(ready, path.join(path.dirname(ready), `invalid-${randomUUID()}.json`));
    writeJson(path.join(path.dirname(ready), 'last-result.json'),
      { status: 'failed', error: 'Invalid ready.json was quarantined.', deploymentUrl: liveUrl });
    return;
  }
  const bytes = fs.readFileSync(ready);
  let manifest;
  try { manifest = JSON.parse(bytes); } catch { /* Record invalid manifests as failed below. */ }
  const identity = Array.isArray(manifest?.files) ? JSON.stringify([
    manifest.version, manifest.base, manifest.files.map(entry => [entry?.path, entry?.sha256])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  ]) : bytes;
  const id = createHash('sha256').update(identity).digest('hex');
  const previous = path.join(state, `${id}.json`);
  const record = fs.existsSync(previous) ? JSON.parse(fs.readFileSync(previous, 'utf8')) :
    { id, status: 'validating', deploymentUrl: liveUrl, build: 'pending', playwright: 'pending' };
  if (!fs.existsSync(previous)) {
    save(record);
    try {
      release(manifest, record);
    } catch (error) {
      record.error = error.message;
      if (record.status === 'validating') record.status = 'failed';
    }
  } else if (record.status === 'validating') {
    record.status = 'interrupted';
    record.error = 'Validation was interrupted before push. This manifest will not be rerun.';
  }
  if (record.status === 'push-started') {
    record.localSync ??= 'unverified';
    // A crash or transport error after push must never trigger a second push.
    // Look up the commit's run even when remote main subsequently advances.
    await monitor(record);
    if (record.status === 'deployment-unverified') record.status = 'push-unverified';
  } else if (record.status === 'monitoring') {
    record.localSync ??= 'unverified';
    await monitor(record);
  }
  save(record);
  if (!['push-started', 'monitoring'].includes(record.status)
      && fs.existsSync(ready) && fs.readFileSync(ready).equals(bytes)) {
    writeJson(path.join(path.dirname(ready), 'last-result.json'), record);
    fs.unlinkSync(ready);
  }
}

try {
  if (dry) {
    const record = { status: 'validating', deploymentUrl: liveUrl };
    try {
      release(makeManifest(process.argv[3], process.argv.slice(4)), record);
    } catch (error) {
      record.status = 'failed';
      record.error = error.message;
      if (record.output && fs.existsSync(record.output)) {
        console.error(fs.readFileSync(record.output, 'utf8').trimEnd().split(/\r?\n/).slice(-18).join('\n'));
      }
      process.exitCode = 1;
    }
    save(record);
  } else if (check) {
    verifyHost(true);
    console.log('Canonical repository, GitHub CLI, Pages workflow, Git remote and npm verified.');
  } else if (process.argv.length === 2) {
    if (state.toLowerCase() === path.join(repo, 'scripts').toLowerCase()) {
      throw new Error('Run the installed service. Use --dry-run for local validation.');
    }
    await tick();
  } else {
    throw new Error('Unknown release service argument.');
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
