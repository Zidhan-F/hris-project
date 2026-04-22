import React from 'react';
import { MENU_ITEMS } from '../utils/helpers';

export default function Sidebar({ sidebarOpen, sidebarClosing, closeSidebar, activeMenu, activeSubMenu, expandedMenu, user, handleMenuClick, handleSubMenuClick }) {
  return (
    <aside className={`sidebar ${sidebarOpen ? 'open' : ''} ${sidebarClosing ? 'sidebar-closing' : ''}`}>
      <div className="sidebar-header">
        <button className="sidebar-close-btn" onClick={closeSidebar}>
          <span className="material-icons-outlined">menu_open</span>
        </button>
        <div className="sidebar-logo"><span className="material-icons-outlined">verified_user</span></div>
        <div className="sidebar-company"><span className="sidebar-company-name">OUR Company</span></div>
      </div>
      <nav className="sidebar-nav">
        {MENU_ITEMS.map((item) => (
          <React.Fragment key={item.id}>
            <button className={`sidebar-menu-item ${activeMenu === item.id && !activeSubMenu ? 'active' : ''} ${expandedMenu === item.id ? 'expanded' : ''}`} onClick={() => handleMenuClick(item.id)}>
              <span className="sidebar-menu-left"><span className="material-icons-outlined">{item.icon}</span>{item.label}</span>
              {item.hasSubmenu && <span className={`material-icons-outlined arrow-icon ${expandedMenu === item.id ? 'rotate' : ''}`}>expand_more</span>}
            </button>
            {item.hasSubmenu && expandedMenu === item.id && item.submenus && (
              <div className="sidebar-submenus">
                {item.submenus
                  .filter(sub => !(sub.id === 'att-report' && user?.role === 'employee'))
                  .map(sub => (
                    <button key={sub.id} className={`sidebar-submenu-item ${activeSubMenu === sub.id ? 'active' : ''}`} onClick={() => handleSubMenuClick(item.id, sub.id)}>{sub.label}</button>
                  ))}
              </div>
            )}
          </React.Fragment>
        ))}
      </nav>
    </aside>
  );
}
