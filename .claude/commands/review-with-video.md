Review a feature's visual behavior using Playwright video capture, comparing the captured output against what the feature specification says it should look and behave like.

## Arguments

$ARGUMENTS - The feature or E2E test to review. Can be a test file path (e.g. `e2e/scheduler-transitions.spec.ts`), a test name pattern (e.g. `"auto-rotation"`), or a description of the feature to test (e.g. `"scheduler page transitions"`).

## Instructions

### 1. Understand the feature specification

- Find the relevant GitHub issue or feature plan that defines expected behavior. Check:
  - Open/closed GitHub issues matching the feature name
  - Feature plans in `.claude/plans/`
  - Acceptance criteria, mockups, and behavioral descriptions
- Note every visual and behavioral expectation: animations, timing, directions, fallbacks, accessibility.

### 2. Identify or create the E2E tests

- Look for existing Playwright E2E tests in `e2e/` that cover the feature.
- If no tests exist, write them. Tests MUST include `test.use({ video: "on" })` at the top level to enable video capture.
- Tests should cover:
  - **Happy path**: The primary user flow
  - **Edge cases**: Boundary conditions, wrapping, rapid interactions
  - **Accessibility**: Reduced motion, keyboard navigation, ARIA attributes
  - **Visual correctness**: Correct animations, no flicker, no blank frames

### 3. Run the tests with video capture

```bash
# Set up browser path if needed (cloud environments)
export PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers

# Run the specific test file or pattern
npx playwright test <test-file-or-pattern> --project=chromium --reporter=list
```

- If Playwright browsers aren't installed, check `/opt/pw-browsers/` for pre-installed versions and symlink if needed.
- If the dev server isn't running, start it first with `pnpm dev`.

### 4. Review captured outputs

Videos and screenshots are saved to `test-results/`. For each test:

- **Read the video file** to visually inspect the recorded behavior.
- **Read any failure screenshots** to diagnose issues.
- Compare what you see against each acceptance criterion from the spec.

### 5. Produce a review report

For each acceptance criterion in the spec, report:

| Criterion             | Status                | Evidence                                  |
| --------------------- | --------------------- | ----------------------------------------- |
| Description from spec | PASS / FAIL / PARTIAL | What you observed in the video/screenshot |

Then provide:

- **Overall verdict**: Does the feature match its specification?
- **Issues found**: Any visual bugs, timing problems, missing behaviors
- **Recommendations**: Fixes needed or improvements suggested

### 6. Fix issues if requested

If the user asks you to fix problems found during review:

- Update the implementation code
- Re-run the E2E tests to verify the fix
- Review the new video capture to confirm the fix looks correct
- Commit and push the fix
