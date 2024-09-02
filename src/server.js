const express = require('express');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const NodeCache = require('node-cache');

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

const cache = new NodeCache({ stdTTL: 3600 });

app.use(bodyParser.json());

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5433,
});

app.get('/', async (req, res) => {
  res.send('The server has been run successfully');
});

// Контроллер для создания новой записи в books_db
app.post('/books', async (req, res) => {
  const {title, date, author, description, image} = req.body;

  try {
    const result = await pool.query(
      'INSERT INTO books (title, date, author, description, image) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [title, date, author, description, image]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error inserting data');
  }
});

// Контроллер для получения записей из books_db + кэширование
app.get('/books', async (req, res) => {
  const cachedData = cache.get('booksData');

  if (cachedData) {
    return res.send(cachedData);
  }

  const {offset = 0, limit = 10, sortBy = 'id', order = 'ASC'} = req.query;

  try {
    const result = await pool.query(
      `SELECT * FROM books ORDER BY ${sortBy} ${order} LIMIT $1 OFFSET $2`,
      [parseInt(limit), parseInt(offset)]
    );

    cache.set('booksData', result.rows);

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error fetching data');
  }
});

// Контроллер для изменения конкретной записи по id в books_db
app.put('/books/:id', async (req, res) => {
  const {id} = req.params;
  const {title, date, author, description, image} = req.body;

  try {
    const result = await pool.query(
      `UPDATE books SET title = $1, date = $2, author = $3, description = $4, image = $5 WHERE id = ${id} RETURNING *`,
      [title, date, author, description, image]
    );
    if (result.rows.length === 0) {
      res.status(404).send('Book not found');
    }
    res.json(result.rows[0]);
    cache.del('booksData');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error updating data');
  }
});

app.listen(port, () => {
  console.log('Server is running at', port);
});
