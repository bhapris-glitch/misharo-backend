const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const Product = require('../models/Product');

// @route   GET /api/products
// @desc    Get all products with filtering, sorting, and pagination
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { category, search, sortBy, page = 1, limit = 12 } = req.query;

    // Build filter object
    let filter = { isActive: true };

    if (category) {
      filter.category = category;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    // Build sort object
    let sortObj = { createdAt: -1 };
    if (sortBy === 'price-asc') {
      sortObj = { finalPrice: 1 };
    } else if (sortBy === 'price-desc') {
      sortObj = { finalPrice: -1 };
    } else if (sortBy === 'rating') {
      sortObj = { rating: -1 };
    } else if (sortBy === 'newest') {
      sortObj = { createdAt: -1 };
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetch products
    const products = await Product.find(filter)
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('seller', 'firstName lastName email');

    // Get total count
    const total = await Product.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: products.length,
      total,
      pages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
      products,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   GET /api/products/:id
// @desc    Get single product by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate(
      'seller',
      'firstName lastName email phone'
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    res.status(200).json({
      success: true,
      product,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   POST /api/products
// @desc    Create new product
// @access  Private/Seller
router.post('/', protect, authorize('seller', 'admin'), async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      discount,
      category,
      subcategory,
      size,
      color,
      fabric,
      images,
      stock,
      tags,
      sku,
    } = req.body;

    // Validation
    if (!name || !description || !price || !category || !images) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields',
      });
    }

    // Create product
    const product = await Product.create({
      name,
      description,
      price,
      discount: discount || 0,
      category,
      subcategory,
      size: size || ['Free'],
      color: color || [],
      fabric,
      images,
      stock: stock || 0,
      seller: req.user._id,
      tags: tags || [],
      sku,
    });

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      product,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   PUT /api/products/:id
// @desc    Update product
// @access  Private/Seller/Admin
router.put('/:id', protect, authorize('seller', 'admin'), async (req, res) => {
  try {
    let product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    // Check if user is seller or admin
    if (product.seller.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this product',
      });
    }

    // Update product
    product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      product,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   DELETE /api/products/:id
// @desc    Delete product
// @access  Private/Seller/Admin
router.delete('/:id', protect, authorize('seller', 'admin'), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    // Check if user is seller or admin
    if (product.seller.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this product',
      });
    }

    await Product.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   GET /api/products/categories/all
// @desc    Get all categories
// @access  Public
router.get('/categories/all', async (req, res) => {
  try {
    const categories = await Product.distinct('category', { isActive: true });

    res.status(200).json({
      success: true,
      categories,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   POST /api/products/:id/review
// @desc    Add product review
// @access  Private
router.post('/:id/review', protect, async (req, res) => {
  try {
    const { rating, comment } = req.body;

    if (!rating || !comment) {
      return res.status(400).json({
        success: false,
        message: 'Please provide rating and comment',
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5',
      });
    }

    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    res.status(201).json({
      success: true,
      message: 'Review added successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;
