const express = require('express');
const mongoose = require('mongoose');
const app = express();

const PORT = 3000;

mongoose.connect('mongodb://localhost:27017/territory-app')
    .then(() => console.log('Connected to MongoDB'))
    .catch((err) => console.log('MongoDB connection error:', err));

app.get('/hello', (req, res) => {
    res.send('Hello World');
});

app.get('/status', (req, res) => {
    res.send('Server is running smoothly!');
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});