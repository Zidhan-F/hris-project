import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { GoogleOAuthProvider } from '@react-oauth/google';

// Client ID dari environment variable (atau fallback untuk development)
const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "512607156379-ci8nrql6q958grjma8o1o3d3fkoknfsn.apps.googleusercontent.com";

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={clientId}>
      <App />
    </GoogleOAuthProvider>
  </React.StrictMode>,
)