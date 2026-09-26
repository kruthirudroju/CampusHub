import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { Chip, Empty, Loading, Modal, Field, formatDate } from '../components/ui';
import { IconHome, IconUsers, IconMessage, IconWrench, IconCalendar, IconClub, IconBus, IconFlag, IconChat } from '../components/icons';

const SECTIONS = [
  { items: [{ key: 'home', label: 'Home', icon: IconHome }] },
  { label: 'Campus', items: [
    { key: 'faculty', label: 'Faculty', icon: IconUsers },
    { key: 'messages', label: 'My queries', icon: IconMessage },
    { key: 'maintenance', label: 'Maintenance', icon: IconWrench },
    { key: 'events', label: 'Events', icon: IconCalendar },
  ]},
  { label: 'Community', items: [
    { key: 'clubs', label: 'Clubs', icon: IconClub },
    { key: 'buses', label: 'Transport', icon: IconBus },
    { key: 'lostfound', label: 'Lost & found', icon: IconFlag },
  ]},
  { label: 'You', items: [
    { key: 'feedback', label: 'Feedback', icon: IconChat },
  ]}
];

const TITLES = {
  home: 'Home', faculty: 'Faculty availability', messages: 'My queries', maintenance: 'Maintenance',
  events: 'Campus events', clubs: 'Clubs', buses: 'Transport', lostfound: 'Lost & found', feedback: 'Feedback'
};

export default function StudentDashboard() {
  const [tab, setTab] = useState('home');
  return (
    <Layout sections={SECTIONS} active={tab} onNavChange={setTab} pageTitle={TITLES[tab]}>
      {tab === 'home' && <HomeTab onNavigate={setTab} />}
      {tab === 'faculty' && <FacultyTab />}
      {tab === 'messages' && <MessagesTab />}
      {tab === 'maintenance' && <MaintenanceTab />}
      {tab === 'events' && <EventsTab />}
      {tab === 'clubs' && <ClubsTab />}
      {tab === 'buses' && <BusesTab />}
      {tab === 'lostfound' && <LostFoundTab />}
      {tab === 'feedback' && <FeedbackTab />}
    </Layout>
  );
}

function HomeTab({ onNavigate }) {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get('/messages/sent'),
      api.get('/maintenance/mine'),
      api.get('/events', { params: { scope: 'upcoming' } }),
      api.get('/clubs')
    ]).then(([messages, maintenance, events, clubs]) => {
      setStats({
        pendingQueries: messages.data.filter((m) => m.status !== 'Answered').length,
        openRequests: maintenance.data.filter((r) => r.status !== 'Completed' && r.status !== 'Rejected').length,
        registeredEvents: events.data.filter((e) => e.is_registered).length,
        joinedClubs: clubs.data.filter((c) => c.is_member).length
      });
    }).catch(() => setStats({ pendingQueries: 0, openRequests: 0, registeredEvents: 0, joinedClubs: 0 }));
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div>
      <h2 style={{ marginBottom: 4 }}>{greeting}, {user?.name?.split(' ')[0]}</h2>
      <p className="muted" style={{ marginBottom: 26 }}>Here's what's happening across campus.</p>

      {!stats ? <Loading what="Loading your summary" /> : (
        <div className="stat-grid" style={{ marginBottom: 30 }}>
          <button className="stat" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => onNavigate('messages')}>
            <div className="n">{stats.pendingQueries}</div>
            <div className="l">Queries awaiting reply</div>
          </button>
          <button className="stat" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => onNavigate('maintenance')}>
            <div className="n">{stats.openRequests}</div>
            <div className="l">Open maintenance reports</div>
          </button>
          <button className="stat" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => onNavigate('events')}>
            <div className="n">{stats.registeredEvents}</div>
            <div className="l">Events you're registered for</div>
          </button>
          <button className="stat" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => onNavigate('clubs')}>
            <div className="n">{stats.joinedClubs}</div>
            <div className="l">Clubs you've joined</div>
          </button>
        </div>
      )}

      <div className="card">
        <h4 style={{ marginBottom: 14 }}>Quick actions</h4>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('faculty')}>Ask a faculty member</button>
          <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('maintenance')}>Report an issue</button>
          <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('buses')}>Check bus routes</button>
          <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('lostfound')}>Lost & found</button>
        </div>
      </div>
    </div>
  );
}

function FacultyTab() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [target, setTarget] = useState(null);
  const [draft, setDraft] = useState({ subject: '', content: '' });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.get('/faculty', { params: search ? { search } : {} })
      .then((r) => setList(r.data)).finally(() => setLoading(false));
  }, [search]);

  useEffect(() => { const t = setTimeout(load, search ? 300 : 0); return () => clearTimeout(t); }, [load, search]);

  const send = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      await api.post('/messages', { facultyId: target.faculty_id, ...draft });
      setNotice(`Your query has been sent to ${target.name}.`);
      setTarget(null); setDraft({ subject: '', content: '' });
    } catch (err) {
      setNotice(err.response?.data?.message || 'Could not send the message.');
    } finally { setBusy(false); }
  };

  return (
    <div>
      {notice && <div className="banner banner-info">{notice}</div>}
      <input placeholder="Search by name or department" value={search}
             onChange={(e) => setSearch(e.target.value)} style={{ marginBottom: 18, maxWidth: 380 }} />

      {loading ? <Loading what="Loading faculty" /> : list.length === 0 ? <Empty>No faculty found.</Empty> : (
        list.map((f) => (
          <div key={f.faculty_id} className="row">
            <div className="row-head">
              <div>
                <strong>{f.name}</strong>
                <div className="row-meta">{f.department}{f.note ? ` · ${f.note}` : ''}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Chip label={f.status} />
                <button className="btn btn-secondary btn-sm" onClick={() => setTarget(f)}>Ask a question</button>
              </div>
            </div>
          </div>
        ))
      )}

      {target && (
        <Modal title={`Message ${target.name}`} subtitle={target.department} onClose={() => setTarget(null)}>
          <form onSubmit={send}>
            <Field label="Subject (optional)">
              <input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
            </Field>
            <Field label="Your question">
              <textarea required rows={4} value={draft.content}
                        onChange={(e) => setDraft({ ...draft, content: e.target.value })} />
            </Field>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setTarget(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Sending…' : 'Send'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
function MessagesTab() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.get('/messages/sent').then((r) => setList(r.data)).finally(() => setLoading(false)); }, []);

  if (loading) return <Loading what="Loading your queries" />;
  if (!list.length) return <Empty>You haven't asked anything yet.</Empty>;

  return list.map((m) => (
    <div key={m.id} className="row">
      <div className="row-head">
        <strong>{m.subject || 'Untitled query'}</strong>
        <Chip label={m.status} />
      </div>
      <div className="row-meta">To {m.faculty_name} · {m.department}</div>
      <p style={{ margin: '8px 0 0', fontSize: 14 }}>{m.content}</p>
      {m.reply && (
        <div style={{ marginTop: 12, paddingLeft: 14, borderLeft: '2px solid var(--accent)' }}>
          <div className="muted" style={{ fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.04em' }}>Reply</div>
          <p style={{ margin: '3px 0 0', fontSize: 14 }}>{m.reply}</p>
        </div>
      )}
    </div>
  ));
}

/* ------------------------------------------------------------------ */
const CATEGORIES = ['Electrical', 'Furniture', 'Internet', 'Cleaning', 'Water', 'Other'];

function MaintenanceTab() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ category: 'Electrical', location: '', room_number: '', description: '', priority: 'Medium' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = () => { setLoading(true); api.get('/maintenance/mine').then((r) => setList(r.data)).finally(() => setLoading(false)); };
  useEffect(load, []);

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      await api.post('/maintenance', form);
      setOpen(false);
      setForm({ category: 'Electrical', location: '', room_number: '', description: '', priority: 'Medium' });
      load();
    } catch (err) { setError(err.response?.data?.message || 'Could not submit.'); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <p className="muted small" style={{ margin: 0 }}>Report a problem and follow it through to completion.</p>
        <button className="btn btn-primary" onClick={() => setOpen(true)}>Report an issue</button>
      </div>

      {loading ? <Loading what="Loading your reports" /> : !list.length ? <Empty>You haven't reported anything yet.</Empty> : (
        list.map((r) => (
          <div key={r.id} className="row">
            <div className="row-head">
              <div>
                <strong>{r.category} · {r.location}{r.room_number ? ` (${r.room_number})` : ''}</strong>
                <div className="row-meta">Reported {formatDate(r.created_at)} · {r.priority} priority</div>
              </div>
              <Chip label={r.status} />
            </div>
            <p style={{ margin: '8px 0 0', fontSize: 14 }}>{r.description}</p>
            {r.admin_note && <p className="muted small" style={{ marginTop: 6 }}>Note from admin: {r.admin_note}</p>}
          </div>
        ))
      )}

      {open && (
        <Modal title="Report a maintenance issue" onClose={() => setOpen(false)}>
          <form onSubmit={submit}>
            {error && <div className="banner banner-err">{error}</div>}
            <Field label="Category">
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Location">
              <input required placeholder="e.g. IT Block, 2nd floor" value={form.location}
                     onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </Field>
            <Field label="Room number (optional)">
              <input placeholder="e.g. IT-204" value={form.room_number}
                     onChange={(e) => setForm({ ...form, room_number: e.target.value })} />
            </Field>
            <Field label="What's wrong?">
              <textarea required rows={3} value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <Field label="Priority">
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                {['Low', 'Medium', 'High'].map((p) => <option key={p}>{p}</option>)}
              </select>
            </Field>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Submitting…' : 'Submit'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
function EventsTab() {
  const [scope, setScope] = useState('upcoming');
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/events', { params: { scope } }).then((r) => setList(r.data)).finally(() => setLoading(false));
  }, [scope]);
  useEffect(load, [load]);

  const toggle = async (ev) => {
    if (ev.is_registered) await api.delete(`/events/${ev.id}/register`);
    else await api.post(`/events/${ev.id}/register`);
    load();
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {['upcoming', 'past'].map((s) => (
          <button key={s} className={`btn btn-sm ${scope === s ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setScope(s)}>
            {s === 'upcoming' ? 'Upcoming' : 'Past'}
          </button>
        ))}
      </div>

      {loading ? <Loading what="Loading events" /> : !list.length ? <Empty>No {scope} events.</Empty> : (
        list.map((e) => (
          <div key={e.id} className="row">
            <div className="row-head">
              <div>
                <strong>{e.title}</strong>
                <div className="row-meta">
                  {formatDate(e.event_date)}
                  {e.start_time ? ` · ${e.start_time.slice(0, 5)}` : ''}
                  {e.venue ? ` · ${e.venue}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Chip label={e.category} tone="chip-neutral" />
                {scope === 'upcoming' && e.registration_open === 1 && (
                  <button className={`btn btn-sm ${e.is_registered ? 'btn-secondary' : 'btn-primary'}`}
                          onClick={() => toggle(e)}>
                    {e.is_registered ? 'Registered ✓' : 'Register'}
                  </button>
                )}
              </div>
            </div>
            {e.description && <p style={{ margin: '8px 0 0', fontSize: 14 }}>{e.description}</p>}
            <p className="muted small" style={{ marginTop: 6 }}>
              {e.organizer ? `By ${e.organizer} · ` : ''}{e.registration_count} registered
            </p>
          </div>
        ))
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
function ClubsTab() {
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);

  const load = () => { api.get('/clubs').then((r) => setClubs(r.data)).finally(() => setLoading(false)); };
  useEffect(load, []);

  const open = (c) => { setSelected(c); setDetail(null); api.get(`/clubs/${c.id}`).then((r) => setDetail(r.data)); };

  const toggleMembership = async () => {
    if (detail.is_member) await api.delete(`/clubs/${selected.id}/join`);
    else await api.post(`/clubs/${selected.id}/join`);
    const r = await api.get(`/clubs/${selected.id}`);
    setDetail(r.data); load();
  };

  if (loading) return <Loading what="Loading clubs" />;

  if (selected) {
    return (
      <div>
        <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)} style={{ marginBottom: 18 }}>
          ← All clubs
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ fontSize: 22 }}>{selected.club_name}</h3>
            <p className="muted small" style={{ marginTop: 3 }}>
              {selected.club_type}
              {detail?.coordinator_name ? ` · Coordinated by ${detail.coordinator_name}` : ''}
              {detail ? ` · ${detail.member_count} member${detail.member_count === 1 ? '' : 's'}` : ''}
            </p>
          </div>
          {detail && (
            <button className={`btn btn-sm ${detail.is_member ? 'btn-secondary' : 'btn-primary'}`} onClick={toggleMembership}>
              {detail.is_member ? 'Leave club' : 'Join club'}
            </button>
          )}
        </div>

        {detail?.description && <p style={{ marginTop: 14, fontSize: 14.5 }}>{detail.description}</p>}

        <h4 style={{ margin: '28px 0 8px' }}>Updates</h4>
        {!detail ? <Loading what="Loading posts" /> : !detail.posts.length ? <Empty>Nothing posted yet.</Empty> : (
          detail.posts.map((p) => (
            <div key={p.id} className="row">
              <div className="row-head">
                <strong>{p.title}</strong>
                <Chip label={p.type} tone={p.type === 'Contest' ? 'chip-stop' : p.type === 'Event' ? 'chip-warn' : 'chip-ok'} />
              </div>
              <div className="row-meta">
                {p.event_date ? formatDate(p.event_date) : formatDate(p.created_at)}
                {p.venue ? ` · ${p.venue}` : ''} · posted by {p.posted_by_name}
              </div>
              {p.description && <p style={{ margin: '8px 0 0', fontSize: 14 }}>{p.description}</p>}
            </div>
          ))
        )}
      </div>
    );
  }

  const group = (type) => clubs.filter((c) => c.club_type === type);
  const Grid = ({ items }) => (
    <div className="grid-cards" style={{ marginBottom: 30 }}>
      {items.map((c) => (
        <button key={c.id} className="card" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => open(c)}>
          <div style={{ fontWeight: 600 }}>{c.club_name}</div>
          <div className="muted small" style={{ marginTop: 4 }}>
            {c.coordinator_name || 'Coordinator to be assigned'}
          </div>
          <div className="muted small" style={{ marginTop: 8 }}>
            {c.member_count} member{c.member_count === 1 ? '' : 's'} · {c.post_count} post{c.post_count === 1 ? '' : 's'}
            {c.is_member ? ' · joined' : ''}
          </div>
        </button>
      ))}
    </div>
  );

  return (
    <div>
      <h4 style={{ marginBottom: 12 }}>Technical clubs</h4>
      <Grid items={group('Technical')} />
      <h4 style={{ marginBottom: 12 }}>Cultural clubs</h4>
      <Grid items={group('Cultural')} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
function BusesTab() {
  const [buses, setBuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      api.get('/buses', { params: search ? { search } : {} })
        .then((r) => setBuses(r.data)).finally(() => setLoading(false));
    }, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <div>
      <input placeholder="Search by bus number, route or stop name" value={search}
             onChange={(e) => setSearch(e.target.value)} style={{ marginBottom: 18, maxWidth: 420 }} />

      {loading ? <Loading what="Loading routes" /> : !buses.length ? <Empty>No routes match that search.</Empty> : (
        buses.map((bus) => {
          const isOpen = openId === bus.id;
          return (
            <div key={bus.id} className="row">
              <div className="row-head" style={{ cursor: 'pointer' }} onClick={() => setOpenId(isOpen ? null : bus.id)}>
                <div>
                  <strong>Bus {bus.bus_number}</strong>
                  {bus.route_name && <span className="muted" style={{ marginLeft: 10, fontSize: 14 }}>{bus.route_name}</span>}
                  <div className="row-meta">{bus.stops.length} stops</div>
                </div>
                <span className="muted small">{isOpen ? 'Hide' : 'View'} details</span>
              </div>

              {isOpen && (
                <div style={{ marginTop: 14 }}>
                  {bus.gps_link ? (
                    <a href={bus.gps_link} target="_blank" rel="noopener noreferrer"
                       className="btn btn-primary btn-sm" style={{ marginBottom: 14 }}>
                      Track live location
                    </a>
                  ) : (
                    <p className="muted small" style={{ marginBottom: 14 }}>Live tracking isn't available for this bus yet.</p>
                  )}

                  {(bus.driver_name || bus.incharge1_name) && (
                    <div className="muted small" style={{ marginBottom: 14, lineHeight: 1.8 }}>
                      {bus.driver_name && <div>Driver: {bus.driver_name}{bus.driver_phone ? ` · ${bus.driver_phone}` : ''}</div>}
                      {bus.incharge1_name && <div>In charge: {bus.incharge1_name}{bus.incharge1_phone ? ` · ${bus.incharge1_phone}` : ''}</div>}
                      {bus.incharge2_name && <div>In charge: {bus.incharge2_name}{bus.incharge2_phone ? ` · ${bus.incharge2_phone}` : ''}</div>}
                    </div>
                  )}

                  <div className="table-scroll">
                    <table className="plain">
                      <tbody>
                        {bus.stops.map((s) => (
                          <tr key={s.id}>
                            <td className="muted" style={{ width: 80 }}>{s.stop_time || '—'}</td>
                            <td>{s.stop_name}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
function LostFoundTab() {
  const [kind, setKind] = useState('');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ kind: 'Lost', item_name: '', category: '', location: '', occurred_on: '', description: '', contact_info: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params = {};
    if (kind) params.kind = kind;
    if (search) params.search = search;
    api.get('/lostfound', { params }).then((r) => setItems(r.data)).finally(() => setLoading(false));
  }, [kind, search]);

  useEffect(() => { const t = setTimeout(load, search ? 300 : 0); return () => clearTimeout(t); }, [load, search]);

  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      await api.post('/lostfound', form);
      setOpen(false);
      setForm({ kind: 'Lost', item_name: '', category: '', location: '', occurred_on: '', description: '', contact_info: '' });
      load();
    } finally { setBusy(false); }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 18 }}>
        {[['', 'All'], ['Lost', 'Lost'], ['Found', 'Found']].map(([v, l]) => (
          <button key={l} className={`btn btn-sm ${kind === v ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setKind(v)}>{l}</button>
        ))}
        <input placeholder="Search items" value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 260 }} />
        <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setOpen(true)}>Post an item</button>
      </div>

      {loading ? <Loading what="Loading items" /> : !items.length ? <Empty>Nothing posted here yet.</Empty> : (
        items.map((i) => (
          <div key={i.id} className="row">
            <div className="row-head">
              <div>
                <strong>{i.item_name}</strong>
                <div className="row-meta">
                  {i.location || 'Location not given'}{i.occurred_on ? ` · ${formatDate(i.occurred_on)}` : ''} · posted by {i.reported_by_name}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Chip label={i.kind} tone={i.kind === 'Lost' ? 'chip-stop' : 'chip-ok'} />
                <Chip label={i.status} />
              </div>
            </div>
            {i.description && <p style={{ margin: '8px 0 0', fontSize: 14 }}>{i.description}</p>}
            {i.contact_info && <p className="muted small" style={{ marginTop: 6 }}>Contact: {i.contact_info}</p>}
          </div>
        ))
      )}

      {open && (
        <Modal title="Post a lost or found item" onClose={() => setOpen(false)}>
          <form onSubmit={submit}>
            <Field label="This item is">
              <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                <option value="Lost">Something I lost</option>
                <option value="Found">Something I found</option>
              </select>
            </Field>
            <Field label="Item">
              <input required placeholder="e.g. Black wallet" value={form.item_name}
                     onChange={(e) => setForm({ ...form, item_name: e.target.value })} />
            </Field>
            <Field label="Where">
              <input placeholder="e.g. Library, 1st floor" value={form.location}
                     onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </Field>
            <Field label="When">
              <input type="date" value={form.occurred_on}
                     onChange={(e) => setForm({ ...form, occurred_on: e.target.value })} />
            </Field>
            <Field label="Description">
              <textarea rows={3} value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <Field label="How should people reach you?">
              <input placeholder="Phone or email" value={form.contact_info}
                     onChange={(e) => setForm({ ...form, contact_info: e.target.value })} />
            </Field>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Posting…' : 'Post'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
function FeedbackTab() {
  const [form, setForm] = useState({ category: 'Facilities', message: '', isAnonymous: true });
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      const r = await api.post('/feedback', form);
      setMsg({ ok: true, text: r.data.message });
      setForm({ category: 'Facilities', message: '', isAnonymous: true });
    } catch (err) {
      setMsg({ ok: false, text: err.response?.data?.message || 'Could not submit.' });
    } finally { setBusy(false); }
  };

  return (
    <div style={{ maxWidth: 520 }}>
      <p className="muted" style={{ marginBottom: 18 }}>
        Suggestions and concerns go straight to the administration. Anonymous notes don't
        carry your name anywhere, including the activity log.
      </p>
      <form onSubmit={submit} className="card">
        {msg && <div className={`banner ${msg.ok ? 'banner-ok' : 'banner-err'}`}>{msg.text}</div>}
        <Field label="About">
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {['Facilities', 'Academics', 'Transport', 'Canteen', 'Safety', 'Other'].map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Your message">
          <textarea required rows={5} value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })} />
        </Field>
        <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 14, marginBottom: 16 }}>
          <input type="checkbox" checked={form.isAnonymous} style={{ width: 'auto' }}
                 onChange={(e) => setForm({ ...form, isAnonymous: e.target.checked })} />
          Send anonymously
        </label>
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Sending…' : 'Send feedback'}</button>
      </form>
    </div>
  );
}
