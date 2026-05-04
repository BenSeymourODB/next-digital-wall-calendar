# Code Review Fix - Remediation Command

You are the **remediation executor** for code review findings. Your job is to read open code review issues from GitHub, help the user prioritize, and execute fixes one at a time.

## Step 1: Fetch Open Findings

List all open GitHub Issues with the `code-review` label:

Use GitHub MCP tools (`mcp__github__list_issues` or `mcp__github__search_issues`) if available, otherwise use:

```bash
gh issue list --label code-review --state open --json number,title,labels,body --limit 50
```

Parse the issues and organize them into a table:

| #              | Severity               | Category               | File        | Issue               | Effort   |
| -------------- | ---------------------- | ---------------------- | ----------- | ------------------- | -------- |
| {issue number} | {severity from labels} | {category from labels} | {file path} | {brief description} | {effort} |

Sort by: Critical first, then High, then Medium, then Low. Within the same severity, sort Small effort before Medium before Large.

## Step 2: Ask User What to Fix

Present the table and ask the user:

- "Which issues would you like to address? (Enter issue numbers, 'all', or 'top N')"
- Recommend starting with Critical+Small and High+Small items for maximum impact with minimum effort.

## Step 3: Execute Fixes

For each selected issue, in order:

1. **Read the issue body** to understand the finding, file, and suggestion
2. **Read the affected file** to understand the current code
3. **Implement the suggested fix** (or a better fix if you identify one)
4. **Run quality checks:**
   ```bash
   pnpm lint:fix
   pnpm format:fix
   pnpm check-types
   ```
5. **Run tests** for the affected area:
   ```bash
   pnpm test:run -- --reporter=verbose {path to related test file if it exists}
   ```
6. **If all checks pass**, note the fix is ready
7. **If checks fail**, diagnose and fix the issue before moving on

After each fix, report what was changed and confirm checks pass.

## Step 4: Close Resolved Issues

After all selected fixes are implemented and passing:

1. **Stage and commit** the changes with a descriptive message referencing the issue numbers:
   ```
   fix: address code review findings #{issue1}, #{issue2}, ...
   ```
2. **Close each resolved issue** on GitHub with a comment:
   ```
   Resolved in commit {sha}. Changes: {brief summary of what was done}.
   ```

Use GitHub MCP tools if available, otherwise:

```bash
gh issue close {number} --comment "Resolved in commit {sha}. {summary}"
```

## Step 5: Summary

Present a summary:

### Remediation Summary

| Issue              | Status                    | Changes            |
| ------------------ | ------------------------- | ------------------ |
| #{number}: {title} | Fixed / Skipped / Partial | {what was changed} |

**Quality checks:** All passing / {details of any failures}
**Remaining open issues:** {count}

## Important Notes

- **Never skip quality checks** - every fix must pass lint, format, types, and tests
- **One fix at a time** - don't batch multiple unrelated fixes into one change
- **Preserve existing tests** - never remove or weaken tests to make a fix pass
- **Ask before large refactors** - if a fix requires changing >5 files, confirm with the user first
- **Follow CLAUDE.md conventions** - all fixes must adhere to the project's coding standards
