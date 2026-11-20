import express from "express";
import {
  createOrder,
  getOrders,
  updateOrderStatus,
  trackOrder,
  cancelOrder,
} from "../controllers/orderController.js";

const orderRouter = express.Router();

// Public order tracking (by orderId + email or phone)
orderRouter.get("/track", trackOrder);

// Customer self-cancel while order is Pending
orderRouter.patch("/:orderId/cancel", cancelOrder);
orderRouter.put("/:orderId/cancel", cancelOrder);

// Create new order
orderRouter.post("/", createOrder);

// Get orders (supports query params ?page=1&limit=10 or path params /:pageSize/:pageNumber)
orderRouter.get("/", getOrders);
orderRouter.get("/:pageSize/:pageNumber", getOrders);

// Update order status (admin) - supports both /status/:status and /:status
orderRouter.put("/:orderId/status/:status", updateOrderStatus);
orderRouter.put("/:orderId/:status", updateOrderStatus);

export default orderRouter;