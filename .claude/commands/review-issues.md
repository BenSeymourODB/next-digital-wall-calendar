Do a review of all open Issues on this repository. Let's identify blockers, co-dependencies, and synergies between the issues: Which issues need to be addressed first in order to let development on others proceed? Which issues aren't explicitly blocked but would become easier if others were developed and merged first? For each connection between issues that you identify, update the description of both issues tagging the connected issue.

## Instructions

1. **Fetch all open issues** using `gh issue list --state open --json number,title,labels,body --limit 50`

2. **Analyze dependencies** across all issues. For each issue, identify:
   - **Blockers**: Issues that must be completed before this one can start (e.g., UI component must exist before API wiring)
   - **Enables**: Issues that this one unblocks once completed
   - **Synergies**: Issues that share infrastructure, patterns, or settings UI and benefit from coordinated development
   - **Benefits from**: Issues that aren't strict blockers but would make this one easier if done first

3. **Group into tiers** based on dependency depth:
   - **Tier 0 (Foundation)**: No blockers, enables many others
   - **Tier 1**: Depends only on Tier 0 or external factors
   - **Tier 2**: Depends on Tier 1 issues
   - **Tier 3+**: Highest dependency chains

4. **Identify synergy clusters**: Groups of issues that share enough infrastructure that they should be designed together even if developed separately.

5. **Write two documentation files**:
   - `docs/issue-dependency-analysis.md` — Full dependency graph with tiers, detailed connection map per issue, recommended implementation order, and key synergy clusters
   - `docs/issue-cross-reference-updates.md` — The exact markdown text to append to each affected issue's description

6. **Update each affected issue** on GitHub:
   - For each issue identified in the analysis, append a "Cross-References" section to its description
   - Preserve the existing issue body and append the new section
   - Use `gh issue view <number> --json body -q .body` to get existing content, then `gh issue edit <number> --body "<existing + new>"` to update
   - The cross-reference section should tag connected issues and explain the nature of each connection

7. **Report a summary** of all updates made.
