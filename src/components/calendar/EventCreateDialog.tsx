"use client";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { WritableCalendar } from "@/hooks/use-writable-calendars";
import {
  parseDateOnly,
  parseDateTimeLocal,
  toDateOnly,
  toDateTimeLocal,
} from "@/lib/calendar/date-input";
import type { TEventColor } from "@/types/calendar";
import { useId, useState } from "react";

// Google Calendar reserves the literal id "primary" as an alias for the
// signed-in user's default calendar, so it is the safe target to write to
// when no explicit calendar is available.
const FALLBACK_CALENDAR_ID = "primary";
// Stable empty-list reference for the `calendars` default. A literal `[]`
// in the destructure would mint a new array every render, defeating the
// reference-equality check that drives the mid-dialog reconciliation guard
// below.
const EMPTY_CALENDARS: readonly WritableCalendar[] = [];

export interface EventCreateInput {
  title: string;
  startDate: string;
  endDate: string;
  color: TEventColor;
  description: string;
  isAllDay: boolean;
  /**
   * Google calendar id the event should be written to. Always set on submit
   * — defaults to {@link FALLBACK_CALENDAR_ID} when no calendar list is
   * provided, or to the user's chosen / persisted calendar otherwise.
   */
  calendarId: string;
}

interface EventCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (event: EventCreateInput) => void;
  /**
   * Seed value for start/end. Defaults to now. Only re-read when the dialog
   * transitions from closed → open, so changes while the dialog is already
   * open will not overwrite the user's in-progress edits.
   */
  defaultDate?: Date;
  /**
   * Writable calendars the user can target. The picker renders only when
   * this list has more than one entry; otherwise the dialog silently
   * submits with the single calendar (or `"primary"`) as the target.
   */
  calendars?: WritableCalendar[];
  /**
   * Initial selection for the calendar picker (e.g. last-used from
   * localStorage). Ignored when not present in `calendars`; the dialog
   * falls back to the primary calendar in that case.
   */
  defaultCalendarId?: string;
}

interface DialogState {
  title: string;
  description: string;
  color: TEventColor;
  isAllDay: boolean;
  startTimed: string;
  endTimed: string;
  startAllDay: string;
  endAllDay: string;
  calendarId: string;
}

/**
 * Decide what calendar id the dialog should commit to when it opens.
 *
 * Preference order:
 *   1. `defaultCalendarId` if it's still present in the writable list
 *   2. The primary writable calendar
 *   3. The first writable calendar
 *   4. {@link FALLBACK_CALENDAR_ID} (covers the empty / loading case)
 *
 * Keeping this pure makes it easy to assert on, and lets the picker hide
 * cleanly without divergent fallback logic between the visible and hidden
 * states.
 */
export function resolveInitialCalendarId(
  calendars: WritableCalendar[],
  defaultCalendarId: string | undefined
): string {
  if (calendars.length === 0) {
    return defaultCalendarId ?? FALLBACK_CALENDAR_ID;
  }
  if (defaultCalendarId && calendars.some((c) => c.id === defaultCalendarId)) {
    return defaultCalendarId;
  }
  const primary = calendars.find((c) => c.primary);
  return (primary ?? calendars[0]).id;
}

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

function roundToNextHalfHour(input: Date): Date {
  const d = new Date(input);
  d.setSeconds(0, 0);
  const minutes = d.getMinutes();
  // Round up to next 30-minute boundary, or clamp to :00/:30.
  if (minutes === 0 || minutes === 30) {
    return d;
  }
  if (minutes < 30) {
    d.setMinutes(30);
  } else {
    d.setHours(d.getHours() + 1);
    d.setMinutes(0);
  }
  return d;
}

function buildInitialState(
  defaultDate: Date | undefined,
  initialCalendarId: string
): DialogState {
  const base = roundToNextHalfHour(defaultDate ?? new Date());
  const end = new Date(base);
  end.setHours(end.getHours() + 1);
  return {
    title: "",
    description: "",
    color: "blue",
    isAllDay: false,
    startTimed: toDateTimeLocal(base),
    endTimed: toDateTimeLocal(end),
    startAllDay: toDateOnly(base),
    endAllDay: toDateOnly(base),
    calendarId: initialCalendarId,
  };
}

function resolveDates(state: DialogState): {
  start: Date | null;
  end: Date | null;
} {
  if (state.isAllDay) {
    const start = parseDateOnly(state.startAllDay);
    const endDay = parseDateOnly(state.endAllDay);
    // Normalize: all-day events span start-of-day to end-of-day of the end
    // date (which may differ from the start date for multi-day events).
    if (!start || !endDay) return { start: null, end: null };
    const end = new Date(endDay);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  return {
    start: parseDateTimeLocal(state.startTimed),
    end: parseDateTimeLocal(state.endTimed),
  };
}

export function EventCreateDialog({
  open,
  onOpenChange,
  onCreate,
  defaultDate,
  calendars = EMPTY_CALENDARS as WritableCalendar[],
  defaultCalendarId,
}: EventCreateDialogProps) {
  const titleId = useId();
  const startId = useId();
  const endId = useId();
  const descriptionId = useId();
  const errorId = useId();
  const calendarId = useId();

  const initialCalendarId = resolveInitialCalendarId(
    calendars,
    defaultCalendarId
  );

  const [state, setState] = useState(() =>
    buildInitialState(defaultDate, initialCalendarId)
  );
  const [prevOpen, setPrevOpen] = useState(open);
  const [prevCalendars, setPrevCalendars] = useState(calendars);

  // Reset the form during render whenever the dialog transitions from closed
  // → open. This is the React "storing information from previous renders"
  // pattern, preferred over a setState-in-effect.
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setState(buildInitialState(defaultDate, initialCalendarId));
    }
  }

  // Reconcile state.calendarId when the writable list arrives mid-dialog.
  // Without this guard, a dialog opened during the loading window keeps the
  // initial id (a possibly-stale persisted localStorage value) even after
  // the canonical writable list shows that id is no longer valid — the
  // user could otherwise submit to a calendar they can't write to and hit
  // a 403 from Google. Same prev-render-info pattern as the open-transition
  // above; only re-resolves when the `calendars` reference actually changes.
  if (calendars !== prevCalendars) {
    setPrevCalendars(calendars);
    if (
      calendars.length > 0 &&
      !calendars.some((c) => c.id === state.calendarId)
    ) {
      setState((prev) => ({ ...prev, calendarId: initialCalendarId }));
    }
  }

  const showPicker = calendars.length > 1;

  const trimmedTitle = state.title.trim();
  const hasTitle = trimmedTitle.length > 0;

  const { start, end } = resolveDates(state);

  const orderError =
    start && end && end.getTime() <= start.getTime()
      ? "End must be after start"
      : null;

  const canSubmit = hasTitle && !!start && !!end && !orderError;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !start || !end) return;

    onCreate({
      title: trimmedTitle,
      description: state.description.trim(),
      color: state.color,
      isAllDay: state.isAllDay,
      // For all-day events, send YYYY-MM-DD strings directly from the date
      // input values — avoids UTC-offset skew on positive-offset clients
      // (e.g. NZST UTC+12) where local midnight encodes as the prior UTC day.
      startDate: state.isAllDay ? state.startAllDay : start.toISOString(),
      endDate: state.isAllDay ? state.endAllDay : end.toISOString(),
      calendarId: state.calendarId,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Event</DialogTitle>
          <DialogDescription>
            Add a new event to your calendar.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="space-y-4"
          data-testid="event-create-form"
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
              placeholder="Team meeting"
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
                    setState((prev) => ({
                      ...prev,
                      startAllDay: e.target.value,
                    }))
                  }
                />
              ) : (
                <Input
                  id={startId}
                  type="datetime-local"
                  value={state.startTimed}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      startTimed: e.target.value,
                    }))
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
                    setState((prev) => ({
                      ...prev,
                      endAllDay: e.target.value,
                    }))
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
                    setState((prev) => ({
                      ...prev,
                      endTimed: e.target.value,
                    }))
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
              data-testid="event-create-error"
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
                      name="event-color"
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

          {showPicker && (
            <div className="space-y-2">
              <Label htmlFor={calendarId}>Calendar</Label>
              <Select
                value={state.calendarId}
                onValueChange={(value) =>
                  setState((prev) => ({ ...prev, calendarId: value }))
                }
              >
                <SelectTrigger id={calendarId} className="w-full">
                  <SelectValue placeholder="Select calendar" />
                </SelectTrigger>
                <SelectContent>
                  {calendars.map((cal) => (
                    <SelectItem key={cal.id} value={cal.id}>
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: cal.backgroundColor }}
                        />
                        {cal.summary}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              Create event
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
