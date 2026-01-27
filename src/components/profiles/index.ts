/**
 * Profile components barrel exports
 */
export { ProfileProvider, useProfile } from "./profile-context";
export type { Profile, ProfileAvatar, ViewMode } from "./profile-context";
export { ProfileAvatar as ProfileAvatarComponent } from "./profile-avatar";
export { ProfileSwitcher } from "./profile-switcher";
export { ProfileCard, ProfileCardSkeleton } from "./profile-card";
export { ProfileGrid, ProfileGridSkeleton } from "./profile-grid";

// PIN components
export { PinEntryModal } from "./pin-entry-modal";
export type {
  PinEntryModalProps,
  PinEntryModalProfile,
} from "./pin-entry-modal";
export { PinSetupModal } from "./pin-setup-modal";
export type {
  PinSetupModalProps,
  PinSetupModalProfile,
} from "./pin-setup-modal";
export { PinSettings } from "./pin-settings";
export type { PinSettingsProps, PinSettingsProfile } from "./pin-settings";
export { NumericKeypad } from "./numeric-keypad";
export type { NumericKeypadProps } from "./numeric-keypad";
export { PinDisplay } from "./pin-display";
export type { PinDisplayProps } from "./pin-display";

// Reward points components
export { GivePointsModal } from "./give-points-modal";
export type { GivePointsModalProps } from "./give-points-modal";

// Profile creation components
export { ColorPicker, PROFILE_COLORS } from "./color-picker";
export type { ColorPickerProps } from "./color-picker";
export { ProfileForm } from "./profile-form";
export type { ProfileFormProps } from "./profile-form";
