export default function ScreenC() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-purple-900 text-white">
      <p className="mb-2 text-sm tracking-widest text-purple-300 uppercase">
        Screen 3 of 3
      </p>
      <h1 className="text-6xl font-bold">Recipes</h1>
      <p className="mt-6 max-w-md text-center text-purple-200">
        After this screen, the sequence wraps back to Screen 1. The floating
        controls auto-hide after 5 seconds of inactivity.
      </p>
    </div>
  );
}
