# Public services site

Build with Node.js 24 using `node src/build.mjs`. The generated site lives in `dist/`. For local review, serve that directory with a static HTTP server, for example `python3 -m http.server 3000 --directory dist`.

For candidate selection, use the [commissioning skill](.agents/skills/commission-public-service-topics/SKILL.md) and [brief queue](commissioning/README.md). Run `node src/commissioning.mjs` to validate and list ready and held briefs. For drafting, use the [editorial playbook](docs/topic-playbook.md), [v7 topic format](docs/topic-format.md) and the skills to [draft a topic](.agents/skills/draft-public-service-topic/SKILL.md) and [review a topic](.agents/skills/review-public-service-topic/SKILL.md).

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

## Topic template v4

Add a sourced consequence to each finding. Use case examples to explain what happened to the people affected and distinguish observed harm from potential harm. In the outcomes section, give each comparison its population, outcome definition, follow-up period and limits. Rates charts use values from 0 to 100 and the full percentage scale.

## Topic template v5

Use `scrutiny` to follow questions that test how well a specific process step works. Cite the official record, link to the relevant exchange using a timestamp, and explain what observable result would show progress. Add the transcript and question number when available. Link to comparable baseline figures where they exist.

For each request for evidence or explicit commitment, give `followUp` a title and start a dated, cited `history` with `requested` or `promised`. Record the expected timing as precisely as the source allows. Append new evidence using `overdue`, `partial` or `provided` as appropriate and explain what the evidence establishes. As service results become available, update the relevant measures and report the periods they cover. Record changes already under way before the hearing so the chronology is clear.

## Topic template v6

Open with three sourced `takeaways` on purpose, what can go wrong and what to watch. Explain the reason for a design choice beside the relevant process step using its `note`. Use `details` blocks with a title and nested content for supporting history, data or methods. A block ID on a disclosure gives readers a link to its contents.

Set `inlineEvidence` on an `issues` block to show each finding’s charts, metrics, consequences and measure of progress together. Define those chart and metric references on the finding itself. Use the response and scrutiny blocks together under “What to watch next” to show what has been announced and what still needs evidence. `collapseExchanges` keeps the committee tracker visible with the full hearing exchanges available to open. The template lists the three jumps shown on smaller screens.
