import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import { initVK } from './vk';
import { initAnalytics, trackEvent } from './analytics';

void initVK();
initAnalytics();
trackEvent('app_open', { environment: 'client' });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
