import express from "express";
import {
  createProduct,
  deleteProduct,
  getAllProducts,
  getProductById,
  searchProducts,
  updateProduct,
  addProductReview,
} from "../controllers/productController.js";

const productRouter = express.Router();

// Search products (supports /api/products/search?q=... and /api/products/search/:query)
productRouter.get("/search", searchProducts);
productRouter.get("/search/:query", searchProducts);

// List products with filters, sorting & pagination
productRouter.get("/", getAllProducts);

// Single product & reviews
productRouter.get("/:productId", getProductById);
productRouter.post("/:productId/reviews", addProductReview);

// Admin product CRUD
productRouter.post("/", createProduct);
productRouter.put("/:productId", updateProduct);
productRouter.delete("/:productId", deleteProduct);

export default productRouter;