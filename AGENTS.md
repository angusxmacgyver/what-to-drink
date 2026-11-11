## Agent skills

### Issue tracker

Issues live in GitHub Issues (`angusxmacgyver/what-to-drink`), via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## README timeline

Any work that adds or changes a feature also adds an entry to the **Timeline** section of `README.md`, in the same commit as the work. If the section doesn't exist yet, create it at the end of the README. Entries are newest first. Each one gives the date the work landed on `main`, the feature in one sentence using `GLOSSARY.md` terms, and the issue it closes.
