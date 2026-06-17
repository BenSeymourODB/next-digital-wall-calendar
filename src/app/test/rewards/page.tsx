"use client";

/**
 * E2E test surface for the reward-point UI surface (#173).
 *
 * Mounts a small `PointsProvider` with a fixed profileId so the
 * Playwright harness can drive both the PointsBadge and the
 * award-on-completion flow without standing up a real session or
 * profile context. `/api/points*` is intercepted with `page.route()`
 * from the spec.
 */
import { PointsBadge } from "@/components/rewards/points-badge";
import { PointsProvider } from "@/components/rewards/points-context";
import { TaskList } from "@/components/tasks/task-list";
import type { TaskListConfig } from "@/components/tasks/types";

const TEST_PROFILE_ID = "test-profile-1";

const TEST_CONFIG: TaskListConfig = {
  id: "test-rewards",
  title: "My Tasks",
  showCompleted: false,
  sortBy: "dueDate",
  lists: [
    {
      listId: "list-rewards",
      listTitle: "Chores",
      color: "#3b82f6",
      enabled: true,
    },
  ],
};

export default function TestRewardsPage() {
  return (
    <PointsProvider profileId={TEST_PROFILE_ID}>
      <div
        className="container mx-auto max-w-md p-4"
        data-testid="test-rewards"
      >
        <header className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Rewards Test</h1>
          <PointsBadge />
        </header>
        <TaskList config={TEST_CONFIG} />
      </div>
    </PointsProvider>
  );
}
