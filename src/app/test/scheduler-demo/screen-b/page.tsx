export default function ScreenB() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-emerald-900 text-white">
      <p className="mb-2 text-sm tracking-widest text-emerald-300 uppercase">
        Screen 2 of 3
      </p>
      <h1 className="text-6xl font-bold">Tasks</h1>
      <p className="mt-6 max-w-md text-center text-emerald-200">
        Transitions slide left on auto-rotation and forward navigation, slide
        right on backward navigation. Keyboard: Left/Right arrows, Space to
        pause/resume. Transitions respect prefers-reduced-motion.
      </p>
    </div>
  );
}
