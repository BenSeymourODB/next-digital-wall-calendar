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
 * Day and Week are dropdown triggers (Day ▾ / Week ▾) that surface
 * "Grid" and "Agenda" as the two display modes — matches the
 * Windows 11 / Microsoft Teams Calendar widget UX (issue #150).
 * Month, Year, and Clock are plain toggle buttons.
 *
 * The dropdown commits both `setView(view)` and `setAgendaMode(mode)`
 * in a single user action so jumping from e.g. Month → Day+Agenda
 * lands in the right place without an intermediate grid flash.
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
      <ModeDropdown
        view="day"
        label="Day"
        icon={<CalendarDays className="h-4 w-4" />}
        active={view === "day"}
        agendaMode={agendaMode}
        onSelect={(mode) => selectMode("day", mode)}
      />
      <ModeDropdown
        view="week"
        label="Week"
        icon={<CalendarRange className="h-4 w-4" />}
        active={view === "week"}
        agendaMode={agendaMode}
        onSelect={(mode) => selectMode("week", mode)}
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

interface ModeDropdownProps {
  view: "day" | "week";
  label: string;
  icon: React.ReactNode;
  active: boolean;
  agendaMode: boolean;
  onSelect: (mode: "grid" | "agenda") => void;
}

function ModeDropdown({
  view,
  label,
  icon,
  active,
  agendaMode,
  onSelect,
}: ModeDropdownProps) {
  // Reflect the current sub-mode in the trigger label only when this
  // dropdown's view is active; otherwise the bare label is fine.
  const subModeLabel = active && agendaMode ? `${label} · Agenda` : label;
  const currentValue = active && agendaMode ? "agenda" : "grid";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant={active ? "default" : "ghost"}
          size="sm"
          aria-pressed={active}
          aria-haspopup="menu"
          data-testid={`view-switcher-${view}`}
          className="flex items-center gap-2"
        >
          {icon}
          <span>{subModeLabel}</span>
          <ChevronDown className="h-3 w-3 opacity-70" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuRadioGroup
          value={currentValue}
          onValueChange={(value) => onSelect(value as "grid" | "agenda")}
        >
          <DropdownMenuRadioItem value="grid">Grid</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="agenda">Agenda</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
