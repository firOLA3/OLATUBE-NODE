const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { profile, subscriptions } = require('../controllers/user.controller');

const router = express.Router();


router.get('/profile', authenticateToken, profile.getProfile);

router.put('/profile', authenticateToken, profile.updateProfile);

router.post('/upload-avatar', authenticateToken, profile.uploadAvatarHandler);

router.post('/avatar', authenticateToken, profile.uploadAvatarHandler);


router.delete('/avatar', authenticateToken, profile.deleteAvatar);

router.post('/subscribe', authenticateToken, subscriptions.subscribeToChannel);


router.delete('/unsubscribe/:channelId', authenticateToken, subscriptions.unsubscribeFromChannel);


router.get('/subscriptions', authenticateToken, subscriptions.getSubscriptions);


router.post('/reset-notifications', authenticateToken, subscriptions.resetNotifications);

module.exports = router;


