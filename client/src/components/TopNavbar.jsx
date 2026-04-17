import React from 'react';
import { getInitials } from '../utils/helpers';

export default function TopNavbar({ sidebarOpen, openSidebar, user, handleLogout }) {
  return (
    <header className="top-navbar">
      <div className="navbar-left">
        {!sidebarOpen && (
          <button className="nav-icon-btn" onClick={openSidebar}>
            <span className="material-icons-outlined">menu</span>
          </button>
        )}
      </div>
      <div className="navbar-right">
        <button className="nav-icon-btn">
          <span className="material-icons-outlined">search</span>
        </button>
        <button className="nav-icon-btn">
          <span className="material-icons-outlined">notifications_none</span>
        </button>
        {user.picture ? (
          <img className="nav-avatar" src={user.picture} alt="" onClick={handleLogout} referrerPolicy="no-referrer" />
        ) : (
          <div className="nav-avatar-placeholder" onClick={handleLogout}>{getInitials(user.name)}</div>
        )}
      </div>
    </header>
  );
}
