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
