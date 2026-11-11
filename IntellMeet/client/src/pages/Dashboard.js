import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiVideo, FiCalendar } from 'react-icons/fi';
import api, { errorMessage } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { greeting } from '../utils/format';
import MeetingRow from '../components/MeetingRow';
import ScheduleModal from '../components/ScheduleModal';
import './Dashboard.css';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [code, setCode] = useState('');
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/meetings'), api.get('/workspaces')])
      .then(([m, w]) => {
        setMeetings(m.data);
        setWorkspaces(w.data);
      })
      .catch((err) => setError(errorMessage(err, 'Could not load your meetings.')))
      .finally(() => setLoading(false));
  }, []);

  const { upcoming, past, stats } = useMemo(() => {
    const active = meetings.filter((m) => m.status !== 'ended').sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
    const ended = meetings.filter((m) => m.status === 'ended');
    return {
      upcoming: active,
      past: ended,
      stats: {
        live: meetings.filter((m) => m.status === 'live').length,
        upcoming: meetings.filter((m) => m.status === 'scheduled').length,
        held: ended.length,
        open: ended.reduce((n, m) => n + (m.actionItems || []).filter((a) => !a.done).length, 0),
      },
    };
  }, [meetings]);

  const startInstant = async () => {
    setStarting(true);
    try {
      const { data } = await api.post('/meetings', { title: `${user.name.split(' ')[0]}'s meeting`, instant: true });
      navigate(`/room/${data.roomId}`);
    } catch (err) {
      setError(errorMessage(err));
      setStarting(false);
    }
  };

  const join = (e) => {
    e.preventDefault();
    if (code.trim()) navigate(`/room/${code.trim().toLowerCase()}`);
  };

  return (
    <div className="dash">
      <header className="dash-head">
        <div>
          <h1>{greeting()}, {user.name.split(' ')[0]}</h1>
          <p className="dash-sub">
            {stats.live > 0 ? `${stats.live} meeting${stats.live > 1 ? 's are' : ' is'} live right now.` : 'Nothing live right now.'}
          </p>
        </div>
        <div className="dash-actions">
          <button className="btn btn-ghost" onClick={() => setShowModal(true)}><FiCalendar /> Schedule</button>
          <button className="btn btn-primary" onClick={startInstant} disabled={starting}>
            <FiVideo /> {starting ? 'Starting…' : 'Start a meeting'}
          </button>
        </div>
      </header>

      {error && <div className="form-error" role="alert">{error}</div>}

      <dl className="ledger">
        <div><dd>{stats.live}</dd><dt>Live</dt></div>
        <div><dd>{stats.upcoming}</dd><dt>Scheduled</dt></div>
        <div><dd>{stats.held}</dd><dt>Held</dt></div>
        <div className={stats.open ? 'ledger-hot' : ''}><dd>{stats.open}</dd><dt>Open action items</dt></div>
      </dl>

      <form className="join-form" onSubmit={join}>
        <label htmlFor="room-code">Have a meeting code?</label>
        <input id="room-code" className="input" placeholder="e.g. 3fa9-b2c1-7d" value={code} onChange={(e) => setCode(e.target.value)} />
        <button className="btn btn-ghost" disabled={!code.trim()}>Join meeting</button>
      </form>

      {loading ? (
        <p className="empty">Loading meetings…</p>
      ) : (
        <>
          <section className="dash-section">
            <h2>Live and upcoming</h2>
            {upcoming.length === 0 ? (
              <p className="empty">No meetings coming up. Start one now or schedule it for later.</p>
            ) : (
              <ul className="mlist">{upcoming.map((m) => <MeetingRow key={m._id} meeting={m} />)}</ul>
            )}
          </section>

          <section className="dash-section">
            <h2>Past meetings</h2>
            {past.length === 0 ? (
              <p className="empty">Minutes appear here after your first meeting ends.</p>
            ) : (
              <ul className="mlist">{past.map((m) => <MeetingRow key={m._id} meeting={m} />)}</ul>
            )}
          </section>
        </>
      )}

      {showModal && (
        <ScheduleModal
          workspaces={workspaces}
          onClose={() => setShowModal(false)}
          onCreated={(m) => {
            setMeetings((prev) => [m, ...prev]);
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
}
