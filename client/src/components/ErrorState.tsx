// ErrorState.tsx
// Component that displays a simple error message and a retry button
// Used for global error states such as network failures or initial loading errors

interface ErrorStateProps {
  /** Error message shown to the user (default: "An error has occurred.") */
  message?: string;
  /** Callback executed when the "Retry" button is clicked (e.g., window.location.reload) */
  onRetry?: () => void;
}

export default function ErrorState({ message = 'An error has occurred.', onRetry }: ErrorStateProps) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center py-12 text-center text-slate-600">
      <div className="mb-2 text-3xl">⚠️</div>
      <div className="mb-4">{message}</div>

      {/* Show the "Retry" button only if onRetry is provided */}
      {onRetry && (
        <button
          onClick={onRetry}
          className="rounded bg-blue-500 px-4 py-2 text-sm text-white transition hover:bg-blue-600"
        >
          Retry
        </button>
      )}
    </div>
  );
}
