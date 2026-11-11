import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
const SOCKET_URL =
  process.env.REACT_APP_SOCKET_URL || (process.env.NODE_ENV === 'production' ? window.location.origin : 'http://localhost:5000');

/**
 * Mesh WebRTC: every participant connects directly to every other participant.
 * Socket.io only relays signaling (offers, answers, ICE candidates).
 * Mesh works well for small meetings (about 2 to 6 people); use an SFU for larger ones.
 */
export default function useWebRTC(roomId, enabled) {
  const [socket, setSocket] = useState(null);
  const [previewStream, setPreviewStream] = useState(null);
  const [peers, setPeers] = useState({});
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState('');

  const pcs = useRef({});
  const pending = useRef({});
  const camStream = useRef(null);
  const screenStream = useRef(null);
  const socketRef = useRef(null);
  const media = useRef({ micOn: true, camOn: true, sharing: false });

  const publishState = useCallback((patch) => {
    media.current = { ...media.current, ...patch };
    if (socketRef.current) socketRef.current.emit('media-state', media.current);
  }, []);

  const replaceVideoTrack = useCallback((track) => {
    Object.values(pcs.current).forEach((pc) => {
      const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
      if (sender) sender.replaceTrack(track).catch(() => {});
    });
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    let sock = null;

    const updatePeer = (id, patch) => setPeers((p) => ({ ...p, [id]: { ...(p[id] || {}), ...patch } }));
    const removePeer = (id) => {
      if (pcs.current[id]) {
        pcs.current[id].close();
        delete pcs.current[id];
      }
      delete pending.current[id];
      setPeers((p) => {
        const next = { ...p };
        delete next[id];
        return next;
      });
    };

    const getMedia = async () => {
      try {
        return await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch {
        try {
          const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true });
          setError('Camera unavailable. You joined with audio only.');
          return audioOnly;
        } catch {
          setError('Camera and microphone are blocked. You joined as a listener. Allow access in your browser to speak.');
          return new MediaStream();
        }
      }
    };

    const createPC = (id, name) => {
      if (pcs.current[id]) return pcs.current[id];
      const pc = new RTCPeerConnection(ICE);
      const stream = camStream.current;

      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      if (!stream.getVideoTracks().length) pc.addTransceiver('video', { direction: 'recvonly' });
      if (!stream.getAudioTracks().length) pc.addTransceiver('audio', { direction: 'recvonly' });

      if (screenStream.current) {
        const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
        if (sender) sender.replaceTrack(screenStream.current.getVideoTracks()[0]).catch(() => {});
      }

      pc.onicecandidate = (e) => {
        if (e.candidate) sock.emit('signal', { to: id, data: { candidate: e.candidate } });
      };
      pc.ontrack = (e) => updatePeer(id, { stream: e.streams[0], name });
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') removePeer(id);
      };

      pcs.current[id] = pc;
      updatePeer(id, { name });
      return pc;
    };

    const flushCandidates = async (id, pc) => {
      const queue = pending.current[id] || [];
      pending.current[id] = [];
      for (const c of queue) {
        try { await pc.addIceCandidate(c); } catch { /* ignore stale candidate */ }
      }
    };

    (async () => {
      const stream = await getMedia();
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      camStream.current = stream;
      setPreviewStream(stream);
      const hasAudio = stream.getAudioTracks().length > 0;
      const hasVideo = stream.getVideoTracks().length > 0;
      setMicOn(hasAudio);
      setCamOn(hasVideo);
      media.current = { micOn: hasAudio, camOn: hasVideo, sharing: false };

      sock = io(SOCKET_URL, { auth: { token: localStorage.getItem('intellmeet_token') } });
      socketRef.current = sock;
      setSocket(sock);

      sock.on('connect_error', () => setError('Could not connect to the meeting server.'));

      sock.on('connect', () => {
        sock.emit('join-room', { roomId });
        sock.emit('media-state', media.current);
      });

      // We are the newcomer: call everyone already in the room.
      sock.on('room-users', async (users) => {
        for (const u of users) {
          const pc = createPC(u.socketId, u.name);
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            sock.emit('signal', { to: u.socketId, data: { sdp: pc.localDescription } });
          } catch (e) {
            console.error('offer failed', e);
          }
        }
      });

      // Tell newcomers our current mic/camera state.
      sock.on('user-joined', () => sock.emit('media-state', media.current));

      sock.on('signal', async ({ from, name, data }) => {
        const pc = createPC(from, name);
        try {
          if (data.sdp) {
            await pc.setRemoteDescription(data.sdp);
            await flushCandidates(from, pc);
            if (data.sdp.type === 'offer') {
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              sock.emit('signal', { to: from, data: { sdp: pc.localDescription } });
            }
          } else if (data.candidate) {
            if (pc.remoteDescription) await pc.addIceCandidate(data.candidate);
            else (pending.current[from] = pending.current[from] || []).push(data.candidate);
          }
        } catch (e) {
          console.error('signal error', e);
        }
      });

      sock.on('media-state', ({ socketId, micOn: m, camOn: c, sharing: s }) =>
        updatePeer(socketId, { micOn: m, camOn: c, sharing: s })
      );
      sock.on('user-left', ({ socketId }) => removePeer(socketId));
    })();

    return () => {
      cancelled = true;
      if (sock) {
        sock.emit('leave-room');
        sock.disconnect();
      }
      socketRef.current = null;
      Object.values(pcs.current).forEach((pc) => pc.close());
      pcs.current = {};
      pending.current = {};
      [camStream.current, screenStream.current].forEach((s) => s && s.getTracks().forEach((t) => t.stop()));
      camStream.current = null;
      screenStream.current = null;
      setPeers({});
      setSocket(null);
    };
  }, [roomId, enabled]);

  const toggleMic = useCallback(() => {
    const tracks = camStream.current ? camStream.current.getAudioTracks() : [];
    if (!tracks.length) return;
    const next = !media.current.micOn;
    tracks.forEach((t) => (t.enabled = next));
    setMicOn(next);
    publishState({ micOn: next });
  }, [publishState]);

  const toggleCam = useCallback(() => {
    const tracks = camStream.current ? camStream.current.getVideoTracks() : [];
    if (!tracks.length) return;
    const next = !media.current.camOn;
    tracks.forEach((t) => (t.enabled = next));
    setCamOn(next);
    publishState({ camOn: next });
  }, [publishState]);

  const stopShare = useCallback(() => {
    if (screenStream.current) {
      screenStream.current.getTracks().forEach((t) => t.stop());
      screenStream.current = null;
    }
    const camTrack = camStream.current && camStream.current.getVideoTracks()[0];
    if (camTrack) replaceVideoTrack(camTrack);
    setPreviewStream(camStream.current);
    setSharing(false);
    publishState({ sharing: false });
  }, [publishState, replaceVideoTrack]);

  const toggleShare = useCallback(async () => {
    if (media.current.sharing) {
      stopShare();
      return;
    }
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = display.getVideoTracks()[0];
      screenStream.current = display;
      track.onended = () => stopShare();
      replaceVideoTrack(track);
      setPreviewStream(display);
      setSharing(true);
      publishState({ sharing: true });
    } catch {
      /* user cancelled the picker */
    }
  }, [publishState, replaceVideoTrack, stopShare]);

  return { socket, previewStream, peers, micOn, camOn, sharing, error, toggleMic, toggleCam, toggleShare };
}
