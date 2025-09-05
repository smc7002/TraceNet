// src/components/LayoutSwitcher.tsx
/**
 * Status: Currently unused (as of 2025-08-13). Will be re-enabled later if a “layout switch” UI is needed.
 * Reason for keeping: for quick experiments/rollback. Safe to delete; build/run are unaffected.
 *
 * Usage:
 *  - When the parent (e.g., MainPage.tsx) owns the state:
 *      <LayoutSwitcher
 *        layoutMode={state.layoutMode}
 *        onChange={(m) => updateState("layoutMode", m)}
 *      />
 *  - Use together with utils/layout: getNewRadialLayoutedElements / getDagreLayoutedElements.
 *
 * Notes:
 *  - Includes a single console.log (remove if unnecessary).
 *  - Button styles are minimal; feel free to replace with a design system (e.g., shadcn/ui).
 *
 * Removal criteria:
 *  - If layout mode switching is completely excluded from the product, this file can be safely deleted.
 */


import { LayoutMode } from '../utils/layout';

interface Props {
  layoutMode: LayoutMode;
  onChange: (mode: LayoutMode) => void;
}

export default function LayoutSwitcher({ layoutMode, onChange }: Props) {
  return (
    <div className="mb-4 flex gap-2">
      <button
        onClick={() => onChange(LayoutMode.Dagre)}
        className={`rounded border px-3 py-1 text-sm font-medium ${
          layoutMode === LayoutMode.Dagre ? 'bg-blue-600 text-white' : 'bg-white text-gray-800'
        }`}
      >
        계층 보기
      </button>
      <button
        onClick={() => {
          console.log('Switch to RADIAL layout');
          onChange(LayoutMode.Radial);
        }}
        className={`rounded border px-3 py-1 text-sm font-medium ${
          layoutMode === LayoutMode.Radial ? 'bg-blue-600 text-white' : 'bg-white text-gray-800'
        }`}
      >
        Radial 보기
      </button>
    </div>
  );
}
