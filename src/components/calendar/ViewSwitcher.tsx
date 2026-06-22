"use client";

import { useCalendar } from "@/components/providers/CalendarProvider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TCalendarView } from "@/types/calendar";
import { useState } from "react";
import {
  Calendar,
  CalendarDays,
  CalendarRange,
  ChevronDown,
  Clock,
  LayoutGrid,
} from "lucide-react";

/**
 * Top-level calendar view switcher.
 *
 * Day and Week are split buttons:
 *
 *   ┌─────────────┬───┐
 *   │ ☐ Day · …   │ ▾ │
 *   └─────────────┴───┘
 *      primary    caret
 *
 * The primary button switches to that view (preserving the user's global
 * `agendaMode`). The caret opens a small Grid/Agenda RadioGroup that commits
 * `setView(view)` AND `setAgendaMode(mode === "agenda")` in a single action,
 * so jumping from e.g. Month → Week+Agenda lands in the right place without
 * an intermediate grid flash.
 *
 * The DropdownMenu is rendered with `modal={false}` so Radix does not install
 * the body-level overlay that was leaking pointer events to sibling buttons
 * after dismissal (see issue #235).
 *
 * Month, Year, and Clock are plain primary buttons.
 */
export function ViewSwitcher() {
  const { view, setView, agendaMode, setAgendaMode } = useCalendar();

  const selectMode = (target: "day" | "week", mode: "grid" | "agenda") => {
    setView(target);
    setAgendaMode(mode === "agenda");
  };

  return (
    <div
      className="bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-md p-1"
      role="group"
      aria-label="Calendar view"
      data-testid="view-switcher"
    >
      <SplitViewControl
        view="day"
        label="Day"
        icon={<CalendarDays className="h-4 w-4" />}
        active={view === "day"}
        agendaMode={agendaMode}
        onSwitchView={() => setView("day")}
        onSelectMode={(mode) => selectMode("day", mode)}
      />
      <SplitViewControl
        view="week"
        label="Week"
        icon={<CalendarRange className="h-4 w-4" />}
        active={view === "week"}
        agendaMode={agendaMode}
        onSwitchView={() => setView("week")}
        onSelectMode={(mode) => selectMode("week", mode)}
      />
      <PrimaryButton
        view="month"
        label="Month"
        icon={<Calendar className="h-4 w-4" />}
        active={view === "month"}
        onClick={() => setView("month")}
      />
      <PrimaryButton
        view="year"
        label="Year"
        icon={<LayoutGrid className="h-4 w-4" />}
        active={view === "year"}
        onClick={() => setView("year")}
      />
      <PrimaryButton
        view="clock"
        label="Clock"
        icon={<Clock className="h-4 w-4" />}
        active={view === "clock"}
        onClick={() => setView("clock")}
      />
    </div>
  );
}

interface PrimaryButtonProps {
  view: TCalendarView;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}

function PrimaryButton({
  view,
  label,
  icon,
  active,
  onClick,
}: PrimaryButtonProps) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "ghost"}
      size="sm"
      aria-pressed={active}
      onClick={onClick}
      data-testid={`view-switcher-${view}`}
      className="flex items-center gap-2"
    >
      {icon}
      <span>{label}</span>
    </Button>
  );
}

interface SplitViewControlProps {
  view: "day" | "week";
  label: string;
  icon: React.ReactNode;
  active: boolean;
  agendaMode: boolean;
  onSwitchView: () => void;
  onSelectMode: (mode: "grid" | "agenda") => void;
}

function SplitViewControl({
  view,
  label,
  icon,
  active,
  agendaMode,
  onSwitchView,
  onSelectMode,
}: SplitViewControlProps) {
  // Reflect the current sub-mode in the primary label only when this
  // control's view is active; otherwise the bare label is fine.
  const subModeLabel = active && agendaMode ? `${label} · Agenda` : label;
  const currentValue = active && agendaMode ? "agenda" : "grid";
  const variant = active ? "default" : "ghost";

  // Control the menu's open state so it closes after a sub-mode is picked.
  // With the uncontrolled default + `modal={false}`, the menu lingered open
  // after a selection, so reopening the same caret toggled it shut instead of
  // re-opening it.
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      role="group"
      aria-label={`${label} view`}
      className="inline-flex items-stretch"
    >
      <Button
        type="button"
        variant={variant}
        size="sm"
        aria-pressed={active}
        onClick={onSwitchView}
        data-testid={`view-switcher-${view}`}
        className="flex items-center gap-2 rounded-r-none pr-2"
      >
        {icon}
        <span>{subModeLabel}</span>
      </Button>
      {/* `modal={false}` prevents Radix from installing the body-level
          overlay that previously left sibling buttons unclickable after
          dismissal (issue #235). */}
      <DropdownMenu modal={false} open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant={variant}
            size="sm"
            aria-label={`Choose ${label.toLowerCase()} display mode`}
            data-testid={`view-switcher-${view}-mode`}
            className="border-border rounded-l-none border-l px-1.5"
          >
            <ChevronDown className="h-3 w-3 opacity-70" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuRadioGroup
            value={currentValue}
            onValueChange={(value) => {
              onSelectMode(value as "grid" | "agenda");
              setMenuOpen(false);
            }}
          >
            <DropdownMenuRadioItem value="grid">Grid</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="agenda">Agenda</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
