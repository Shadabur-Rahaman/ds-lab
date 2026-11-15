# DS LAB

DS LAB is the Data Science track for a shared learning ecosystem. This local milestone includes a homepage, a progress dashboard, a searchable catalog, a four-stage roadmap and three interactive lessons. The 12-course curriculum maps 48 chapters. Interactive content is available for the three samples, with Python coursework linked to the existing Python Lab.

## Run locally

1. Run `npm ci` and `npm run dev -- --port 5174`.
2. Open `http://127.0.0.1:5174/`.
3. Use `npm run build` for the production bundle. Serve `index.html` for application routes such as `/learn/statistics`.
4. Install Chromium with `npx playwright install chromium`, keep the dev server running and run `npm run test:e2e`. To test the built bundle through browser request interception in a loopback-restricted environment, set `DS_TEST_STATIC=1` after building. Live runtime tests require access to the Pyodide CDN.

## Architecture

## GitHub Pages previews

In the DS LAB GitHub repository, select **Settings → Pages → Source → GitHub Actions**. The included workflow builds and publishes on pushes to `main` and can also run manually. It uses the Pages base path for internal navigation, datasets and the Python worker, and emits directory index files so direct lesson links and refreshes work.

On this machine, use `D:\10_PROJECTS\ds-lab-publish` as the Git checkout for future releases. Review and reconcile any edits made in `D:\10_PROJECTS\DS LAB` before committing. Run `npm ci`, build with `DS_LAB_BASE=/ds-lab/`, and run the desktop and mobile browser checks before pushing to `main`. Verify the **Publish DS LAB** run and open the live site before closing out a release. The static browser checks cover navigation and project exercises. Run the live Python checks separately with network access to the Pyodide CDN.

The guided Iris EDA project at `/projects/iris` uses the 150 observations in UCI's `bezdekIris.data`. The bundled CSV adds headers and shortens species labels. Fisher (1936), [Iris](https://doi.org/10.24432/C56C76), UCI Machine Learning Repository, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Learners can compare distributions, check an interpretation, and export a Markdown report. Report drafts are saved on the current browser.

- `src/data.ts` holds course, chapter and lesson metadata. `src/content` holds MDX-compatible prose. `LessonContent` implements a restricted Markdown subset for the samples. JSX inside authored lesson files requires a full MDX compiler.
- `src/components.tsx` contains visual experiments, quizzes and the code workspace. `public/python-worker.js` adapts the existing Python Lab Pyodide worker with package loading for pandas. Python runs on the learner's device and requires the CDN on first use.
- `src/lib/progress.ts` preserves the original progress key and records visits separately from graded completion. `src/lib/learnerData.ts` reads existing draft and notes keys and adds per-draft revision metadata. The dashboard can export and merge an allowlisted JSON backup. Clearing one lesson clears its progress only. Clearing local learning data leaves authentication, preferences, and account data intact.

## Project Studio

V11 projects already had working datasets, interactive analyses, domain checks and report downloads. The shared Studio adds six evidence-based milestones, a dataset preview and profiler, and graded Python exercises around those workbenches. Prior project completions and notes are preserved. New completions require all six milestones, and the original project reports can still be downloaded while work is in progress.

Project reports are saved as local snapshots. Once all six milestones are verified, the portfolio can export Markdown or JSON with the last report's actual results and learner findings. Guided and independent modes use the same checks and saved code, with fewer hints in independent mode. Textual interpretations are reviewed using the project criteria and learner judgment.

## Optional account sync

The existing Pages workflow does not inject Supabase settings. Guest progress, notes and drafts work without them. For an authorized Supabase deployment, apply `001_progress.sql` and `002_learner_sync.sql` and supply `VITE_SUPABASE_URL` plus `VITE_SUPABASE_PUBLISHABLE_KEY` (or the legacy public `VITE_SUPABASE_ANON_KEY`) at build time. Use a public browser key and configure the existing OTP redirect to the deployed dashboard. Server keys belong outside Vite environment variables.

Sync starts when a signed-in learner enables it. The first merge includes this browser’s saved activity and the original cloud lesson flags. Completion flags merge monotonically, and snapshots use revision-checked writes so a competing edit must be read and merged before retrying. Drafts use edit timestamps with a deterministic text tie-break. If the same draft has different edits, keep a backup before linking both devices. Accounts can access only their own snapshots through Row Level Security. A local reset pauses sync. Enabling it again can restore account progress. Sign-out retains this browser’s saved work.
- React and TypeScript use Vite for this milestone. Stable URLs and separation of curriculum, prose and browser interactions provide a migration path to Next.js and full MDX. HTML Lab and JavaScript Lab are listed as planned integrations. Unified sign-in, cross-lab progress, more real datasets and full capstones remain future work.
