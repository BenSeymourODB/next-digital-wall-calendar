"use client";

import { NavigationControls } from "@/components/scheduler/navigation-controls";
import { useState } from "react";

/**
 * Test page for scheduler UI — renders NavigationControls with mock state
 * so it can be validated without a running scheduler or real routes.
 *
 * Usage: /test/scheduler
 */

const SCREEN_LABELS = ["Calendar", "Tasks", "Meal Plan", "Shopping List"];

export default function TestSchedulerPage() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const totalScreens = SCREEN_LABELS.length;

  const handlePrevious = () => {
    setCurrentIndex((i) => (i - 1 + totalScreens) % totalScreens);
  };

  const handleNext = () => {
    setCurrentIndex((i) => (i + 1) % totalScreens);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-900 text-white">
      <div className="mb-6 rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800">
        Test page — rendering NavigationControls with mock state (no scheduler
        required)
      </div>

      <div className="mb-12 text-center">
        <p className="mb-2 text-sm text-gray-400">Current Screen</p>
        <h1 className="text-5xl font-bold" data-testid="current-screen">
          {SCREEN_LABELS[currentIndex]}
        </h1>
        <p className="mt-4 text-gray-400">
          {isPaused ? "Paused" : "Playing"} &middot; Screen {currentIndex + 1}{" "}
          of {totalScreens}
        </p>
      </div>

      <NavigationControls
        currentIndex={currentIndex}
        totalScreens={totalScreens}
        isPaused={isPaused}
        isVisible={true}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onTogglePause={() => setIsPaused((p) => !p)}
      />
    </div>
  );
}
