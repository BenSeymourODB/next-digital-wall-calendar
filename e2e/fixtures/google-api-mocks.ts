/**
 * Mock data for Google API responses in E2E tests
 *
 * These mocks are used with Playwright's route interception
 * to simulate Google API responses without making real API calls
 */

/**
 * Mock Google Tasks task list
 */
export interface MockTaskList {
  id: string;
  title: string;
  updated: string;
  selfLink: string;
}

/**
 * Mock Google Tasks task
 */
export interface MockTask {
  id: string;
  title: string;
  status: "needsAction" | "completed";
  notes?: string;
  due?: string;
  completed?: string;
  updated: string;
  selfLink: string;
}

/**
 * Mock Google Calendar event
 */
export interface MockCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime: string; timeZone?: string } | { date: string };
  end: { dateTime: string; timeZone?: string } | { date: string };
  colorId?: string;
  status: "confirmed" | "tentative" | "cancelled";
  htmlLink: string;
}

/**
 * Sample task lists for testing
 */
export const mockTaskLists: MockTaskList[] = [
  {
    id: "list-1",
    title: "My Tasks",
    updated: new Date().toISOString(),
    selfLink: "https://tasks.googleapis.com/tasks/v1/users/@me/lists/list-1",
  },
  {
    id: "list-2",
    title: "Work Tasks",
    updated: new Date().toISOString(),
    selfLink: "https://tasks.googleapis.com/tasks/v1/users/@me/lists/list-2",
  },
  {
    id: "list-3",
    title: "Shopping List",
    updated: new Date().toISOString(),
    selfLink: "https://tasks.googleapis.com/tasks/v1/users/@me/lists/list-3",
  },
];

/**
 * Sample tasks for testing
 */
export const mockTasks: MockTask[] = [
  {
    id: "task-1",
    title: "Complete project documentation",
    status: "needsAction",
    notes: "Include API docs and README updates",
    due: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    updated: new Date().toISOString(),
    selfLink: "https://tasks.googleapis.com/tasks/v1/lists/list-1/tasks/task-1",
  },
  {
    id: "task-2",
    title: "Review pull requests",
    status: "needsAction",
    updated: new Date().toISOString(),
    selfLink: "https://tasks.googleapis.com/tasks/v1/lists/list-1/tasks/task-2",
  },
  {
    id: "task-3",
    title: "Fix authentication bug",
    status: "completed",
    completed: new Date().toISOString(),
    updated: new Date().toISOString(),
    selfLink: "https://tasks.googleapis.com/tasks/v1/lists/list-1/tasks/task-3",
  },
];

/**
 * Sample calendar events for testing
 */
export const mockCalendarEvents: MockCalendarEvent[] = [
  {
    id: "event-1",
    summary: "Morning Standup",
    description: "Daily team sync",
    start: {
      dateTime: new Date(
        Date.now() + 24 * 60 * 60 * 1000 + 9 * 60 * 60 * 1000
      ).toISOString(),
      timeZone: "America/New_York",
    },
    end: {
      dateTime: new Date(
        Date.now() + 24 * 60 * 60 * 1000 + 9.5 * 60 * 60 * 1000
      ).toISOString(),
      timeZone: "America/New_York",
    },
    colorId: "1",
    status: "confirmed",
    htmlLink: "https://calendar.google.com/event?eid=event-1",
  },
  {
    id: "event-2",
    summary: "Project Review",
    description: "Weekly project status review",
    start: {
      dateTime: new Date(
        Date.now() + 24 * 60 * 60 * 1000 + 14 * 60 * 60 * 1000
      ).toISOString(),
      timeZone: "America/New_York",
    },
    end: {
      dateTime: new Date(
        Date.now() + 24 * 60 * 60 * 1000 + 15 * 60 * 60 * 1000
      ).toISOString(),
      timeZone: "America/New_York",
    },
    colorId: "2",
    status: "confirmed",
    htmlLink: "https://calendar.google.com/event?eid=event-2",
  },
  {
    id: "event-3",
    summary: "Team Lunch",
    start: {
      dateTime: new Date(
        Date.now() + 2 * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000
      ).toISOString(),
      timeZone: "America/New_York",
    },
    end: {
      dateTime: new Date(
        Date.now() + 2 * 24 * 60 * 60 * 1000 + 13 * 60 * 60 * 1000
      ).toISOString(),
      timeZone: "America/New_York",
    },
    status: "tentative",
    htmlLink: "https://calendar.google.com/event?eid=event-3",
  },
];

/**
 * Mock response for Google Tasks API: List task lists
 */
export function mockTaskListsResponse() {
  return {
    kind: "tasks#taskLists",
    etag: '"mock-etag"',
    items: mockTaskLists,
  };
}

/**
 * Mock response for Google Tasks API: List tasks
 */
export function mockTasksResponse(listId: string) {
  // Filter tasks by list or return all
  const tasks = listId === "list-1" ? mockTasks : [];
  return {
    kind: "tasks#tasks",
    etag: '"mock-etag"',
    items: tasks,
  };
}

/**
 * Mock response for Google Tasks API: Create task
 */
export function mockCreateTaskResponse(
  title: string,
  listId: string,
  notes?: string,
  due?: string
): MockTask {
  const newTask: MockTask = {
    id: `task-${Date.now()}`,
    title,
    status: "needsAction",
    notes,
    due,
    updated: new Date().toISOString(),
    selfLink: `https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks/task-${Date.now()}`,
  };
  return newTask;
}

/**
 * Mock response for Google Calendar API: List events
 */
export function mockCalendarEventsResponse() {
  return {
    kind: "calendar#events",
    etag: '"mock-etag"',
    summary: "Primary Calendar",
    description: "Test calendar",
    updated: new Date().toISOString(),
    timeZone: "America/New_York",
    accessRole: "owner",
    items: mockCalendarEvents,
  };
}

/**
 * Mock 401 unauthorized response
 */
export function mockUnauthorizedResponse() {
  return {
    error: {
      code: 401,
      message: "Invalid Credentials",
      errors: [
        {
          message: "Invalid Credentials",
          domain: "global",
          reason: "authError",
          locationType: "header",
          location: "Authorization",
        },
      ],
    },
  };
}

/**
 * Mock 404 not found response
 */
export function mockNotFoundResponse(resource: string) {
  return {
    error: {
      code: 404,
      message: `${resource} not found`,
      errors: [
        {
          message: `${resource} not found`,
          domain: "global",
          reason: "notFound",
        },
      ],
    },
  };
}

/**
 * Mock 500 internal server error response
 */
export function mockServerErrorResponse() {
  return {
    error: {
      code: 500,
      message: "Backend Error",
      errors: [
        {
          message: "Backend Error",
          domain: "global",
          reason: "backendError",
        },
      ],
    },
  };
}
