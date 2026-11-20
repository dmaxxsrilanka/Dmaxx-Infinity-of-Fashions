import Order from "../models/order.js";
import Product from "../models/product.js";
import { isAdmin } from "./userController.js";

// Helper to generate next sequential Order ID (e.g., ORD000001)
async function generateNextOrderId() {
  const lastOrder = await Order.findOne().sort({ createdAt: -1, date: -1 }).lean();
  if (!lastOrder || !lastOrder.orderId) {
    return "ORD000001";
  }
  const numericPart = parseInt(String(lastOrder.orderId).replace("ORD", ""), 10);
  if (isNaN(numericPart)) {
    return "ORD000001";
  }
  return "ORD" + (numericPart + 1).toString().padStart(6, "0");
}

// Helper to get size-specific stock whether stored as a Map or plain object
function getSizeStockValue(product, size) {
  if (!size || !product?.sizeStock) return null;
  if (typeof product.sizeStock.get === "function") {
    const val = product.sizeStock.get(size);
    return typeof val === "number" ? val : null;
  }
  if (Object.prototype.hasOwnProperty.call(product.sizeStock, size)) {
    const val = product.sizeStock[size];
    return typeof val === "number" ? val : null;
  }
  return null;
}

export async function createOrder(req, res) {
  try {
    if (req.user == null) {
      return res.status(401).json({ message: "You need to login to create an order" });
    }

    const {
      firstName,
      lastName,
      addressLine1,
      addressLine2,
      city,
      postalCode,
      phone,
      secondaryPhone,
      customerNotes,
      paymentMethod,
      items,
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Order must contain at least one item" });
    }

    if (!addressLine1 || !city || !phone) {
      return res.status(400).json({ message: "Address, city, and phone number are required" });
    }

    const orderData = {
      orderId: await generateNextOrderId(),
      email: req.user.email.trim().toLowerCase(),
      firstName: firstName?.trim() || req.user.firstName,
      lastName: lastName?.trim() || req.user.lastName,
      addressLine1: addressLine1.trim(),
      addressLine2: addressLine2?.trim() || "",
      city: city.trim(),
      postalCode: postalCode?.trim() || "",
      phone: phone.trim(),
      secondaryPhone: secondaryPhone?.trim() || "",
      customerNotes: customerNotes?.trim() || "",
      paymentMethod: paymentMethod || "COD",
      status: "Pending",
      totalAmount: 0,
      items: [],
    };

    // Validate each item & calculate total
    for (let i = 0; i < items.length; i++) {
      const reqItem = items[i];
      const qty = Number(reqItem.qty);

      if (!reqItem.productId || isNaN(qty) || qty < 1) {
        return res.status(400).json({ message: "Invalid product or quantity in order items" });
      }

      const product = await Product.findOne({ productId: String(reqItem.productId).trim() });

      if (product == null) {
        return res.status(400).json({
          message: `Product with productId ${reqItem.productId} does not exist`,
        });
      }

      if (!product.isAvailable) {
        return res.status(400).json({
          message: `${product.name} is currently unavailable`,
        });
      }

      const sizeValue = reqItem.size ? String(reqItem.size).trim() : "";
      const colorValue = reqItem.color ? String(reqItem.color).trim() : "";

      const sizeStockQty = getSizeStockValue(product, sizeValue);
      if (sizeStockQty !== null && sizeStockQty < qty) {
        return res.status(400).json({
          message: `Insufficient stock for ${product.name} (Size: ${sizeValue}). Available: ${sizeStockQty}`,
        });
      }

      // Check general stock if tracked on product
      if (typeof product.stock === "number" && product.stock < qty) {
        return res.status(400).json({
          message: `Insufficient stock for ${product.name}. Available: ${product.stock}`,
        });
      }

      const effectivePrice =
        typeof product.discountPrice === "number" &&
        product.discountPrice > 0 &&
        product.discountPrice < product.price
          ? product.discountPrice
          : product.price;

      const unitPrice = Number(effectivePrice);

      orderData.items.push({
        product: {
          productId: product.productId,
          name: product.name,
          image: product.images?.[0] || "",
          price: unitPrice,
        },
        size: sizeValue,
        color: colorValue,
        qty: qty,
      });

      orderData.totalAmount += unitPrice * qty;
    }

    // Save order with retry in case of concurrent duplicate orderId
    let savedOrder = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const order = new Order(orderData);
        savedOrder = await order.save();
        break;
      } catch (err) {
        if (err.code === 11000 && attempt < 2) {
          orderData.orderId = await generateNextOrderId();
        } else {
          throw err;
        }
      }
    }

    // Deduct stock after successful order creation
    for (let i = 0; i < orderData.items.length; i++) {
      const item = orderData.items[i];
      const updatePayload = { $inc: { stock: -item.qty } };
      if (item.size) {
        updatePayload.$inc[`sizeStock.${item.size}`] = -item.qty;
      }

      await Product.updateOne(
        { productId: item.product.productId, stock: { $gte: item.qty } },
        updatePayload
      );
    }

    return res.status(201).json({
      message: "Order created successfully",
      orderId: savedOrder.orderId,
      order: savedOrder,
    });
  } catch (error) {
    console.error("Error creating order:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function getOrders(req, res) {
  try {
    if (req.user == null) {
      return res.status(401).json({ message: "You need to login to view your orders" });
    }

    const pageSize = Math.max(1, parseInt(req.params.pageSize || req.query.pageSize || "10", 10));
    const pageNumber = Math.max(1, parseInt(req.params.pageNumber || req.query.pageNumber || "1", 10));
    const skipCount = (pageNumber - 1) * pageSize;

    const filter = isAdmin(req) ? {} : { email: req.user.email.trim().toLowerCase() };

    const [totalOrderCount, orders] = await Promise.all([
      Order.countDocuments(filter),
      Order.find(filter)
        .sort({ createdAt: -1, date: -1 })
        .skip(skipCount)
        .limit(pageSize)
        .lean(),
    ]);

    const totalPages = Math.ceil(totalOrderCount / pageSize);

    return res.json({
      orders,
      totalPages,
      currentPage: pageNumber,
      totalCount: totalOrderCount,
    });
  } catch (error) {
    console.error("Error getting orders:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function updateOrderStatus(req, res) {
  if (!isAdmin(req)) {
    return res.status(403).json({ message: "You are not authorized to update order status" });
  }

  const orderId = req.params.orderId;
  const newStatus = req.params.status || req.body.status;

  const allowedStatuses = ["Pending", "Confirmed", "Processing", "Shipped", "Delivered", "Cancelled"];
  if (!allowedStatuses.includes(newStatus)) {
    return res.status(400).json({ message: "Invalid order status" });
  }

  try {
    const order = await Order.findOne({ orderId: String(orderId).trim().toUpperCase() });

    if (order == null) {
      return res.status(404).json({ message: `Order with orderId ${orderId} does not exist` });
    }

    // Restore stock if admin cancels a non-cancelled order
    if (newStatus === "Cancelled" && order.status !== "Cancelled") {
      for (const item of order.items) {
        const restoreInc = { stock: item.qty };
        if (item.size) {
          restoreInc[`sizeStock.${item.size}`] = item.qty;
        }
        await Product.updateOne(
          { productId: item.product.productId },
          { $inc: restoreInc }
        );
      }
    }

    await Order.updateOne({ _id: order._id }, { $set: { status: newStatus } });

    return res.json({ message: "Order status updated successfully", status: newStatus });
  } catch (error) {
    console.error("Error updating order status:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

// Public Track Order endpoint (by orderId + email or phone)
export async function trackOrder(req, res) {
  try {
    const { orderId, contact } = req.query;

    if (!orderId || !contact) {
      return res.status(400).json({ message: "Order ID and email or phone number are required" });
    }

    const normalizedContact = String(contact).trim().toLowerCase();
    const rawContact = String(contact).trim();

    const order = await Order.findOne({
      orderId: String(orderId).trim().toUpperCase(),
      $or: [{ email: normalizedContact }, { phone: rawContact }],
    })
      .select("orderId status totalAmount paymentMethod city items date createdAt updatedAt")
      .lean();

    if (!order) {
      return res.status(404).json({ message: "No matching order found. Please check your details." });
    }

    return res.json({ order });
  } catch (error) {
    console.error("Error tracking order:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

// Customer self-cancel while order is still Pending
export async function cancelOrder(req, res) {
  try {
    if (req.user == null) {
      return res.status(401).json({ message: "You need to login to cancel an order" });
    }

    const { orderId } = req.params;
    const order = await Order.findOne({
      orderId: String(orderId).trim().toUpperCase(),
      email: req.user.email.trim().toLowerCase(),
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.status !== "Pending") {
      return res.status(400).json({
        message: `Cannot cancel order because it is already ${order.status}`,
      });
    }

    order.status = "Cancelled";
    await order.save();

    // Restore stock
    for (const item of order.items) {
      const restoreInc = { stock: item.qty };
      if (item.size) {
        restoreInc[`sizeStock.${item.size}`] = item.qty;
      }
      await Product.updateOne(
        { productId: item.product.productId },
        { $inc: restoreInc }
      );
    }

    return res.json({ message: "Order cancelled successfully", order });
  } catch (error) {
    console.error("Error cancelling order:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}