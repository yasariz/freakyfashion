var createError = require('http-errors'); // Import error handling module
var express = require('express'); // Import express framework
var path = require('path'); // Import path module for file and directory manipulation
var cookieParser = require('cookie-parser'); // Import cookie parser middleware
var logger = require('morgan'); // Import logger middleware for logging requests
const multer = require('multer'); // Import multer for handling file uploads
const Database = require('better-sqlite3'); // Import better-sqlite3 for database handling
const db = new Database('./db/products.db', { 
  verbose: console.log, // Log SQL queries for debugging
  fileMustExist: true // Ensure the database file exists
});

var indexRouter = require('./routes/index'); // Import the index route

var app = express(); // Initialize the Express application

// ============================
// VIEW ENGINE SETUP
// ============================
// Set the views folder where the templates are stored
app.set('views', path.join(__dirname, 'views'));
// Set the view engine to EJS
app.set('view engine', 'ejs');

// ============================
// MIDDLEWARE SETUP
// ============================
// Log HTTP requests
app.use(logger('dev'));
// Parse incoming JSON requests
app.use(express.json());
// Parse URL-encoded data
app.use(express.urlencoded({ extended: false }));
// Parse cookies
app.use(cookieParser());
// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Use index router for the root route
app.use('/', indexRouter);

// Serve static files (like uploaded images)
app.use(express.static(path.join(__dirname, 'public')));

// ============================
// MULTER FILE UPLOAD CONFIGURATION
// ============================
// Configure storage for uploaded files (images)
const storage = multer.diskStorage({
  // Set the destination for the uploaded files
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'public/uploads')); // Save files to /public/uploads
  },
  // Set the file name for the uploaded files
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9); // Generate a unique suffix
    cb(null, uniqueSuffix + '-' + file.originalname); // Ensure a unique file name
  }
});
// Create multer upload instance
const upload = multer({ storage: storage });

// ============================
// CUSTOM ROUTES
// ============================

// ============================
// Route: Show Product Details by URL Slug
// ============================
app.get('/product/:urlSlug', (req, res) => {
  const { urlSlug } = req.params;  // Get the URL slug from the URL parameter

  // Query the database to find the product with the matching slug
  const product = db.prepare('SELECT * FROM products WHERE urlSlug = ?').get(urlSlug);

  // If product not found, handle the error or show a "Product Not Found" page
  if (!product) {
    return res.status(404).send('Product not found');
  }

  // Fetch all products to display related ones, excluding the current product
  const allProducts = db.prepare('SELECT * FROM products').all();
  const filteredProducts = allProducts.filter(p => p.urlSlug !== urlSlug);  // Exclude current product

  // Shuffle the remaining products and pick the first 3 random products
  const shuffledProducts = filteredProducts.sort(() => 0.5 - Math.random()).slice(0, 3);

  // Render product details page with product and related products
  res.render('product-details', { 
    product, 
    relatedProducts: shuffledProducts 
  });
});

// ============================
// Route: Show Add New Product Form (Admin)
// ============================
app.get('/admin/products/add', (req, res) => {
  res.render('admin/products/add');  // Render the form for adding a new product
});

// ============================
// Route: Add New Product to Database (Admin)
// ============================
app.post('/admin/products/new', upload.single('image'), (req, res) => {
  const { title, description, sku, price } = req.body;

  // Generate URL slug based on title and SKU
  const urlSlug = generateSlug(`${title}-${sku}`);

  // Normalize category to always be an array
  const categories = Array.isArray(req.body.category) ? req.body.category : req.body.category ? [req.body.category] : [];

  // Image handling: Get the uploaded file's filename, if available
  const image = req.file ? req.file.filename : null;

  // Insert the new product into the database
  const stmt = db.prepare(`
    INSERT INTO products (title, category, description, image, price, sku, urlSlug) 
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(title, categories.join(','), description, image, price, sku, urlSlug);

  // Redirect to the admin products page after adding the new product
  res.redirect('/admin/products');
});

// ============================
// Route: Show All Products in Admin Panel
// ============================
app.get('/admin/products', (req, res) => {
  // Query the database to get all products
  const products = db.prepare('SELECT * FROM products').all(); 

  // Render the admin products page, passing the list of products to the view
  res.render('admin/products/index', { products });
});

// ============================
// END OF CUSTOM ROUTES
// ============================

// ============================
// ERROR HANDLING
// ============================

// Catch 404 errors and forward them to the error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// General error handler
app.use(function(err, req, res, next) {
  // Set error details for development environment
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // Render the error page with the error details
  res.status(err.status || 500);
  res.render('error');
});

// Export the app module
module.exports = app;

// ============================
// UTILITIES
// ============================

// Utility function to generate a URL-friendly slug from a product title
function generateSlug(title) {
  return title
    .toLowerCase()                      // Convert to lowercase
    .trim()                             // Remove leading/trailing spaces
    .replace(/[^a-z0-9\s-]/g, '')       // Remove special characters
    .replace(/\s+/g, '-')               // Replace spaces with hyphens
    .replace(/-+/g, '-');               // Replace multiple hyphens with a single hyphen
}
