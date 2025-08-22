//rackApi.ts

import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5285/api";

export interface Rack {
  rackId: number;
  name: string;
}

export async function fetchRacks(): Promise<Rack[]> {
  const res = await axios.get(`${API_BASE}/rack`);
  return Array.isArray(res.data) ? res.data : [];
}
