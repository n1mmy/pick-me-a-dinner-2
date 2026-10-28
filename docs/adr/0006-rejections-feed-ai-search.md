# Rejections feed AI search; the model judges what is standing

_Amended by ADR-0008: a Rejection can also be created, edited and deleted for
any date from the Log and the Option detail page, and the snapshot carries
future-dated rows. Amended by ADR-0010: a weekly closure is a Closed day on the
Restaurant, not a standing Rejection for the model to infer. Amended
2026-10-28: the snapshot lists each Rejection a second time under every Tag of
its Option, so a reason about the kind of food ("too recent") reaches every
Option of that kind — the model still judges each reason; listed under one
Option alone, the reason was read as being about that Option only._

ADR-0004 and ADR-0005 had AI search read the Household's Log to find eating
habits. But the Log records only what was *eaten* — it has no record of what was
considered and turned *down*. When the Household passes on an Option because it
is "too heavy tonight" or because "too spicy for the kids", that reaction —
their clearest signal about a bad fit — is invisible to the model.

We are adding **Rejections**: from the Tonight screen the Household can reject an
Option for tonight's decision, with an optional short reason. A Rejection
removes the Option from tonight's list and is kept as dated history that is fed
into future AI searches. The model then reasons over not just what the Household
ate but what they declined and why.

The load-bearing choice: store every Rejection flat — its optional reason and
its date — and let the **model itself** judge which reasons are standing
dislikes ("too spicy for the kids") and which were one-off ("too heavy
tonight"). We deliberately encode no decay, no query-scoping, and no
persistence heuristic of our own.

## Considered options

- **No memory of Rejections (status quo).** AI search sees only the Log.
  Rejected: the Household's most explicit signal about a bad fit — a deliberate
  "no, because X" — is discarded the moment the list refreshes.
- **Rejections as standing rules.** A Rejection permanently downranks the Option
  in every future search. Rejected: most Rejections are contextual ("too heavy
  *tonight*"), not verdicts on the Option; treating them as permanent rules
  poisons future searches with momentary noise.
- **Rejections scoped or decayed by coded heuristics.** Persist each Rejection
  with the query it happened under and surface it only on a similar later query,
  or fade Rejections after a fixed window. Rejected: query-similarity matching
  and decay tuning are real machinery for a single-Household app, and they bake
  our guess about "similar" and "stale" into code.
- **Flat dated history, the model judges (chosen).** Store every Rejection with
  its optional reason and date. Feed the full history into the AI snapshot and
  let the model read the reason text together with the date and frequency
  pattern to decide what is structural and what was one-off — the same division
  of labour as ADR-0005, where the model reasons over raw history rather than
  pre-digested signals.

## Consequences

- A new `rejections` table enters the schema, with its own out-of-band
  migration. A Rejection row is light: an Option reference, an optional reason,
  and the date — it is not a Log entry and carries no Score weight.
- The AI search snapshot gains a Rejections block in two groups: Rejections on
  the anchor day (those Options are removed from the candidate set) and all
  others (those Options stay candidates, their reasons ride along as a standing
  taste signal). The system prompt is extended to explain both. Snapshot and
  prompt size grow with Rejection history — uncapped by choice, acceptable for
  a single Household; revisit only if a prompt genuinely bloats.
- The deterministic ranking (ADR-0003) is untouched. A Rejection suppresses an
  Option from the *displayed* Tonight list — deterministic list and AI results
  alike — for its own day only; that is a presentation filter and never changes
  a Score. The Option returns on its own the next day.
- A Rejection's effect is non-deterministic: like the rest of the AI path
  (ADR-0005) its influence is whatever the model makes of it, and it is not
  unit-tested. The deterministic Tonight list stays the offline-proof fail-safe.
- A Rejection can be undone ("Bring back"), which deletes the record so a
  mis-tap never reaches the model.
