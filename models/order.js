import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      unique: true,
      required: true,
      trim: true,
      uppercase: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    addressLine1: {
      type: String,
      required: true,
      trim: true,
    },
    addressLine2: {
      type: String,
      default: "",
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    postalCode: {
      type: String,
      default: "",
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    secondaryPhone: {
      type: String,
      default: "",
      trim: true,
    },
    customerNotes: {
      type: String,
      default: "",
      trim: true,
    },
    paymentMethod: {
      type: String,
      enum: ["COD", "Card", "3X Installment", "Bank Transfer"],
      default: "COD",
    },
    status: {
      type: String,
      enum: ["Pending", "Confirmed", "Processing", "Shipped", "Delivered", "Cancelled"],
      default: "Pending",
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    items: [
      {
        product: {
          productId: {
            type: String,
            required: true,
          },
          name: {
            type: String,
            required: true,
          },
          image: {
            type: String,
            default: "",
          },
          price: {
            type: Number,
            required: true,
            min: 0,
          },
        },
        size: {
          type: String,
          default: "",
          trim: true,
        },
        color: {
          type: String,
          default: "",
          trim: true,
        },
        qty: {
          type: Number,
          required: true,
          min: 1,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

const Order = mongoose.models.Order || mongoose.model("Order", orderSchema);

export default Order;