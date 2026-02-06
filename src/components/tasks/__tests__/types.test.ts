/**
 * Tests for Google Tasks type helpers
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type GoogleTask,
  type TaskWithMeta,
  formatDueDate,
  isTaskOverdue,
  sortTasks,
} from "../types";

// Mock date for consistent testing
const MOCK_TODAY = new Date("2024-06-15T12:00:00Z");

describe("isTaskOverdue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(MOCK_TODAY);
  });

  // Helper to create dates relative to mock today
  const getDateRelativeToToday = (daysOffset: number): string => {
    const date = new Date(MOCK_TODAY);
    date.setDate(date.getDate() + daysOffset);
    date.setHours(0, 0, 0, 0);
    return date.toISOString();
  };

  it("returns false for tasks without due date", () => {
    const task: GoogleTask = {
      id: "1",
      title: "Test",
      status: "needsAction",
      updated: getDateRelativeToToday(-1),
      position: "0",
    };

    expect(isTaskOverdue(task)).toBe(false);
  });

  it("returns false for completed tasks even if due date passed", () => {
    const task: GoogleTask = {
      id: "1",
      title: "Test",
      status: "completed",
      due: getDateRelativeToToday(-5), // 5 days ago
      updated: getDateRelativeToToday(-1),
      position: "0",
    };

    expect(isTaskOverdue(task)).toBe(false);
  });

  it("returns true for incomplete tasks with past due date", () => {
    const task: GoogleTask = {
      id: "1",
      title: "Test",
      status: "needsAction",
      due: getDateRelativeToToday(-1), // Yesterday
      updated: getDateRelativeToToday(-1),
      position: "0",
    };

    expect(isTaskOverdue(task)).toBe(true);
  });

  it("returns false for tasks due today", () => {
    const task: GoogleTask = {
      id: "1",
      title: "Test",
      status: "needsAction",
      due: getDateRelativeToToday(0), // Today
      updated: getDateRelativeToToday(-1),
      position: "0",
    };

    expect(isTaskOverdue(task)).toBe(false);
  });

  it("returns false for tasks due in the future", () => {
    const task: GoogleTask = {
      id: "1",
      title: "Test",
      status: "needsAction",
      due: getDateRelativeToToday(5), // 5 days from now
      updated: getDateRelativeToToday(-1),
      position: "0",
    };

    expect(isTaskOverdue(task)).toBe(false);
  });
});

describe("formatDueDate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(MOCK_TODAY);
  });

  // Use dates relative to the mocked today to avoid timezone issues
  it('returns "Today" for today\'s date', () => {
    // Create today's date in local time
    const today = new Date(MOCK_TODAY);
    today.setHours(0, 0, 0, 0);
    expect(formatDueDate(today.toISOString())).toBe("Today");
  });

  it('returns "Tomorrow" for tomorrow\'s date', () => {
    const tomorrow = new Date(MOCK_TODAY);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    expect(formatDueDate(tomorrow.toISOString())).toBe("Tomorrow");
  });

  it('returns "Yesterday" for yesterday\'s date', () => {
    const yesterday = new Date(MOCK_TODAY);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    expect(formatDueDate(yesterday.toISOString())).toBe("Yesterday");
  });

  it("returns formatted date for dates a week away", () => {
    const nextWeek = new Date(MOCK_TODAY);
    nextWeek.setDate(nextWeek.getDate() + 7);
    nextWeek.setHours(0, 0, 0, 0);
    const result = formatDueDate(nextWeek.toISOString());
    // Format: "Sat, Jun 22" (approximately)
    expect(result).toMatch(/\w+, \w+ \d+/);
  });

  it("returns formatted date for dates in the past", () => {
    const lastWeek = new Date(MOCK_TODAY);
    lastWeek.setDate(lastWeek.getDate() - 7);
    lastWeek.setHours(0, 0, 0, 0);
    const result = formatDueDate(lastWeek.toISOString());
    // Format: "Sat, Jun 8" (approximately)
    expect(result).toMatch(/\w+, \w+ \d+/);
  });

  it("returns formatted date for dates in different months", () => {
    const differentMonth = new Date(MOCK_TODAY);
    differentMonth.setMonth(differentMonth.getMonth() + 2);
    differentMonth.setHours(0, 0, 0, 0);
    const result = formatDueDate(differentMonth.toISOString());
    // Should have some month and day
    expect(result).toMatch(/\w+, \w+ \d+/);
  });
});

describe("sortTasks", () => {
  const createTask = (overrides: Partial<TaskWithMeta>): TaskWithMeta => ({
    id: "1",
    title: "Test Task",
    status: "needsAction",
    updated: "2024-06-14T00:00:00Z",
    position: "00000000000000000000",
    listId: "list-1",
    listTitle: "My List",
    listColor: "#3b82f6",
    isOverdue: false,
    ...overrides,
  });

  describe("sortBy: dueDate", () => {
    it("sorts tasks by due date ascending", () => {
      const tasks: TaskWithMeta[] = [
        createTask({ id: "3", due: "2024-06-20T00:00:00Z" }),
        createTask({ id: "1", due: "2024-06-15T00:00:00Z" }),
        createTask({ id: "2", due: "2024-06-18T00:00:00Z" }),
      ];

      const sorted = sortTasks(tasks, "dueDate");

      expect(sorted.map((t) => t.id)).toEqual(["1", "2", "3"]);
    });

    it("puts tasks without due date at the end", () => {
      const tasks: TaskWithMeta[] = [
        createTask({ id: "1" }), // No due date
        createTask({ id: "2", due: "2024-06-15T00:00:00Z" }),
        createTask({ id: "3" }), // No due date
      ];

      const sorted = sortTasks(tasks, "dueDate");

      expect(sorted[0].id).toBe("2");
      expect(sorted[1].due).toBeUndefined();
      expect(sorted[2].due).toBeUndefined();
    });

    it("handles all tasks without due dates", () => {
      const tasks: TaskWithMeta[] = [
        createTask({ id: "1" }),
        createTask({ id: "2" }),
        createTask({ id: "3" }),
      ];

      const sorted = sortTasks(tasks, "dueDate");

      expect(sorted).toHaveLength(3);
    });
  });

  describe("sortBy: created", () => {
    it("sorts tasks by updated date descending (newest first)", () => {
      const tasks: TaskWithMeta[] = [
        createTask({ id: "1", updated: "2024-06-10T00:00:00Z" }),
        createTask({ id: "2", updated: "2024-06-15T00:00:00Z" }),
        createTask({ id: "3", updated: "2024-06-12T00:00:00Z" }),
      ];

      const sorted = sortTasks(tasks, "created");

      expect(sorted.map((t) => t.id)).toEqual(["2", "3", "1"]);
    });
  });

  describe("sortBy: manual", () => {
    it("sorts tasks by position field", () => {
      const tasks: TaskWithMeta[] = [
        createTask({ id: "1", position: "00000000000000000002" }),
        createTask({ id: "2", position: "00000000000000000000" }),
        createTask({ id: "3", position: "00000000000000000001" }),
      ];

      const sorted = sortTasks(tasks, "manual");

      expect(sorted.map((t) => t.id)).toEqual(["2", "3", "1"]);
    });
  });

  it("does not mutate the original array", () => {
    const tasks: TaskWithMeta[] = [
      createTask({ id: "2", due: "2024-06-20T00:00:00Z" }),
      createTask({ id: "1", due: "2024-06-15T00:00:00Z" }),
    ];

    const sorted = sortTasks(tasks, "dueDate");

    expect(tasks[0].id).toBe("2"); // Original unchanged
    expect(sorted[0].id).toBe("1"); // Sorted version different
  });

  it("returns unsorted copy for unknown sortBy value", () => {
    const tasks: TaskWithMeta[] = [
      createTask({ id: "3", due: "2024-06-20T00:00:00Z" }),
      createTask({ id: "1", due: "2024-06-15T00:00:00Z" }),
      createTask({ id: "2", due: "2024-06-18T00:00:00Z" }),
    ];

    // Cast to bypass TypeScript type checking for unknown sortBy value
    const sorted = sortTasks(tasks, "unknown" as "dueDate");

    // Should return a copy in original order (not sorted)
    expect(sorted.map((t) => t.id)).toEqual(["3", "1", "2"]);
    // Should still be a different array (copy, not reference)
    expect(sorted).not.toBe(tasks);
  });
});
