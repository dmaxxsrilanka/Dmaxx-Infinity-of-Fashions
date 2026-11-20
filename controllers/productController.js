import Product from "../models/product.js";
import { isAdmin } from "./userController.js";

function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function createProduct(req, res) {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ message: "You need to login as an admin to create products" });
    }

    const product = new Product(req.body);
    const savedProduct = await product.save();

    return res.status(201).json({
      message: "Product created successfully",
      product: savedProduct,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({ message: "A product with this productId already exists" });
    }
    if (error?.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
    }
    console.error("Error creating product:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function getAllProducts(req, res) {
  try {
    const {
      category,
      subCategory,
      brand,
      size,
      color,
      minPrice,
      maxPrice,
      featured,
      onSale,
      search,
      sort = "newest",
      page,
      limit,
    } = req.query;

    const filter = {};

    // Non-admins only see available products
    if (!isAdmin(req)) {
      filter.isAvailable = true;
    }

    if (category && String(category).trim().toLowerCase() !== "all") {
      filter.category = {
        $regex: `^${escapeRegex(String(category).trim())}$`,
        $options: "i",
      };
    }

    if (subCategory && String(subCategory).trim().toLowerCase() !== "all") {
      filter.subCategory = {
        $regex: `^${escapeRegex(String(subCategory).trim())}$`,
        $options: "i",
      };
    }

    if (brand && String(brand).trim().toLowerCase() !== "all") {
      filter.brand = {
        $regex: `^${escapeRegex(String(brand).trim())}$`,
        $options: "i",
      };
    }

    if (size && String(size).trim() !== "") {
      filter.sizes = {
        $in: [new RegExp(`^${escapeRegex(String(size).trim())}$`, "i")],
      };
    }

    if (color && String(color).trim() !== "") {
      filter.colors = {
        $elemMatch: { $regex: escapeRegex(String(color).trim()), $options: "i" },
      };
    }

    if (featured === "true") {
      filter.isFeatured = true;
    }

    if (onSale === "true") {
      filter.onSale = true;
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.price = {};
      if (minPrice !== undefined && String(minPrice).trim() !== "" && !isNaN(Number(minPrice))) {
        filter.price.$gte = Number(minPrice);
      }
      if (maxPrice !== undefined && String(maxPrice).trim() !== "" && !isNaN(Number(maxPrice))) {
        filter.price.$lte = Number(maxPrice);
      }
      if (Object.keys(filter.price).length === 0) {
        delete filter.price;
      }
    }

    if (search && String(search).trim() !== "") {
      const q = escapeRegex(String(search).trim());
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
        { brand: { $regex: q, $options: "i" } },
        { category: { $regex: q, $options: "i" } },
        { subCategory: { $regex: q, $options: "i" } },
        { altNames: { $elemMatch: { $regex: q, $options: "i" } } },
      ];
    }

    let sortOption = { createdAt: -1, _id: -1 };
    switch (sort) {
      case "price-asc":
        sortOption = { price: 1, _id: 1 };
        break;
      case "price-desc":
        sortOption = { price: -1, _id: -1 };
        break;
      case "rating":
        sortOption = { averageRating: -1, numReviews: -1, _id: -1 };
        break;
      case "newest":
      default:
        sortOption = { createdAt: -1, _id: -1 };
        break;
    }

    // Support both paginated calls and full array calls smoothly
    if (page !== undefined || limit !== undefined) {
      const pageNum = Math.max(1, parseInt(page || "1", 10) || 1);
      const limitNum = Math.max(1, Math.min(100, parseInt(limit || "12", 10) || 12));
      const skipNum = (pageNum - 1) * limitNum;

      const [products, totalCount] = await Promise.all([
        Product.find(filter).sort(sortOption).skip(skipNum).limit(limitNum).lean(),
        Product.countDocuments(filter),
      ]);

      return res.json({
        products,
        totalCount,
        totalPages: Math.ceil(totalCount / limitNum),
        currentPage: pageNum,
      });
    }

    const products = await Product.find(filter).sort(sortOption).lean();
    return res.json(products);
  } catch (error) {
    console.error("Error fetching products:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function deleteProduct(req, res) {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ message: "You need to login as an admin to delete products" });
    }

    const productId = String(req.params.productId || "").trim();
    const deleted = await Product.findOneAndDelete({ productId });

    if (!deleted) {
      return res.status(404).json({ message: "Product does not exist" });
    }

    return res.json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("Error deleting product:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function updateProduct(req, res) {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ message: "You need to login as an admin to update products" });
    }

    const productId = String(req.params.productId || "").trim();
    const updatedProduct = await Product.findOneAndUpdate(
      { productId },
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ message: "Product does not exist" });
    }

    return res.json({
      message: "Product updated successfully",
      product: updatedProduct,
    });
  } catch (error) {
    if (error?.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
    }
    if (error?.code === 11000) {
      return res.status(400).json({ message: "Duplicate productId value" });
    }
    console.error("Error updating product:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function getProductById(req, res) {
  try {
    const productId = String(req.params.productId || "").trim();
    const product = await Product.findOne({ productId }).lean();

    if (!product) {
      return res.status(404).json({ message: "Product does not exist" });
    }

    if (!product.isAvailable && !isAdmin(req)) {
      return res.status(404).json({ message: "Product does not exist" });
    }

    return res.json(product);
  } catch (error) {
    console.error("Error fetching product:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function searchProducts(req, res) {
  try {
    const rawQuery = (req.params.query || req.query.q || "").trim();
    if (!rawQuery) {
      return res.json([]);
    }

    const q = escapeRegex(rawQuery);
    const filter = {
      $or: [
        { name: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
        { brand: { $regex: q, $options: "i" } },
        { category: { $regex: q, $options: "i" } },
        { subCategory: { $regex: q, $options: "i" } },
        { altNames: { $elemMatch: { $regex: q, $options: "i" } } },
      ],
    };

    if (!isAdmin(req)) {
      filter.isAvailable = true;
    }

    const products = await Product.find(filter).lean();
    return res.json(products);
  } catch (error) {
    console.error("Error searching products:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function addProductReview(req, res) {
  try {
    const productId = String(req.params.productId || "").trim();
    const numericRating = Number(req.body.rating);
    const comment = String(req.body.comment || "").trim();
    const userName =
      String(req.body.userName || "").trim() ||
      (req.user ? `${req.user.firstName || ""} ${req.user.lastName || ""}`.trim() : "");

    if (isNaN(numericRating) || numericRating < 1 || numericRating > 5 || !comment || !userName) {
      return res.status(400).json({
        message: "Please provide a valid rating (1-5), comment, and user name",
      });
    }

    const product = await Product.findOne({ productId });
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    product.reviews.push({
      userName,
      rating: numericRating,
      comment,
    });

    product.numReviews = product.reviews.length;
    const totalRating = product.reviews.reduce((acc, item) => acc + Number(item.rating || 0), 0);
    product.averageRating = Number((totalRating / product.reviews.length).toFixed(1));

    await product.save();
    return res.status(201).json(product);
  } catch (error) {
    console.error("Error adding review:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}