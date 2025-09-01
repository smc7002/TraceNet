import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import "./setupHttpGuards";
import 'react-flow-renderer/dist/style.css';
import 'react-flow-renderer/dist/theme-default.css';

import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
