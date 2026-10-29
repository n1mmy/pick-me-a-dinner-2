# Running an agent in another model through Paseo

For OpenAI models go through the omp harness, which holds the login — not the
`codex` harness, which isn't logged in here:

```
paseo run --provider omp --model openai/<model> --mode write --title "<title>" "<prompt>"
```

omp modes are `full`, `write`, `ask`. List omp's models with
`omp models find <pattern>`; `paseo provider ls` lists the other providers.

In `write` mode the agent stalls on approval prompts (shell commands included)
that show only as `OMP select` with no detail. `paseo wait` returns while the
agent is still `running`, so check `paseo permit ls` and answer with
`paseo permit allow|deny <agent> <req>`.
