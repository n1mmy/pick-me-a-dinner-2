# Triage Labels

Issues are local markdown files, so a "label" is the value of the `Status:`
line near the top of the issue file. The five triage roles the skills speak in
use their default strings:

- `needs-triage` — maintainer needs to evaluate this issue
- `needs-info` — waiting on the reporter for more information
- `ready-for-agent` — fully specified, ready for an AFK agent
- `ready-for-human` — requires human implementation
- `wontfix` — will not be actioned

## Terminal status

`done` is **not** a triage role — it is a terminal lifecycle state past
triage, set by the implementing agent (the Ralph loop — see
`issue-tracker.md`) once the work is committed and the acceptance criteria are
all ticked. A `done` issue has left the triage state machine; `/triage` ignores
it.
