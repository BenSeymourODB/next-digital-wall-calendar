"use client";

/**
 * NewTaskModal - dialog for creating a Google Task from the TaskList footer.
 *
 * Uses the same Radix Dialog plumbing as EventCreateDialog so focus
 * management, ESC-to-close and ARIA dialog semantics come for free.
 * Submission goes through {@link useCreateTask}; on success the form
 * resets, the dialog closes, and the supplied `onSuccess` callback fires
 * with the newly created task so the parent TaskList can refresh.
 */
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useId, useState } from "react";
import type { GoogleTask, TaskListSelection } from "./types";
import { useCreateTask } from "./use-create-task";

export interface NewTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Lists offered in the destination dropdown. Typically the enabled lists. */
  availableLists: TaskListSelection[];
  /** Pre-select this list. Useful when the launching context shows a single list. */
  defaultListId?: string;
  /** Invoked with the created task before the dialog closes. */
  onSuccess?: (task: GoogleTask) => void;
}

interface FormState {
  title: string;
  listId: string;
  due: string;
  notes: string;
}

interface FormErrors {
  title?: string;
  listId?: string;
}

function buildInitialState(defaultListId: string | undefined): FormState {
  return {
    title: "",
    listId: defaultListId ?? "",
    due: "",
    notes: "",
  };
}

/**
 * Convert an HTML `<input type="date">` value (YYYY-MM-DD) to RFC 3339,
 * which is what the Google Tasks API expects on the `due` field. Empty
 * strings collapse to `undefined` so the field is omitted entirely.
 */
function toApiDue(value: string): string | undefined {
  if (!value) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const [, y, m, d] = match;
  return `${y}-${m}-${d}T00:00:00.000Z`;
}

export function NewTaskModal({
  open,
  onOpenChange,
  availableLists,
  defaultListId,
  onSuccess,
}: NewTaskModalProps) {
  const titleId = useId();
  const listId = useId();
  const dueId = useId();
  const notesId = useId();
  const titleErrorId = useId();
  const listErrorId = useId();
  const submitErrorId = useId();

  const [state, setState] = useState<FormState>(() =>
    buildInitialState(defaultListId)
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [prevOpen, setPrevOpen] = useState(open);

  const { createTask, loading, error: submitError } = useCreateTask();

  // Reset on open (mirrors EventCreateDialog's "store information from previous renders" pattern).
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setState(buildInitialState(defaultListId));
      setErrors({});
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedTitle = state.title.trim();
    const nextErrors: FormErrors = {};
    if (!trimmedTitle) nextErrors.title = "Title is required";
    if (!state.listId) nextErrors.listId = "Please select a list";

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});

    try {
      const created = await createTask({
        listId: state.listId,
        title: trimmedTitle,
        ...(state.due ? { due: toApiDue(state.due) } : {}),
        ...(state.notes.trim() ? { notes: state.notes.trim() } : {}),
      });
      onSuccess?.(created);
      onOpenChange(false);
    } catch {
      // Error surfaced via the submitError state; modal stays open.
    }
  };

  const selectedList = availableLists.find((l) => l.listId === state.listId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Task</DialogTitle>
          <DialogDescription>
            Create a new task in one of your Google Tasks lists.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="space-y-4"
          data-testid="new-task-form"
          noValidate
        >
          <div className="space-y-2">
            <Label htmlFor={titleId}>
              Title <span className="text-red-600">*</span>
            </Label>
            <Input
              id={titleId}
              value={state.title}
              autoFocus
              placeholder="e.g., Buy milk"
              aria-invalid={!!errors.title}
              aria-describedby={errors.title ? titleErrorId : undefined}
              onChange={(e) => {
                const next = e.target.value;
                setState((prev) => ({ ...prev, title: next }));
                if (errors.title && next.trim()) {
                  setErrors((prev) => ({ ...prev, title: undefined }));
                }
              }}
            />
            {errors.title && (
              <p
                id={titleErrorId}
                role="alert"
                className="text-sm text-red-600"
              >
                {errors.title}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor={listId}>
              List <span className="text-red-600">*</span>
            </Label>
            <select
              id={listId}
              value={state.listId}
              aria-invalid={!!errors.listId}
              aria-describedby={errors.listId ? listErrorId : undefined}
              onChange={(e) => {
                const next = e.target.value;
                setState((prev) => ({ ...prev, listId: next }));
                if (errors.listId && next) {
                  setErrors((prev) => ({ ...prev, listId: undefined }));
                }
              }}
              className="border-input dark:bg-input/30 flex h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs aria-invalid:border-red-500"
            >
              <option value="">Select a list…</option>
              {availableLists.map((list) => (
                <option key={list.listId} value={list.listId}>
                  {list.listTitle}
                </option>
              ))}
            </select>
            {selectedList && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span
                  aria-hidden="true"
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: selectedList.color }}
                />
                <span>{selectedList.listTitle}</span>
              </div>
            )}
            {errors.listId && (
              <p id={listErrorId} role="alert" className="text-sm text-red-600">
                {errors.listId}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor={dueId}>Due date</Label>
            <Input
              id={dueId}
              type="date"
              value={state.due}
              onChange={(e) =>
                setState((prev) => ({ ...prev, due: e.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={notesId}>Notes</Label>
            <Textarea
              id={notesId}
              value={state.notes}
              placeholder="Optional details"
              onChange={(e) =>
                setState((prev) => ({ ...prev, notes: e.target.value }))
              }
            />
          </div>

          {submitError && (
            <p
              id={submitErrorId}
              role="alert"
              className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {submitError.message}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Adding…" : "Add Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
