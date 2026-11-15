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
- `src/lib/progress.ts` stores quiz and code results locally. Optional Supabase OTP authentication and cloud progress use the migration in `supabase/migrations` and the variables in `.env.example`. Only use a public browser key. Cloud configuration and live account workflows require verification against the intended project before launch.
- React and TypeScript use Vite for this milestone. Stable URLs and separation of curriculum, prose and browser interactions provide a migration path to Next.js and full MDX. HTML Lab and JavaScript Lab are listed as planned integrations. Unified sign-in, cross-lab progress, more real datasets and full capstones remain future work.
