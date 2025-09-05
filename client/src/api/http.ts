import axios from 'axios';

const baseURL =
  import.meta.env.DEV && import.meta.env.VITE_API_BASE ? import.meta.env.VITE_API_BASE : '';

export const http = axios.create({ baseURL });
