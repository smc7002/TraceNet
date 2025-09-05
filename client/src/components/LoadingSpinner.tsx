// import React from 'react';
// LoadingSpinner.tsx
// Component that shows a centered spinning loader during global loading states
// Used to indicate that a page or panel is loading


export default function LoadingSpinner() {
  return (
    <div className="flex h-full w-full items-center justify-center py-12">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
    </div>
  );
}
