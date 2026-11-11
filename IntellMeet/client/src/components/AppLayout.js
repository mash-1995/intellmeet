import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { FiGrid, FiUsers, FiLogOut, FiVideo } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { initials } from '../utils/format';
import './AppLayout.css';

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const signOut = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark"><FiVideo /></span>
          <span className="brand-name">IntellMeet</span>
        </div>

        <nav className="side-nav" aria-label="Main">
          <NavLink to="/" end className="side-link"><FiGrid /> Meetings</NavLink>
          <NavLink to="/workspaces" className="side-link"><FiUsers /> Workspaces</NavLink>
        </nav>

        <div className="side-user">
          <span className="avatar side-avatar">{initials(user.name)}</span>
          <div className="side-user-text">
            <strong>{user.name}</strong>
            <span>{user.email}</span>
          </div>
          <button className="side-logout" onClick={signOut} aria-label="Sign out" title="Sign out">
            <FiLogOut />
          </button>
        </div>
      </aside>

      <main className="layout-main">
        <Outlet />
      </main>
    </div>
  );
}
