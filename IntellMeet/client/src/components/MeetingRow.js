import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiVideo, FiFileText, FiUsers } from 'react-icons/fi';
import { formatDateTime } from '../utils/format';
import './MeetingRow.css';

export default function MeetingRow({ meeting }) {
  const navigate = useNavigate();
  const ended = meeting.status === 'ended';
  const pending = (meeting.actionItems || []).filter((a) => !a.done).length;

  return (
    <li className="mrow">
      <div className="mrow-main">
        <div className="mrow-title">
          <Link to={`/meetings/${meeting._id}`}>{meeting.title}</Link>
          {meeting.status === 'live' && (
            <span className="badge badge-live"><span className="dot-live" /> Live</span>
          )}
          {meeting.status === 'scheduled' && <span className="badge badge-scheduled">Scheduled</span>}
        </div>
        <div className="mrow-meta">
          <span>{formatDateTime(meeting.scheduledAt)}</span>
          <span><FiUsers aria-hidden="true" /> {meeting.participants?.length || 1}</span>
          {meeting.workspace && <span>{meeting.workspace.name}</span>}
          {ended && pending > 0 && <span className="mrow-pending">{pending} open action item{pending > 1 ? 's' : ''}</span>}
        </div>
      </div>

      {ended ? (
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/meetings/${meeting._id}`)}>
          <FiFileText /> Minutes
        </button>
      ) : (
        <button className="btn btn-primary btn-sm" onClick={() => navigate(`/room/${meeting.roomId}`)}>
          <FiVideo /> {meeting.status === 'live' ? 'Join' : 'Start'}
        </button>
      )}
    </li>
  );
}
