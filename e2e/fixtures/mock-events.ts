import type { IEvent, TEventColor } from "@/types/calendar";

/**
 * Helper to create dates relative to today for consistent test data
 */
function getRelativeDate(
  daysFromToday: number,
  hours = 9,
  minutes = 0
): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

/**
 * Helper to create a mock event
 */
export function createMockEvent(
  overrides: Partial<IEvent> & { id: string }
): IEvent {
  return {
    title: "Test Event",
    startDate: getRelativeDate(0, 10, 0),
    endDate: getRelativeDate(0, 11, 0),
    color: "blue",
    description: "",
    user: {
      id: "user-1",
      name: "Test User",
      picturePath: null,
    },
    ...overrides,
  };
}

/**
 * Sample events for testing month calendar display
 * These events span across multiple days with various colors
 */
export const monthCalendarEvents: IEvent[] = [
  // Today's events
  createMockEvent({
    id: "today-1",
    title: "Morning Standup",
    startDate: getRelativeDate(0, 9, 0),
    endDate: getRelativeDate(0, 9, 30),
    color: "blue",
    description: "Daily team standup meeting",
  }),
  createMockEvent({
    id: "today-2",
    title: "Project Review",
    startDate: getRelativeDate(0, 14, 0),
    endDate: getRelativeDate(0, 15, 0),
    color: "green",
    description: "Sprint review with stakeholders",
  }),
  createMockEvent({
    id: "today-3",
    title: "Team Lunch",
    startDate: getRelativeDate(0, 12, 0),
    endDate: getRelativeDate(0, 13, 0),
    color: "yellow",
  }),
  createMockEvent({
    id: "today-4",
    title: "One-on-One",
    startDate: getRelativeDate(0, 16, 0),
    endDate: getRelativeDate(0, 16, 30),
    color: "purple",
  }),

  // Tomorrow's events
  createMockEvent({
    id: "tomorrow-1",
    title: "Client Call",
    startDate: getRelativeDate(1, 10, 0),
    endDate: getRelativeDate(1, 11, 0),
    color: "red",
    description: "Important client meeting",
  }),
  createMockEvent({
    id: "tomorrow-2",
    title: "Code Review",
    startDate: getRelativeDate(1, 14, 0),
    endDate: getRelativeDate(1, 15, 0),
    color: "blue",
  }),

  // Day after tomorrow
  createMockEvent({
    id: "day2-1",
    title: "Workshop",
    startDate: getRelativeDate(2, 9, 0),
    endDate: getRelativeDate(2, 12, 0),
    color: "orange",
    description: "React performance workshop",
  }),

  // 3 days from now - multiple events to test overflow
  createMockEvent({
    id: "day3-1",
    title: "Planning Meeting",
    startDate: getRelativeDate(3, 9, 0),
    endDate: getRelativeDate(3, 10, 0),
    color: "blue",
  }),
  createMockEvent({
    id: "day3-2",
    title: "Design Review",
    startDate: getRelativeDate(3, 11, 0),
    endDate: getRelativeDate(3, 12, 0),
    color: "purple",
  }),
  createMockEvent({
    id: "day3-3",
    title: "Tech Sync",
    startDate: getRelativeDate(3, 14, 0),
    endDate: getRelativeDate(3, 15, 0),
    color: "green",
  }),
  createMockEvent({
    id: "day3-4",
    title: "Retrospective",
    startDate: getRelativeDate(3, 16, 0),
    endDate: getRelativeDate(3, 17, 0),
    color: "yellow",
  }),
  createMockEvent({
    id: "day3-5",
    title: "Team Social",
    startDate: getRelativeDate(3, 18, 0),
    endDate: getRelativeDate(3, 19, 0),
    color: "orange",
  }),

  // Week ahead events
  createMockEvent({
    id: "day5-1",
    title: "Demo Day",
    startDate: getRelativeDate(5, 14, 0),
    endDate: getRelativeDate(5, 16, 0),
    color: "red",
    description: "Product demo to leadership",
  }),
  createMockEvent({
    id: "day6-1",
    title: "Training Session",
    startDate: getRelativeDate(6, 10, 0),
    endDate: getRelativeDate(6, 12, 0),
    color: "blue",
  }),
];

/**
 * All-day events for testing
 */
export const allDayEvents: IEvent[] = [
  createMockEvent({
    id: "allday-1",
    title: "Team Offsite",
    startDate: getRelativeDate(4, 0, 0),
    endDate: getRelativeDate(5, 0, 0),
    color: "purple",
    description: "Annual team building event",
  }),
  createMockEvent({
    id: "allday-2",
    title: "Holiday",
    startDate: getRelativeDate(10, 0, 0),
    endDate: getRelativeDate(11, 0, 0),
    color: "green",
  }),
];

/**
 * Events for testing empty state
 */
export const emptyEvents: IEvent[] = [];

/**
 * Events for testing color variations
 */
export const colorTestEvents: IEvent[] = (
  ["blue", "green", "red", "yellow", "purple", "orange"] as TEventColor[]
).map((color, index) =>
  createMockEvent({
    id: `color-${color}`,
    title: `${color.charAt(0).toUpperCase() + color.slice(1)} Event`,
    startDate: getRelativeDate(0, 9 + index, 0),
    endDate: getRelativeDate(0, 10 + index, 0),
    color,
  })
);

/**
 * Family calendar mock events - realistic family schedule
 */
export const familyCalendarEvents: IEvent[] = [
  // Parent 1 events
  createMockEvent({
    id: "family-1",
    title: "Work Meeting",
    startDate: getRelativeDate(0, 9, 0),
    endDate: getRelativeDate(0, 10, 0),
    color: "blue",
    user: { id: "parent-1", name: "Mom", picturePath: null },
  }),
  createMockEvent({
    id: "family-2",
    title: "Grocery Shopping",
    startDate: getRelativeDate(1, 17, 0),
    endDate: getRelativeDate(1, 18, 0),
    color: "green",
    user: { id: "parent-1", name: "Mom", picturePath: null },
  }),

  // Parent 2 events
  createMockEvent({
    id: "family-3",
    title: "Client Presentation",
    startDate: getRelativeDate(0, 14, 0),
    endDate: getRelativeDate(0, 16, 0),
    color: "blue",
    user: { id: "parent-2", name: "Dad", picturePath: null },
  }),
  createMockEvent({
    id: "family-4",
    title: "Car Service",
    startDate: getRelativeDate(2, 10, 0),
    endDate: getRelativeDate(2, 12, 0),
    color: "orange",
    user: { id: "parent-2", name: "Dad", picturePath: null },
  }),

  // Kid 1 events
  createMockEvent({
    id: "family-5",
    title: "Soccer Practice",
    startDate: getRelativeDate(0, 16, 0),
    endDate: getRelativeDate(0, 17, 30),
    color: "green",
    user: { id: "kid-1", name: "Emma", picturePath: null },
  }),
  createMockEvent({
    id: "family-6",
    title: "Piano Lesson",
    startDate: getRelativeDate(2, 15, 0),
    endDate: getRelativeDate(2, 16, 0),
    color: "purple",
    user: { id: "kid-1", name: "Emma", picturePath: null },
  }),
  createMockEvent({
    id: "family-7",
    title: "Soccer Game",
    startDate: getRelativeDate(5, 10, 0),
    endDate: getRelativeDate(5, 12, 0),
    color: "green",
    user: { id: "kid-1", name: "Emma", picturePath: null },
  }),

  // Kid 2 events
  createMockEvent({
    id: "family-8",
    title: "Art Class",
    startDate: getRelativeDate(1, 15, 30),
    endDate: getRelativeDate(1, 17, 0),
    color: "yellow",
    user: { id: "kid-2", name: "Jack", picturePath: null },
  }),
  createMockEvent({
    id: "family-9",
    title: "Birthday Party",
    startDate: getRelativeDate(3, 14, 0),
    endDate: getRelativeDate(3, 17, 0),
    color: "red",
    description: "Tommy's birthday at the park",
    user: { id: "kid-2", name: "Jack", picturePath: null },
  }),

  // Shared family events
  createMockEvent({
    id: "family-10",
    title: "Family Dinner",
    startDate: getRelativeDate(0, 18, 0),
    endDate: getRelativeDate(0, 19, 30),
    color: "yellow",
    description: "Grandma's house",
    user: { id: "family", name: "Family", picturePath: null },
  }),
  createMockEvent({
    id: "family-11",
    title: "Movie Night",
    startDate: getRelativeDate(4, 19, 0),
    endDate: getRelativeDate(4, 21, 30),
    color: "purple",
    user: { id: "family", name: "Family", picturePath: null },
  }),
  createMockEvent({
    id: "family-12",
    title: "Weekend Trip",
    startDate: getRelativeDate(6, 8, 0),
    endDate: getRelativeDate(7, 20, 0),
    color: "orange",
    description: "Beach house getaway",
    user: { id: "family", name: "Family", picturePath: null },
  }),
];

/**
 * Combined mock events for comprehensive testing
 */
export const allMockEvents: IEvent[] = [
  ...monthCalendarEvents,
  ...allDayEvents,
];
