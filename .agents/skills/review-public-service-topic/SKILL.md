---
name: review-public-service-topic
description: Independently review a draft or update to a public-service topic. Use before publication to check its claims, numbers, outcome evidence, scrutiny status and rendered page against the source record.
---

# Review a public-service topic

Read the [editorial playbook](../../../docs/topic-playbook.md) and the draft with its change summary. For updates, compare against the previous published version. Review the content and resulting page as supplied. Apply corrections when requested.

When a [commissioned brief](../../../commissioning/README.md) was used, check that the draft answers its reader question and explains any material change to the scope, framing or evidence since commissioning.

1. Open the original records for the lead claim, key figures, examples of harm, outcome comparisons and any new commitment or status. Follow the playbook’s [source release check](../../../docs/topic-playbook.md#verify-the-publishers-release) when the accessible copy may be incomplete or stale. Check the quoted or paraphrased wording, jurisdiction, population and dates. Report any record you could not verify.
2. Recompute the important values where the source gives underlying counts. Check units, denominators, observation windows, rounding, provisional values, definition changes and chart labels. For spending and funding, check years, cost boundaries and possible overlap. Check that every comparison supports the claim attached to it. [Cost and funding references](../../../docs/cost-references.md)
3. Check the link from the problem to its consequence and progress measure. Look for inferences from individual cases, incompatible populations or increased detection. Verify the distinction between attempted activity, delivered service and resulting outcomes.
4. Check the dates and precise commitment behind every scrutiny change. Confirm the difference between a request and a promise, and between evidence supplied and service improvement. Check whether a cited change was already under way before the challenge.
5. Run `node src/build.mjs`. Check the lead, the section order, the closest figure to each finding, and the navigation from claims to sources. Check existing deep links on updates. Inspect both desktop and narrow layouts when presentation changes.

Return **Ready** or **Needs revision**, giving the evidence for that decision. List any necessary corrections with the affected topic field or chart, original source and the specific change needed. Record unresolved gaps and checks you could not complete, including when they limit what the page can claim.
