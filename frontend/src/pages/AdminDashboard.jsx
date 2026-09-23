import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import Layout from '../components/Layout';
import { Chip, Empty, Loading, Modal, Field, formatDate, timeAgo } from '../components/ui';
import { IconGrid, IconWrench, IconClub, IconCalendar, IconFlag, IconChat, IconScroll } from '../components/icons';

const SECTIONS = [
  { items: [{ key: 'overview', label: 'Overview', icon: IconGrid }] },
  { label: 'Manage', items: [
    { key: 'maintenance', label: 'Maintenance', icon: IconWrench },
    { key: 'clubs', label: 'Clubs', icon: IconClub },
    { key: 'events', label: 'Events', icon: IconCalendar },
    { key: 'lostfound', label: 'Lost & found', icon: IconFlag },
    { key: 'feedback', label: 'Feedback', icon: IconChat },
  ]},
  { label: 'Records', items: [
    { key: 'activity', label: 'Activity log', icon: IconScroll },
  ]}
];

const TITLES = {
  overview: 'Overview', maintenance: 'Maintenance', clubs: 'Clubs', events: 'Campus events',
  lostfound: 'Lost & found', feedback: 'Feedback', activity: 'Activity log'
};

export default function AdminDashboard() {
  const [tab, setTab] = useState('overview');
  return (
    <Layout sections={SECTIONS} active={tab} onNavChange={setTab} pageTitle={TITLES[tab]}>
      {tab === 'overview' && <Overview />}
      {tab === 'maintenance' && <MaintenanceAdmin />}
      {tab === 'clubs' && <ClubsAdmin />}
      {tab === 'events' && <EventsAdmin />}
      {tab === 'lostfound' && <LostFoundAdmin />}
      {tab === 'feedback' && <FeedbackAdmin />}
      {tab === 'activity' && <ActivityLog />}
    </Layout>
  );
}

function Overview() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.get('/audit/analytics').then((r) => setData(r.data)).finally(() => setLoading(false)); }, []);

  if (loading) return <Loading what="Crunching the numbers" />;
  if (!data) return <Empty>No data yet.</Empty>;

  const t = data.totals || {};
  const maxCat = Math.max(1, ...data.maintenanceByCategory.map((c) => c.count));

  return (
    <div>
      <div className="stat-grid" style={{ marginBottom: 30 }}>
        {[
          ['Students', t.students], ['Faculty', t.faculty],
          ['Maintenance reports', t.maintenance_total], ['Student queries', t.messages_total],
          ['Events', t.events_total], ['Lost & found', t.lostfound_total]
        ].map(([label, n]) => (
          <div key={label} className="stat">
            <div className="n">{n ?? 0}</div>
            <div className="l">{label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
        <section className="card">
          <h4 style={{ marginBottom: 14 }}>Maintenance by category</h4>
          {!data.maintenanceByCategory.length ? <p className="muted small">No reports yet.</p> :
            data.maintenanceByCategory.map((c) => (
              <div key={c.category} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, marginBottom: 5 }}>
                  <span>{c.category}</span><span className="muted">{c.count}</span>
                </div>
                <div className="bar-track"><div className="bar-fill" style={{ width: `${(c.count / maxCat) * 100}%` }} /></div>
              </div>
            ))}
          {data.avgResolutionHours != null && (
            <p className="muted small" style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
              Average time to close a request: <strong>{data.avgResolutionHours} hours</strong>
            </p>
          )}
        </section>

        <section className="card">
          <h4 style={{ marginBottom: 14 }}>Faculty response times</h4>
          {!data.facultyResponse.length ? <p className="muted small">No queries yet.</p> : (
            <div className="table-scroll">
              <table className="plain">
                <thead><tr><th>Faculty</th><th>Queries</th><th>Avg reply</th></tr></thead>
                <tbody>
                  {data.facultyResponse.map((f) => (
                    <tr key={f.name}>
                      <td>{f.name}</td>
                      <td>{f.messages}</td>
                      <td className="muted">{f.avg_reply_hours != null ? `${f.avg_reply_hours} h` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card">
          <h4 style={{ marginBottom: 14 }}>Most popular events</h4>
          {!data.eventPopularity.length ? <p className="muted small">No events yet.</p> : (
            <div className="table-scroll">
              <table className="plain">
                <thead><tr><th>Event</th><th>Date</th><th>Signed up</th></tr></thead>
                <tbody>
                  {data.eventPopularity.map((e, i) => (
                    <tr key={i}>
                      <td>{e.title}</td>
                      <td className="muted">{formatDate(e.event_date)}</td>
                      <td>{e.registrations}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card">
          <h4 style={{ marginBottom: 14 }}>Activity, last 30 days</h4>
          {!data.activityByDay.length ? <p className="muted small">Nothing recorded yet.</p> : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 130 }}>
              {data.activityByDay.map((d) => {
                const max = Math.max(...data.activityByDay.map((x) => x.actions));
                return (
                  <div key={d.day} title={`${d.day}: ${d.actions} actions`}
                       style={{ flex: 1, background: 'var(--accent)', borderRadius: '2px 2px 0 0',
                                height: `${Math.max(4, (d.actions / max) * 100)}%`, opacity: .85 }} />
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
const NEXT = { Pending: 'In Progress', 'In Progress': 'Completed' };

function MaintenanceAdmin() {
  const [filter, setFilter] = useState('All');
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/maintenance', { params: filter === 'All' ? {} : { status: filter } })
      .then((r) => setList(r.data)).finally(() => setLoading(false));
  }, [filter]);
  useEffect(load, [load]);

  const advance = async (r, status) => {
    setBusyId(r.id);
    try { await api.put(`/maintenance/${r.id}/status`, { status }); load(); }
    finally { setBusyId(null); }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {['All', 'Pending', 'In Progress', 'Completed', 'Rejected'].map((f) => (
          <button key={f} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>

      {loading ? <Loading /> : !list.length ? <Empty>Nothing in this view.</Empty> : (
        list.map((r) => (
          <div key={r.id} className="row">
            <div className="row-head">
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <strong>{r.category} · {r.location}{r.room_number ? ` (${r.room_number})` : ''}</strong>
                  {r.priority === 'High' && <Chip label="High" tone="chip-stop" />}
                </div>
                <div className="row-meta">
                  {r.reported_by_name} ({r.reporter_role}) · {formatDate(r.created_at)}
                </div>
                <p style={{ margin: '8px 0 0', fontSize: 14 }}>{r.description}</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                <Chip label={r.status} />
                {NEXT[r.status] && (
                  <button className="btn btn-secondary btn-sm" disabled={busyId === r.id}
                          onClick={() => advance(r, NEXT[r.status])}>
                    {busyId === r.id ? 'Saving…' : `Mark ${NEXT[r.status]}`}
                  </button>
                )}
                {r.status === 'Pending' && (
                  <button className="btn btn-ghost btn-sm" onClick={() => advance(r, 'Rejected')}>Reject</button>
                )}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
function ClubsAdmin() {
  const [clubs, setClubs] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [desc, setDesc] = useState('');
  const [form, setForm] = useState({ type: 'Announcement', title: '', description: '', event_date: '', venue: '' });
  const [busy, setBusy] = useState(false);

  const loadClubs = () => api.get('/clubs').then((r) => setClubs(r.data)).finally(() => setLoading(false));
  useEffect(() => { loadClubs(); api.get('/faculty').then((r) => setFaculty(r.data)); }, []);

  const open = (c) => {
    setSelected(c); setDesc(c.description || ''); setDetail(null);
    api.get(`/clubs/${c.id}`).then((r) => setDetail(r.data));
  };
  const refresh = async () => { const r = await api.get(`/clubs/${selected.id}`); setDetail(r.data); loadClubs(); };

  if (loading) return <Loading what="Loading clubs" />;

  if (selected) {
    return (
      <div>
        <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)} style={{ marginBottom: 18 }}>← All clubs</button>
        <h3 style={{ marginBottom: 20 }}>{selected.club_name}</h3>

        <div className="card" style={{ maxWidth: 520, marginBottom: 22 }}>
          <Field label="Coordinator">
            <select value={detail?.coordinator_id || ''} onChange={async (e) => {
              await api.put(`/clubs/${selected.id}/coordinator`, { facultyId: e.target.value || null });
              refresh();
            }}>
              <option value="">No coordinator assigned</option>
              {faculty.map((f) => <option key={f.faculty_id} value={f.faculty_id}>{f.name} ({f.department})</option>)}
            </select>
          </Field>
          <Field label="Description">
            <textarea rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} />
          </Field>
          <button className="btn btn-secondary btn-sm" onClick={async () => {
            await api.put(`/clubs/${selected.id}/description`, { description: desc }); refresh();
          }}>Save description</button>
        </div>

        <form className="card" style={{ maxWidth: 520, marginBottom: 26 }} onSubmit={async (e) => {
          e.preventDefault(); setBusy(true);
          try {
            await api.post(`/clubs/${selected.id}/posts`, form);
            setForm({ type: 'Announcement', title: '', description: '', event_date: '', venue: '' });
            refresh();
          } finally { setBusy(false); }
        }}>
          <h4 style={{ marginBottom: 14 }}>Post an update</h4>
          <Field label="Type">
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option>Announcement</option><option>Event</option><option>Contest</option>
            </select>
          </Field>
          <Field label="Title"><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label="Details"><textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <Field label="Date (optional)"><input type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} /></Field>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Posting…' : 'Post'}</button>
        </form>

        <h4 style={{ marginBottom: 10 }}>Existing posts</h4>
        {!detail ? <Loading /> : !detail.posts.length ? <Empty>Nothing posted yet.</Empty> : (
          detail.posts.map((p) => (
            <div key={p.id} className="row">
              <div className="row-head">
                <div>
                  <strong>{p.title}</strong>
                  <div className="row-meta">{p.type}{p.event_date ? ` · ${formatDate(p.event_date)}` : ''} · {p.posted_by_name}</div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={async () => {
                  await api.delete(`/clubs/posts/${p.id}`); refresh();
                }}>Delete</button>
              </div>
            </div>
          ))
        )}
      </div>
    );
  }

  return (
    <div className="grid-cards">
      {clubs.map((c) => (
        <button key={c.id} className="card" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => open(c)}>
          <div style={{ fontWeight: 600 }}>{c.club_name}</div>
          <div className="muted small" style={{ marginTop: 4 }}>{c.coordinator_name || 'No coordinator'}</div>
          <div className="muted small" style={{ marginTop: 8 }}>{c.member_count} members · {c.post_count} posts</div>
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
function EventsAdmin() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', category: 'Fest', venue: '', event_date: '', start_time: '', organizer: '' });
  const [busy, setBusy] = useState(false);

  const load = () => { setLoading(true); api.get('/events', { params: { scope: 'upcoming' } }).then((r) => setList(r.data)).finally(() => setLoading(false)); };
  useEffect(load, []);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="btn btn-primary" onClick={() => setOpen(true)}>Create an event</button>
      </div>

      {loading ? <Loading /> : !list.length ? <Empty>No upcoming events.</Empty> : (
        list.map((e) => (
          <div key={e.id} className="row">
            <div className="row-head">
              <div>
                <strong>{e.title}</strong>
                <div className="row-meta">{formatDate(e.event_date)}{e.venue ? ` · ${e.venue}` : ''} · {e.registration_count} registered · by {e.created_by_name}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Chip label={e.category} tone="chip-neutral" />
                <button className="btn btn-ghost btn-sm" onClick={async () => { await api.delete(`/events/${e.id}`); load(); }}>Delete</button>
              </div>
            </div>
            {e.description && <p style={{ margin: '8px 0 0', fontSize: 14 }}>{e.description}</p>}
          </div>
        ))
      )}

      {open && (
        <Modal title="Create a campus event" onClose={() => setOpen(false)}>
          <form onSubmit={async (e) => {
            e.preventDefault(); setBusy(true);
            try {
              await api.post('/events', form); setOpen(false);
              setForm({ title: '', description: '', category: 'Fest', venue: '', event_date: '', start_time: '', organizer: '' });
              load();
            } finally { setBusy(false); }
          }}>
            <Field label="Title"><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
            <Field label="Category">
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {['Fest', 'Guest Lecture', 'Placement', 'Workshop', 'Sports', 'Exam Notice', 'Other'].map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Date"><input type="date" required value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} /></Field>
            <Field label="Start time"><input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></Field>
            <Field label="Venue"><input value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} /></Field>
            <Field label="Organiser"><input value={form.organizer} onChange={(e) => setForm({ ...form, organizer: e.target.value })} /></Field>
            <Field label="Details"><textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
function LostFoundAdmin() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = () => { setLoading(true); api.get('/lostfound').then((r) => setItems(r.data)).finally(() => setLoading(false)); };
  useEffect(load, []);

  if (loading) return <Loading />;
  if (!items.length) return <Empty>Nothing posted yet.</Empty>;

  return items.map((i) => (
    <div key={i.id} className="row">
      <div className="row-head">
        <div>
          <strong>{i.item_name}</strong>
          <div className="row-meta">{i.kind} · {i.location || 'no location'} · {i.reported_by_name} · {timeAgo(i.created_at)}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Chip label={i.status} />
          <select value={i.status} style={{ width: 'auto', padding: '5px 8px', fontSize: 13 }}
                  onChange={async (e) => { await api.put(`/lostfound/${i.id}/status`, { status: e.target.value }); load(); }}>
            {['Open', 'Claimed', 'Closed'].map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>
      {i.description && <p style={{ margin: '8px 0 0', fontSize: 14 }}>{i.description}</p>}
    </div>
  ));
}

/* ------------------------------------------------------------------ */
function FeedbackAdmin() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = () => { setLoading(true); api.get('/feedback').then((r) => setList(r.data)).finally(() => setLoading(false)); };
  useEffect(load, []);

  if (loading) return <Loading />;
  if (!list.length) return <Empty>No feedback submitted yet.</Empty>;

  return list.map((f) => (
    <div key={f.id} className="row">
      <div className="row-head">
        <div>
          <strong>{f.category}</strong>
          <div className="row-meta">
            {f.is_anonymous ? 'Anonymous' : f.submitted_by_name} · {timeAgo(f.created_at)}
          </div>
        </div>
        <select value={f.status} style={{ width: 'auto', padding: '5px 8px', fontSize: 13 }}
                onChange={async (e) => { await api.put(`/feedback/${f.id}/status`, { status: e.target.value }); load(); }}>
          {['New', 'Reviewed', 'Actioned'].map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      <p style={{ margin: '8px 0 0', fontSize: 14 }}>{f.message}</p>
    </div>
  ));
}

/* ------------------------------------------------------------------ */
function ActivityLog() {
  const [data, setData] = useState({ entries: [], total: 0, page: 1 });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ entityType: '', action: '' });
  const [page, setPage] = useState(1);

  const load = useCallback(() => {
    setLoading(true);
    const params = { page, perPage: 50 };
    if (filters.entityType) params.entityType = filters.entityType;
    if (filters.action) params.action = filters.action;
    api.get('/audit', { params }).then((r) => setData(r.data)).finally(() => setLoading(false));
  }, [page, filters]);
  useEffect(load, [load]);

  const exportXlsx = async () => {
    const res = await api.get('/audit/export.xlsx', { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = `campushub-activity-${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const pages = Math.ceil(data.total / (data.perPage || 50)) || 1;

  return (
    <div>
      <p className="muted small" style={{ marginBottom: 16 }}>
        Every create, update and delete in CampusHub is recorded here, with who did it and when.
      </p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18, alignItems: 'center' }}>
        <select value={filters.entityType} style={{ width: 'auto' }}
                onChange={(e) => { setPage(1); setFilters({ ...filters, entityType: e.target.value }); }}>
          <option value="">All areas</option>
          {['message', 'maintenance_request', 'club', 'club_post', 'club_member', 'event',
            'event_registration', 'lost_found_item', 'feedback', 'faculty_availability', 'user', 'auth']
            .map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
        </select>
        <select value={filters.action} style={{ width: 'auto' }}
                onChange={(e) => { setPage(1); setFilters({ ...filters, action: e.target.value }); }}>
          <option value="">All actions</option>
          {['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGIN_FAILED'].map((a) => <option key={a}>{a}</option>)}
        </select>
        <button className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }} onClick={exportXlsx}>
          Download as Excel
        </button>
      </div>

      {loading ? <Loading what="Loading the log" /> : !data.entries.length ? <Empty>Nothing recorded for this filter.</Empty> : (
        <>
          <div className="table-scroll">
            <table className="plain">
              <thead>
                <tr><th>When</th><th>User</th><th>Action</th><th>Area</th><th>What happened</th></tr>
              </thead>
              <tbody>
                {data.entries.map((e) => (
                  <tr key={e.id}>
                    <td className="muted" style={{ whiteSpace: 'nowrap' }}>{timeAgo(e.created_at)}</td>
                    <td>{e.actor_name || '—'}<div className="muted" style={{ fontSize: 11.5 }}>{e.actor_role || ''}</div></td>
                    <td><Chip label={e.action} tone={e.action === 'DELETE' || e.action === 'LOGIN_FAILED' ? 'chip-stop' : e.action === 'CREATE' ? 'chip-ok' : 'chip-neutral'} /></td>
                    <td className="muted small">{e.entity_type.replace(/_/g, ' ')}</td>
                    <td style={{ fontSize: 13.5 }}>{e.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 }}>
            <span className="muted small">{data.total} entries · page {data.page} of {pages}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
              <button className="btn btn-secondary btn-sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
