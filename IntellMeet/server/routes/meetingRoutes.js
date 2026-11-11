const router = require('express').Router();
const c = require('../controllers/meetingController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.route('/').get(c.getMeetings).post(c.createMeeting);
router.get('/room/:roomId', c.getMeetingByRoom);
router.route('/:id').get(c.getMeeting).delete(c.deleteMeeting);
router.patch('/:id/end', c.endMeeting);
router.post('/:id/summarize', c.summarize);
router.get('/:id/messages', c.getMessages);
router.get('/:id/transcript', c.getTranscript);
router.patch('/:id/action-items/:itemId', c.toggleActionItem);

module.exports = router;
