const router = require('express').Router();
const c = require('../controllers/workspaceController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.route('/').get(c.getWorkspaces).post(c.createWorkspace);
router.post('/join', c.joinWorkspace);
router.delete('/:id/leave', c.leaveWorkspace);

module.exports = router;
