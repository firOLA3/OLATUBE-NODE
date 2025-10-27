const Comment = require('../models/Comment');
const customerModel = require('../models/user.model');

const createComment = async (req, res) => {
  try {
    const { videoId, commentText } = req.body;
    const userId = req.user.id; // From auth middleware

    // Validate input
    if (!videoId || !commentText || !commentText.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Video ID and comment text are required'
      });
    }

    // Verify user exists
    const user = await customerModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Create comment
    const comment = new Comment({
      videoId,
      userId,
      text: commentText.trim()
    });

    await comment.save();

    res.status(201).json({
      success: true,
      message: 'Comment posted successfully',
      comment: {
        id: comment._id,
        videoId: comment.videoId,
        text: comment.text,
        createdAt: comment.createdAt,
        user: {
          id: user._id,
          name: user.name || `${user.firstName} ${user.lastName}`,
          profilePictureUrl: user.profilePictureUrl
        }
      }
    });

  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to post comment'
    });
  }
};

const getComments = async (req, res) => {
  try {
    const { videoId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const comments = await Comment.find({ videoId })
      .populate('userId', 'firstName lastName name profilePictureUrl')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Comment.countDocuments({ videoId });

    res.json({
      success: true,
      comments: comments.map(comment => ({
        id: comment._id,
        text: comment.text,
        createdAt: comment.createdAt,
        user: {
          id: comment.userId._id,
          name: comment.userId.name || `${comment.userId.firstName} ${comment.userId.lastName}`,
          profilePictureUrl: comment.userId.profilePictureUrl
        }
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch comments'
    });
  }
};

module.exports = {
  createComment,
  getComments
};
