const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
          default: 1,
        },
        size: String,
        color: String,
        addedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    subtotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    tax: {
      type: Number,
      default: 0,
      min: 0,
    },
    shippingCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    discountCode: String,
    totalAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    couponApplied: {
      code: String,
      discount: Number,
      expiresAt: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Calculate totals before saving
cartSchema.pre('save', async function (next) {
  try {
    let subtotal = 0;

    // Calculate subtotal by fetching product prices
    if (this.items.length > 0) {
      const Product = mongoose.model('Product');
      
      for (const item of this.items) {
        const product = await Product.findById(item.product).select('finalPrice');
        if (product) {
          subtotal += product.finalPrice * item.quantity;
        }
      }
    }

    this.subtotal = subtotal;
    this.tax = this.subtotal * 0.18; // 18% tax
    this.shippingCost = this.subtotal > 0 ? (this.subtotal > 500 ? 0 : 50) : 0; // Free shipping above 500
    this.totalAmount = this.subtotal + this.tax + this.shippingCost - this.discount;

    next();
  } catch (error) {
    next(error);
  }
});

// Remove empty items
cartSchema.pre('save', function (next) {
  this.items = this.items.filter(item => item.quantity > 0);
  next();
});

// Indexes
cartSchema.index({ user: 1 });
cartSchema.index({ isActive: 1 });

module.exports = mongoose.model('Cart', cartSchema);
