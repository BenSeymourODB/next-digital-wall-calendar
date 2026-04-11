export default function ScreenA() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-blue-900 text-white">
      <p className="mb-2 text-sm tracking-widest text-blue-300 uppercase">
        Screen 1 of 3
      </p>
      <h1 className="text-6xl font-bold">Calendar</h1>
      <p className="mt-6 max-w-md text-center text-blue-200">
        This page auto-rotates every 10 seconds with smooth slide transitions.
        Move your mouse to pause for 30s. Use the floating controls to navigate
        manually. Arrow keys slide forward/backward with directional animations.
      </p>
    </div>
  );
}
