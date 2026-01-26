"use client";

import { useCalendar } from "@/components/providers/CalendarProvider";
import { Button } from "@/components/ui/button";
import {
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isSameDay,
  startOfMonth,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function SimpleCalendar() {
  const { selectedDate, setSelectedDate, events, isLoading } = useCalendar();

  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get the day of week for the first day (0 = Sunday, 6 = Saturday)
  const startDayOfWeek = getDay(monthStart);

  // Create padding cells for days before the first day of the month
  const paddingDays = Array.from({ length: startDayOfWeek }, (_, i) => i);

  const previousMonth = () => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() - 1);
    setSelectedDate(newDate);
  };

  const nextMonth = () => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() + 1);
    setSelectedDate(newDate);
  };

  const getEventsForDay = (day: Date) => {
    return events.filter((event) => {
      const eventStart = new Date(event.startDate);
      return isSameDay(eventStart, day);
    });
  };

  const today = new Date();

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">
          {format(selectedDate, "MMMM yyyy")}
        </h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={previousMonth}
            className="border-gray-200 hover:bg-gray-50"
            data-testid="calendar-prev-month"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={nextMonth}
            className="border-gray-200 hover:bg-gray-50"
            data-testid="calendar-next-month"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div className="text-center text-gray-600">Loading events...</div>
      )}

      {/* Calendar Grid */}
      <div className="rounded-lg border border-gray-200 bg-white">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div
              key={day}
              className="p-3 text-center text-sm font-semibold text-gray-700"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7">
          {/* Padding cells for days before the first day of the month */}
          {paddingDays.map((index) => (
            <div
              key={`padding-${index}`}
              className="min-h-[100px] border-r border-b border-gray-200 bg-gray-50"
            />
          ))}

          {/* Actual days of the month */}
          {daysInMonth.map((day) => {
            const dayEvents = getEventsForDay(day);
            const isToday = isSameDay(day, today);

            return (
              <div
                key={day.toISOString()}
                className={`min-h-[100px] border-r border-b border-gray-200 p-2 ${
                  isToday ? "bg-blue-50" : "bg-white"
                }`}
              >
                <div
                  className={`mb-1 text-sm ${
                    isToday
                      ? "inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white"
                      : "text-gray-700"
                  }`}
                >
                  {format(day, "d")}
                </div>

                {/* Events for this day */}
                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map((event) => (
                    <div
                      key={event.id}
                      className={`rounded px-2 py-1 text-xs ${
                        event.color === "blue"
                          ? "bg-blue-100 text-blue-800"
                          : event.color === "green"
                            ? "bg-green-100 text-green-800"
                            : event.color === "red"
                              ? "bg-red-100 text-red-800"
                              : event.color === "yellow"
                                ? "bg-yellow-100 text-yellow-800"
                                : event.color === "purple"
                                  ? "bg-purple-100 text-purple-800"
                                  : "bg-orange-100 text-orange-800"
                      }`}
                    >
                      {event.title}
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-xs text-gray-500">
                      +{dayEvents.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
