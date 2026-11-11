import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  FiMic, FiMicOff, FiVideo, FiVideoOff, FiMonitor, FiPhoneOff, FiMessageSquare,
  FiFileText, FiUsers, FiType, FiCopy, FiCheck, FiX,
} from 'react-icons/fi';
import api, { errorMessage } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import useWebRTC from '../hooks/useWebRTC';
import useTranscription from '../hooks/useTranscription';
import VideoTile from '../components/VideoTile';
import ChatPanel from '../components/ChatPanel';
import TranscriptPanel from '../components/TranscriptPanel';
import { initials } from '../utils/format';
import './MeetingRoom.css';

export default function MeetingRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [meeting, setMeeting] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [panel, setPanel] = useState('chat');
  const [captionsOn, setCaptionsOn] = useState(true);
  const [copied, setCopied] = useState(false);
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    api
      .get(`/meetings/room/${roomId}`)
      .then((r) => setMeeting(r.data))
      .catch((err) => {
        if (err.response?.status === 410) navigate(`/meetings/${err.response.data.meetingId}`, { replace: true });
        else setLoadError(errorMessage(err, 'Could not open this meeting.'));
      });
  }, [roomId, navigate]);

  const rtc = useWebRTC(roomId, !!meeting);
  const transcriptionSupported = useTranscription(rtc.socket, captionsOn && rtc.micOn);

  useEffect(() => {
    if (!rtc.socket) return undefined;
    const onEnded = ({ meetingId }) => navigate(`/meetings/${meetingId}`, { replace: true });
    rtc.socket.on('meeting-ended', onEnded);
    return () => rtc.socket.off('meeting-ended', onEnded);
  }, [rtc.socket, navigate]);

  const isHost = meeting && meeting.host._id === user._id;
  const peerList = Object.entries(rtc.peers);
  const count = peerList.length + 1;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard unavailable */ }
  };

  const leave = () => navigate(meeting ? `/meetings/${meeting._id}` : '/');

  const endForAll = async () => {
    if (!window.confirm('End the meeting for everyone? Minutes will be generated.')) return;
    setEnding(true);
    try {
      await api.patch(`/meetings/${meeting._id}/end`);
      navigate(`/meetings/${meeting._id}`, { replace: true });
    } catch {
      setEnding(false);
    }
  };

  const togglePanel = (name) => setPanel((p) => (p === name ? null : name));

  if (loadError) {
    return (
      <div className="room-error">
        <h1>Can't open this meeting</h1>
        <p>{loadError}</p>
        <button className="btn btn-primary" onClick={() => navigate('/')}>Back to meetings</button>
      </div>
    );
  }
  if (!meeting) return <div className="room-error"><p>Opening meeting…</p></div>;

  return (
    <div className="room">
      <header className="room-bar">
        <div className="room-title">
          <span className="badge badge-live"><span className="dot-live" /> Live</span>
          <h1>{meeting.title}</h1>
        </div>
        <button className="room-code" onClick={copyCode} title="Copy meeting code to share">
          <code>{roomId}</code> {copied ? <FiCheck /> : <FiCopy />}
        </button>
      </header>

      {rtc.error && <div className="room-warning" role="status">{rtc.error}</div>}

      <div className="room-stage">
        <div className={`room-grid grid-${Math.min(count, 7)}`}>
          <VideoTile stream={rtc.previewStream} name={user.name} local micOn={rtc.micOn} camOn={rtc.camOn} sharing={rtc.sharing} />
          {peerList.map(([id, p]) => (
            <VideoTile key={id} stream={p.stream} name={p.name || 'Guest'} micOn={p.micOn !== false} camOn={p.camOn !== false} sharing={!!p.sharing} />
          ))}
        </div>

        {panel && (
          <aside className="room-panel" aria-label={panel}>
            <div className="room-panel-head">
              <h2>{panel === 'chat' ? 'Chat' : panel === 'transcript' ? 'Live transcript' : `People (${count})`}</h2>
              <button onClick={() => setPanel(null)} aria-label="Close panel"><FiX /></button>
            </div>
            <div className="room-panel-content">
              {panel === 'chat' && <ChatPanel socket={rtc.socket} meetingId={meeting._id} user={user} />}
              {panel === 'transcript' && (
                <TranscriptPanel socket={rtc.socket} meetingId={meeting._id} supported={transcriptionSupported} captionsOn={captionsOn} />
              )}
              {panel === 'people' && (
                <ul className="people-list">
                  <li><span className="avatar">{initials(user.name)}</span> {user.name} (you) <span className="state">{rtc.micOn ? '' : 'Muted'}</span></li>
                  {peerList.map(([id, p]) => (
                    <li key={id}><span className="avatar">{initials(p.name)}</span> {p.name || 'Guest'} <span className="state">{p.micOn === false ? 'Muted' : ''}</span></li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        )}
      </div>

      <footer className="room-controls">
        <button className={`ctl${rtc.micOn ? '' : ' off'}`} onClick={rtc.toggleMic} aria-pressed={!rtc.micOn} aria-label={rtc.micOn ? 'Mute microphone' : 'Unmute microphone'}>
          {rtc.micOn ? <FiMic /> : <FiMicOff />}<span>{rtc.micOn ? 'Mute' : 'Unmute'}</span>
        </button>
        <button className={`ctl${rtc.camOn ? '' : ' off'}`} onClick={rtc.toggleCam} aria-pressed={!rtc.camOn} aria-label={rtc.camOn ? 'Turn camera off' : 'Turn camera on'}>
          {rtc.camOn ? <FiVideo /> : <FiVideoOff />}<span>{rtc.camOn ? 'Camera' : 'Camera off'}</span>
        </button>
        <button className={`ctl${rtc.sharing ? ' active' : ''}`} onClick={rtc.toggleShare} aria-pressed={rtc.sharing}>
          <FiMonitor /><span>{rtc.sharing ? 'Stop sharing' : 'Share'}</span>
        </button>
        <button className={`ctl${captionsOn ? ' active' : ''}`} onClick={() => setCaptionsOn((c) => !c)} aria-pressed={captionsOn}>
          <FiType /><span>Transcribe</span>
        </button>

        <span className="ctl-gap" />

        <button className={`ctl${panel === 'chat' ? ' active' : ''}`} onClick={() => togglePanel('chat')}><FiMessageSquare /><span>Chat</span></button>
        <button className={`ctl${panel === 'transcript' ? ' active' : ''}`} onClick={() => togglePanel('transcript')}><FiFileText /><span>Transcript</span></button>
        <button className={`ctl${panel === 'people' ? ' active' : ''}`} onClick={() => togglePanel('people')}><FiUsers /><span>People</span></button>

        <span className="ctl-gap" />

        <button className="ctl leave" onClick={leave}><FiPhoneOff /><span>Leave</span></button>
        {isHost && (
          <button className="ctl end" onClick={endForAll} disabled={ending}><span>{ending ? 'Ending…' : 'End for all'}</span></button>
        )}
      </footer>
    </div>
  );
}
