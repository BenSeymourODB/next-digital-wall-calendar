/**
 * Zod schemas and a typed validation helper for Google Calendar API responses.
 *
 * These schemas are evaluated at the route-handler boundary
 * (`src/app/api/calendar/**`) so a malformed wire payload from Google (or a
 * proxy/anti-bot rewrite) surfaces as a clean validation error and a 502
 * rather than an opaque crash deep in the mapper layer. See issue #210.
 *
 * Design notes:
 *
 * - All schemas use loose objects (`z.object(...).loose()`) so unknown fields
 *   pass through unchanged. The mappers in `google-calendar-mappers.ts` rely
 *   on `{ ...event }` spread to forward Google-specific fields we don't yet
 *   surface in the UI, so dropping unknown keys here would silently regress
 *   downstream features.
 * - The schemas are intentionally permissive about *which* fields are
 *   present. Google marks most event fields optional in their published
 *   schema and the only field we strictly require to be useful is `id`.
 *   We validate types, not completeness.
 * - The schemas are deliberately decoupled from `gapi.client.calendar.*`
 *   ambient types. Those types describe the *browser SDK* surface; the
 *   schemas describe the *wire shape*. They overlap heavily in practice but
 *   we don't want a runtime guard whose contract is "trust the type
 *   declarations we got from the package we are trying to validate against".
 */
import { z } from "zod";

/**
 * Common `start` / `end` shape on a Google Calendar event. Either `date`
 * (for all-day events) or `dateTime` (for timed events) is set, but the
 * Google schema marks both optional, so the schema does too.
 */
const GoogleEventDateTimeSchema = z
  .object({
    date: z.string().optional(),
    dateTime: z.string().optional(),
    timeZone: z.string().optional(),
  })
  .loose();

const GoogleEventAttendeeSchema = z
  .object({
    email: z.string().optional(),
    displayName: z.string().optional(),
    organizer: z.boolean().optional(),
    self: z.boolean().optional(),
    resource: z.boolean().optional(),
    optional: z.boolean().optional(),
    responseStatus: z.string().optional(),
    comment: z.string().optional(),
    additionalGuests: z.number().optional(),
    id: z.string().optional(),
  })
  .loose();

const GoogleEventOrganizerSchema = z
  .object({
    email: z.string().optional(),
    displayName: z.string().optional(),
    self: z.boolean().optional(),
    id: z.string().optional(),
  })
  .loose();

const GoogleEventReminderOverrideSchema = z
  .object({
    method: z.string().optional(),
    minutes: z.number().optional(),
  })
  .loose();

const GoogleEventRemindersSchema = z
  .object({
    useDefault: z.boolean().optional(),
    overrides: z.array(GoogleEventReminderOverrideSchema).optional(),
  })
  .loose();

/**
 * Schema for a single event item inside an `events.list` response (or the
 * payload of `events.get` / `events.insert` / `events.patch`). Only `id` is
 * required — everything else is optional to match the Google API contract.
 */
export const GoogleEventSchema = z
  .object({
    id: z.string(),
    kind: z.string().optional(),
    etag: z.string().optional(),
    status: z.string().optional(),
    htmlLink: z.string().optional(),
    created: z.string().optional(),
    updated: z.string().optional(),
    summary: z.string().optional(),
    description: z.string().optional(),
    location: z.string().optional(),
    colorId: z.string().optional(),
    iCalUID: z.string().optional(),
    sequence: z.number().optional(),
    start: GoogleEventDateTimeSchema.optional(),
    end: GoogleEventDateTimeSchema.optional(),
    endTimeUnspecified: z.boolean().optional(),
    recurrence: z.array(z.string()).optional(),
    recurringEventId: z.string().optional(),
    originalStartTime: GoogleEventDateTimeSchema.optional(),
    transparency: z.string().optional(),
    visibility: z.string().optional(),
    organizer: GoogleEventOrganizerSchema.optional(),
    creator: GoogleEventOrganizerSchema.optional(),
    attendees: z.array(GoogleEventAttendeeSchema).optional(),
    attendeesOmitted: z.boolean().optional(),
    reminders: GoogleEventRemindersSchema.optional(),
    eventType: z.string().optional(),
    hangoutLink: z.string().optional(),
    anyoneCanAddSelf: z.boolean().optional(),
    guestsCanInviteOthers: z.boolean().optional(),
    guestsCanModify: z.boolean().optional(),
    guestsCanSeeOtherGuests: z.boolean().optional(),
    privateCopy: z.boolean().optional(),
    locked: z.boolean().optional(),
  })
  .loose();

export type GoogleEventPayload = z.infer<typeof GoogleEventSchema>;

const GoogleEventsListReminderSchema = z
  .object({
    method: z.string().optional(),
    minutes: z.number().optional(),
  })
  .loose();

/**
 * Schema for the full `events.list` response envelope.
 *
 * The `items` field is `optional` (rather than `default([])`) because Google
 * legitimately omits the key when the list is empty and the existing route
 * tests assert that `{ items: undefined }` round-trips to a 200. Routes
 * apply their own `?? []` fallback after parsing.
 */
export const GoogleEventsListResponseSchema = z
  .object({
    kind: z.string().optional(),
    etag: z.string().optional(),
    summary: z.string().optional(),
    description: z.string().optional(),
    updated: z.string().optional(),
    timeZone: z.string().optional(),
    accessRole: z.string().optional(),
    defaultReminders: z.array(GoogleEventsListReminderSchema).optional(),
    nextPageToken: z.string().optional(),
    nextSyncToken: z.string().optional(),
    items: z.array(GoogleEventSchema).optional(),
  })
  .loose();

export type GoogleEventsListResponse = z.infer<
  typeof GoogleEventsListResponseSchema
>;

/**
 * Schema for a single entry inside a `calendarList.list` response.
 *
 * Only `id` is strictly required. `summary` is *very* commonly present in
 * practice but the published Google schema marks it optional, so the
 * schema follows suit; the mapper in `google-calendar-mappers.ts` already
 * applies a `?? ""` fallback on the consuming side.
 */
export const GoogleCalendarListEntrySchema = z
  .object({
    id: z.string(),
    kind: z.string().optional(),
    etag: z.string().optional(),
    summary: z.string().optional(),
    description: z.string().optional(),
    location: z.string().optional(),
    timeZone: z.string().optional(),
    summaryOverride: z.string().optional(),
    colorId: z.string().optional(),
    backgroundColor: z.string().optional(),
    foregroundColor: z.string().optional(),
    hidden: z.boolean().optional(),
    selected: z.boolean().optional(),
    accessRole: z.string().optional(),
    primary: z.boolean().optional(),
    deleted: z.boolean().optional(),
    notificationSettings: z.unknown().optional(),
    defaultReminders: z.array(GoogleEventsListReminderSchema).optional(),
    conferenceProperties: z.unknown().optional(),
  })
  .loose();

export type GoogleCalendarListEntry = z.infer<
  typeof GoogleCalendarListEntrySchema
>;

export const GoogleCalendarListResponseSchema = z
  .object({
    kind: z.string().optional(),
    etag: z.string().optional(),
    nextPageToken: z.string().optional(),
    nextSyncToken: z.string().optional(),
    items: z.array(GoogleCalendarListEntrySchema).optional(),
  })
  .loose();

export type GoogleCalendarListResponse = z.infer<
  typeof GoogleCalendarListResponseSchema
>;

/**
 * Schema for the canonical Google API error envelope. Used to safely pluck
 * `error.message` from a non-2xx response body without trusting an
 * arbitrary cast. The schema accepts an empty `{}` body so existing
 * `.catch(() => ({}))` fallbacks remain valid input.
 */
const GoogleApiErrorDetailSchema = z
  .object({
    domain: z.string().optional(),
    reason: z.string().optional(),
    message: z.string().optional(),
    location: z.string().optional(),
    locationType: z.string().optional(),
  })
  .loose();

export const GoogleApiErrorBodySchema = z
  .object({
    error: z
      .object({
        code: z.number().optional(),
        message: z.string().optional(),
        status: z.string().optional(),
        errors: z.array(GoogleApiErrorDetailSchema).optional(),
      })
      .loose()
      .optional(),
  })
  .loose();

export type GoogleApiErrorBody = z.infer<typeof GoogleApiErrorBodySchema>;

/**
 * Context for a {@link GoogleApiValidationError} so route logging has enough
 * information to triage which Google endpoint produced the malformed
 * payload.
 */
export interface GoogleApiValidationContext {
  /** Symbolic name of the Google endpoint, e.g. `"events.list"`. */
  endpoint: string;
  /** Optional calendar id when the call was scoped to one calendar. */
  calendarId?: string;
}

/**
 * Thrown by {@link parseGoogleResponse} when a Google Calendar payload
 * fails Zod validation. Routes should catch this, log a structured error
 * via `logger.error`, and respond with a 502.
 */
export class GoogleApiValidationError extends Error {
  readonly endpoint: string;
  readonly calendarId?: string;
  readonly issues: z.core.$ZodIssue[];

  constructor(context: GoogleApiValidationContext, issues: z.core.$ZodIssue[]) {
    const summary = issues
      .slice(0, 3)
      .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
      .join("; ");
    super(
      `Google Calendar API response failed validation (${context.endpoint}): ${summary}`
    );
    this.name = "GoogleApiValidationError";
    this.endpoint = context.endpoint;
    this.calendarId = context.calendarId;
    this.issues = issues;
  }
}

/**
 * Validate a Google Calendar API payload with the supplied Zod schema.
 *
 * On success returns the parsed value (typed by the schema). On failure
 * throws a {@link GoogleApiValidationError} carrying the endpoint context
 * and the Zod issue list, so routes can log and translate to a 502
 * uniformly.
 */
export function parseGoogleResponse<T extends z.ZodType>(
  data: unknown,
  schema: T,
  context: GoogleApiValidationContext
): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new GoogleApiValidationError(context, result.error.issues);
  }
  return result.data;
}
