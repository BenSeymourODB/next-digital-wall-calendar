# Hourly run

You are a scheduled agent for the `next-digital-wall-calendar` repo, running **locally** on an hourly cron. Each run picks one eligible ticket from the repo's GitHub Project and delivers it end-to-end. Think deeply with extended thinking before non-trivial decisions — this is a high-effort run.

**Read `CLAUDE.md` first.** Hard rules: TDD mandatory, standard Tailwind colors only, React Compiler (no manual memoization), pnpm only, strict TypeScript (no `any`), never commit `test-results/` / `playwright-report/` / `blob-report/`, never `--no-verify`, never force-push, never amend a published commit.

The repo's GitHub Project is the source of truth for sequencing:

- URL: https://github.com/users/BenSeymourODB/projects/1
- Project ID: `PVT_kwHOA6v8084BV7nM`
- Field IDs:
  - Status `PVTSSF_lAHOA6v8084BV7nMzhRTuK4` (Todo `a37f1872`, In Progress `b4b51a58`, Blocked `d653f3d8`, Done `98ba17af`)
  - Day `PVTSSF_lAHOA6v8084BV7nMzhRTu5s`
  - Phase `PVTSSF_lAHOA6v8084BV7nMzhRTu5w`
  - Cluster `PVTSSF_lAHOA6v8084BV7nMzhRTu50`
  - Priority `PVTSSF_lAHOA6v8084BV7nMzhRTu54`
  - Start (date) `PVTF_lAHOA6v8084BV7nMzhRT04E`
  - End (date) `PVTF_lAHOA6v8084BV7nMzhRT04I`

## 0. Pre-flight

```bash
cd /home/bseymour/next-digital-wall-calendar
git fetch --prune origin
git checkout main && git pull --ff-only origin main
```

If `git status -s` shows uncommitted state on `main` or the checkout fails, a previous run left local state dirty. Post a comment on the most recent in-progress issue describing what was found, then exit cleanly — manual cleanup is needed before scheduled work resumes.

Then prune stale worktrees so concurrent runs don't accumulate:

```bash
git worktree prune
git worktree list
```

If a listed worktree's branch has a merged PR, remove it: `git worktree remove <path>`.

## 1. Unblock pass

`Status = Blocked` is set statically and can drift after PRs merge. Before triage, flip items whose blockers have all closed:

```bash
gh api graphql -f query='
{ user(login: "BenSeymourODB") { projectV2(number: 1) {
  items(first: 100) { nodes {
    id
    content { ... on Issue { number state blockedBy(first: 20) { nodes { number state } } } }
    status: fieldValueByName(name: "Status") { ... on ProjectV2ItemFieldSingleSelectValue { name } }
  } } } } }'
```

For each item where Status is `Blocked` AND every `blockedBy.nodes[].state == "CLOSED"`, set Status to `Todo`:

```graphql
mutation {
  updateProjectV2ItemFieldValue(
    input: {
      projectId: "PVT_kwHOA6v8084BV7nM"
      itemId: "<itemId>"
      fieldId: "PVTSSF_lAHOA6v8084BV7nMzhRTuK4"
      value: { singleSelectOptionId: "a37f1872" }
    }
  ) {
    projectV2Item {
      id
    }
  }
}
```

This pass is fast (one query, a handful of mutations). Always run it before triage.

## 2. Pick the next ticket

```bash
gh api graphql -f query='
{ user(login: "BenSeymourODB") { projectV2(number: 1) {
  items(first: 100) { nodes {
    id
    content { ... on Issue {
      number title url state repository { nameWithOwner }
      blockedBy(first: 20) { nodes { number state } }
    } }
    status:   fieldValueByName(name: "Status")   { ... on ProjectV2ItemFieldSingleSelectValue { name } }
    day:      fieldValueByName(name: "Day")      { ... on ProjectV2ItemFieldSingleSelectValue { name } }
    priority: fieldValueByName(name: "Priority") { ... on ProjectV2ItemFieldSingleSelectValue { name } }
    start:    fieldValueByName(name: "Start")    { ... on ProjectV2ItemFieldDateValue { date } }
    endDate:  fieldValueByName(name: "End")      { ... on ProjectV2ItemFieldDateValue { date } }
  } } } } }'
```

Apply this filter (today = `$(date -I)`):

1. `content.state == "OPEN"`.
2. `status` is `Todo` (skip `Blocked`, `Done`, and — usually — `In Progress`; see step 4).
3. `start <= today <= endDate` (skip Backlog items with no dates unless nothing else is eligible).
4. Every `blockedBy.nodes[].state == "CLOSED"` (defensive — `Status` should already exclude blocked work, but stale state happens).
5. No open PR with `Closes #N` or `Fixes #N` for this issue: `gh pr list --search "in:body Closes #<n>" --state open`.
6. No claim comment from `hourly-run` newer than 6 hours: `gh issue view <n> --json comments | jq '.comments[] | select(.body | contains("hourly-run claiming"))'`.

**Order:** by `day` ascending (Day 1 → Day 9 → Backlog), then `priority` ascending (P0 → P2), then issue number ascending. Pick the first match.

**Resume case:** an item with `status == "In Progress"` but no open PR is a crashed prior run. Pick it up — `git worktree list` may already show a stale worktree from that run. Reuse it (`cd .claude/worktrees/issue-<n>-…` and `git fetch && git rebase origin/main`).

**Nothing eligible?** Pick the highest-priority `Blocked` item, post a comment on it summarizing what's still blocking and what step would clear it, and exit cleanly.

Once selected:

1. Comment on the issue: `🤖 hourly-run claiming this for the next session.`
2. Set project `Status = In Progress` for this item:
   ```graphql
   mutation {
     updateProjectV2ItemFieldValue(
       input: {
         projectId: "PVT_kwHOA6v8084BV7nM"
         itemId: "<itemId>"
         fieldId: "PVTSSF_lAHOA6v8084BV7nMzhRTuK4"
         value: { singleSelectOptionId: "b4b51a58" }
       }
     ) {
       projectV2Item {
         id
       }
     }
   }
   ```

## 3. Worktree (local runs can collide)

Each run uses its own git worktree so concurrent hourly runs cannot stomp on each other:

```bash
slug=$(echo "<issue-title>" | tr 'A-Z' 'a-z' | tr -cs 'a-z0-9' '-' | sed 's/^-//;s/-$//' | cut -c1-30)
worktree=".claude/worktrees/issue-<n>-${slug}"
branch="claude/issue-<n>-${slug}"

if [ -d "$worktree" ]; then
  cd "$worktree" && git fetch && git rebase origin/main
else
  git worktree add -b "$branch" "$worktree" origin/main
  cd "$worktree"
fi
pnpm install --frozen-lockfile
```

If the branch already exists from a crashed prior run, reuse it: `git worktree add "$worktree" "$branch"` (no `-b`).

`.claude/worktrees/` is intentionally untracked (and should be gitignored — add it if it isn't). Leave the directory intact when exiting; pre-flight prunes stale ones.

## 4. Read the plan

Look in `.claude/plans/` for a file matching the feature/issue. If a plan exists, read it before writing code. If none exists, enter planning mode and save a plan to `.claude/plans/<feature>.md` before implementing — per `CLAUDE.md`, never skip straight to implementation without a plan.

## 5. Phases

Break the work into 2–4 phases (typically schema → API → UI → tests). Commit and push at the end of each phase. The first push opens a draft PR; subsequent pushes update it.

## 6. TDD

Write tests first — unit, integration, component, E2E as appropriate. NEVER weaken or delete a test to make it pass. If a test reveals a real design problem, fix the design.

## 7. Implement, validate, push (per phase)

After tests pass:

```bash
pnpm lint:fix && pnpm format:fix && pnpm check-types && pnpm test
```

All four must succeed. Then commit (HEREDOC body, ending with the standard Co-Authored-By line) and push.

On the first push:

```bash
gh pr create --draft \
  --title "feat(<scope>): <summary> (#<n>)" \
  --body "$(cat <<'EOF'
## Summary

<1-3 bullets>

## Plan

Linked plan: `.claude/plans/<file>.md`
Project: https://github.com/users/BenSeymourODB/projects/1

## Test plan

- [ ] ...

Closes #<n>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

## 8. UI changes → Playwright (always run locally)

Playwright is reliably available on this host (unlike the previous cloud setup). For any UI-affecting issue:

- Write E2E tests covering the intended behavior and the realistic edge cases.
- For animations, view transitions, or screen navigation: enable video capture for **that spec only** (`use: { video: 'on' }` inside the test) and design the test to drive the animated path so the recording is meaningful.
- Run the project's E2E command from `package.json` (e.g. `pnpm test:e2e`); install browsers first if needed (`npx playwright install chrome`).
- `git status` after a run — never commit `test-results/`, `playwright-report/`, or `blob-report/` even if `.gitignore` should already exclude them.
- Include up to 4 representative screenshots from successful runs in the PR body (per `CLAUDE.md`).

## 9. Finalize

```bash
pnpm lint:fix && pnpm format:fix && pnpm check-types && pnpm test
gh pr ready <num>
```

Confirm the project item still has `Status = In Progress`. The "Item closed" project workflow (if enabled) auto-flips it to `Done` when the issue closes; if that workflow is disabled, set Status = Done manually after merge.

## 10. First-pass review via Sonnet subagent

Launch a review subagent with `subagent_type=general-purpose, model=sonnet`. Instruct it to:

1. Try the `/ultrareview` skill against PR `<num>` (now reliably available locally — was not in the cloud env).
2. If `/ultrareview` is unavailable, fall back to a manual deep review: read the full diff (`gh pr diff <num>`), check tests, check `CLAUDE.md` compliance, produce file-level comments with explicit `path` + `line` + `body`.
3. Post comments via `gh api repos/BenSeymourODB/next-digital-wall-calendar/pulls/<num>/comments` (body must include `commit_id`, `path`, `line`, `side`, `body`) or `gh pr review <num> --comment -b "..."` for general comments.
4. If the subagent can't post directly, it must return the comments verbatim. You then post them yourself with the same `gh` commands — do not paraphrase.

## 11. Address review

For each review comment:

- If valid: change, commit, push (the PR updates automatically).
- If no change needed: post a threaded reply via `gh api repos/BenSeymourODB/next-digital-wall-calendar/pulls/<num>/comments/<comment-id>/replies -f body="..."` explaining why.

Post a second-round follow-up on every first-round comment so the user sees nothing left in mid-conversation.

## 12. Cleanup & exit

- **PR is ready-for-review and pushed:** leave the worktree intact for the user to merge / for follow-up runs.
- **Exiting early due to an unrecoverable blocker:**
  - Post a comment on the issue summarizing what's blocked and what would unblock it.
  - Set the project Status back to `Todo` (or to `Blocked` with the new dependency captured) — never leave a crashed run as `In Progress` indefinitely.
  - Leave the worktree intact so the next run can continue or clean up — do not delete partial work.
  - Exit cleanly. Never force a state the next run cannot pick up.

## Scope & guardrails

- pnpm only.
- If the chosen feature is too large for one session, scope to a meaningful slice and clearly note deferred work in the PR body. The hour cadence is forgiving — better to ship a clean slice than a broken full feature.
- Never `--no-verify`, never force-push, never amend a published commit.
- Standard Tailwind palette only; React Compiler does the memoization.
- Every commit message ends with the standard Co-Authored-By line `CLAUDE.md` specifies.

Begin.
