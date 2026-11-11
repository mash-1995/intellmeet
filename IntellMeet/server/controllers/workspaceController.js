const crypto = require('crypto');
const Workspace = require('../models/Workspace');

const makeCode = () => crypto.randomBytes(3).toString('hex').toUpperCase();

exports.createWorkspace = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ message: 'Workspace name is required' });
    const workspace = await Workspace.create({
      name,
      description,
      owner: req.user.id,
      members: [{ user: req.user.id, role: 'owner' }],
      inviteCode: makeCode(),
    });
    await workspace.populate('members.user', 'name email');
    res.status(201).json(workspace);
  } catch (err) {
    next(err);
  }
};

exports.getWorkspaces = async (req, res, next) => {
  try {
    const workspaces = await Workspace.find({ 'members.user': req.user.id })
      .populate('members.user', 'name email')
      .sort('-createdAt');
    res.json(workspaces);
  } catch (err) {
    next(err);
  }
};

exports.joinWorkspace = async (req, res, next) => {
  try {
    const code = (req.body.inviteCode || '').trim().toUpperCase();
    const workspace = await Workspace.findOne({ inviteCode: code });
    if (!workspace) return res.status(404).json({ message: 'No workspace matches that invite code' });
    const already = workspace.members.some((m) => m.user.toString() === req.user.id);
    if (!already) {
      workspace.members.push({ user: req.user.id });
      await workspace.save();
    }
    await workspace.populate('members.user', 'name email');
    res.json(workspace);
  } catch (err) {
    next(err);
  }
};

exports.leaveWorkspace = async (req, res, next) => {
  try {
    const workspace = await Workspace.findById(req.params.id);
    if (!workspace) return res.status(404).json({ message: 'Workspace not found' });
    if (workspace.owner.toString() === req.user.id) {
      return res.status(400).json({ message: 'Owners cannot leave their own workspace' });
    }
    workspace.members = workspace.members.filter((m) => m.user.toString() !== req.user.id);
    await workspace.save();
    res.json({ message: 'You left the workspace' });
  } catch (err) {
    next(err);
  }
};
