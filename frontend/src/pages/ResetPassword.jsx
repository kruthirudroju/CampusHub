import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import { Field } from '../components/ui';

export default function ResetPassword() {
  const { slug, token } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({ newPassword: '', confirm: '' });
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.newPassword !== form.confirm) return setError('The two passwords do not match.');
    setBusy(true);
    try {
      await api.post('/auth/reset-password', { institutionSlug: slug, token, newPassword: form.newPassword });
      setDone(true);
      setTimeout(() => navigate(`/login/${slug}`), 2500);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not reset the password.');
    } finally { setBusy(false); }
  };

  return (
    <div style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <h2 style={{ marginBottom: 6 }}>Choose a new password</h2>
        <p className="muted small" style={{ marginBottom: 22 }}>This link is valid for 30 minutes from when it was sent.</p>

        {done ? (
          <div className="banner banner-ok">Password updated. Redirecting you to sign in…</div>
        ) : (
          <form onSubmit={submit}>
            {error && <div className="banner banner-err">{error}</div>}
            <Field label="New password">
              <input type="password" required value={form.newPassword}
                     onChange={(e) => setForm({ ...form, newPassword: e.target.value })} />
              <p className="muted small" style={{ marginTop: 6 }}>At least 8 characters, with a letter and a number.</p>
            </Field>
            <Field label="Confirm new password">
              <input type="password" required value={form.confirm}
                     onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
            </Field>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>
              {busy ? 'Updating…' : 'Update password'}
            </button>
          </form>
        )}

        <p className="small" style={{ textAlign: 'center', marginTop: 20 }}>
          <Link to={`/login/${slug}`}>Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
