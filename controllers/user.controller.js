const customerModel = require("../models/user.model")
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const jwt = require("jsonwebtoken");
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const JWT_SECRET  = process.env.JWT_SECRET

// Configure multer storage for avatars
const avatarStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join('uploads', 'avatars'))
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname)
        // If JWT contains id, prefer it; else fallback to email safe version
        const userId = (req.user && (req.user.id || req.user._id)) || (req.user && req.user.email ? req.user.email.replace(/[^a-zA-Z0-9]/g, '') : 'unknown')
        cb(null, `user_${userId}_${Date.now()}${ext}`)
    }
})

const uploadAvatar = multer({
    storage: avatarStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype && file.mimetype.startsWith('image/')) {
            return cb(null, true)
        }
        cb(new Error('Only image files are allowed'))
    }
})

const getSignup = (req, res) => {
    res.render('signup');
}

const postRegister = (req, res) => {
    let salt = bcrypt.genSaltSync(10);
    let hashedPassword = bcrypt.hashSync(req.body.password, salt);

    // overwrite the plain password with the hashed one
    req.body.password = hashedPassword;

    console.log(req.body);
    // create a new customer with hashed password
    let newCustomer = new customerModel(req.body);

    newCustomer.save()
        .then(() => {
            newCustomer.password = hashedPassword;
            console.log("Customer registered successfully");

            // res.send("Registration successful!");
            // Transporter means the information about the service you are using to send email
            let transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: 'firola3.falcon@gmail.com',
                    // a special password generated from google account settings not your original password
                    // Step one: Enable 2-step verification
                    // Step two: Generate app password
                    pass: 'pufgemyouvvfxluc'
                }
            });
            // This is the information about the email you are sending
            let mailOptions = {
                from: 'firola3.falcon@gmail.com',
                to: [req.body.email], // list of receivers
                subject: 'Welcome to Our Application',

                // You can also send HTML formatted emails
                html: `
                                    <div style="background: #f4f6fb; padding: 40px 0; font-family: 'Segoe UI', Arial, sans-serif;">
                                        <div style="max-width: 480px; margin: auto; background: #fff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); overflow: hidden;">
                                            <div style="background: linear-gradient(90deg, #39d353 60%, #2ecc40 100%); padding: 24px 32px; color: #fff; text-align: center;">
                                                <h1 style="margin: 0; font-size: 2rem; font-weight: 700; letter-spacing: 1px;">Welcome to OlaTube</h1>
                                            </div>
                                            <div style="padding: 32px 32px 24px 32px; text-align: center;">
                                                <p style="font-size: 1.1rem; margin-bottom: 16px; color: #333;">🎉 <strong>Congratulations!</strong> Your sign-up was successful!</p>
                                                <p style="font-size: 1rem; margin-bottom: 16px; color: #555;">Thank you for registering. We are excited to have you on board.</p>
                                                <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
                                                <p style="font-size: 0.95rem; color: #888;">Best Regards,<br><span style="font-weight: 600; color: #39d353;">Your Application Team</span></p>
                                            </div>
                                        </div>
                                    </div>
                                    `
            };

            // This is what will actually send the email
            transporter.sendMail(mailOptions, function (error, info) {
                if (error) {
                    console.log(error);
                } else {
                    console.log('Email sent: ' + info.response);
                }
            });

            res.redirect("/user/signin");
        })
        .catch((err) => {
            console.error("Error registering customer:", err);
            // res.status(500).send("Internal server error");
        });
}

const getSignIn = (req, res) => {
    res.render('signin');
}

const postLogin = (req, res) => {
    const { email, password } = req.body;

    console.log("Login form submitted data:", req.body);

    customerModel.findOne({ email })
        .then((foundCustomer) => {
            if (!foundCustomer) {
                console.log("Invalid email");
                return res.status(400).json({ message: "Invalid email or password" });
            }

            // Compare provided password with hashed one
            const isMatch = bcrypt.compareSync(password, foundCustomer.password);

            if (!isMatch) {
                console.log("Invalid password");
                return res.status(400).json({ message: "Invalid email or password" });
            }

            // ✅ Success
            console.log("Login successful for:", foundCustomer.email);
            const token = jwt.sign({ id: foundCustomer._id, email: foundCustomer.email }, JWT_SECRET, { expiresIn: "1h" });
            console.log("Generated JWT:", token);
            return res.json({
                message: "Login successful",
                user: {
                    id: foundCustomer._id,
                    firstName: foundCustomer.firstName,
                    email: foundCustomer.email,
                    token: token
                }
            });
            // On successful login, redirect to dashboard
            return res.redirect("/user/dashboard");
        })

        .catch((err) => {
            console.error("Error logging in:", err);
            res.status(500).json({ message: "Internal server error" });
        });
};


// const getDashboard = (req, res) => {
//     customerModel.find()
//         .then((allCustomers) => {
//             console.log(allCustomers);
//             res.render('index', { allCustomers });
//         })
//         .catch((err) => {
//             console.error("Error fetching customers:", err);
//             res.status(500).send("Internal server error");
//         });
// }

const getDashboard = (req, res) => {
    customerModel.find()
        .then((allCustomers) => {
            res.render('index', { allCustomers });
        })
        .catch((err) => {
            console.error("Error fetching customers:", err);
            res.status(500).send("Internal server error");
        });
}

module.exports = { getSignup, postRegister, getSignIn, postLogin, getDashboard }

// Profile APIs (JSON): expect JWT auth upstream
const getProfile = async (req, res) => {
    try {
        const userId = req.user.id
        const user = await customerModel.findById(userId).select('_id firstName lastName name handle profilePictureUrl')
        if (!user) return res.status(404).json({ success: false, message: 'User not found' })
        res.json({ success: true, data: user })
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch profile' })
    }
}

const updateProfile = async (req, res) => {
    try {
        const userId = req.user.id
        const { name, handle } = req.body

        if (handle) {
            const existing = await customerModel.findOne({ handle, _id: { $ne: userId } }).select('_id')
            if (existing) {
                return res.status(400).json({ success: false, message: 'Handle is already taken' })
            }
        }

        await customerModel.findByIdAndUpdate(userId, { name, handle }, { new: false })
        res.json({ success: true, message: 'Profile updated successfully' })
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update profile' })
    }
}

const uploadAvatarHandler = [
    uploadAvatar.single('avatar'),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ success: false, message: 'No file uploaded' })
            }
            const userId = req.user.id
            const profilePictureUrl = `/uploads/avatars/${req.file.filename}`

            await customerModel.findByIdAndUpdate(userId, { profilePictureUrl })
            res.json({ success: true, message: 'Avatar uploaded successfully', data: { profilePictureUrl } })
        } catch (error) {
            res.status(500).json({ success: false, message: 'Failed to upload avatar' })
        }
    }
]

const deleteAvatar = async (req, res) => {
    try {
        const userId = req.user.id
        const user = await customerModel.findById(userId).select('profilePictureUrl')
        if (user && user.profilePictureUrl) {
            const fileName = user.profilePictureUrl.split('/').pop()
            const filePath = path.join('uploads', 'avatars', fileName)
            if (fs.existsSync(filePath)) {
                try { fs.unlinkSync(filePath) } catch (_) {}
            }
        }
        await customerModel.findByIdAndUpdate(userId, { profilePictureUrl: null })
        res.json({ success: true, message: 'Avatar deleted successfully' })
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete avatar' })
    }
}

module.exports.profile = { getProfile, updateProfile, uploadAvatarHandler, deleteAvatar }

// Subscription APIs
const subscribeToChannel = async (req, res) => {
    try {
        const userId = req.user.id;
        const { channelId, channelTitle, channelThumbnail } = req.body;

        if (!channelId || !channelTitle || !channelThumbnail) {
            return res.status(400).json({ success: false, message: 'Channel data is required' });
        }

        // Check if already subscribed
        const user = await customerModel.findById(userId);
        const isAlreadySubscribed = user.subscriptions.some(sub => sub.channelId === channelId);

        if (isAlreadySubscribed) {
            return res.status(400).json({ success: false, message: 'Already subscribed to this channel' });
        }

        // Add subscription and increment notifications
        await customerModel.findByIdAndUpdate(userId, {
            $push: { subscriptions: { channelId, channelTitle, channelThumbnail } },
            $inc: { unreadNotifications: 1 }
        });

        res.json({ success: true, message: 'Subscribed successfully' });
    } catch (error) {
        console.error('Error subscribing to channel:', error);
        res.status(500).json({ success: false, message: 'Failed to subscribe' });
    }
};

const unsubscribeFromChannel = async (req, res) => {
    try {
        const userId = req.user.id;
        const { channelId } = req.params;

        if (!channelId) {
            return res.status(400).json({ success: false, message: 'Channel ID is required' });
        }

        // Remove subscription
        const result = await customerModel.findByIdAndUpdate(userId, {
            $pull: { subscriptions: { channelId } }
        });

        if (!result) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({ success: true, message: 'Unsubscribed successfully' });
    } catch (error) {
        console.error('Error unsubscribing from channel:', error);
        res.status(500).json({ success: false, message: 'Failed to unsubscribe' });
    }
};

const getSubscriptions = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await customerModel.findById(userId).select('subscriptions unreadNotifications');

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({
            success: true,
            subscriptions: user.subscriptions,
            unreadNotifications: user.unreadNotifications
        });
    } catch (error) {
        console.error('Error fetching subscriptions:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch subscriptions' });
    }
};

const resetNotifications = async (req, res) => {
    try {
        const userId = req.user.id;

        await customerModel.findByIdAndUpdate(userId, { unreadNotifications: 0 });

        res.json({ success: true, message: 'Notifications reset successfully' });
    } catch (error) {
        console.error('Error resetting notifications:', error);
        res.status(500).json({ success: false, message: 'Failed to reset notifications' });
    }
};

module.exports.subscriptions = { subscribeToChannel, unsubscribeFromChannel, getSubscriptions, resetNotifications };

