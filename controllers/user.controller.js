const customerModel = require("../models/user.model");
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const jwt = require("jsonwebtoken");
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const JWT_SECRET = process.env.JWT_SECRET;

// Configure multer storage for avatars
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join('uploads', 'avatars'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const userId =
      (req.user && (req.user.id || req.user._id)) ||
      (req.user && req.user.email
        ? req.user.email.replace(/[^a-zA-Z0-9]/g, '')
        : 'unknown');
    cb(null, `user_${userId}_${Date.now()}${ext}`);
  },
});

const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed'));
  },
});

// ============================
// 🌟 SIGNUP & LOGIN (React API)
// ============================

const getSignup = (req, res) => {
  res.json({ message: "Signup endpoint active" });
};

const postRegister = async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    const existingUser = await customerModel.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(password, salt);

    const newCustomer = new customerModel({
      firstName,
      lastName,
      email,
      password: hashedPassword,
    });

    await newCustomer.save();

    console.log("Customer registered successfully");

    // Send welcome email
    let transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'firola3.falcon@gmail.com',
        pass: 'pufgemyouvvfxluc', // ⚠️ move this to process.env later
      },
    });

    let mailOptions = {
      from: 'firola3.falcon@gmail.com',
      to: [email],
      subject: 'Welcome to Our Application',
      html: `
        <div style="background:#f4f6fb;padding:40px 0;font-family:'Segoe UI',Arial,sans-serif;">
          <div style="max-width:480px;margin:auto;background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.08);overflow:hidden;">
            <div style="background:linear-gradient(90deg,#39d353 60%,#2ecc40 100%);padding:24px 32px;color:#fff;text-align:center;">
              <h1 style="margin:0;font-size:2rem;font-weight:700;">Welcome to OlaTube</h1>
            </div>
            <div style="padding:32px;text-align:center;">
              <p style="font-size:1.1rem;margin-bottom:16px;color:#333;">🎉 <strong>Congratulations!</strong> Your sign-up was successful!</p>
              <p style="font-size:1rem;margin-bottom:16px;color:#555;">Thank you for registering. We are excited to have you on board.</p>
              <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
              <p style="font-size:0.95rem;color:#888;">Best Regards,<br><span style="font-weight:600;color:#39d353;">Your Application Team</span></p>
            </div>
          </div>
        </div>
      `,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) console.log(error);
      else console.log('Email sent:', info.response);
    });

    return res.status(201).json({ message: "Signup successful! Please login." });
  } catch (err) {
    console.error("Error registering customer:", err);
    return res.status(500).json({ message: "Signup failed" });
  }
};

const getSignIn = (req, res) => {
  res.json({ message: "Signin endpoint active" });
};

const postLogin = (req, res) => {
  const { email, password } = req.body;

  customerModel.findOne({ email })
    .then((foundCustomer) => {
      if (!foundCustomer) {
        return res.status(400).json({ message: "Invalid email or password" });
      }

      const isMatch = bcrypt.compareSync(password, foundCustomer.password);
      if (!isMatch) {
        return res.status(400).json({ message: "Invalid email or password" });
      }

      const token = jwt.sign(
        { id: foundCustomer._id, email: foundCustomer.email },
        JWT_SECRET,
        { expiresIn: "1h" }
      );

      console.log("Login successful for:", foundCustomer.email);
      return res.status(200).json({
        message: "Login successful",
        user: {
          id: foundCustomer._id,
          firstName: foundCustomer.firstName,
          email: foundCustomer.email,
          token: token,
        },
      });
    })
    .catch((err) => {
      console.error("Error logging in:", err);
      res.status(500).json({ message: "Internal server error" });
    });
};

const getDashboard = async (req, res) => {
  try {
    const allCustomers = await customerModel.find();
    res.json({ message: "Dashboard data", allCustomers });
  } catch (err) {
    console.error("Error fetching customers:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ============================
// 🌟 PROFILE & SUBSCRIPTIONS
// ============================

const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await customerModel.findById(userId).select('_id firstName lastName name handle profilePictureUrl');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch profile' });
  }
};

const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, handle } = req.body;

    if (handle) {
      const existing = await customerModel.findOne({ handle, _id: { $ne: userId } }).select('_id');
      if (existing) {
        return res.status(400).json({ success: false, message: 'Handle is already taken' });
      }
    }

    await customerModel.findByIdAndUpdate(userId, { name, handle }, { new: false });
    res.json({ success: true, message: 'Profile updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
};

const uploadAvatarHandler = [
  uploadAvatar.single('avatar'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
      }
      const userId = req.user.id;
      const profilePictureUrl = `/uploads/avatars/${req.file.filename}`;

      await customerModel.findByIdAndUpdate(userId, { profilePictureUrl });
      res.json({ success: true, message: 'Avatar uploaded successfully', data: { profilePictureUrl } });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to upload avatar' });
    }
  },
];

const deleteAvatar = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await customerModel.findById(userId).select('profilePictureUrl');
    if (user && user.profilePictureUrl) {
      const fileName = user.profilePictureUrl.split('/').pop();
      const filePath = path.join('uploads', 'avatars', fileName);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (_) {}
      }
    }
    await customerModel.findByIdAndUpdate(userId, { profilePictureUrl: null });
    res.json({ success: true, message: 'Avatar deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete avatar' });
  }
};

// ============================
// 🌟 SUBSCRIPTIONS
// ============================

const subscribeToChannel = async (req, res) => {
  try {
    const userId = req.user.id;
    const { channelId, channelTitle, channelThumbnail } = req.body;

    if (!channelId || !channelTitle || !channelThumbnail) {
      return res.status(400).json({ success: false, message: 'Channel data is required' });
    }

    const user = await customerModel.findById(userId);
    const isAlreadySubscribed = user.subscriptions.some(sub => sub.channelId === channelId);

    if (isAlreadySubscribed) {
      return res.status(400).json({ success: false, message: 'Already subscribed to this channel' });
    }

    await customerModel.findByIdAndUpdate(userId, {
      $push: { subscriptions: { channelId, channelTitle, channelThumbnail } },
      $inc: { unreadNotifications: 1 },
    });

    res.json({ success: true, message: 'Subscribed successfully' });
  } catch (error) {
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

    const result = await customerModel.findByIdAndUpdate(userId, {
      $pull: { subscriptions: { channelId } },
    });

    if (!result) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, message: 'Unsubscribed successfully' });
  } catch (error) {
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
      unreadNotifications: user.unreadNotifications,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch subscriptions' });
  }
};

const resetNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    await customerModel.findByIdAndUpdate(userId, { unreadNotifications: 0 });
    res.json({ success: true, message: 'Notifications reset successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to reset notifications' });
  }
};

module.exports = {
  getSignup,
  postRegister,
  getSignIn,
  postLogin,
  getDashboard,
  profile: { getProfile, updateProfile, uploadAvatarHandler, deleteAvatar },
  subscriptions: { subscribeToChannel, unsubscribeFromChannel, getSubscriptions, resetNotifications },
};
