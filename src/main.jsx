import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { AuthProvider } from './auth/AuthProvider';
import './styles/global.css';

const pendingRedirect = sessionStorage.getItem('spa:redirect');
if (pendingRedirect) {
  sessionStorage.removeItem('spa:redirect');
  history.replaceState(null, '', pendingRedirect);
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
