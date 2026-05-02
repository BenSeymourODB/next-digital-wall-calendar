/**
 * Task-assignments service.
 *
 * Batch lookup of `TaskAssignment` rows for a set of Google Tasks IDs.
 * Used by the per-profile task filter so a list view can show only the
 * tasks owned by a single profile (plus optionally the unassigned ones).
 */
import { prisma } from "@/lib/db";

export interface AssignmentProfileSummary {
  id: string;
  name: string;
  color: string;
  avatar: unknown;
}

export interface AssignmentSummary {
  profileId: string;
  profile: AssignmentProfileSummary;
}

/**
 * Look up profile assignments for many tasks in a single query.
 *
 * @param taskIds  Google Tasks IDs to look up. Duplicates are ignored.
 * @returns        Map keyed by task ID. Tasks with no assignments are
 *                 omitted from the map β€" callers should treat a missing
 *                 entry as "unassigned".
 */
export async function getTaskAssignmentsByTaskIds(
  taskIds: string[]
): Promise<Map<string, AssignmentSummary[]>> {
  const result = new Map<string, AssignmentSummary[]>();
  if (taskIds.length === 0) {
    return result;
  }

  const uniqueIds = Array.from(new Set(taskIds));

  const rows = await prisma.taskAssignment.findMany({
    where: { taskId: { in: uniqueIds } },
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
      profile: row.profile,
    };
    if (list) {
      list.push(summary);
    } else {
      result.set(row.taskId, [summary]);
    }
  }

  return result;
}
