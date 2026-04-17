import React from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { getInitials } from '../utils/helpers';

export default function LoginPage({ loading, statusMsg, handleLoginSuccess, handleLoginError }) {
  return (
    <div className="login-page">
      <div className="login-brand-bar">
        <div className="login-brand-icon"><span className="material-icons-outlined">verified_user</span></div>
        <div className="login-brand-text"><span className="login-brand-name">EMS</span><span className="login-brand-sub">Employee</span></div>
      </div>
      <div className="login-card-area">
        <div className="login-card">
          <div className="login-card-logo">
            <div className="login-card-logo-icon"><span className="material-icons-outlined">verified_user</span></div>
            <div className="login-card-brand"><span className="login-card-brand-name">EMS</span><span className="login-card-brand-sub">Employee</span></div>
          </div>
          <div className="login-welcome"><h2>Welcome back!</h2><p>Please sign-in with Google Account</p></div>
          <div className="login-auth-area">
            {loading ? <div className="loading-spinner"></div> :
              <GoogleLogin onSuccess={handleLoginSuccess} onError={handleLoginError} shape="pill" size="large" width="320" theme="outline" />}
          </div>
          {statusMsg && <div className={`status-message status-${statusMsg.type}`}>{statusMsg.text}</div>}
        </div>
      </div>
    </div>
  );
}
