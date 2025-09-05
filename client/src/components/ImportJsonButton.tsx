// components/ImportJsonButton.tsx
// Button component to select a local JSON file and upload it to the server
// Assumes the server accepts a multipart/form-data field named "file"

import axios from 'axios';
import { useRef } from 'react';

interface Props {
  onSuccess: () => void;
  /** Disable the button (e.g., when busy) */
  disabled?: boolean;
  /** Override button class; defaults match original ControlBar style */
  className?: string;
  /** Override label text */
  label?: string;
}

export default function ImportJsonButton({
  onSuccess,
  disabled,
  className = 'rounded-md border border-slate-600 bg-slate-600 px-3 py-2 text-sm text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50',
  label = '📂 Upload JSON',
}: Props) {
  // Ref to access the hidden <input type="file">
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** Trigger hidden file input */
  const handleClick = () => {
    if (disabled) return;
    fileInputRef.current?.click();
  };

  /**
   * File selection change handler
   * - Wraps the selected file in FormData and uploads it
   * - Calls the parent onSuccess callback to refresh the list/UI on success
   */
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      await axios.post('/api/import', formData);
      alert('✅ JSON data uploaded successfully.');
      onSuccess();
      // e.currentTarget.value = '';
    } catch (err) {
      alert('❌ Upload failed: ' + (err as Error).message);
    }
  };

  return (
    <>
      <button onClick={handleClick} disabled={disabled} className={className}>
        {label}
      </button>
      {/* Actual file input: hidden, only triggered by button */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
      />
    </>
  );
}
