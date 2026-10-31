export default function LoadingSpinner({
  message = "Loading...",
  fullScreen = false,
}) {
  return (
    <div
      className={`flex w-full items-center justify-center ${
        fullScreen ? "min-h-screen" : "min-h-[60vh]"
      }`}
    >
      <div className="flex flex-col items-center justify-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" />

        <p className="text-sm font-semibold text-slate-500">
          {message}
        </p>
      </div>
    </div>
  );
}