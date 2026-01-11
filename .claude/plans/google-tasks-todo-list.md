# Google Tasks To-Do List Component

## Overview

Create a to-do list component that displays tasks from Google Tasks API, supporting single or multiple task lists with configurable display options and task completion functionality.

## Requirements

### Core Features

#### 1. Task Display

- **Data Source**: Google Tasks API
- **Display Options**:
  - Show tasks from a single list
  - Show tasks from multiple lists (combined view)
  - Filter: Show only incomplete tasks or include completed tasks
  - Sort: By due date, creation date, or manual order

#### 2. Multi-List Support

- **Color Coding**: Each list has an associated color
- **Visual Indicator**: Tasks display with color indicator (border, dot, or background)
- **List Selection**: Configure which lists to show via settings modal

#### 3. Task Interaction

- **Mark as Done**: Click checkbox to complete task
  - Makes API call to update task status in Google Tasks
  - Visual feedback (strikethrough, fade out, or remove from list)
  - Optimistic update with rollback on API failure
- **Task Details**: Show task title, due date (if set), and notes (if any)

#### 4. Configuration UI

- **Settings Icon**: "⋮" (three-dot menu) icon
- **Settings Modal**: Opens when icon is clicked
  - Select which task lists to display
  - Assign colors to each list
  - Choose display options (show completed, sort order, etc.)
  - Save configuration (localStorage initially, DB later)

### Visual Design

#### Layout

```
┌─────────────────────────────────────┐
│  My Tasks                        ⋮  │  ← Header with title and settings icon
├─────────────────────────────────────┤
│  🔴 ☐ Buy groceries                │  ← Task with color indicator and checkbox
│      Due: Today                     │  ← Due date (if set)
├─────────────────────────────────────┤
│  🔵 ☐ Finish project report        │
│      Due: Tomorrow                  │
├─────────────────────────────────────┤
│  🟢 ☐ Call dentist                 │
├─────────────────────────────────────┤
│  + Add Task                         │  ← Add task button (separate feature)
└─────────────────────────────────────┘
```

#### Color Indicators

- **Option A**: Left border (4px solid color)
- **Option B**: Colored circle/dot before checkbox
- **Option C**: Subtle background tint
- **Recommendation**: Use colored dot (Option B) for clarity

#### Task States

- **Incomplete**: Normal text, empty checkbox
- **Completed**: Strikethrough text, checked checkbox, optional fade/removal
- **Overdue**: Red text or indicator if due date passed

## Technical Implementation Plan

### 1. Component Structure

```
src/components/tasks/
├── task-list.tsx              # Main task list component
├── task-item.tsx              # Individual task item
├── task-list-settings.tsx     # Settings modal
├── use-tasks.ts               # Hook for fetching/managing tasks
└── types.ts                   # TypeScript types

src/lib/google/
├── tasks-api.ts               # Google Tasks API client
└── tasks-types.ts             # API response types

src/app/api/tasks/
├── route.ts                   # GET tasks from Google Tasks
├── [taskId]/
│   └── route.ts              # PATCH to update task (mark complete)
└── lists/
    └── route.ts              # GET all task lists
```

### 2. Data Models

```typescript
// Task from Google Tasks API
interface GoogleTask {
  id: string;
  title: string;
  notes?: string;
  status: "needsAction" | "completed";
  due?: string; // ISO 8601 date string
  updated: string;
  parent?: string; // For subtasks
  position: string; // For ordering
  links?: Array<{ type: string; description: string; link: string }>;
}

// Task list from Google Tasks API
interface GoogleTaskList {
  id: string;
  title: string;
  updated: string;
}

// Component configuration
interface TaskListConfig {
  id: string; // Component instance ID
  title?: string; // Custom title (default: "My Tasks")
  lists: TaskListSelection[];
  showCompleted: boolean;
  sortBy: "dueDate" | "created" | "manual";
}

interface TaskListSelection {
  listId: string;
  listTitle: string;
  color: string; // Hex color code
  enabled: boolean;
}

// Enhanced task with metadata
interface TaskWithMeta extends GoogleTask {
  listId: string;
  listTitle: string;
  listColor: string;
  isOverdue?: boolean;
}
```

### 3. Core Components

#### TaskList Component

```tsx
// src/components/tasks/task-list.tsx
interface TaskListProps {
  configId?: string; // For loading saved config
  className?: string;
}

export function TaskList({ configId, className }: TaskListProps) {
  const [config, setConfig] = useState<TaskListConfig | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const { tasks, loading, error, refreshTasks, updateTask } = useTasks(config);

  // Load configuration
  useEffect(() => {
    const loadConfig = async () => {
      // Load from localStorage or API
    };
    loadConfig();
  }, [configId]);

  const handleTaskToggle = async (task: TaskWithMeta) => {
    const newStatus = task.status === "completed" ? "needsAction" : "completed";

    // Optimistic update
    const optimisticUpdate = { ...task, status: newStatus };

    try {
      await updateTask(task.id, task.listId, { status: newStatus });
      logger.event("TaskCompleted", {
        taskId: task.id,
        listId: task.listId,
        newStatus,
      });
    } catch (error) {
      // Rollback on error
      logger.error(error as Error, {
        context: "TaskToggleFailed",
        taskId: task.id,
      });
      // Show error toast
    }
  };

  return (
    <div className={`rounded-lg bg-white shadow-md ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b p-4">
        <h2 className="text-xl font-semibold text-gray-900">{config?.title || "My Tasks"}</h2>
        <button
          onClick={() => setShowSettings(true)}
          className="p-1 text-gray-500 hover:text-gray-700"
          aria-label="Task list settings"
        >
          ⋮
        </button>
      </div>

      {/* Task list */}
      <div className="divide-y">
        {loading && <div className="p-4 text-center">Loading tasks...</div>}
        {error && <div className="p-4 text-red-600">Error: {error.message}</div>}
        {tasks.length === 0 && !loading && (
          <div className="p-4 text-center text-gray-500">No tasks</div>
        )}
        {tasks.map((task) => (
          <TaskItem key={task.id} task={task} onToggle={() => handleTaskToggle(task)} />
        ))}
      </div>

      {/* Settings modal */}
      {showSettings && (
        <TaskListSettings
          config={config}
          onSave={(newConfig) => {
            setConfig(newConfig);
            setShowSettings(false);
          }}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
```

#### TaskItem Component

```tsx
// src/components/tasks/task-item.tsx
interface TaskItemProps {
  task: TaskWithMeta;
  onToggle: () => void;
}

export function TaskItem({ task, onToggle }: TaskItemProps) {
  const isCompleted = task.status === "completed";
  const isOverdue = task.isOverdue;

  return (
    <div className="p-4 transition hover:bg-gray-50">
      <div className="flex items-start gap-3">
        {/* Color indicator dot */}
        <div
          className="mt-1 h-3 w-3 flex-shrink-0 rounded-full"
          style={{ backgroundColor: task.listColor }}
          title={task.listTitle}
        />

        {/* Checkbox */}
        <input
          type="checkbox"
          checked={isCompleted}
          onChange={onToggle}
          className="mt-1 flex-shrink-0"
        />

        {/* Task content */}
        <div className="flex-1">
          <div className={`text-gray-900 ${isCompleted ? "text-gray-500 line-through" : ""}`}>
            {task.title}
          </div>

          {task.due && (
            <div
              className={`mt-1 text-sm ${isOverdue ? "font-medium text-red-600" : "text-gray-500"}`}
            >
              Due: {formatDueDate(task.due)}
            </div>
          )}

          {task.notes && <div className="mt-1 text-sm text-gray-600">{task.notes}</div>}
        </div>
      </div>
    </div>
  );
}

function formatDueDate(dueDate: string): string {
  const due = new Date(dueDate);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (isSameDay(due, today)) return "Today";
  if (isSameDay(due, tomorrow)) return "Tomorrow";

  // Format as "Mon, Jan 15" or similar
  return due.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
```

#### TaskListSettings Component

```tsx
// src/components/tasks/task-list-settings.tsx
interface TaskListSettingsProps {
  config: TaskListConfig | null;
  onSave: (config: TaskListConfig) => void;
  onClose: () => void;
}

export function TaskListSettings({ config, onSave, onClose }: TaskListSettingsProps) {
  const [localConfig, setLocalConfig] = useState(config || defaultConfig);
  const [availableLists, setAvailableLists] = useState<GoogleTaskList[]>([]);

  // Fetch available task lists
  useEffect(() => {
    const fetchLists = async () => {
      const lists = await fetch("/api/tasks/lists").then((r) => r.json());
      setAvailableLists(lists);
    };
    fetchLists();
  }, []);

  const handleToggleList = (listId: string) => {
    const updated = localConfig.lists.map((list) =>
      list.listId === listId ? { ...list, enabled: !list.enabled } : list
    );
    setLocalConfig({ ...localConfig, lists: updated });
  };

  const handleColorChange = (listId: string, color: string) => {
    const updated = localConfig.lists.map((list) =>
      list.listId === listId ? { ...list, color } : list
    );
    setLocalConfig({ ...localConfig, lists: updated });
  };

  return (
    <div className="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black">
      <div className="w-full max-w-md rounded-lg bg-white p-6">
        <h3 className="mb-4 text-xl font-semibold">Task List Settings</h3>

        {/* List selection */}
        <div className="mb-4 space-y-3">
          <h4 className="font-medium text-gray-700">Lists to Display</h4>
          {localConfig.lists.map((list) => (
            <div key={list.listId} className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={list.enabled}
                onChange={() => handleToggleList(list.listId)}
              />
              <input
                type="color"
                value={list.color}
                onChange={(e) => handleColorChange(list.listId, e.target.value)}
                className="h-8 w-8"
              />
              <span className="flex-1">{list.listTitle}</span>
            </div>
          ))}
        </div>

        {/* Display options */}
        <div className="mb-4 space-y-3">
          <h4 className="font-medium text-gray-700">Display Options</h4>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={localConfig.showCompleted}
              onChange={(e) => setLocalConfig({ ...localConfig, showCompleted: e.target.checked })}
            />
            <span>Show completed tasks</span>
          </label>

          <label className="flex flex-col gap-1">
            <span>Sort by:</span>
            <select
              value={localConfig.sortBy}
              onChange={(e) =>
                setLocalConfig({
                  ...localConfig,
                  sortBy: e.target.value as TaskListConfig["sortBy"],
                })
              }
              className="rounded border px-2 py-1"
            >
              <option value="dueDate">Due Date</option>
              <option value="created">Created Date</option>
              <option value="manual">Manual Order</option>
            </select>
          </label>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded px-4 py-2 text-gray-700 hover:bg-gray-100">
            Cancel
          </button>
          <button
            onClick={() => onSave(localConfig)}
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 4. Custom Hook: useTasks

```typescript
// src/components/tasks/use-tasks.ts
function useTasks(config: TaskListConfig | null) {
  const [tasks, setTasks] = useState<TaskWithMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchTasks = useCallback(async () => {
    if (!config) return;

    setLoading(true);
    setError(null);

    try {
      const enabledLists = config.lists.filter((l) => l.enabled);

      // Fetch tasks from all enabled lists
      const taskPromises = enabledLists.map((list) =>
        fetch(`/api/tasks?listId=${list.listId}`).then((r) => r.json())
      );

      const tasksArrays = await Promise.all(taskPromises);

      // Combine and enrich tasks with list metadata
      const allTasks: TaskWithMeta[] = tasksArrays.flatMap((tasks, index) => {
        const list = enabledLists[index];
        return tasks.map((task: GoogleTask) => ({
          ...task,
          listId: list.listId,
          listTitle: list.listTitle,
          listColor: list.color,
          isOverdue: task.due ? new Date(task.due) < new Date() : false,
        }));
      });

      // Filter completed if needed
      const filtered = config.showCompleted
        ? allTasks
        : allTasks.filter((t) => t.status !== "completed");

      // Sort tasks
      const sorted = sortTasks(filtered, config.sortBy);

      setTasks(sorted);
    } catch (err) {
      setError(err as Error);
      logger.error(err as Error, { context: "FetchTasksFailed" });
    } finally {
      setLoading(false);
    }
  }, [config]);

  const updateTask = useCallback(
    async (taskId: string, listId: string, updates: Partial<GoogleTask>) => {
      try {
        const response = await fetch(`/api/tasks/${taskId}?listId=${listId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });

        if (!response.ok) throw new Error("Failed to update task");

        // Refresh tasks
        await fetchTasks();
      } catch (err) {
        throw err; // Let caller handle error
      }
    },
    [fetchTasks]
  );

  // Initial fetch and periodic refresh
  useEffect(() => {
    fetchTasks();

    // Refresh every 5 minutes
    const interval = setInterval(fetchTasks, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [fetchTasks]);

  return {
    tasks,
    loading,
    error,
    refreshTasks: fetchTasks,
    updateTask,
  };
}

function sortTasks(tasks: TaskWithMeta[], sortBy: TaskListConfig["sortBy"]) {
  switch (sortBy) {
    case "dueDate":
      return tasks.sort((a, b) => {
        if (!a.due && !b.due) return 0;
        if (!a.due) return 1;
        if (!b.due) return -1;
        return new Date(a.due).getTime() - new Date(b.due).getTime();
      });

    case "created":
      return tasks.sort((a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime());

    case "manual":
      // Use position field from Google Tasks
      return tasks.sort((a, b) => a.position.localeCompare(b.position));

    default:
      return tasks;
  }
}
```

### 5. API Routes

#### GET /api/tasks

```typescript
// src/app/api/tasks/route.ts
import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const listId = searchParams.get("listId");

    if (!listId) {
      return NextResponse.json({ error: "listId is required" }, { status: 400 });
    }

    // Get access token from session/auth
    const accessToken = await getAccessToken(request);

    // Call Google Tasks API
    const response = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Google Tasks API error: ${response.statusText}`);
    }

    const data = await response.json();

    logger.log("Tasks fetched successfully", {
      listId,
      taskCount: data.items?.length || 0,
    });

    return NextResponse.json(data.items || []);
  } catch (error) {
    logger.error(error as Error, {
      endpoint: "/api/tasks",
      errorType: "fetch_tasks",
    });

    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }
}
```

#### PATCH /api/tasks/[taskId]

```typescript
// src/app/api/tasks/[taskId]/route.ts
export async function PATCH(request: NextRequest, { params }: { params: { taskId: string } }) {
  try {
    const { taskId } = params;
    const { searchParams } = new URL(request.url);
    const listId = searchParams.get("listId");
    const updates = await request.json();

    if (!listId) {
      return NextResponse.json({ error: "listId is required" }, { status: 400 });
    }

    const accessToken = await getAccessToken(request);

    const response = await fetch(
      `https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks/${taskId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      }
    );

    if (!response.ok) {
      throw new Error(`Google Tasks API error: ${response.statusText}`);
    }

    const updatedTask = await response.json();

    logger.event("TaskUpdated", {
      taskId,
      listId,
      updates: Object.keys(updates),
    });

    return NextResponse.json(updatedTask);
  } catch (error) {
    logger.error(error as Error, {
      endpoint: "/api/tasks/[taskId]",
      errorType: "update_task",
    });

    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}
```

#### GET /api/tasks/lists

```typescript
// src/app/api/tasks/lists/route.ts
export async function GET(request: NextRequest) {
  try {
    const accessToken = await getAccessToken(request);

    const response = await fetch("https://tasks.googleapis.com/tasks/v1/users/@me/lists", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Google Tasks API error: ${response.statusText}`);
    }

    const data = await response.json();

    logger.log("Task lists fetched", {
      listCount: data.items?.length || 0,
    });

    return NextResponse.json(data.items || []);
  } catch (error) {
    logger.error(error as Error, {
      endpoint: "/api/tasks/lists",
      errorType: "fetch_lists",
    });

    return NextResponse.json({ error: "Failed to fetch task lists" }, { status: 500 });
  }
}
```

## Implementation Steps

1. **Set up Google Tasks API integration**
   - Add Google Tasks API scope to OAuth consent
   - Test API calls with Google API Explorer
   - Create API client utilities

2. **Create data models and types**
   - Define TypeScript interfaces
   - Create mock data for development

3. **Build TaskItem component**
   - Render task with checkbox and details
   - Add color indicator
   - Test with mock data

4. **Build TaskList component**
   - Render list of TaskItem components
   - Add header with title and settings icon
   - Add loading/error states

5. **Implement useTasks hook**
   - Fetch tasks from API
   - Handle loading and error states
   - Implement task update logic

6. **Create API routes**
   - GET /api/tasks (fetch tasks from list)
   - PATCH /api/tasks/[taskId] (update task)
   - GET /api/tasks/lists (fetch all lists)

7. **Build TaskListSettings component**
   - List selection UI
   - Color picker for each list
   - Display options (show completed, sort order)
   - Save/cancel actions

8. **Implement configuration persistence**
   - Save to localStorage initially
   - Later migrate to database

9. **Add optimistic updates**
   - Update UI immediately on task toggle
   - Rollback on API failure
   - Show error message to user

10. **Testing and polish**
    - Test with real Google Tasks data
    - Edge cases (empty lists, API errors, etc.)
    - Accessibility improvements
    - Performance optimization

## Challenges and Considerations

### Challenge 1: Authentication

- **Problem**: Requires Google OAuth and access tokens
- **Solution**: Depends on server-side auth implementation
- **Temporary**: Use client-side GIS for development

### Challenge 2: Rate Limiting

- **Problem**: Google Tasks API has rate limits
- **Solution**:
  - Cache responses
  - Implement request debouncing
  - Show rate limit errors gracefully

### Challenge 3: Subtasks

- **Problem**: Google Tasks supports nested subtasks
- **Solution**:
  - Phase 1: Show only top-level tasks
  - Phase 2: Add expandable subtask display

### Challenge 4: Offline Support

- **Problem**: Component breaks without internet
- **Solution**:
  - Cache last fetched tasks
  - Show stale data with indicator
  - Queue task updates for later sync

### Challenge 5: Real-time Updates

- **Problem**: Changes made in Google Tasks app don't appear immediately
- **Solution**:
  - Periodic polling (every 5 minutes)
  - Manual refresh button
  - Later: Implement webhooks if available

## Testing Strategy

1. **Unit Tests**:
   - Task sorting logic
   - Date formatting
   - Overdue calculation

2. **Integration Tests**:
   - API route functionality
   - Task fetch and update
   - Error handling

3. **Component Tests**:
   - TaskItem rendering
   - Checkbox interaction
   - Settings modal

4. **E2E Tests**:
   - Complete task flow
   - Settings configuration
   - Multi-list display

## Dependencies

- Google Tasks API v1
- Server-side authentication (future)
- No additional UI libraries needed

## Integration with Other Features

- **Server-Side Auth**: Required for production use
- **User Settings**: Task list configs should be per-user
- **Reward System**: Track completed tasks for points
- **Add Task Modal**: Launch from "+" button in this component
