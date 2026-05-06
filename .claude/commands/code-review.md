# Weekly Code Cleanliness Review

You are the **orchestrator** for a weekly code cleanliness review of this Next.js project. You coordinate specialized review agents, deduplicate findings, and create GitHub Issues for actionable items.

## Step 1: Baseline Checks

Run these commands first and note any pre-existing issues:

```bash
pnpm lint
pnpm check-types
```

If either fails, note the failures but continue with the review. These are separate from the code cleanliness findings.

## Step 2: Spawn Review Agents

Launch **all 5 agents in parallel** using the Agent tool. Each agent should be an Explore-type agent. Give each agent the full contents of its corresponding command file as the prompt:

1. **Complexity & CRAP** - Read `.claude/commands/code-review-complexity.md` and use its contents as the agent prompt
2. **Separation of Concerns** - Read `.claude/commands/code-review-concerns.md` and use its contents as the agent prompt
3. **Dead Code & Unused Exports** - Read `.claude/commands/code-review-dead-code.md` and use its contents as the agent prompt
4. **Naming & Readability** - Read `.claude/commands/code-review-readability.md` and use its contents as the agent prompt
5. **Pattern Consistency** - Read `.claude/commands/code-review-patterns.md` and use its contents as the agent prompt

Wait for all agents to complete.

## Step 3: Collect and Deduplicate Findings

Parse all agent results. Each finding follows this format:

```
FINDING: {severity} | {file_path}:{line_range} | {category}
DESCRIPTION: {what the issue is}
SUGGESTION: {specific refactoring recommendation}
EFFORT: {S|M|L}
```

Deduplicate:

- If multiple agents flag the same file+line range, merge into one finding keeping the highest severity
- If agents flag different issues in the same file, keep them as separate findings but note they can be addressed together

## Step 4: Create GitHub Issues

For each finding (or group of related findings for the same file), create a GitHub Issue.

First, check for existing open issues with the `code-review` label to avoid duplicates:

- Use the GitHub MCP tool `mcp__github__search_issues` or `gh issue list --label code-review --state open`
- If an existing issue covers the same file and concern, add a comment to update it instead of creating a new issue

For new issues, use GitHub MCP tools (`mcp__github__create_issue`) if available, otherwise use `gh issue create`.

**Issue format:**

```
Title: [Code Review] {brief description} - {relative file path}

Labels: code-review, {severity}, {category}

Body:
## Finding
**File:** `{file_path}:{line_range}`
**Category:** {category}
**Severity:** {severity}
**Effort:** {effort}

## Issue
{description}

## Suggestion
{suggestion}

## Context
Found during automated code review on {today's date}.
```

**Label mapping:**

- Severity labels: `critical`, `high`, `medium`, `low`
- Category labels: `complexity`, `separation-of-concerns`, `dead-code`, `readability`, `pattern-consistency`
- All issues get the `code-review` label

If labels don't exist yet, create them first.

## Step 5: Summary Report

Present a summary to the user:

### Code Review Summary - {date}

| Severity | Count |
| -------- | ----- |
| Critical | N     |
| High     | N     |
| Medium   | N     |
| Low      | N     |

**Top 5 Actionable Items** (ranked by severity, then by effort ascending):

1. {finding summary} - {issue link} - Effort: {S/M/L}
2. ...

**Baseline Check Results:**

- ESLint: {pass/fail with count}
- TypeScript: {pass/fail with count}

**Next steps:** Run `/code-review-fix` to address findings, or review individual issues on GitHub.

## Important Notes

- This is a **read-only review**. Do NOT modify any source code.
- Be conservative with Critical severity - reserve it for genuine architectural problems.
- Group related findings for the same file into a single issue when they share a root cause.
- If an agent returns no findings for a category, that's fine - note it in the summary as a clean area.
