var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const multer = require('multer');
const Database = require('better-sqlite3');
const db = new Database('./db/products.db', { 
  verbose: console.log,
  fileMustExist: true 
});

var indexRouter = require('./routes/index');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);

// Serve static files (like uploaded images)
app.use(express.static(path.join(__dirname, 'public')));

// Configure multer for file uploads (images)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
      cb(null, path.join(__dirname, 'public/uploads')); // Save files to /public/uploads
  },
  filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + '-' + file.originalname); // Ensure a unique file name
  }
});
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

  // Image handling
  const image = req.file ? req.file.filename : null;

  // Insert product into the database
  const stmt = db.prepare(`
      INSERT INTO products (title, category, description, image, price, sku, urlSlug) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(title, categories.join(','), description, image, price, sku, urlSlug);

  // Redirect to admin products page after adding the new product
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



// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;

function generateSlug(title) {
  return title
      .toLowerCase()                      // Convert to lowercase
      .trim()                             // Remove leading/trailing spaces
      .replace(/[^a-z0-9\s-]/g, '')       // Remove special characters
      .replace(/\s+/g, '-')               // Replace spaces with hyphens
      .replace(/-+/g, '-');               // Replace multiple hyphens with a single hyphen
}


