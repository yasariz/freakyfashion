var express = require('express');
var router = express.Router();
const multer = require('multer');
const Database = require('better-sqlite3');
const db = new Database('./db/products.db', { 
  verbose: console.log,
  fileMustExist: true 
});

/* GET home page. */
router.get('/', function(req, res, next) {
  // Fetch all products from the database
  const allProducts = db.prepare('SELECT * FROM products').all();

  // Shuffle the array of products randomly
  const shuffledProducts = allProducts.sort(() => 0.5 - Math.random());

  // Slice the shuffled array to limit to 8 products
  const products = shuffledProducts.slice(0, 8);

  // Render the homepage with the randomized products
  res.render('index', { products });
});

module.exports = router;
