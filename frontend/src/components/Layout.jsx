import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';
import NotificationBell from './NotificationBell';
import ProfileMenu from './ProfileMenu';
import { IconMenu } from './icons';

export default function Layout({ sections, active, onNavChange, pageTitle, children }) {
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="app-shell">
      <Sidebar
        institutionName={user?.institutionName}
        sections={sections}
        active={active}
        onChange={onNavChange}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="content-area">
        <header className="topbar-mini">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="hamburger" onClick={() => setMobileOpen(true)}><IconMenu /></button>
            <h2 style={{ fontSize: 19 }}>{pageTitle}</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <NotificationBell />
            <ProfileMenu />
          </div>
        </header>

        <main className="shell">{children}</main>
      </div>
    </div>
  );
}
