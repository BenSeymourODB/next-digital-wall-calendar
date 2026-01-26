/**
 * ProfileAvatar - Displays a profile's avatar with optional name
 *
 * Supports three avatar types:
 * - initials: Shows 2-letter initials with background color
 * - emoji: Shows an emoji character
 * - photo: Shows a profile photo
 */
import { ProfileAvatar as ProfileAvatarType } from "./profile-context";

interface ProfileAvatarProps {
  profile: {
    name: string;
    color: string;
    avatar: ProfileAvatarType;
  };
  size?: "sm" | "md" | "lg";
  showName?: boolean;
}

const sizeClasses = {
  sm: "w-8 h-8 text-xs",
  md: "w-12 h-12 text-sm",
  lg: "w-16 h-16 text-base",
};

export function ProfileAvatar({
  profile,
  size = "md",
  showName = false,
}: ProfileAvatarProps) {
  const { name, color, avatar } = profile;
  const backgroundColor = avatar.backgroundColor || color;

  const renderAvatarContent = () => {
    switch (avatar.type) {
      case "photo":
        return (
          <img
            src={avatar.value}
            alt={name}
            className="h-full w-full object-cover"
          />
        );

      case "emoji":
        return (
          <span className="text-xl" role="img" aria-label={name}>
            {avatar.value}
          </span>
        );

      case "initials":
      default:
        return <span className="font-medium text-white">{avatar.value}</span>;
    }
  };

  const avatarDiv = (
    <div
      className={`${sizeClasses[size]} flex items-center justify-center overflow-hidden rounded-full`}
      style={{ backgroundColor }}
    >
      {renderAvatarContent()}
    </div>
  );

  if (showName) {
    return (
      <div className="flex items-center gap-2">
        {avatarDiv}
        <span className="font-medium text-gray-900">{name}</span>
      </div>
    );
  }

  return avatarDiv;
}
