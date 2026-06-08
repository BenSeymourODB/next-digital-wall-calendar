"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  parseDateOnly,
  parseDateTimeLocal,
  toDateOnly,
  toDateTimeLocal,
} from "@/lib/calendar/date-input";
import type {
  IEvent,
  TCalendarAccessRole,
  TEventColor,
} from "@/types/calendar";
import { type RefObject, useId, useState } from "react";
import { format, isSameDay } from "date-fns";
import { Pencil, Trash2 } from "lucide-react";

const COLOR_INDICATOR_CLASSES: Record<TEventColor, string> = {
  blue: "bg-blue-500",
  green: "bg-green-500",
  red: "bg-red-500",
  yellow: "bg-yellow-500",
  purple: "bg-purple-500",
  orange: "bg-orange-500",
};

const COLOR_OPTIONS: readonly {
  value: TEventColor;
  label: string;
  swatch: string;
}[] = [
  { value: "blue", label: "Blue", swatch: "bg-blue-500" },
  { value: "green", label: "Green", swatch: "bg-green-500" },
  { value: "red", label: "Red", swatch: "bg-red-500" },
  { value: "yellow", label: "Yellow", swatch: "bg-yellow-500" },
  { value: "purple", label: "Purple", swatch: "bg-purple-500" },
  { value: "orange", label: "Orange", swatch: "bg-orange-500" },
];

/**
 * Edit-form patch payload. Matches `EditEventInput`'s body shape from
 * `CalendarProvider` minus `calendarId` (the modal doesn't know about
 * other calendars; the parent forwards the event's own `calendarId`).
 *
 * `isAllDay = true` ⇒ `startDate` / `endDate` are `YYYY-MM-DD` strings
 * (matching the `POST` / `PATCH` route wire format). `isAllDay = false`
 * ⇒ ISO datetime strings.
 */
export interface EventEditPatch {
  title: string;
  description: string;
  color: TEventColor;
  isAllDay: boolean;
  startDate: string;
  endDate: string;
}

interface EventDetailModalProps {
  event: IEvent | null;
  onClose: () => void;
  use24HourFormat: boolean;
  /**
   * Ref to the element that opened the modal. On close, focus is explicitly
   * restored to this element so keyboard users land back where they were
   * (WCAG 2.4.3), since the triggers are not wrapped in a Radix DialogTrigger.
   * Accepts SVG elements too (clock arc <g> with tabIndex=0 is a valid trigger).
   */
  returnFocusTo?: RefObject<HTMLElement | SVGElement | null>;
  /**
   * Optional delete handler. When provided, a "Delete event" button renders
   * in the footer behind a confirmation dialog. When the handler resolves,
   * `onClose` is called so the modal dismisses; when it rejects, the modal
   * stays open (the caller is expected to surface a toast).
   */
  onDelete?: (event: IEvent) => Promise<void>;
  /**
   * Optional edit handler (#265). When provided, an "Edit event" button
   * renders in the footer. Activating it swaps the read-only body for an
   * inline edit form; saving calls `onEdit(event, patch)`. On success the
   * modal closes; on rejection the form stays open so the caller can show
   * a toast and the user can retry.
   *
   * Gated by `accessRole` exactly like delete — `reader` / `freeBusyReader`
   * hides the button (Google's server-side 403 is still the backstop).
   */
  onEdit?: (event: IEvent, patch: EventEditPatch) => Promise<void>;
  /**
   * The user's permission level on the event's source calendar (#266).
   * When `reader` or `freeBusyReader`, mutating actions (delete, edit) are
   * hidden — Google's server-side 403 stays as the backstop for races
   * where the role changes mid-session. Treat `undefined` as "unknown /
   * writable" so a not-yet-loaded calendar list doesn't accidentally hide
   * the buttons on owned calendars.
   */
  accessRole?: TCalendarAccessRole;
}

function isReadOnlyRole(role: TCalendarAccessRole | undefined): boolean {
  return role === "reader" || role === "freeBusyReader";
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatTimeRange(event: IEvent, use24HourFormat: boolean): string {
  if (event.isAllDay) return "All day";
  const timePattern = use24HourFormat ? "HH:mm" : "h:mm a";
  const start = format(new Date(event.startDate), timePattern);
  const end = format(new Date(event.endDate), timePattern);
  return `${start} – ${end}`;
}

function formatDateLabel(event: IEvent): string {
  const start = new Date(event.startDate);
  const end = new Date(event.endDate);

  if (isSameDay(start, end)) {
    return format(start, "EEEE, MMMM d, yyyy");
  }

  const startLabel = format(start, "EEE, MMM d");
  const endLabel = format(end, "EEE, MMM d, yyyy");
  return `${startLabel} – ${endLabel}`;
}

interface EditFormState {
  title: string;
  description: string;
  color: TEventColor;
  isAllDay: boolean;
  startTimed: string;
  endTimed: string;
  startAllDay: string;
  endAllDay: string;
}

/**
 * Seed the edit form from the event's current values.
 *
 * Both `startTimed` / `endTimed` and `startAllDay` / `endAllDay` are
 * populated regardless of `isAllDay` so toggling the checkbox doesn't
 * lose the user's other-mode picks — same UX as `EventCreateDialog`.
 */
function buildInitialEditState(event: IEvent): EditFormState {
  const start = new Date(event.startDate);
  const end = new Date(event.endDate);
  return {
    title: event.title,
    description: event.description ?? "",
    color: event.color,
    isAllDay: event.isAllDay,
    startTimed: toDateTimeLocal(start),
    endTimed: toDateTimeLocal(end),
    startAllDay: toDateOnly(start),
    endAllDay: toDateOnly(end),
  };
}

interface EditFormProps {
  event: IEvent;
  onSave: (patch: EventEditPatch) => Promise<void>;
  onCancel: () => void;
}

function EventEditForm({ event, onSave, onCancel }: EditFormProps) {
  const titleId = useId();
  const startId = useId();
  const endId = useId();
  const descriptionId = useId();
  const errorId = useId();

  const [state, setState] = useState<EditFormState>(() =>
    buildInitialEditState(event)
  );
  const [isSaving, setIsSaving] = useState(false);

  const trimmedTitle = state.title.trim();
  const hasTitle = trimmedTitle.length > 0;

  let orderError: string | null = null;
  if (state.isAllDay) {
    if (state.endAllDay < state.startAllDay) {
      orderError = "End must be on or after start";
    }
  } else {
    const start = parseDateTimeLocal(state.startTimed);
    const end = parseDateTimeLocal(state.endTimed);
    if (start && end && end.getTime() <= start.getTime()) {
      orderError = "End must be after start";
    }
  }

  const canSubmit = hasTitle && !orderError && !isSaving;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    let startDate: string;
    let endDate: string;
    if (state.isAllDay) {
      // YYYY-MM-DD strings flow straight through to the route, matching the
      // POST wire format. No `new Date()` round-trip means no UTC-offset
      // skew on positive-offset clients.
      const startParsed = parseDateOnly(state.startAllDay);
      const endParsed = parseDateOnly(state.endAllDay);
      if (!startParsed || !endParsed) return;
      startDate = state.startAllDay;
      endDate = state.endAllDay;
    } else {
      const startParsed = parseDateTimeLocal(state.startTimed);
      const endParsed = parseDateTimeLocal(state.endTimed);
      if (!startParsed || !endParsed) return;
      startDate = startParsed.toISOString();
      endDate = endParsed.toISOString();
    }

    setIsSaving(true);
    try {
      await onSave({
        title: trimmedTitle,
        description: state.description.trim(),
        color: state.color,
        isAllDay: state.isAllDay,
        startDate,
        endDate,
      });
    } catch {
      // Parent surfaces the toast; keep the form open so the user can retry.
      setIsSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4"
      data-testid="event-edit-form"
      noValidate
    >
      <div className="space-y-2">
        <Label htmlFor={titleId}>
          Title <span className="text-red-600">*</span>
        </Label>
        <Input
          id={titleId}
          value={state.title}
          required
          autoFocus
          onChange={(e) =>
            setState((prev) => ({ ...prev, title: e.target.value }))
          }
        />
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id={`${titleId}-all-day`}
          checked={state.isAllDay}
          onCheckedChange={(checked) =>
            setState((prev) => ({ ...prev, isAllDay: checked === true }))
          }
        />
        <Label htmlFor={`${titleId}-all-day`} className="cursor-pointer">
          All day
        </Label>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={startId}>Start</Label>
          {state.isAllDay ? (
            <Input
              id={startId}
              type="date"
              value={state.startAllDay}
              onChange={(e) =>
                setState((prev) => ({ ...prev, startAllDay: e.target.value }))
              }
            />
          ) : (
            <Input
              id={startId}
              type="datetime-local"
              value={state.startTimed}
              onChange={(e) =>
                setState((prev) => ({ ...prev, startTimed: e.target.value }))
              }
            />
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor={endId}>End</Label>
          {state.isAllDay ? (
            <Input
              id={endId}
              type="date"
              value={state.endAllDay}
              aria-invalid={!!orderError}
              aria-describedby={orderError ? errorId : undefined}
              onChange={(e) =>
                setState((prev) => ({ ...prev, endAllDay: e.target.value }))
              }
            />
          ) : (
            <Input
              id={endId}
              type="datetime-local"
              value={state.endTimed}
              aria-invalid={!!orderError}
              aria-describedby={orderError ? errorId : undefined}
              onChange={(e) =>
                setState((prev) => ({ ...prev, endTimed: e.target.value }))
              }
            />
          )}
        </div>
      </div>

      {orderError && (
        <p
          id={errorId}
          role="alert"
          className="text-sm text-red-600"
          data-testid="event-edit-error"
        >
          {orderError}
        </p>
      )}

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Color</legend>
        <div className="flex flex-wrap gap-3">
          {COLOR_OPTIONS.map((option) => {
            const checked = state.color === option.value;
            return (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-2"
              >
                <input
                  type="radio"
                  name="event-edit-color"
                  value={option.value}
                  checked={checked}
                  aria-label={option.label}
                  onChange={() =>
                    setState((prev) => ({ ...prev, color: option.value }))
                  }
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className={`h-6 w-6 rounded-full ${option.swatch} ${
                    checked
                      ? "ring-2 ring-gray-900 ring-offset-2 dark:ring-gray-100"
                      : "ring-1 ring-gray-300 dark:ring-gray-700"
                  }`}
                />
                <span className="text-sm">{option.label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor={descriptionId}>Description</Label>
        <Textarea
          id={descriptionId}
          value={state.description}
          placeholder="Optional notes"
          onChange={(e) =>
            setState((prev) => ({ ...prev, description: e.target.value }))
          }
        />
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSaving}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={!canSubmit}>
          {isSaving ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function EventDetailModal({
  event,
  onClose,
  use24HourFormat,
  returnFocusTo,
  onDelete,
  onEdit,
  accessRole,
}: EventDetailModalProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  if (!event) return null;

  const timeRange = formatTimeRange(event, use24HourFormat);
  const dateLabel = formatDateLabel(event);
  const hasDescription = Boolean(event.description?.trim());
  // Single chokepoint for "this calendar disallows mutation". Both delete
  // and edit (#265) read from this flag so a future read-only check has
  // exactly one place to land.
  const isWritable = !isReadOnlyRole(accessRole);
  const canDelete = Boolean(onDelete) && isWritable;
  const canEdit = Boolean(onEdit) && isWritable;

  const handleConfirmDelete = async () => {
    if (!onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(event);
      // onClose unmounts the modal; no need to reset confirmingDelete first.
      onClose();
    } catch {
      // Caller surfaces the toast; keep the detail modal open so the user
      // sees the event still present and can retry.
      setConfirmingDelete(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveEdit = async (patch: EventEditPatch) => {
    if (!onEdit) {
      // Invariant: `canEdit` gates the Edit button on `onEdit`, so this
      // should be unreachable in practice. If the parent strips `onEdit`
      // mid-edit (e.g. `accessRole` flips to `reader`), throwing makes
      // the form surface the failure instead of silently swallowing the
      // save — without the throw, `EventEditForm`'s try-block resolves
      // cleanly and `isSaving` stays true forever.
      throw new Error(
        "Editing is no longer available — please close and retry."
      );
    }
    await onEdit(event, patch);
    // Success → dismiss the modal so the user sees the updated row in
    // the calendar grid. Errors propagate to the form so it can keep
    // itself open; the parent's hook surfaces the toast.
    setIsEditing(false);
    onClose();
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        onCloseAutoFocus={(e) => {
          const el = returnFocusTo?.current;
          if (el) {
            e.preventDefault();
            el.focus();
          }
        }}
      >
        <DialogHeader>
          <div className="flex items-start gap-3">
            <span
              data-testid="event-detail-color"
              data-color={event.color}
              aria-hidden="true"
              className={`mt-2 h-3 w-3 shrink-0 rounded-full ${COLOR_INDICATOR_CLASSES[event.color]}`}
            />
            <div className="flex-1">
              <DialogTitle>{event.title}</DialogTitle>
              <DialogDescription
                data-testid="event-detail-date"
                className="mt-1"
              >
                {dateLabel}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isEditing ? (
          // `key={event.id}` forces a fresh mount (and re-seeded state)
          // whenever the parent swaps to a different event while the
          // modal is open — without it the form would keep showing the
          // previous event's title/dates after navigation. `useState`'s
          // lazy initialiser only runs once per mount, so re-seeding has
          // to come from React identity rather than an effect.
          <EventEditForm
            key={event.id}
            event={event}
            onSave={handleSaveEdit}
            onCancel={() => setIsEditing(false)}
          />
        ) : (
          <>
            <div className="space-y-4">
              <p
                data-testid="event-detail-time"
                className="text-foreground text-sm font-medium"
              >
                {timeRange}
              </p>

              {hasDescription && (
                <p
                  data-testid="event-detail-description"
                  className="text-muted-foreground text-sm whitespace-pre-wrap"
                >
                  {event.description}
                </p>
              )}

              <div className="flex items-center gap-2">
                <Avatar>
                  {event.user.picturePath && (
                    <AvatarImage
                      src={event.user.picturePath}
                      alt={event.user.name}
                    />
                  )}
                  <AvatarFallback>
                    {getInitials(event.user.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-foreground text-sm">
                  {event.user.name}
                </span>
              </div>
            </div>

            {(canDelete || canEdit) && (
              <DialogFooter>
                {canEdit && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEditing(true)}
                  >
                    <Pencil aria-hidden="true" />
                    Edit event
                  </Button>
                )}
                {canDelete && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setConfirmingDelete(true)}
                    disabled={isDeleting}
                  >
                    <Trash2 aria-hidden="true" />
                    Delete event
                  </Button>
                )}
              </DialogFooter>
            )}
          </>
        )}
      </DialogContent>

      {canDelete && (
        <AlertDialog
          open={confirmingDelete}
          onOpenChange={(open) => {
            if (!isDeleting) setConfirmingDelete(open);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this event?</AlertDialogTitle>
              <AlertDialogDescription>
                Deleting &ldquo;{event.title}&rdquo; removes it from Google
                Calendar. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  // Run the async handler ourselves so we can keep the
                  // alert open while the request is in-flight; otherwise
                  // Radix would close it before we know the result.
                  e.preventDefault();
                  void handleConfirmDelete();
                }}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting…" : "Yes, delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </Dialog>
  );
}
