import React from 'react';
import { 
  LayoutDashboard, 
  UploadCloud, 
  FileText, 
  Send, 
  History, 
  Settings, 
  LogOut 
} from 'lucide-react';

function Sidebar({ activeTab, setActiveTab, onLogout }) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'upload', label: 'Upload Buyers', icon: UploadCloud },
    { id: 'templates', label: 'Email Templates', icon: FileText },
    { id: 'campaigns', label: 'Campaigns', icon: Send },
    { id: 'history', label: 'Sent History', icon: History },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="sidebar">
      <div className="logo-container">
        <div className="logo-icon">🌶️</div>
        <div>
          <h2 className="logo-text">Ve Veyron Exports</h2>
          <div className="logo-subtext">Console v1.0</div>
        </div>
      </div>

      <nav style={{ flexGrow: 1 }}>
        <ul className="menu-list">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <button
                  onClick={() => setActiveTab(item.id)}
                  className={`menu-item ${activeTab === item.id ? 'active' : ''}`}
                  style={{
                    background: 'none',
                    border: 'none',
                    width: '100%',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                  }}
                >
                  <Icon />
                  <span>{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="sidebar-footer">
        <button
          onClick={onLogout}
          className="menu-item"
          style={{
            background: 'none',
            border: 'none',
            width: '100%',
            textAlign: 'left',
            fontFamily: 'inherit',
            color: '#ef4444',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.8rem 1rem',
            cursor: 'pointer'
          }}
        >
          <LogOut style={{ color: '#ef4444' }} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
