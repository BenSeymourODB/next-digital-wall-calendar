"use client";

/**
 * ProfileSwitcher - Dropdown component for switching between profiles
 *
 * Features:
 * - Shows current profile with avatar
 * - Dropdown with all available profiles
 * - Admin badge and PIN lock indicators
 * - PIN verification for protected profiles
 * - Family view option
 * - Link to manage profiles
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PinEntryModal } from "./pin-entry-modal";
import { ProfileAvatar } from "./profile-avatar";
import { Profile, useProfile } from "./profile-context";

export function ProfileSwitcher() {
  const { activeProfile, allProfiles, setActiveProfile, setViewMode } =
    useProfile();
  const [isOpen, setIsOpen] = useState(false);
  const [pinModalProfile, setPinModalProfile] = useState<Profile | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  if (!activeProfile) {
    return null;
  }

  const handleProfileSelect = async (profile: Profile) => {
    // If profile is the same as active, just close dropdown
    if (profile.id === activeProfile?.id) {
      setIsOpen(false);
      return;
    }

    // If profile has PIN, show PIN entry modal
    if (profile.pinEnabled) {
      setPinModalProfile(profile);
      setIsOpen(false);
      return;
    }

    // No PIN required, switch immediately
    await setActiveProfile(profile.id);
    setIsOpen(false);
  };

  // Handle successful PIN entry
  const handlePinSuccess = async () => {
    if (pinModalProfile) {
      await setActiveProfile(pinModalProfile.id);
      setPinModalProfile(null);
    }
  };

  // Handle PIN modal close/cancel
  const handlePinClose = () => {
    setPinModalProfile(null);
  };

  const handleFamilyView = () => {
    setViewMode("family");
    setIsOpen(false);
  };

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        {/* Trigger Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-gray-100"
          aria-expanded={isOpen}
          aria-haspopup="true"
          aria-label={activeProfile.name}
        >
          <ProfileAvatar profile={activeProfile} size="sm" />
          <svg
            className={`h-4 w-4 text-gray-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute right-0 z-50 mt-2 w-64 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
            {/* Profile List */}
            <div className="px-2 py-1">
              <p className="px-2 py-1 text-xs font-medium tracking-wider text-gray-500 uppercase">
                Profiles
              </p>
              {allProfiles.map((profile) => (
                <button
                  key={profile.id}
                  onClick={() => handleProfileSelect(profile)}
                  className={`flex w-full items-center gap-3 rounded-md px-2 py-2 hover:bg-gray-50 ${
                    profile.id === activeProfile.id ? "bg-blue-50" : ""
                  }`}
                >
                  <ProfileAvatar profile={profile} size="sm" />
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-1">
                      <span className="font-medium text-gray-900">
                        {profile.name}
                      </span>
                      {profile.type === "admin" && (
                        <span title="Admin">👑</span>
                      )}
                      {profile.pinEnabled && (
                        <span title="PIN Protected">🔒</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Divider */}
            <div className="my-1 border-t border-gray-200" />

            {/* Family View Option */}
            <button
              onClick={handleFamilyView}
              className="flex w-full items-center gap-3 px-4 py-2 hover:bg-gray-50"
            >
              <span className="text-xl">👨‍👩‍👧‍👦</span>
              <span className="font-medium text-gray-900">Family View</span>
            </button>

            {/* Divider */}
            <div className="my-1 border-t border-gray-200" />

            {/* Manage Profiles Link */}
            <Link
              href="/profiles"
              className="flex w-full items-center gap-3 px-4 py-2 hover:bg-gray-50"
              onClick={() => setIsOpen(false)}
            >
              <svg
                className="h-5 w-5 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span className="font-medium text-gray-900">Manage Profiles</span>
            </Link>
          </div>
        )}
      </div>

      {/* PIN Entry Modal */}
      {pinModalProfile && (
        <PinEntryModal
          open={true}
          profile={pinModalProfile}
          onSuccess={handlePinSuccess}
          onClose={handlePinClose}
        />
      )}
    </>
  );
}
