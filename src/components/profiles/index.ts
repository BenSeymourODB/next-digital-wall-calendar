/**
 * Profile components barrel exports
 */
export {
  ProfileProvider,
  useProfile,
  useProfileOptional,
} from "./profile-context";

// Domain types live in ./types — re-exported here so consumers can write
// `import { Profile } from "@/components/profiles"` without reaching into
// the internal module layout. Matches the `tasks` / `recipe` / `scheduler`
// pattern.
export type {
  AgeGroup,
  Profile,
  ProfileAvatar,
  ProfileType,
  ViewMode,
} from "./types";

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
