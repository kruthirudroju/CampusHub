import { useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';
import NotificationBell from './NotificationBell';
import { Modal, Field } from './ui';
import { IconLock, IconLogOut, IconMenu } from './icons';

/**
 * Full app shell: sidebar (module navigation) + a slim top bar
 * (page title, notifications, account) + the page content.
 *
 * sections / active / onNavChange drive the sidebar; pageTitle is
 * shown in the top bar so the current section is clear even on mobile
 * where the sidebar is hidden behind a hamburger.
 */
export default function Layout({ sections, active, onNavChange, pageTitle, children }) {
  const { user, logout } = useAuth();
  const [showPw, setShowPw] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const initials = (user?.name || '?').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

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
            <button className="btn btn-ghost btn-sm" onClick={() => setShowPw(true)} title="Change password">
              <IconLock width={15} height={15} />
            </button>
            <button className="btn btn-ghost btn-sm" onClick={logout} title="Sign out">
              <IconLogOut width={15} height={15} />
            </button>
            <span className="avatar" title={user?.name}>{initials}</span>
          </div>
        </header>

        <main className="shell">{children}</main>
      </div>

      {showPw && <ChangePassword onClose={() => setShowPw(false)} />}
    </div>
  );
}

function ChangePassword({ onClose }) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirm) return setMsg({ ok: false, text: 'The two new passwords do not match' });
    setBusy(true); setMsg(null);
    try {
      await api.put('/auth/password', { currentPassword: form.currentPassword, newPassword: form.newPassword });
      setMsg({ ok: true, text: 'Password updated' });
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      setMsg({ ok: false, text: err.response?.data?.message || 'Could not update the password' });
    } finally { setBusy(false); }
  };

  return (
    <Modal title="Change password" onClose={onClose}>
      <form onSubmit={submit}>
        {msg && <div className={`banner ${msg.ok ? 'banner-ok' : 'banner-err'}`}>{msg.text}</div>}
        <Field label="Current password">
          <input type="password" required value={form.currentPassword}
                 onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} />
        </Field>
        <Field label="New password">
          <input type="password" required value={form.newPassword}
                 onChange={(e) => setForm({ ...form, newPassword: e.target.value })} />
          <p className="muted small" style={{ marginTop: 6 }}>At least 8 characters, with a letter and a number.</p>
        </Field>
        <Field label="Confirm new password">
          <input type="password" required value={form.confirm}
                 onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
        </Field>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Update'}</button>
        </div>
      </form>
    </Modal>
  );
}
