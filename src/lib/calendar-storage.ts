/**
 * Browser storage utilities for calendar data
 * Handles localStorage for accounts; the IndexedDB event cache lives in
 * `./event-cache` and is re-exported here for callers that import via this
 * module.
 */
import { logger } from "@/lib/logger";
import type { TEventColor } from "@/types/calendar";
import type { GoogleCalendarAccount } from "./google-calendar";

export { eventCache } from "./event-cache";

const STORAGE_KEYS = {
  ACCOUNTS: "calendar_accounts",
  SETTINGS: "calendar_settings",
  LAST_SYNC: "calendar_last_sync",
  COLOR_MAPPINGS: "calendar_color_mappings",
} as const;

export interface CalendarSettings {
  refreshInterval: number; // minutes
  defaultView: "day" | "week" | "month" | "year";
  theme: "light" | "dark" | "auto";
  use24HourFormat: boolean;
}

const DEFAULT_SETTINGS: CalendarSettings = {
  refreshInterval: 15,
  defaultView: "month",
  theme: "auto",
  use24HourFormat: true,
};

/**
 * Calendar color mapping
 * Maps calendar IDs to their Google Calendar colors and Tailwind color equivalents
 */
export interface CalendarColorMapping {
  calendarId: string;
  colorId: string; // Google colorId (if available)
  hexColor: string; // backgroundColor from Google Calendar API
  tailwindColor: TEventColor; // Mapped Tailwind color
}

/**
 * Save calendar color mappings to localStorage
 */
export function saveColorMappings(mappings: CalendarColorMapping[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.COLOR_MAPPINGS, JSON.stringify(mappings));
    logger.log("Saved calendar color mappings", { count: mappings.length });
  } catch (error) {
    logger.error(error as Error, { context: "saveColorMappings" });
    throw error;
  }
}

/**
 * Load calendar color mappings from localStorage
 */
export function loadColorMappings(): CalendarColorMapping[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.COLOR_MAPPINGS);
    if (!data) {
      return [];
    }
    const mappings = JSON.parse(data) as CalendarColorMapping[];
    logger.log("Loaded calendar color mappings", { count: mappings.length });
    return mappings;
  } catch (error) {
    logger.error(error as Error, { context: "loadColorMappings" });
    return [];
  }
}

/**
 * Get color mapping for a specific calendar
 */
export function getColorMapping(
  calendarId: string
): CalendarColorMapping | null {
  const mappings = loadColorMappings();
  return mappings.find((m) => m.calendarId === calendarId) || null;
}

/**
 * Update color mappings (adds new or updates existing)
 */
export function updateColorMappings(newMappings: CalendarColorMapping[]): void {
  const existingMappings = loadColorMappings();
  const mappingsMap = new Map(existingMappings.map((m) => [m.calendarId, m]));

  // Add or update each new mapping
  newMappings.forEach((mapping) => {
    mappingsMap.set(mapping.calendarId, mapping);
  });

  const updatedMappings = Array.from(mappingsMap.values());
  saveColorMappings(updatedMappings);
}

/**
 * Save calendar accounts to localStorage
 */
export function saveAccounts(accounts: GoogleCalendarAccount[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(accounts));
    logger.log("Saved calendar accounts", { count: accounts.length });
  } catch (error) {
    logger.error(error as Error, { context: "saveAccounts" });
    throw error;
  }
}

/**
 * Load calendar accounts from localStorage
 */
export function loadAccounts(): GoogleCalendarAccount[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.ACCOUNTS);
    if (!data) {
      return [];
    }
    const accounts = JSON.parse(data) as GoogleCalendarAccount[];
    logger.log("Loaded calendar accounts", { count: accounts.length });
    return accounts;
  } catch (error) {
    logger.error(error as Error, { context: "loadAccounts" });
    return [];
  }
}

/**
 * Add a new calendar account
 */
export function addAccount(account: GoogleCalendarAccount): void {
  const accounts = loadAccounts();
  const existingIndex = accounts.findIndex((a) => a.id === account.id);

  if (existingIndex >= 0) {
    // Update existing account
    accounts[existingIndex] = account;
  } else {
    // Add new account
    accounts.push(account);
  }

  saveAccounts(accounts);
}

/**
 * Remove a calendar account
 */
export function removeAccount(accountId: string): void {
  const accounts = loadAccounts();
  const filtered = accounts.filter((a) => a.id !== accountId);
  saveAccounts(filtered);
}

/**
 * Get a specific account by ID
 */
export function getAccount(accountId: string): GoogleCalendarAccount | null {
  const accounts = loadAccounts();
  return accounts.find((a) => a.id === accountId) || null;
}

/**
 * Update an existing account (e.g., for token refresh)
 */
export function updateAccount(updatedAccount: GoogleCalendarAccount): void {
  const accounts = loadAccounts();
  const index = accounts.findIndex((a) => a.id === updatedAccount.id);

  if (index >= 0) {
    accounts[index] = updatedAccount;
    saveAccounts(accounts);
    logger.log("Updated account", { accountId: updatedAccount.id });
  } else {
    logger.error(new Error("Account not found for update"), {
      context: "updateAccount",
      accountId: updatedAccount.id,
    });
  }
}

/**
 * Update calendar IDs for a specific account
 */
export function updateAccountCalendars(
  accountId: string,
  calendarIds: string[]
): void {
  const accounts = loadAccounts();
  const account = accounts.find((a) => a.id === accountId);

  if (account) {
    account.calendarIds = calendarIds;
    saveAccounts(accounts);
    logger.log("Updated account calendars", {
      accountId,
      count: calendarIds.length,
    });
  }
}

/**
 * Save calendar settings
 */
export function saveSettings(settings: Partial<CalendarSettings>): void {
  try {
    const currentSettings = loadSettings();
    const newSettings = { ...currentSettings, ...settings };
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(newSettings));
    logger.log("Saved calendar settings");
  } catch (error) {
    logger.error(error as Error, { context: "saveSettings" });
    throw error;
  }
}

/**
 * Load calendar settings
 */
export function loadSettings(): CalendarSettings {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!data) {
      return DEFAULT_SETTINGS;
    }
    return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
  } catch (error) {
    logger.error(error as Error, { context: "loadSettings" });
    return DEFAULT_SETTINGS;
  }
}

/**
 * Save last sync timestamp
 */
export function saveLastSync(timestamp: Date): void {
  try {
    localStorage.setItem(STORAGE_KEYS.LAST_SYNC, timestamp.toISOString());
  } catch (error) {
    logger.error(error as Error, { context: "saveLastSync" });
  }
}

/**
 * Get last sync timestamp
 */
export function getLastSync(): Date | null {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.LAST_SYNC);
    return data ? new Date(data) : null;
  } catch (error) {
    logger.error(error as Error, { context: "getLastSync" });
    return null;
  }
}

/**
 * Clear all calendar data from storage
 */
export function clearAllData(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.ACCOUNTS);
    localStorage.removeItem(STORAGE_KEYS.SETTINGS);
    localStorage.removeItem(STORAGE_KEYS.LAST_SYNC);
    localStorage.removeItem(STORAGE_KEYS.COLOR_MAPPINGS);
    logger.log("Cleared all calendar data");
  } catch (error) {
    logger.error(error as Error, { context: "clearAllData" });
    throw error;
  }
}
