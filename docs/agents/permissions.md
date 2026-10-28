# Bash permission matcher

How Claude Code's Bash permission matcher actually behaves. It is built-in and
undocumented, so this is an empirical catalogue: it can drift across Claude
Code versions, so re-verify if a result surprises you. The rules `CLAUDE.md`
draws from it live there, under *Bash shapes*.

- **Compounds are decomposed, not rejected wholesale.** `&&`, `||`, `;`, `|`,
  and `&` are split into their stages, and the compound clears iff *every* stage
  independently clears (against the allowlist or a safe list below). A compound
  does **not** prompt merely for being compound — only when some stage isn't
  itself allowed. So `git add <paths> && git commit -m x` is fine when both
  halves are allowed. **But** command substitution `$(…)` / backticks are
  rejected as a distinct shape, and an unescaped `*`, or any literal `$` byte
  (even backslash-escaped as `\$`), in an argument is rejected outright.
- **Two built-in safe lists clear with no allow rule.** Read-only Bash commands
  — `cat`, `head`, `tail`, `wc`, `grep`, `find`, `ls`, `stat`, `echo`, `printf`,
  `which`, `type`, `realpath`, `dirname`, `basename`, `test` — and read-only git
  subcommands — `log`, `diff`, `show`, `status`, `blame`, `rev-parse`,
  `ls-files`, `for-each-ref`, `worktree list` — run without prompting.
  `sed`/`awk` (verified — both prompt), `env`/`printenv`, `rm`/`mkdir`/`rmdir`,
  and `git config`/`push`/`fetch` are **not** on the lists — treat them as
  prompting.
- **Path-locality gate.** For the path-taking readers (`cat`/`head`/`tail`/
  `wc`/`grep`/`find`/`ls`/`stat`/`rmdir`), an argument that is an absolute path
  **outside the working directory** is rejected even though the command is
  safe-listed — so `cat /etc/passwd` and `find /` are blocked, while in-worktree
  paths clear. (git's read subcommands bypass this gate.)
- **First-token shape.** A first token containing `/` — a full path like
  `/usr/bin/git` or a `./relative` form — misses the lookup and is rejected even
  for an otherwise-allowed command. `cd` isn't allowlisted, so a
  `cd <path> && …` compound fails on its first stage.
