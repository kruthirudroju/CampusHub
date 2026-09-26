import { useState, useRef, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Modal, Field } from './ui';
import { IconLock, IconLogOut } from './icons';

const ROLE_LABEL = { student: 'Student', faculty: 'Faculty', admin: 'Administrator' };

export default function ProfileMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const ref = useRef(null);

  const initials = (user?.name || '?').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)} className="avatar" style={{ border: 'none', cursor: 'pointer' }} title={user?.name}>
        {initials}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 250,
          background: 'var(--paper-raised)', border: '1px solid var(--line)', borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow)', zIndex: 80, overflow: 'hidden'
        }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{user?.name}</div>
            <div className="muted small" style={{ marginTop: 2 }}>{user?.email}</div>
            <div className="muted small" style={{ marginTop: 4 }}>
              {[user?.department, ROLE_LABEL[user?.role]].filter(Boolean).join(' · ')}
            </div>
          </div>

          <MenuItem icon={<IconLock width={15} height={15} />} label="Change password"
                    onClick={() => { setOpen(false); setShowPw(true); }} />
          <MenuItem icon={<IconLock width={15} height={15} />} label="Email me a reset link"
                    onClick={() => { setOpen(false); setShowReset(true); }} />
          <div style={{ borderTop: '1px solid var(--line)' }}>
            <MenuItem icon={<IconLogOut width={15} height={15} />} label="Sign out" danger onClick={logout} />
          </div>
        </div>
      )}

      {showPw && <ChangePasswordModal onClose={() => setShowPw(false)} />}
      {showReset && <EmailResetModal user={user} onClose={() => setShowReset(false)} />}
    </div>
  );
}

function MenuItem({ icon, label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
        background: 'none', border: 'none', textAlign: 'left', fontSize: 13.5,
        color: danger ? '#D0342C' : 'var(--ink)'
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--paper-sunken)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
    >
      {icon}{label}
    </button>
  );
}

function ChangePasswordModal({ onClose }) {
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
          <input type="password" required value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} />
        </Field>
        <Field label="New password">
          <input type="password" required value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} />
          <p className="muted small" style={{ marginTop: 6 }}>At least 8 characters, with a letter and a number.</p>
        </Field>
        <Field label="Confirm new password">
          <input type="password" required value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
        </Field>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Update'}</button>
        </div>
      </form>
    </Modal>
  );
}

function EmailResetModal({ user, onClose }) {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const send = async () => {
    setBusy(true); setError('');
    try {
      await api.post('/auth/forgot-password', { institutionSlug: user.institutionSlug, email: user.email });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send the email right now.');
    } finally { setBusy(false); }
  };

  return (
    <Modal title="Email me a reset link" onClose={onClose}>
      {!sent ? (
        <>
          <p className="small" style={{ marginBottom: 18 }}>
            We'll send a password reset link to <strong>{user.email}</strong>. The link expires in 30 minutes.
          </p>
          {error && <div className="banner banner-err">{error}</div>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={send} disabled={busy}>{busy ? 'Sending…' : 'Send email'}</button>
          </div>
        </>
      ) : (
        <>
          <div className="banner banner-ok">If that email is registered, a reset link is on its way.</div>
          <p className="muted small">Check your inbox (and spam folder) for a message from CampusHub.</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
            <button className="btn btn-secondary" onClick={onClose}>Close</button>
          </div>
        </>
      )}
    </Modal>
  );
}
