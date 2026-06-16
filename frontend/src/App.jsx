import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar.jsx';
import Dashboard from './components/Dashboard.jsx';
import UploadBuyers from './components/UploadBuyers.jsx';
import Templates from './components/Templates.jsx';
import Campaigns from './components/Campaigns.jsx';
import History from './components/History.jsx';
import Settings from './components/Settings.jsx';
import Login from './components/Login.jsx';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLoading, setIsLoading] = useState(true);

  // Parse user session on start
  useEffect(() => {
    if (token) {
      setIsLoading(true);
      fetch((import.meta.env.VITE_API_URL || '') + '/api/auth/verify', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then((res) => {
          if (res.ok) return res.json();
          throw new Error('Session expired');
        })
        .then((data) => {
          setUser(data.user);
          setIsLoading(false);
        })
        .catch(() => {
          handleLogout();
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
  }, [token]);

  const handleLogin = (userToken, userData) => {
    localStorage.setItem('token', userToken);
    setToken(userToken);
    setUser(userData);
    setActiveTab('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken('');
    setUser(null);
    setActiveTab('dashboard');
  };

  // Secure wrapper for API requests
  const apiFetch = async (url, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch((import.meta.env.VITE_API_URL || '') + url, {
      ...options,
      headers
    });

    if (response.status === 401 || response.status === 403) {
      handleLogout();
      throw new Error('Authentication expired. Please log in again.');
    }

    return response;
  };

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#0a0d14',
        color: '#10b981',
        fontSize: '1.25rem',
        fontWeight: '600',
        fontFamily: 'Outfit, sans-serif',
        gap: '0.5rem'
      }}>
        <span className="spinner" style={{
          width: '24px',
          height: '24px',
          border: '3px solid #10b981',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></span>
        Loading Ve Veyron Exports Console...
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!token) {
    return <Login onLogin={handleLogin} />;
  }

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard apiFetch={apiFetch} setActiveTab={setActiveTab} />;
      case 'upload':
        return <UploadBuyers apiFetch={apiFetch} setActiveTab={setActiveTab} />;
      case 'templates':
        return <Templates apiFetch={apiFetch} />;
      case 'campaigns':
        return <Campaigns apiFetch={apiFetch} />;
      case 'history':
        return <History apiFetch={apiFetch} />;
      case 'settings':
        return <Settings apiFetch={apiFetch} />;
      default:
        return <Dashboard apiFetch={apiFetch} setActiveTab={setActiveTab} />;
    }
  };

  return (
    <div className="app-container">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} onLogout={handleLogout} />
      <main className="main-content">
        {renderActiveView()}
      </main>
    </div>
  );
}

export default App;
