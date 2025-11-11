const express = require('express');
const mongoose = require('mongoose');
const app = express();
const User = require('./models/user');

const PORT = 3000;

app.use(express.json());

mongoose.connect('mongodb://localhost:27017/territory-app')
    .then(() => console.log('Connected to MongoDB'))
    .catch((err) => console.log('MongoDB connection error:', err));

app.get('/hello', (req, res) => {
    res.send('Hello World');
});

app.get('/status', (req, res) => {
    res.send('Server is running smoothly!');
});

app.post('/signup', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.create({ email, password });
        res.status(201).json({ message: 'User created successfully', userId: user._id });
    } catch (error) {
        res.status(400).json({ message: 'Error creating user', error: error.message });
    }
});

app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // find user by email
        const user = await User.findOne({ email });

        // if user doesn't exist
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        // check if password matches
        if (user.password !== password) {
            return res.status(401).json({ error: 'Invalid email or password' });        
        }

        // Success!
        res.json({ message: 'Login successful', userId: user._id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});