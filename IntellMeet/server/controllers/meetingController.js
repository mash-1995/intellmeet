const crypto = require('crypto');
const Meeting = require('../models/Meeting');
const Message = require('../models/Message');
const Workspace = require('../models/Workspace');
const { summarizeMeeting } = require('../services/aiService');

const makeRoomId = () => {
  const h = crypto.randomBytes(5).toString('hex');
  return `${h.slice(0, 4)}-${h.slice(4, 8)}-${h.slice(8, 10)}`;
};

const populateMeeting = (q) =>
  q
    .populate('host', 'name email')
    .populate('participants', 'name email')
    .populate('workspace', 'name');

const myWorkspaceIds = async (userId) => {
  const ws = await Workspace.find({ 'members.user': userId }).select('_id');
  return ws.map((w) => w._id);
};

const canAccess = async (meeting, user) => {
  const uid = user.id;
  if (meeting.host._id ? meeting.host._id.toString() === uid : meeting.host.toString() === uid) return true;
  if (meeting.participants.some((p) => (p._id || p).toString() === uid)) return true;
  if (meeting.workspace) {
    const wsId = meeting.workspace._id || meeting.workspace;
    const ws = await Workspace.findOne({ _id: wsId, 'members.user': uid }).select('_id');
    if (ws) return true;
  }
  return false;
};

const isHost = (meeting, user) => (meeting.host._id || meeting.host).toString() === user.id;

exports.createMeeting = async (req, res, next) => {
  try {
    const { title, description, scheduledAt, workspace, instant } = req.body;
    if (!title) return res.status(400).json({ message: 'Meeting title is required' });

    if (workspace) {
      const member = await Workspace.findOne({ _id: workspace, 'members.user': req.user.id });
      if (!member) return res.status(403).json({ message: 'You are not a member of that workspace' });
    }

    const meeting = await Meeting.create({
      title,
      description,
      host: req.user.id,
      workspace: workspace || null,
      roomId: makeRoomId(),
      scheduledAt: instant ? new Date() : scheduledAt || new Date(),
      status: instant ? 'live' : 'scheduled',
      startedAt: instant ? new Date() : undefined,
      participants: [req.user.id],
    });
    res.status(201).json(await populateMeeting(Meeting.findById(meeting.id).select('-transcript')));
  } catch (err) {
    next(err);
  }
};

exports.getMeetings = async (req, res, next) => {
  try {
    const wsIds = await myWorkspaceIds(req.user.id);
    const meetings = await populateMeeting(
      Meeting.find({
        $or: [{ host: req.user.id }, { participants: req.user.id }, { workspace: { $in: wsIds } }],
      })
        .select('-transcript')
        .sort('-scheduledAt')
        .limit(100)
    );
    res.json(meetings);
  } catch (err) {
    next(err);
  }
};

exports.getMeeting = async (req, res, next) => {
  try {
    const meeting = await populateMeeting(Meeting.findById(req.params.id));
    if (!meeting) return res.status(404).json({ message: 'Meeting not found' });
    if (!(await canAccess(meeting, req.user))) {
      return res.status(403).json({ message: 'You do not have access to this meeting' });
    }
    res.json(meeting);
  } catch (err) {
    next(err);
  }
};

/** Anyone with the room code can join (like a meeting link). */
exports.getMeetingByRoom = async (req, res, next) => {
  try {
    const meeting = await Meeting.findOne({ roomId: req.params.roomId.toLowerCase() });
    if (!meeting) return res.status(404).json({ message: 'No meeting found for that code' });
    if (meeting.status === 'ended') {
      return res.status(410).json({ message: 'This meeting has already ended', meetingId: meeting.id });
    }
    if (!meeting.participants.some((p) => p.toString() === req.user.id)) {
      meeting.participants.push(req.user.id);
    }
    if (meeting.status === 'scheduled') {
      meeting.status = 'live';
      meeting.startedAt = new Date();
    }
    await meeting.save();
    res.json(await populateMeeting(Meeting.findById(meeting.id).select('-transcript')));
  } catch (err) {
    next(err);
  }
};

exports.endMeeting = async (req, res, next) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) return res.status(404).json({ message: 'Meeting not found' });
    if (!isHost(meeting, req.user)) return res.status(403).json({ message: 'Only the host can end a meeting' });

    meeting.status = 'ended';
    meeting.endedAt = new Date();
    await meeting.save();

    const io = req.app.get('io');
    if (io) io.to(meeting.roomId).emit('meeting-ended', { meetingId: meeting.id });

    // Generate minutes in the background so ending the call is instant.
    summarizeMeeting(meeting.transcript)
      .then(async (result) => {
        await Meeting.findByIdAndUpdate(meeting.id, { ...result, summaryGeneratedAt: new Date() });
      })
      .catch((e) => console.error('Background summary failed:', e.message));

    res.json({ message: 'Meeting ended', meetingId: meeting.id });
  } catch (err) {
    next(err);
  }
};

exports.summarize = async (req, res, next) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) return res.status(404).json({ message: 'Meeting not found' });
    if (!(await canAccess(meeting, req.user))) return res.status(403).json({ message: 'No access' });

    const result = await summarizeMeeting(meeting.transcript);
    meeting.summary = result.summary;
    meeting.keyPoints = result.keyPoints;
    meeting.decisions = result.decisions;
    meeting.actionItems = result.actionItems;
    meeting.summaryGeneratedAt = new Date();
    await meeting.save();
    res.json(await populateMeeting(Meeting.findById(meeting.id)));
  } catch (err) {
    next(err);
  }
};

exports.toggleActionItem = async (req, res, next) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) return res.status(404).json({ message: 'Meeting not found' });
    if (!(await canAccess(meeting, req.user))) return res.status(403).json({ message: 'No access' });
    const item = meeting.actionItems.id(req.params.itemId);
    if (!item) return res.status(404).json({ message: 'Action item not found' });
    item.done = typeof req.body.done === 'boolean' ? req.body.done : !item.done;
    await meeting.save();
    res.json(item);
  } catch (err) {
    next(err);
  }
};

exports.getMessages = async (req, res, next) => {
  try {
    const meeting = await Meeting.findById(req.params.id).select('roomId host participants workspace');
    if (!meeting) return res.status(404).json({ message: 'Meeting not found' });
    if (!(await canAccess(meeting, req.user))) return res.status(403).json({ message: 'No access' });
    res.json(await Message.find({ roomId: meeting.roomId }).sort('createdAt').limit(300));
  } catch (err) {
    next(err);
  }
};

exports.getTranscript = async (req, res, next) => {
  try {
    const meeting = await Meeting.findById(req.params.id).select('transcript host participants workspace');
    if (!meeting) return res.status(404).json({ message: 'Meeting not found' });
    if (!(await canAccess(meeting, req.user))) return res.status(403).json({ message: 'No access' });
    res.json(meeting.transcript);
  } catch (err) {
    next(err);
  }
};

exports.deleteMeeting = async (req, res, next) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) return res.status(404).json({ message: 'Meeting not found' });
    if (!isHost(meeting, req.user)) return res.status(403).json({ message: 'Only the host can delete a meeting' });
    await Message.deleteMany({ roomId: meeting.roomId });
    await meeting.deleteOne();
    res.json({ message: 'Meeting deleted' });
  } catch (err) {
    next(err);
  }
};
