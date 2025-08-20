// 📁 src/components/LayoutSwitcher.tsx
/**
 * 상태: 현재 미사용(2025-08-20 기준). 향후 “레이아웃 전환” UI 필요 시 재활성화 예정.
 * 보관 이유: 빠른 실험/복구 용도. 삭제해도 빌드/실행에는 영향 없음.
 *
 * 사용 방법:
 *  - MainPage.tsx 등 상위에서 상태를 갖고 있을 때:
 *      <LayoutSwitcher
 *        layoutMode={state.layoutMode}
 *        onChange={(m) => updateState("layoutMode", m)}
 *      />
 *  - utils/layout의 getNewRadialLayoutedElements / getDagreLayoutedElements와 함께 사용.
 *
 * 주의:
 *  - 콘솔 로그(console.log) 한 줄 포함되어 있음(필요 시 제거).
 *  - 버튼 스타일은 최소 구성. 디자인 시스템(shadcn/ui 등)으로 교체 가능.
 *
 * 제거 기준:
 *  - 레이아웃 모드 스위칭을 제품에서 완전히 제외한다면 안전하게 삭제 가능.
 */

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
