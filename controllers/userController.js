import User from "../models/user.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import axios from "axios";
import OTP from "../models/otp.js";
import transporter from "../utils/emailTransporter.js";

dotenv.config();

const BRAND_NAME = "Dmaxx Infinity of Fashions";

function buildTokenPayload(user) {
  return {
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    image: user.image,
    emailVerified: user.isEmailVerified,
    isAdmin: user.isAdmin,
    isBlocked: user.isBlocked,
  };
}

function sanitizeUser(userDoc) {
  if (!userDoc) return null;
  const obj = typeof userDoc.toObject === "function" ? userDoc.toObject() : { ...userDoc };
  delete obj.password;
  return obj;
}

export function isAdmin(req) {
  if (!req?.user) return false;
  return Boolean(req.user.isAdmin);
}

export async function createUser(req, res) {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const firstName = req.body.firstName?.trim();
    const lastName = req.body.lastName?.trim();
    const password = req.body.password;

    if (!email || !firstName || !password) {
      return res.status(400).json({ message: "First name, email, and password are required" });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const existingUser = await User.findOne({ email }).lean();
    if (existingUser) {
      return res.status(409).json({ message: "An account with this email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = new User({
      email,
      firstName,
      lastName: lastName || "",
      password: passwordHash,
    });

    await user.save();

    return res.status(201).json({
      message: "User created successfully",
      user: sanitizeUser(user),
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: "An account with this email already exists" });
    }
    console.error("Error creating user:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function loginUser(req, res) {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    const user = await User.findOne({ email });
    if (user == null) {
      return res.status(404).json({ message: "User does not exist" });
    }

    if (user.isBlocked) {
      return res.status(403).json({ message: "User is blocked" });
    }

    const isPasswordMatching = await bcrypt.compare(password, user.password);
    if (!isPasswordMatching) {
      return res.status(401).json({ message: "Invalid password" });
    }

    const token = jwt.sign(buildTokenPayload(user), process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    return res.json({
      token,
      isAdmin: user.isAdmin,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error("Error logging in user:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function getAllUsers(req, res) {
  if (!isAdmin(req)) {
    return res.status(403).json({ message: "You are not authorized to view all users" });
  }

  const pageSize = Math.max(1, parseInt(req.params.pageSize || req.query.pageSize || "10", 10) || 10);
  const pageNumber = Math.max(1, parseInt(req.params.pageNumber || req.query.pageNumber || "1", 10) || 1);
  const skipCount = (pageNumber - 1) * pageSize;

  try {
    const [totalUserCount, users] = await Promise.all([
      User.countDocuments(),
      User.find().select("-password").skip(skipCount).limit(pageSize).lean(),
    ]);

    const totalPages = Math.ceil(totalUserCount / pageSize);

    return res.json({
      users,
      totalPages,
      currentPage: pageNumber,
      totalCount: totalUserCount,
    });
  } catch (error) {
    console.error("Error getting all users:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function updateUserStatus(req, res) {
  if (!isAdmin(req)) {
    return res.status(403).json({ message: "You are not authorized to update user status" });
  }

  const email = req.body.email?.trim().toLowerCase();
  const isBlocked = Boolean(req.body.isBlocked);

  try {
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    if (email === req.user.email?.trim().toLowerCase()) {
      return res.status(400).json({ message: "You cannot update your own status" });
    }

    const updatedUser = await User.findOneAndUpdate(
      { email },
      { $set: { isBlocked } },
      { new: true }
    )
      .select("-password")
      .lean();

    if (updatedUser == null) {
      return res.status(404).json({ message: "User does not exist" });
    }

    return res.json({
      message: "User status updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error updating user status:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function updateUserRole(req, res) {
  if (!isAdmin(req)) {
    return res.status(403).json({ message: "You are not authorized to update user role" });
  }

  const email = req.body.email?.trim().toLowerCase();
  const isAdminRole = Boolean(req.body.isAdmin);

  try {
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    if (email === req.user.email?.trim().toLowerCase()) {
      return res.status(400).json({ message: "You cannot update your own role" });
    }

    const updatedUser = await User.findOneAndUpdate(
      { email },
      { $set: { isAdmin: isAdminRole } },
      { new: true }
    )
      .select("-password")
      .lean();

    if (updatedUser == null) {
      return res.status(404).json({ message: "User does not exist" });
    }

    return res.json({
      message: "User role updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error updating user role:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function getCurrentUser(req, res) {
  if (req.user == null) {
    return res.status(401).json({ message: "You are not logged in" });
  }

  try {
    const user = await User.findOne({ email: req.user.email.trim().toLowerCase() })
      .select("-password")
      .lean();

    if (user == null) {
      return res.status(404).json({ message: "User does not exist" });
    }

    return res.json({ user });
  } catch (error) {
    console.error("Error getting current user:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function updateUserProfile(req, res) {
  if (req.user == null) {
    return res.status(401).json({ message: "You are not logged in" });
  }

  try {
    const updateFields = {};
    if (req.body.firstName !== undefined) {
      updateFields.firstName = String(req.body.firstName).trim();
    }
    if (req.body.lastName !== undefined) {
      updateFields.lastName = String(req.body.lastName).trim();
    }
    if (req.body.image !== undefined) {
      updateFields.image = req.body.image;
    }

    const updatedUser = await User.findOneAndUpdate(
      { email: req.user.email.trim().toLowerCase() },
      { $set: updateFields },
      { new: true }
    )
      .select("-password")
      .lean();

    if (updatedUser == null) {
      return res.status(404).json({ message: "User does not exist" });
    }

    return res.json({
      message: "User profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error updating user profile:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function updateUserPassword(req, res) {
  if (req.user == null) {
    return res.status(401).json({ message: "You are not logged in" });
  }

  try {
    const newPassword = req.body.password;
    if (!newPassword || String(newPassword).length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const updatedUser = await User.findOneAndUpdate(
      { email: req.user.email.trim().toLowerCase() },
      { $set: { password: hashedPassword } },
      { new: true }
    ).lean();

    if (updatedUser == null) {
      return res.status(404).json({ message: "User does not exist" });
    }

    return res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Error updating user password:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function googleLogin(req, res) {
  const accessToken = req.body.accessToken;
  if (!accessToken) {
    return res.status(400).json({ message: "Google access token is required" });
  }

  try {
    const googleResponse = await axios.get("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const email = googleResponse.data.email?.trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ message: "Google account email not available" });
    }

    let user = await User.findOne({ email });

    if (user == null) {
      const randomPassword = Math.random().toString(36).slice(-10);
      const passwordHash = await bcrypt.hash(randomPassword, 10);

      user = new User({
        email,
        firstName: googleResponse.data.given_name?.trim() || "Dmaxx",
        lastName: googleResponse.data.family_name?.trim() || "Member",
        password: passwordHash,
        image: googleResponse.data.picture || "/images/default-profile.png",
        isEmailVerified: Boolean(googleResponse.data.email_verified),
      });

      await user.save();
    } else if (user.isBlocked) {
      return res.status(403).json({ message: "User is blocked" });
    }

    const token = jwt.sign(buildTokenPayload(user), process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    return res.json({
      token,
      isAdmin: user.isAdmin,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error("Error logging in with Google:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function sendOTP(req, res) {
  try {
    const email = req.body.email?.trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email }).lean();
    if (user == null) {
      return res.status(404).json({ message: "Account not found" });
    }

    if (user.isBlocked) {
      return res.status(403).json({ message: "User is blocked" });
    }

    await OTP.findOneAndDelete({ email });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otp, 10);

    await new OTP({
      email,
      otp: otpHash,
      time: new Date(),
    }).save();

    const message = {
      from: process.env.EMAIL,
      to: email,
      subject: `Your OTP for ${BRAND_NAME}`,
      text: `Your OTP for ${BRAND_NAME} is: ${otp}. It is valid for 5 minutes.`,
    };

    transporter.sendMail(message, (error, info) => {
      if (error) {
        console.error("Error sending OTP email:", error);
        return res.status(500).json({ message: "Failed to send OTP email" });
      }
      console.log("OTP email sent:", info.response);
      return res.json({ message: "OTP sent successfully" });
    });
  } catch (error) {
    console.error("Error sending OTP:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function resetPassword(req, res) {
  const email = req.body.email?.trim().toLowerCase();
  const otp = req.body.otp?.trim();
  const newPassword = req.body.newPassword;

  if (!email || !otp || !newPassword) {
    return res.status(400).json({ message: "Email, OTP, and new password required" });
  }

  if (String(newPassword).length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters" });
  }

  try {
    const otpRecord = await OTP.findOne({ email });
    if (otpRecord == null) {
      return res.status(404).json({ message: "OTP not found" });
    }

    const currentTime = new Date();
    const otpCreationTime = new Date(otpRecord.time);
    const timeDifferenceInMinutes = (currentTime - otpCreationTime) / (1000 * 60);

    if (timeDifferenceInMinutes > 5) {
      await OTP.findOneAndDelete({ email });
      return res.status(400).json({ message: "OTP has expired" });
    }

    const isOTPValid = await bcrypt.compare(otp, otpRecord.otp);
    if (!isOTPValid) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await User.findOneAndUpdate({ email }, { $set: { password: hashedPassword } });
    await OTP.findOneAndDelete({ email });

    return res.json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("Error resetting password:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function getUserCart(req, res) {
  if (req.user == null) {
    return res.status(401).json({ message: "You are not logged in" });
  }

  try {
    const user = await User.findOne({ email: req.user.email.trim().toLowerCase() })
      .populate("cart.product")
      .lean();

    if (user == null) {
      return res.status(404).json({ message: "User does not exist" });
    }

    return res.json({ cart: user.cart || [] });
  } catch (error) {
    console.error("Error getting user cart:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function updateUserCart(req, res) {
  if (req.user == null) {
    return res.status(401).json({ message: "You are not logged in" });
  }

  try {
    const rawCart = Array.isArray(req.body.cart) ? req.body.cart : [];

    const normalizedCart = rawCart
      .map((item) => {
        const productRef =
          typeof item?.product === "object" && item?.product?._id
            ? item.product._id
            : item?.product || item?.productId || item?._id;

        if (!productRef) return null;

        return {
          product: productRef,
          size: item?.size ? String(item.size).trim() : "",
          color: item?.color ? String(item.color).trim() : "",
          qty: Math.max(1, Number(item?.qty) || 1),
        };
      })
      .filter(Boolean);

    const updatedUser = await User.findOneAndUpdate(
      { email: req.user.email.trim().toLowerCase() },
      { $set: { cart: normalizedCart } },
      { new: true }
    )
      .populate("cart.product")
      .lean();

    if (updatedUser == null) {
      return res.status(404).json({ message: "User does not exist" });
    }

    return res.json({
      message: "Cart updated successfully",
      cart: updatedUser.cart || [],
    });
  } catch (error) {
    console.error("Error updating user cart:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function getUserWishlist(req, res) {
  if (req.user == null) {
    return res.status(401).json({ message: "You are not logged in" });
  }

  try {
    const user = await User.findOne({ email: req.user.email.trim().toLowerCase() })
      .select("wishlist")
      .lean();

    if (user == null) {
      return res.status(404).json({ message: "User does not exist" });
    }

    return res.json({ wishlist: user.wishlist || [] });
  } catch (error) {
    console.error("Error getting wishlist:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function toggleUserWishlist(req, res) {
  if (req.user == null) {
    return res.status(401).json({ message: "You are not logged in" });
  }

  try {
    const productId = String(req.body.productId || "").trim();
    if (!productId) {
      return res.status(400).json({ message: "productId is required" });
    }

    const user = await User.findOne({ email: req.user.email.trim().toLowerCase() });
    if (user == null) {
      return res.status(404).json({ message: "User does not exist" });
    }

    const currentWishlist = Array.isArray(user.wishlist) ? [...user.wishlist] : [];
    const existsIndex = currentWishlist.indexOf(productId);

    if (existsIndex > -1) {
      currentWishlist.splice(existsIndex, 1);
    } else {
      currentWishlist.push(productId);
    }

    user.wishlist = currentWishlist;
    await user.save();

    return res.json({
      message: "Wishlist updated",
      wishlist: user.wishlist,
    });
  } catch (error) {
    console.error("Error updating wishlist:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}