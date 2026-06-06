"use client";

import { useCalendar } from "@/components/providers/CalendarProvider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { IUser, TEventColor } from "@/types/calendar";
import { Check, Filter, X } from "lucide-react";

const ALL_COLORS: TEventColor[] = [
  "blue",
  "green",
  "red",
  "yellow",
  "purple",
  "orange",
];

const COLOR_SWATCH_CLASS: Record<TEventColor, string> = {
  blue: "bg-blue-500",
  green: "bg-green-500",
  red: "bg-red-500",
  yellow: "bg-yellow-500",
  purple: "bg-purple-500",
  orange: "bg-orange-500",
};

function initials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

interface UserAvatarProps {
  user: IUser;
  className?: string;
}

function UserAvatar({ user, className }: UserAvatarProps) {
  return (
    <Avatar className={className}>
      {user.picturePath ? (
        <AvatarImage src={user.picturePath} alt={user.name} />
      ) : null}
      <AvatarFallback className="text-xs font-medium">
        {initials(user.name)}
      </AvatarFallback>
    </Avatar>
  );
}

export function CalendarFilterPanel() {
  const {
    selectedColors,
    filterEventsBySelectedColors,
    users,
    selectedUserId,
    setSelectedUserId,
    clearFilter,
  } = useCalendar();

  const colorCount = selectedColors.length;
  const hasActiveFilters = colorCount > 0 || selectedUserId !== "all";

  const selectedUser =
    selectedUserId === "all"
      ? null
      : (users.find((u) => u.id === selectedUserId) ?? null);

  return (
    <div
      className="flex items-center gap-2"
      data-testid="calendar-filter-panel"
    >
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="relative gap-2"
            aria-label="Filter events by color"
            data-testid="filter-panel-color-trigger"
          >
            <Filter className="h-4 w-4" aria-hidden="true" />
            <span>Colors</span>
            {colorCount > 0 ? (
              <Badge
                variant="secondary"
                className="ml-1 h-5 min-w-5 px-1.5 text-xs"
                data-testid="filter-panel-color-count"
              >
                {colorCount}
              </Badge>
            ) : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-56 p-2"
          data-testid="filter-panel-color-popover"
        >
          <p className="text-muted-foreground px-2 pt-1 pb-2 text-xs font-medium uppercase">
            Filter by color
          </p>
          <ul className="flex flex-col">
            {ALL_COLORS.map((color) => {
              const checked = selectedColors.includes(color);
              return (
                <li key={color}>
                  <button
                    type="button"
                    onClick={() => filterEventsBySelectedColors(color)}
                    className="hover:bg-accent flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left"
                    data-testid={`filter-panel-color-option-${color}`}
                    aria-pressed={checked}
                  >
                    <span
                      aria-hidden="true"
                      data-state={checked ? "checked" : "unchecked"}
                      data-testid={`filter-panel-color-checkbox-${color}`}
                      className="border-input data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary flex size-4 shrink-0 items-center justify-center rounded-[4px] border shadow-xs"
                    >
                      {checked ? <Check className="size-3.5" /> : null}
                    </span>
                    <span
                      className={`h-3 w-3 rounded-full ${COLOR_SWATCH_CLASS[color]}`}
                      aria-hidden="true"
                    />
                    <span className="text-sm capitalize">{color}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            aria-label="Filter events by user"
            data-testid="filter-panel-user-trigger"
          >
            {selectedUser ? (
              <span aria-hidden="true">
                <UserAvatar user={selectedUser} className="size-6" />
              </span>
            ) : users.length > 0 ? (
              <div className="flex -space-x-2" aria-hidden="true">
                {users.slice(0, 3).map((u) => (
                  <UserAvatar
                    key={u.id}
                    user={u}
                    className="border-background size-6 border-2"
                  />
                ))}
              </div>
            ) : null}
            <span>{selectedUser ? selectedUser.name : "All"}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-64 p-2"
          data-testid="filter-panel-user-popover"
        >
          <p className="text-muted-foreground px-2 pt-1 pb-2 text-xs font-medium uppercase">
            Filter by user
          </p>
          <ul className="flex flex-col">
            <li>
              <button
                type="button"
                onClick={() => setSelectedUserId("all")}
                className="hover:bg-accent data-[selected=true]:bg-accent flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left"
                data-testid="filter-panel-user-option-all"
                data-selected={selectedUserId === "all"}
                aria-pressed={selectedUserId === "all"}
              >
                <Avatar className="size-6" aria-hidden="true">
                  <AvatarFallback className="text-xs font-medium">
                    All
                  </AvatarFallback>
                </Avatar>
                <span className="flex-1 text-sm">All</span>
                {selectedUserId === "all" ? (
                  <Check
                    className="text-primary size-4 shrink-0"
                    data-testid="filter-panel-user-option-all-check"
                  />
                ) : null}
              </button>
            </li>
            {users.length === 0 ? (
              <li
                className="text-muted-foreground px-2 py-2 text-xs"
                data-testid="filter-panel-user-empty"
              >
                No users available yet. They&apos;ll appear here once events
                load.
              </li>
            ) : (
              users.map((u) => {
                const isSelected = selectedUserId === u.id;
                return (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedUserId(u.id)}
                      className="hover:bg-accent data-[selected=true]:bg-accent flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left"
                      data-testid={`filter-panel-user-option-${u.id}`}
                      data-selected={isSelected}
                      aria-pressed={isSelected}
                    >
                      <span aria-hidden="true">
                        <UserAvatar user={u} className="size-6" />
                      </span>
                      <span className="flex-1 text-sm">{u.name}</span>
                      {isSelected ? (
                        <Check
                          className="text-primary size-4 shrink-0"
                          data-testid={`filter-panel-user-option-${u.id}-check`}
                        />
                      ) : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </PopoverContent>
      </Popover>

      {hasActiveFilters ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={clearFilter}
          className="gap-1 text-xs"
          data-testid="filter-panel-clear"
        >
          <X className="h-3 w-3" aria-hidden="true" />
          Clear filters
        </Button>
      ) : null}
    </div>
  );
}
