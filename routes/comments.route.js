const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { createComment, getComments } = require('../controllers/comment.controller');

// POST /api/comments - Create new comment
router.post('/', authenticateToken, createComment);

// GET /api/comments/:videoId - Get comments for a video
router.get('/:videoId', getComments);

module.exports = router;
