import React from 'react';
import ReactDOM from 'react-dom/client';
import './renderer.css';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';

console.log('Renderer process starting...');

const rootElement = document.getElementById('root');
if (!rootElement) {
  document.body.innerHTML = '<div style="padding: 20px; color: red;">Error: Could not find root element</div>';
} else {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
}