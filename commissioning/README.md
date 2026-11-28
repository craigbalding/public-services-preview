# Topic commissioning

Commissioning turns public evidence and reader questions into briefs that can be handed to [drafting](../.agents/skills/draft-public-service-topic/SKILL.md) and [independent review](../.agents/skills/review-public-service-topic/SKILL.md). Use the [commissioning skill](../.agents/skills/commission-public-service-topics/SKILL.md) for each run and the [editorial playbook](../docs/topic-playbook.md) to check sources.

## Run the queue

| Run | Work |
| --- | --- |
| Nightly new topics | Check timely leads and under-covered services across UK jurisdictions. Develop the strongest ready briefs up to available drafting and independent review capacity. Carry other ready briefs forward. |
| Weekly refresh | Check existing guides against new data, revisions, rule and fee changes, and promises due. Create or update a brief only where the change would affect what a reader does, expects or concludes. |

The [source register](sources-v1.json) gives starting points and what to look for. Follow the actual publisher links to validate dates, definitions and cited tables. Record where a live copy was unavailable. For local services, choose councils or providers with comparable records and explain why they were picked. For search, distinguish observed search data from terminology found in public questions or reporting. Google Trends measures relative interest. After launch, site search performance or AI citation reporting can add evidence about this site’s visibility on those services. Demand signals can support commissioning. A service rule or performance claim still needs its own evidence.

Use `node src/commissioning.mjs` to validate the register and briefs and list the queue. Pass `new` or `refresh` for one run type. Add `--json` for a structured handoff. The command works from a checkout with Node.js 24 and makes no network calls. A run can use the ordered queue to allocate work based on its available review capacity. The site builder reads the separate public topic directory.

## Brief format v1

One UTF-8 JSON file per brief in `briefs/`, named for its stable `id`. Set `version` to `1`. See [the Blue Badge brief](briefs/blue-badge-application.json) and [the tagging refresh brief](briefs/prisoner-tagging-fitting-figures.json) for examples.

| Field | What to record |
| --- | --- |
| `id`, `topic`, `kind` | Stable brief ID and target topic slug. Use `new` or `refresh`. A refresh targets an existing `content/topics/<topic>.json`. Use a specific brief ID for a distinct refresh cycle. Keep one open brief per target topic. |
| `title`, `category`, `scope`, `reader` | Proposed reader-facing question, subject area, jurisdiction and population, and the person whose question the guide will answer. |
| `commissionedOn`, `checkedOn` | First commissioning date and most recent evidence check in `YYYY-MM-DD` format. |
| `primaryAngle`, `secondaryAngle`, `lastingValue` | The service step that answers the question, what else the evidence can illuminate, and the reason to keep the guide after the news cycle. |
| `signals` | Dated observations. Each records `kind`, `observedOn`, `detail` and `sources` as an array of source IDs. Kinds are `search`, `news`, `scrutiny`, `release`, `policy` and `recurring-need`. Cite evidence for empirical demand or news claims. A recurring need can be grounded in service guidance. |
| `sources` | Exact starter records keyed by stable source ID. Each gives `title`, `publisher`, HTTPS `url`, a `locator` such as a question or table, an evidence `role`, and `access` and `checkedOn`. Roles are `process`, `delivery`, `scrutiny`, `cost`, `calendar` and `signal`. Access is `publisher` or `indexed-only`. Use the locator to say what was verified and which data still need extraction. |
| `ratings` | Separate `usefulness`, `urgency`, `coverage` and `evidence` entries, each with `level` (`high`, `medium` or `low`) and `reason`. Use high urgency for a dated near-term change, live scrutiny or evidenced demand, high coverage for a meaningful gap in the catalogue, and high evidence for a clear process and directly relevant comparable data or oversight. |
| `evidenceGap`, `draftingChecks` | A specific question still unanswered, and the checks the drafter should perform. Include the proposed handoffs, comparison measures and, where supported, consequence, costs and accountability. |
| `nextCheck` | `when` in `YYYY-MM-DD` format and `what` to check. This is an editorial check date. Describe the actual timing of a promise or planned release using the source’s precision. |
| `refresh` | Refresh briefs give `anchor` in the existing guide, `change` since the last review or the evidence still awaited, and `impact` on the reader. |
| `status`, `decisionReason` | Use `ready`, `hold`, `in-progress`, `complete` or `closed`. Give the reason for the current decision. A ready brief needs publisher-checked process and delivery evidence and a usable handoff. Verified qualitative evidence can establish delivery. Describe its limits in `evidenceGap`. |

Rank ready briefs by usefulness, then urgency, coverage and evidence. Use the earliest commissioning date and stable ID to break ties. Read the reasons and check the spread of the selected batch, especially when several briefs cover similar services. A nightly run can develop any number of qualifying briefs that available reviewers can handle. Briefs on hold remain visible with the next check and cannot be selected as ready work.

Before starting a draft, recheck the evidence and record `in-progress`. After independent review and publication, record `complete` with the outcome and retain the brief for its source trail. If a candidate no longer qualifies, record `closed` with the reason so the next run can see the decision. If new evidence changes qualification, update the brief and its reason before it returns to the ready list.
