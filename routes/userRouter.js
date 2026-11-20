import express from "express";
import {
  createUser,
  getAllUsers,
  getCurrentUser,
  getUserCart,
  getUserWishlist,
  googleLogin,
  loginUser,
  resetPassword,
  sendOTP,
  toggleUserWishlist,
  updateUserCart,
  updateUserPassword,
  updateUserProfile,
  updateUserRole,
  updateUserStatus,
} from "../controllers/userController.js";

const userRouter = express.Router();

// Auth & account routes
userRouter.get("/me", getCurrentUser);
userRouter.post("/", createUser);
userRouter.post("/register", createUser);
userRouter.post("/login", loginUser);
userRouter.post("/google", googleLogin);
userRouter.post("/otp", sendOTP);
userRouter.post("/reset-password", resetPassword);

// Profile & password routes
userRouter.put("/update", updateUserProfile);
userRouter.put("/password", updateUserPassword);

// Cart & wishlist routes
userRouter.get("/cart", getUserCart);
userRouter.put("/cart", updateUserCart);
userRouter.get("/wishlist", getUserWishlist);
userRouter.post("/wishlist/toggle", toggleUserWishlist);
userRouter.put("/wishlist", toggleUserWishlist);

// Admin user management routes
userRouter.get("/", getAllUsers);
userRouter.get("/:pageSize/:pageNumber", getAllUsers);
userRouter.put("/status", updateUserStatus);
userRouter.put("/role", updateUserRole);

export default userRouter;