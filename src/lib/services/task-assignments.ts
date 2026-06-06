/**
 * Task-assignments service.
 *
 * Batch lookup of `TaskAssignment` rows for a set of Google Tasks IDs.
 * Used by the per-profile task filter so a list view can show only the
 * tasks owned by a single profile (plus optionally the unassigned ones).
 */
import type {
  AssignmentProfileSummary,
  AssignmentSummary,
} from "@/components/tasks/types";
import { prisma } from "@/lib/db";

export type {
  AssignmentProfileSummary,
  AssignmentSummary,
} from "@/components/tasks/types";

/**
 * Look up profile assignments for many tasks in a single query.
 *
 * The query is scoped to the caller's `userId` so two accounts with
 * coincidentally-equal Google Tasks IDs cannot read each other's
 * assignments. (`Profile.userId` is the link back to the account
 * owner; `TaskAssignment.profile` provides that join.)
 *
 * @param taskIds  Google Tasks IDs to look up. Duplicates are ignored.
 * @param userId   Account owner's ID. Only assignments belonging to
 *                 this user's profiles are returned.
 * @returns        Map keyed by task ID. Tasks with no assignments are
 *                 omitted from the map β€" callers should treat a missing
 *                 entry as "unassigned".
 */
export async function getTaskAssignmentsByTaskIds(
  taskIds: string[],
  userId: string
): Promise<Map<string, AssignmentSummary[]>> {
  const result = new Map<string, AssignmentSummary[]>();
  if (taskIds.length === 0) {
    return result;
  }

  const uniqueIds = Array.from(new Set(taskIds));

  const rows = await prisma.taskAssignment.findMany({
    where: {
      taskId: { in: uniqueIds },
      profile: { userId },
    },
    include: {
      profile: {
        select: {
          id: true,
          name: true,
          color: true,
          avatar: true,
        },
      },
    },
  });

  for (const row of rows) {
    const list = result.get(row.taskId);
    const summary: AssignmentSummary = {
      profileId: row.profileId,
      // The Prisma client returns `avatar` as `JsonValue`. The
      // shape is constrained by ProfileForm/Profile creation
      // (always `{ type, value, backgroundColor? }`), so casting
      // to the structured type is safe at this boundary.
      profile: row.profile as AssignmentProfileSummary,
    };
    if (list) {
      list.push(summary);
    } else {
      result.set(row.taskId, [summary]);
    }
  }

  return result;
}
