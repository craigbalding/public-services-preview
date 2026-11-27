# Topic format

New topics use the [v7 template](../content/templates/topic-v7.json). Each topic records its template in `content/topics/<topic-id>.json`. Keep the stable topic ID and existing fragments on updates. The [tagging topic JSON](../content/topics/prisoner-tagging.json) shows the full range of build features used in the pilot and remains pinned to v6.

## Where to put the material

| Material | Location and references |
|---|---|
| Title and scope | `id`, `title`, `category`, `scope`, `summary`, `reviewed`, `citations` |
| Source record | `sources` keyed by source ID, with `title`, `publisher`, HTTPS `url` and available `date` and `reference`. Keep published source ordering stable so numbered references retain their targets. |
| People and organisations | Shared display names in `content/actors.json`. Topic-specific roles and citations in the topic’s `actors`. |
| Process | `visuals` with ordered, identified steps and cited text. Attach a `note` to the relevant step for a sourced design explanation. Use `visual` in the `how-it-works` section to show the flow. |
| Findings | `issues` records with `step.visual`, `step.id`, `title`, `text`, `citations`, cited `consequences`, and a `measure` of progress. Publish the IDs in an `issues` block under `what-needs-fixing`. |
| Figures | Define `metrics` and `charts` on the topic, with chart inputs in `content/data/`. Attach IDs to the finding to display them beside its claims. Label metric `population`, `period`, `type` and `basis`. Use an `evidenceGap` on the finding when the right figure is unavailable. |
| Response | Add `improvement` to a finding when there is a sourced response. Give `owner`, `title`, `status` and `citations`, then publish the finding ID in an `improvements` block under `whats-changing`. |
| Scrutiny | `scrutiny` records give `step`, `question`, `answer`, `citations`, `watch` and a `record` for a written source or `recording` for a source with a timestamp in `reference`. Publish IDs in a `scrutiny` block under `whats-changing`. A string in `collapseExchanges` supplies a disclosure title. |
| Supporting material | Use `details` with a `title` and nested `blocks` for supplementary history or methods. `sources` may be an empty block list. The build appends the references. |

Use all six section IDs from the template. Add three entries to the `takeaways` block. Summarise outcome evidence or its limits in `outcomes`. The `whats-changing` section can use cited text to explain the available record and what would show progress, including where there are no public commitments to track. A finding with only qualitative evidence still needs a source, consequence, evidence gap and measure of progress. An unannounced response needs no `improvement` object or link.

## Follow-up records

Give each requested or promised item a `followUp.title` and a `followUp.history` array. Entries use `date` in `YYYY-MM-DD` format, `status`, `text` and `citations`. Use `requested`, `promised`, `overdue`, `partial` and `provided`. Preserve earlier entries and append dated updates in order. Describe the expected timing in `text` using the source’s precision. A publication fulfilling a request belongs in the history. Subsequent service performance belongs alongside the finding’s measure.

## Check the output

Run `node src/build.mjs` from the repository root. It writes `dist/` and validates section structure, evidence references, citations and other template requirements. Open the rendered topic under `dist/topics/<topic-id>/index.html` or serve `dist/` with `python3 -m http.server 3000 --directory dist`. Check the content in the reading order, follow links to figure and source anchors and expand supplementary sections. See the [editorial playbook](topic-playbook.md) for the evidence checks.
