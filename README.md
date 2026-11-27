# Public services site

Build with Node.js 24 using `node src/build.mjs`. The generated site lives in `dist/`. For local review, serve that directory with a static HTTP server, for example `python3 -m http.server 3000 --directory dist`.

- `site.json` holds the working title, description and indexing preference.
- `content/topics/` contains each topic's content and references. Each topic pins a template in `content/templates/`.
- `content/actors.json` gives actors a shared ID and display name.
- `content/data/` holds the snapshots used by charts.

The build validates required sections and resolves actor, citation, chart and visual references before writing HTML. Pull requests run the same build. To enable publication, select **Settings → Pages → Source → GitHub Actions** in the project repository. Pushes to `main` and manual runs on `main` deploy the generated site. Relative links support a repository Pages path and a later custom domain. The preview requests search-engine exclusion using a robots meta tag. GitHub Pages serves the published pages publicly.

## Topic template v2

Explain what the service is meant to achieve, then use the history to answer a specific question about today's design. In `metrics`, record the cohort and period in the basis or observation date, the kind of evidence, and the citation. Supply a count and denominator when the source gives both. Use a published percentage when the underlying counts are unavailable.

For each finding, link to the relevant step by its visual and step IDs and to the figures that substantiate it. Where a figure is unavailable, state the evidence gap. Give each response an owner, a sourced status and a measure that could show progress. Publish each finding under `issues` and its response under `improvements` using the same ID.

## Topic template v3

Link process steps to their evidence using `charts` and `metrics` IDs. Describe the population and period for each standalone metric. Use a status chart for snapshots of the same stages. Each bar has its own dated population, and the stage counts must be mutually exclusive and add to that population.

Store trend observations as `[date, count, publicationStatus?]` within comparable segments, with a definition and citing sources for each segment. Start a new segment at a collection break and use `null` for a missing observation inside a segment. Mark collection and policy events separately. Use the latest comparable historical revisions where the publisher provides them, and report when key follow-up measures are unavailable.
