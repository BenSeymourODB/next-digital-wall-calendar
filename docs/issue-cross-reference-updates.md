# Issue Cross-References

> **Superseded 2026-04-27.** Cross-references between issues are now
> encoded with GitHub's native **Blocked by** relationships, visible on
> each issue and the
> [Features Before Claude Subscription Close](https://github.com/users/BenSeymourODB/projects/1)
> project board.

## Why this file existed

When this repo had no GitHub Project, this file held copy-pasteable
"append to issue X" recipes documenting which issues blocked, informed,
or shared infrastructure with which others. That bookkeeping lived only
here and drifted as work landed.

## What replaces it

- **Blocked by / Blocks** — added via the GraphQL `addBlockedBy` mutation
  (or the issue UI's "Add a blocked-by relationship"). All previously
  documented blockers were migrated on 2026-04-27.
- **Synergy clusters** — encoded in the project's `Cluster` field. Items
  that share API routes, providers, or settings UI sit in the same
  cluster (e.g. `Calendar CRUD` for #115 / #116 / #118).
- **Informational links** — for "informs" or "benefits from" relationships
  where there's no hard blocker, mention the related issue in the
  description and rely on GitHub's automatic Cross-references panel.

If you want the original recipes, they're in this file's parent commit
in git history.
