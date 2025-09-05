/**
 * SearchBar.tsx - Network Device Search Input Component
 *
 * Purpose:
 * - Provides search interface for users to quickly find specific network devices
 * - Supports real-time search based on device name or IP address
 * - Delivers intuitive and accessible user experience
 *
 * // Usage with state management (for future expansion)
 * <SearchBar
 *   value={searchQuery}
 *   onChange={setSearchQuery}
 *   onSearch={handleSearch}
 * />
 * ```
 */

export default function SearchBar() {
  return (
    <div className="border-b border-gray-200 bg-white px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="text-lg text-gray-500">🔍</span>
        <input
          type="text"
          placeholder="Type device name or IP..."
          className="w-72 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Search Device"
        />
      </div>
    </div>
  );
}
