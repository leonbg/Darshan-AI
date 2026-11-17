import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { SystemSafePointBoundary } from './components/layout/SystemSafePointBoundary';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <SystemSafePointBoundary>
    <App />
  </SystemSafePointBoundary>
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

