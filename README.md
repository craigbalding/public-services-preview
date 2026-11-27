# Public services site

Build with Node.js 24 using `node src/build.mjs`. The generated site lives in `dist/`. For local review, serve that directory with a static HTTP server, for example `python3 -m http.server 3000 --directory dist`.

- `site.json` holds the working title, description and indexing preference.
- `content/topics/` contains each topic's content and references. Each topic pins a template in `content/templates/`.
- `content/actors.json` gives actors a shared ID and display name.
- `content/data/` holds the snapshots used by charts.

The build validates required sections and resolves actor, citation, chart and visual references before writing HTML. Pull requests run the same build. To enable publication, select **Settings → Pages → Source → GitHub Actions** in the project repository. Pushes to `main` and manual runs on `main` deploy the generated site. Relative links support a repository Pages path and a later custom domain. The preview requests search-engine exclusion using a robots meta tag. GitHub Pages serves the published pages publicly.
