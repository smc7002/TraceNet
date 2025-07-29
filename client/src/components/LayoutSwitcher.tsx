// 📁 src/components/LayoutSwitcher.tsx
import { LayoutMode } from "../utils/layout";

interface Props {
  layoutMode: LayoutMode;
  onChange: (mode: LayoutMode) => void;
}

export default function LayoutSwitcher({ layoutMode, onChange }: Props) {
  return (
    <div className="flex gap-2 mb-4">
      <button
        onClick={() => onChange(LayoutMode.Dagre)}
        className={`px-3 py-1 rounded text-sm font-medium border ${
          layoutMode === LayoutMode.Dagre
            ? "bg-blue-600 text-white"
            : "bg-white text-gray-800"
        }`}
      >
        계층 보기
      </button>
      <button
        onClick={() => {
          console.log("Switch to RADIAL layout");
          onChange(LayoutMode.Radial);
        }}
        className={`px-3 py-1 rounded text-sm font-medium border ${
          layoutMode === LayoutMode.Radial
            ? "bg-blue-600 text-white"
            : "bg-white text-gray-800"
        }`}
      >
        Radial 보기
      </button>
    </div>
  );
}
