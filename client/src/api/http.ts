import axios from "axios";

// 개발 중(5173)일 때만 VITE_API_BASE가 있으면 사용
const baseURL =
  import.meta.env.DEV && import.meta.env.VITE_API_BASE
    ? import.meta.env.VITE_API_BASE
    : "";

export const http = axios.create({ baseURL });