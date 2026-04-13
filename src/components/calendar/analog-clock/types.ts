/**
 * Type definitions for the analog clock with calendar event arcs
 */

/** Parsed result from an event title containing emoji prefixes */
export interface ParsedEventTitle {
  /** Color emoji prefix (e.g., "🔴") if present */
  colorEmoji?: string;
  /** Event-specific emoji (e.g., "🎮") if present */
  eventEmoji?: string;
  /** Title with color/event emoji prefixes removed */
  cleanTitle: string;
  /** Resolved hex color code */
  color: string;
}

/** Arc angle positions in degrees (0 = 12 o'clock, clockwise) */
export interface ArcAngles {
  startAngle: number;
  endAngle: number;
}

/** A calendar event mapped to clock arc data */
export interface ClockEvent {
  id: string;
  title: string;
  cleanTitle: string;
  startAngle: number;
  endAngle: number;
  color: string;
  eventEmoji?: string;
  isAllDay: boolean;
}

/** Props for the main AnalogClock component */
export interface AnalogClockProps {
  /** Clock diameter in pixels (default: 600) */
  size?: number;
  /** Calendar events to display as arcs */
  events?: ClockEvent[];
  /** Whether to show the second hand (default: false for wall calendar) */
  showSeconds?: boolean;
  /** Current time override for testing (default: uses real time) */
  currentTime?: Date;
  /** Arc thickness in pixels (default: 48) */
  arcThickness?: number;
}

/** Props for the ClockFace component */
export interface ClockFaceProps {
  /** Clock radius */
  radius: number;
  /** Center X coordinate */
  cx: number;
  /** Center Y coordinate */
  cy: number;
  /** Current time */
  time: Date;
  /** Whether to show second hand */
  showSeconds: boolean;
}

/** Props for the EventArc component */
export interface EventArcProps {
  /** Event data */
  event: ClockEvent;
  /** Outer radius of the arc */
  outerRadius: number;
  /** Inner radius of the arc */
  innerRadius: number;
  /** Center X coordinate */
  cx: number;
  /** Center Y coordinate */
  cy: number;
  /** Ring index for stacked overlapping events (0 = outermost) */
  ringIndex?: number;
}
