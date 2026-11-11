const mongoose = require('mongoose');

const transcriptSchema = new mongoose.Schema(
  {
    speaker: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    speakerName: String,
    text: { type: String, required: true },
    at: { type: Date, default: Date.now },
  },
  { _id: true }
);

const actionItemSchema = new mongoose.Schema({
  task: { type: String, required: true },
  assignee: { type: String, default: '' },
  dueDate: { type: String, default: '' },
  done: { type: Boolean, default: false },
});

const meetingSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    host: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', default: null },
    roomId: { type: String, required: true, unique: true, index: true },
    scheduledAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['scheduled', 'live', 'ended'], default: 'scheduled' },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    startedAt: Date,
    endedAt: Date,
    transcript: [transcriptSchema],
    summary: { type: String, default: '' },
    keyPoints: [String],
    decisions: [String],
    actionItems: [actionItemSchema],
    summaryGeneratedAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Meeting', meetingSchema);
