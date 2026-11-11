import React, { useEffect, useRef } from 'react';
import { FiMicOff, FiMonitor } from 'react-icons/fi';
import { initials } from '../utils/format';
import './VideoTile.css';

export default function VideoTile({ stream, name, local = false, micOn = true, camOn = true, sharing = false }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream;
  }, [stream]);

  const showVideo = !!stream && (camOn || sharing);

  return (
    <div className={`tile${sharing ? ' tile-sharing' : ''}`}>
      {/* Keep the element mounted so audio keeps playing when the camera is off */}
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={local}
        className={`tile-video${local && !sharing ? ' mirror' : ''}`}
        style={{ visibility: showVideo ? 'visible' : 'hidden' }}
      />
      {!showVideo && <span className="tile-avatar">{initials(name)}</span>}
      <div className="tile-label">
        {!micOn && <FiMicOff aria-label="Muted" />}
        {sharing && <FiMonitor aria-label="Sharing screen" />}
        <span>{local ? `${name} (you)` : name}</span>
      </div>
    </div>
  );
}
