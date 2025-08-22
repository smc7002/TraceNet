// /** (레거시 코드)
//  * @fileoverview 네트워크 장비 노드 스타일 생성 함수
//  * @description 장비 타입별 시각적 구분을 위한 스타일 유틸리티
//  */

// /**
//  * 장비 타입과 선택 상태에 따른 노드 스타일을 반환
//  * 
//  * @description
//  * 네트워크 다이어그램에서 PC/스위치/서버를 시각적으로 구분하고
//  * 선택된 노드를 강조하기 위한 스타일을 생성합니다.
//  * 
//  * @param type 장비 타입 ("pc", "switch", "server" 등, 대소문자 무관)
//  * @param isSelected 현재 선택된 노드인지 여부
//  * @returns CSS 스타일 객체
//  * 
//  * @example
//  * ```typescript
//  * const style = getDeviceStyle("switch", true);
//  * // 결과: 보라색 배경 + 두꺼운 선택 테두리 + 원형
//  * ```
//  */
// export function getDeviceStyle(type: string, isSelected: boolean) {
//   // 모든 장비 공통 기본 스타일
//   const base = {
//     padding: 10,
//     textAlign: "center" as const,
//     fontSize: 12,
//     cursor: "pointer",
//   };

//   // 장비 타입별 색상과 모양 구분
//   switch (type.toLowerCase()) {
    
//     // PC: 하늘색 계열, 둥근 모서리
//     case "pc":
//       return {
//         ...base,
//         backgroundColor: "#f0f9ff",  // 연한 하늘색
//         border: isSelected ? "2px solid #0ea5e9" : "1px solid #bae6fd",
//         borderRadius: 8,
//       };
    
//     // 스위치: 보라색 계열, 완전 원형
//     case "switch":
//       return {
//         ...base,
//         backgroundColor: "#eef2ff",  // 연한 보라색
//         border: isSelected ? "2px solid #6366f1" : "1px solid #c7d2fe",
//         borderRadius: 9999, // 완전 원형
//       };
    
//     // 서버: 회색 계열, 각진 모서리 (중요성 강조)
//     case "server":
//       return {
//         ...base,
//         backgroundColor: "#f8fafc",  // 연한 회색
//         border: isSelected ? "2px solid #64748b" : "1px solid #cbd5e1",
//         borderRadius: 4,
//       };
    
//     // 미분류/기타: 노란색 계열 (주의 표시)
//     default:
//       return {
//         ...base,
//         backgroundColor: "#fef3c7",  // 연한 노란색
//         border: isSelected ? "2px solid #f59e0b" : "1px solid #fde68a",
//         borderRadius: 6,
//       };
//   }
// }

// /**
//  * 장비별 시각적 구분 가이드:
//  * 
//  * PC      → 하늘색 + 둥근 사각형 (일반 장비)
//  * Switch  → 보라색 + 원형 (네트워크 허브)
//  * Server  → 회색 + 각진 사각형 (중요 장비)
//  * 기타    → 노란색 + 중간 둥글기 (확인 필요)
//  * 
//  * 선택 시 → 테두리 2배 굵게 + 진한 색상
//  */