export default function ScreenA() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-blue-900 text-white">
      <p className="mb-2 text-sm tracking-widest text-blue-300 uppercase">
        Screen 1 of 3
      </p>
      <h1 className="text-6xl font-bold">Calendar</h1>
      <p className="mt-6 max-w-md text-center text-blue-200">
        This page auto-rotates every 10 seconds. Move your mouse to pause for
        30s. Use the floating controls at the bottom to navigate manually. The
        status indicator in the bottom-left shows countdown progress.
      </p>
    </div>
  );
}
