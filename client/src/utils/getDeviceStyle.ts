// 📁 src/utils/getDeviceStyle.ts

export function getDeviceStyle(type: string, isSelected: boolean) {
  const base = {
    padding: 10,
    textAlign: "center" as const,
    fontSize: 12,
    cursor: "pointer",
  };

  switch (type.toLowerCase()) {
    case "pc":
      return {
        ...base,
        backgroundColor: "#f0f9ff",
        border: isSelected ? "2px solid #0ea5e9" : "1px solid #bae6fd",
        borderRadius: 8,
      };
    case "switch":
      return {
        ...base,
        backgroundColor: "#eef2ff",
        border: isSelected ? "2px solid #6366f1" : "1px solid #c7d2fe",
        borderRadius: 9999, // 둥글게
      };
    case "server":
      return {
        ...base,
        backgroundColor: "#f8fafc",
        border: isSelected ? "2px solid #64748b" : "1px solid #cbd5e1",
        borderRadius: 4,
      };
    default:
      return {
        ...base,
        backgroundColor: "#fef3c7",
        border: isSelected ? "2px solid #f59e0b" : "1px solid #fde68a",
        borderRadius: 6,
      };
  }
}
