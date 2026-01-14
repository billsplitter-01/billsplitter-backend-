const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Connect to TiDB
const connection = mysql.createConnection({
    uri: process.env.DATABASE_URL.replace('sslaccept=strict', 'ssl={"rejectUnauthorized":true}')
});

connection.connect((err) => {
    if (err) return console.error('Error connecting: ' + err.stack);
    console.log('Connected to TiDB as id ' + connection.threadId);
});

// Test Route
app.get('/test-db', (req, res) => {
    connection.query('SELECT 1 + 1 AS solution', (err, results) => {
        if (err) return res.status(500).json(err);
        res.json({ message: "Database is connected!", data: results });
    });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
