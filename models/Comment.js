const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  videoId: {
    type: String,
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer', // Matches your User model name
    required: true
  },
  text: {
    type: String,
    required: true,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for efficient queries
commentSchema.index({ videoId: 1, createdAt: -1 });

module.exports = mongoose.model('Comment', commentSchema);
