---
name: commission-public-service-topics
description: Find, qualify, rank and frame evidence-backed briefs for new public-service guides or updates to existing guides. Use for commissioning runs and maintenance triage.
---

# Commission public-service topics

Read the [commissioning workflow and brief format](../../../commissioning/README.md), [source register](../../../commissioning/sources-v1.json) and [editorial playbook](../../../docs/topic-playbook.md). Read the published topic catalogue and existing briefs before writing a new one.

1. Establish the run type, date and available drafting and independent review capacity. A new-topic run looks for timely questions and enduring gaps. A refresh run checks existing guides for material changes, including statistics, revisions, rules, fees and commitments. Use the current release and follow-up records to judge which guides need attention.
2. Scan the relevant starting sources. Record what was checked, its jurisdiction and the dated signal that led to each candidate. Give search interest, news attention, institutional scrutiny and a recurring reader need their own descriptions. Look for services and places that have less coverage. Follow the [publisher release check](../../../docs/topic-playbook.md#verify-the-publishers-release) when the evidence is incomplete or appears stale.
3. Frame the candidate title as a reader’s question about a defined service and leave the answer open. Identify who needs the answer, what the service promises, which step matters most and what the evidence could show. Verify a primary source for the process and another basis for assessing delivery. A documented evidence gap can qualify where the brief identifies the record checked, what it establishes and what is still missing. For a refresh, link the existing passage and identify the new evidence and material consequence.
4. Record the brief in the current format. Rate reader usefulness, urgency, coverage and evidence separately, and give the reasons. Check for an existing guide or brief that answers the same question. Mark the brief ready when it can support drafting. Hold unresolved briefs with the concrete source, event or date to check again. Advance an existing brief in place as evidence arrives.
5. Run `node src/commissioning.mjs new` or `node src/commissioning.mjs refresh` to validate the files and order the ready briefs. Select as many ready briefs as drafting and independent review can take. Carry the rest forward. A commissioned brief can be handed to the [drafting skill](../draft-public-service-topic/SKILL.md), then the [review skill](../review-public-service-topic/SKILL.md). Commissioning ends at the brief and handoff. Use the publication scope of the request for downstream work.

Report the ranked ready briefs, held items and their triggers, duplicate or refresh decisions, and the coverage added. State which relevant sources could not be checked.
