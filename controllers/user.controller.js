const customerModel = require("../models/user.model");
const nodemailer = require("nodemailer");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const JWT_SECRET = process.env.JWT_SECRET;

// === Multer Setup for Avatar Uploads ===
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join("uploads", "avatars"));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const userId =
      (req.user && (req.user.id || req.user._id)) ||
      (req.user?.email ? req.user.email.replace(/[^a-zA-Z0-9]/g, "") : "unknown");
    cb(null, `user_${userId}_${Date.now()}${ext}`);
  },
});

const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith("image/")) return cb(null, true);
    cb(new Error("Only image files are allowed"));
  },
});

// === REGISTER USER ===
const postRegister = async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existingUser = await customerModel.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newCustomer = new customerModel({
      firstName,
      lastName,
      email,
      password: hashedPassword,
    });

    await newCustomer.save();
    console.log("✅ Customer registered successfully");

    // Send Welcome Email
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "firola3.falcon@gmail.com",
        pass: "pufgemyouvvfxluc", // ⚠️ Consider moving this to process.env
      },
    });

    const mailOptions = {
      from: "firola3.falcon@gmail.com",
      to: [email],
      subject: "Welcome to OlaTube",
      html: `
        <div style="background: #f4f6fb; padding: 40px; font-family: 'Segoe UI', sans-serif;">
          <div style="max-width: 480px; margin: auto; background: #fff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
            <div style="background: linear-gradient(90deg, #39d353 60%, #2ecc40 100%); padding: 24px; color: #fff; text-align: center;">
              <h1>Welcome to OlaTube</h1>
            </div>
            <div style="padding: 24px; text-align: center;">
              <p>🎉 <strong>Congratulations!</strong> Your sign-up was successful!</p>
              <p>Thank you for registering. We’re excited to have you on board.</p>
            </div>
          </div>
        </div>`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) console.error("Email error:", error);
      else console.log("Email sent:", info.response);
    });

    res.status(201).json({ message: "Signup successful!" });
  } catch (err) {
    console.error("Error registering customer:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

// === LOGIN USER ===
const postLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const foundCustomer = await customerModel.findOne({ email });

    if (!foundCustomer)
      return res.status(400).json({ message: "Invalid email or password" });

    const isMatch = await bcrypt.compare(password, foundCustomer.password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid email or password" });

    const token = jwt.sign(
      { id: foundCustomer._id, email: foundCustomer.email },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({
      message: "Login successful",
      user: {
        id: foundCustomer._id,
        firstName: foundCustomer.firstName,
        lastName: foundCustomer.lastName,
        email: foundCustomer.email,
        token,
      },
    });
  } catch (err) {
    console.error("Error logging in:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

// === GET ALL USERS (Dashboard Example) ===
const getDashboard = async (req, res) => {
  try {
    const users = await customerModel.find();
    res.json({ success: true, users });
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// === PROFILE ENDPOINTS ===
const getProfile = async (req, res) => {
  try {
    const user = await customerModel
      .findById(req.user.id)
      .select("_id firstName lastName email profilePictureUrl");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    res.json({ success: true, data: user });
  } catch {
    res.status(500).json({ success: false, message: "Failed to fetch profile" });
  }
};

const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { firstName, lastName } = req.body;
    await customerModel.findByIdAndUpdate(userId, { firstName, lastName });
    res.json({ success: true, message: "Profile updated successfully" });
  } catch {
    res.status(500).json({ success: false, message: "Failed to update profile" });
  }
};

const uploadAvatarHandler = [
  uploadAvatar.single("avatar"),
  async (req, res) => {
    try {
      if (!req.file)
        return res.status(400).json({ success: false, message: "No file uploaded" });

      const userId = req.user.id;
      const profilePictureUrl = `/uploads/avatars/${req.file.filename}`;
      await customerModel.findByIdAndUpdate(userId, { profilePictureUrl });

      res.json({
        success: true,
        message: "Avatar uploaded successfully",
        data: { profilePictureUrl },
      });
    } catch {
      res.status(500).json({ success: false, message: "Failed to upload avatar" });
    }
  },
];

const deleteAvatar = async (req, res) => {
  try {
    const user = await customerModel.findById(req.user.id).select("profilePictureUrl");
    if (user?.profilePictureUrl) {
      const filePath = path.join("uploads", "avatars", path.basename(user.profilePictureUrl));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      await customerModel.findByIdAndUpdate(req.user.id, { profilePictureUrl: null });
    }
    res.json({ success: true, message: "Avatar deleted successfully" });
  } catch {
    res.status(500).json({ success: false, message: "Failed to delete avatar" });
  }
};

// === SUBSCRIPTIONS ===
const subscribeToChannel = async (req, res) => {
  try {
    const userId = req.user.id;
    const { channelId, channelTitle, channelThumbnail } = req.body;

    if (!channelId || !channelTitle || !channelThumbnail)
      return res.status(400).json({ success: false, message: "Channel data required" });

    const user = await customerModel.findById(userId);
    if (user.subscriptions.some((sub) => sub.channelId === channelId))
      return res.status(400).json({ success: false, message: "Already subscribed" });

    await customerModel.findByIdAndUpdate(userId, {
      $push: { subscriptions: { channelId, channelTitle, channelThumbnail } },
      $inc: { unreadNotifications: 1 },
    });

    res.json({ success: true, message: "Subscribed successfully" });
  } catch {
    res.status(500).json({ success: false, message: "Failed to subscribe" });
  }
};

const unsubscribeFromChannel = async (req, res) => {
  try {
    const userId = req.user.id;
    const { channelId } = req.params;
    await customerModel.findByIdAndUpdate(userId, {
      $pull: { subscriptions: { channelId } },
    });
    res.json({ success: true, message: "Unsubscribed successfully" });
  } catch {
    res.status(500).json({ success: false, message: "Failed to unsubscribe" });
  }
};

const getSubscriptions = async (req, res) => {
  try {
    const user = await customerModel
      .findById(req.user.id)
      .select("subscriptions unreadNotifications");
    res.json({ success: true, data: user });
  } catch {
    res.status(500).json({ success: false, message: "Failed to fetch subscriptions" });
  }
};

const resetNotifications = async (req, res) => {
  try {
    await customerModel.findByIdAndUpdate(req.user.id, { unreadNotifications: 0 });
    res.json({ success: true, message: "Notifications reset" });
  } catch {
    res.status(500).json({ success: false, message: "Failed to reset notifications" });
  }
};

// === EXPORTS ===
module.exports = {
  postRegister,
  postLogin,
  getDashboard,
  profile: { getProfile, updateProfile, uploadAvatarHandler, deleteAvatar },
  subscriptions: {
    subscribeToChannel,
    unsubscribeFromChannel,
    getSubscriptions,
    resetNotifications,
  },
};
