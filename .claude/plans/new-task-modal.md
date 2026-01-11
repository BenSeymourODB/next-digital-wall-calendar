# New Task Entry Modal

## Overview

Create a modal dialog for adding new tasks to Google Tasks, with smart defaults when launched from a task list component and a dropdown for selecting the destination list.

## Requirements

### Core Features

#### 1. Launch Mechanism

- **Trigger**: "+" button at bottom of TaskList component
- **Multiple Instances**: Each TaskList component can have its own "+" button
- **Context-Aware**: Modal knows which TaskList launched it

#### 2. Form Fields

- **Task Title** (required): Text input for task name
- **Due Date** (optional): Date picker
- **Notes** (optional): Textarea for additional details
- **List Selection** (required): Dropdown to choose destination list

#### 3. Smart Defaults

- **Single-List Context**: If TaskList shows only one list, dropdown defaults to that list
- **Multi-List Context**: If TaskList shows multiple lists, dropdown has no default (user must choose)
- **Recent List**: Remember last-used list and suggest it

#### 4. Validation

- **Required Fields**: Task title must not be empty
- **List Selection**: Must select a list before submitting
- **Error Messages**: Clear feedback for validation errors

#### 5. Submission

- **API Call**: POST to Google Tasks API to create task
- **Optimistic Update**: Add task to UI immediately, remove on failure
- **Success Feedback**: Close modal, show brief success message
- **Error Handling**: Show error message, keep modal open for retry

### Visual Design

```
┌─────────────────────────────────────┐
│  Add New Task                    ✕  │  ← Header with close button
├─────────────────────────────────────┤
│                                     │
│  Task Title *                       │
│  ┌─────────────────────────────┐   │
│  │ Buy milk                    │   │
│  └─────────────────────────────┘   │
│                                     │
│  List *                             │
│  ┌─────────────────────────────┐   │
│  │ 🔴 Groceries            ▼   │   │  ← Colored dot shows list color
│  └─────────────────────────────┘   │
│                                     │
│  Due Date (optional)                │
│  ┌─────────────────────────────┐   │
│  │ 2026-01-07              📅  │   │
│  └─────────────────────────────┘   │
│                                     │
│  Notes (optional)                   │
│  ┌─────────────────────────────┐   │
│  │                             │   │
│  │ Get whole milk, not skim    │   │
│  │                             │   │
│  └─────────────────────────────┘   │
│                                     │
│           [Cancel]  [Add Task]      │
└─────────────────────────────────────┘
```

## Technical Implementation Plan

### 1. Component Structure

```
src/components/tasks/
├── new-task-modal.tsx         # Main modal component
├── new-task-form.tsx          # Form component (reusable)
├── use-create-task.ts         # Hook for creating tasks
└── task-list.tsx              # Updated with "+" button

src/app/api/tasks/
└── create/
    └── route.ts               # POST endpoint for creating tasks
```

### 2. Data Models

```typescript
interface NewTaskFormData {
  title: string;
  listId: string;
  due?: string; // ISO 8601 date string
  notes?: string;
}

interface NewTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (task: GoogleTask) => void;
  defaultListId?: string; // Pre-select this list
  availableLists: TaskListSelection[]; // Lists to show in dropdown
}

interface CreateTaskRequest {
  listId: string;
  task: {
    title: string;
    due?: string;
    notes?: string;
  };
}
```

### 3. NewTaskModal Component

```tsx
// src/components/tasks/new-task-modal.tsx
interface NewTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (task: GoogleTask) => void;
  defaultListId?: string;
  availableLists: TaskListSelection[];
}

export function NewTaskModal({
  isOpen,
  onClose,
  onSuccess,
  defaultListId,
  availableLists,
}: NewTaskModalProps) {
  const [formData, setFormData] = useState<NewTaskFormData>({
    title: "",
    listId: defaultListId || "",
    due: undefined,
    notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { createTask, loading, error } = useCreateTask();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = "Task title is required";
    }

    if (!formData.listId) {
      newErrors.listId = "Please select a list";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      const newTask = await createTask({
        listId: formData.listId,
        task: {
          title: formData.title,
          due: formData.due,
          notes: formData.notes,
        },
      });

      logger.event("TaskCreated", {
        listId: formData.listId,
        hasDueDate: !!formData.due,
        hasNotes: !!formData.notes,
      });

      // Success callback
      onSuccess?.(newTask);

      // Reset form and close
      setFormData({
        title: "",
        listId: defaultListId || "",
        due: undefined,
        notes: "",
      });
      setErrors({});
      onClose();
    } catch (err) {
      logger.error(err as Error, {
        context: "CreateTaskFailed",
        listId: formData.listId,
      });
      // Error is handled by useCreateTask hook
    }
  };

  if (!isOpen) return null;

  return (
    <div className="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black">
      <div className="w-full max-w-md rounded-lg bg-white p-6">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-gray-900">Add New Task</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Task Title */}
          <div>
            <label htmlFor="task-title" className="mb-1 block text-sm font-medium text-gray-700">
              Task Title *
            </label>
            <input
              id="task-title"
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className={`w-full rounded border px-3 py-2 ${
                errors.title ? "border-red-500" : "border-gray-300"
              }`}
              placeholder="e.g., Buy milk"
              autoFocus
            />
            {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title}</p>}
          </div>

          {/* List Selection */}
          <div>
            <label htmlFor="task-list" className="mb-1 block text-sm font-medium text-gray-700">
              List *
            </label>
            <select
              id="task-list"
              value={formData.listId}
              onChange={(e) => setFormData({ ...formData, listId: e.target.value })}
              className={`w-full rounded border px-3 py-2 ${
                errors.listId ? "border-red-500" : "border-gray-300"
              }`}
            >
              <option value="">Select a list...</option>
              {availableLists.map((list) => (
                <option key={list.listId} value={list.listId}>
                  {list.listTitle}
                </option>
              ))}
            </select>
            {errors.listId && <p className="mt-1 text-sm text-red-600">{errors.listId}</p>}

            {/* Show color indicator for selected list */}
            {formData.listId && (
              <div className="mt-2 flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{
                    backgroundColor:
                      availableLists.find((l) => l.listId === formData.listId)?.color || "#gray",
                  }}
                />
                <span className="text-sm text-gray-600">
                  {availableLists.find((l) => l.listId === formData.listId)?.listTitle}
                </span>
              </div>
            )}
          </div>

          {/* Due Date */}
          <div>
            <label htmlFor="task-due" className="mb-1 block text-sm font-medium text-gray-700">
              Due Date (optional)
            </label>
            <input
              id="task-due"
              type="date"
              value={formData.due || ""}
              onChange={(e) => setFormData({ ...formData, due: e.target.value })}
              className="w-full rounded border border-gray-300 px-3 py-2"
            />
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="task-notes" className="mb-1 block text-sm font-medium text-gray-700">
              Notes (optional)
            </label>
            <textarea
              id="task-notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full rounded border border-gray-300 px-3 py-2"
              rows={3}
              placeholder="Additional details..."
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-700">{error.message}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded px-4 py-2 text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Adding..." : "Add Task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

### 4. useCreateTask Hook

```typescript
// src/components/tasks/use-create-task.ts
function useCreateTask() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createTask = async (request: CreateTaskRequest): Promise<GoogleTask> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/tasks/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create task");
      }

      const newTask = await response.json();

      return newTask;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    createTask,
    loading,
    error,
  };
}
```

### 5. API Route: POST /api/tasks/create

```typescript
// src/app/api/tasks/create/route.ts
import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body: CreateTaskRequest = await request.json();

    // Validate request
    if (!body.listId || !body.task?.title) {
      return NextResponse.json({ error: "listId and task.title are required" }, { status: 400 });
    }

    // Get access token
    const accessToken = await getAccessToken(request);

    // Prepare task data for Google Tasks API
    const taskData: Record<string, string> = {
      title: body.task.title,
    };

    if (body.task.due) {
      // Convert to RFC 3339 format if needed
      taskData.due = new Date(body.task.due).toISOString();
    }

    if (body.task.notes) {
      taskData.notes = body.task.notes;
    }

    // Call Google Tasks API
    const response = await fetch(
      `https://tasks.googleapis.com/tasks/v1/lists/${body.listId}/tasks`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(taskData),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Google Tasks API error: ${errorData.error?.message || response.statusText}`);
    }

    const newTask = await response.json();

    logger.event("TaskCreated", {
      listId: body.listId,
      taskId: newTask.id,
      hasDueDate: !!body.task.due,
      hasNotes: !!body.task.notes,
    });

    return NextResponse.json(newTask);
  } catch (error) {
    logger.error(error as Error, {
      endpoint: "/api/tasks/create",
      errorType: "create_task",
    });

    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}
```

### 6. Integration with TaskList Component

```tsx
// Update to src/components/tasks/task-list.tsx

export function TaskList({ configId, className }: TaskListProps) {
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  // ... existing state ...

  // Determine default list for new task modal
  const getDefaultListId = () => {
    const enabledLists = config?.lists.filter((l) => l.enabled) || [];
    return enabledLists.length === 1 ? enabledLists[0].listId : undefined;
  };

  const handleTaskCreated = (newTask: GoogleTask) => {
    // Refresh tasks to include newly created task
    refreshTasks();

    // Optional: Show success toast
    // showToast('Task created successfully!');
  };

  return (
    <div className={`rounded-lg bg-white shadow-md ${className}`}>
      {/* ... existing header and task list ... */}

      {/* Add Task Button */}
      <button
        onClick={() => setShowNewTaskModal(true)}
        className="flex w-full items-center justify-center gap-2 border-t p-4 text-blue-600 transition hover:bg-blue-50"
      >
        <span className="text-xl">+</span>
        <span>Add Task</span>
      </button>

      {/* New Task Modal */}
      {showNewTaskModal && (
        <NewTaskModal
          isOpen={showNewTaskModal}
          onClose={() => setShowNewTaskModal(false)}
          onSuccess={handleTaskCreated}
          defaultListId={getDefaultListId()}
          availableLists={config?.lists.filter((l) => l.enabled) || []}
        />
      )}

      {/* ... existing settings modal ... */}
    </div>
  );
}
```

## Implementation Steps

1. **Create NewTaskModal component**
   - Build form UI with all fields
   - Add validation logic
   - Test with mock data

2. **Implement useCreateTask hook**
   - Handle API call to create task
   - Manage loading and error states
   - Test error scenarios

3. **Create POST API route**
   - Validate request data
   - Call Google Tasks API
   - Handle errors and logging
   - Test with Google API Explorer

4. **Integrate with TaskList**
   - Add "+" button to TaskList component
   - Pass correct props to modal
   - Handle task creation success
   - Refresh task list after creation

5. **Add smart defaults**
   - Pre-select list when launched from single-list context
   - Remember last-used list (localStorage)
   - Test default behavior

6. **Polish and test**
   - Add keyboard shortcuts (ESC to close, Enter to submit)
   - Improve form accessibility
   - Add loading indicators
   - Test edge cases

## Challenges and Considerations

### Challenge 1: Form Validation

- **Problem**: Need robust validation for required fields
- **Solution**:
  - Use controlled inputs with real-time validation
  - Show errors only after user attempts to submit
  - Clear errors when user corrects input

### Challenge 2: Date Handling

- **Problem**: Need to convert date input to Google Tasks format
- **Solution**:
  - HTML5 date input returns YYYY-MM-DD
  - Convert to ISO 8601 for Google Tasks API
  - Handle timezone considerations

### Challenge 3: Modal Accessibility

- **Problem**: Modal must be accessible to keyboard and screen reader users
- **Solution**:
  - Trap focus within modal when open
  - ESC key to close
  - Focus first input on open
  - Return focus to trigger button on close
  - ARIA attributes for modal role

### Challenge 4: Optimistic Updates

- **Problem**: Should task appear in list immediately or wait for API?
- **Solution**:
  - Option A: Wait for API response (simpler, but slower UX)
  - Option B: Add to list immediately, remove on failure (better UX)
  - Recommendation: Option A for simplicity, Option B for v2

### Challenge 5: Multiple List Colors in Dropdown

- **Problem**: Showing list colors in dropdown is tricky with native select
- **Solution**:
  - Option A: Use native select, show color after selection
  - Option B: Build custom dropdown with color indicators
  - Recommendation: Option A for simplicity

## Testing Strategy

1. **Unit Tests**:
   - Form validation logic
   - Date conversion
   - Error handling

2. **Component Tests**:
   - Modal rendering
   - Form submission
   - Validation messages
   - Cancel button

3. **Integration Tests**:
   - API route functionality
   - Task creation end-to-end
   - Error scenarios

4. **Manual Tests**:
   - Test from single-list context
   - Test from multi-list context
   - Test with all form fields filled
   - Test with only required fields
   - Test error handling
   - Test keyboard navigation

## Accessibility Checklist

- [ ] Modal has `role="dialog"` and `aria-labelledby`
- [ ] Focus trapped within modal when open
- [ ] ESC key closes modal
- [ ] First input is focused when modal opens
- [ ] Focus returns to trigger button when modal closes
- [ ] All form fields have associated labels
- [ ] Error messages have `aria-describedby` linking to input
- [ ] Submit button disabled state is announced to screen readers

## Future Enhancements

- **Quick add**: Input at top of list for faster task creation (without modal)
- **Template tasks**: Create tasks from templates
- **Recurring tasks**: Support for recurring task creation
- **Task priority**: Add priority field (if Google Tasks supports it)
- **Subtasks**: Create tasks with subtasks
- **Voice input**: Add task via voice command
- **Smart suggestions**: Suggest list based on task title
- **Keyboard shortcuts**: Global shortcut to open modal from anywhere

## Dependencies

- Google Tasks API v1
- No additional UI libraries needed
- React Hook Form (optional, for more complex form handling)

## Integration with Other Features

- **TaskList Component**: Primary integration point
- **Reward System**: Award points when task is created (optional)
- **Logging**: Track task creation events in Application Insights
- **User Settings**: Remember last-used list per user
