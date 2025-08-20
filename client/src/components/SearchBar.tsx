
/**
 * SearchBar.tsx - 네트워크 장비 검색 입력 컴포넌트
 * 
 * 목적:
 * - 사용자가 특정 네트워크 장비를 빠르게 찾을 수 있도록 검색 인터페이스 제공
 * - 장비명 또는 IP 주소 기반 실시간 검색 지원
 * - 직관적이고 접근 가능한 사용자 경험 제공
 * 
 * // 상태 관리와 함께 사용 (향후 확장)
 * <SearchBar 
 *   value={searchQuery}
 *   onChange={setSearchQuery}
 *   onSearch={handleSearch}
 * />
 * ```
 */


export default function SearchBar() {
  return (
    <div className="px-4 py-3 border-b border-gray-200 bg-white">
      <div className="flex items-center gap-2">
        <span className="text-gray-500 text-lg">🔍</span>
        <input
          type="text"
          placeholder="Device 이름 또는 IP 입력"
          className="w-72 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          aria-label="장비 검색"
        />
      </div>
    </div>
  );
}
