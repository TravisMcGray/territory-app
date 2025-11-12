const express = require('express');
const mongoose = require('mongoose');
const app = express();
const User = require('./models/user');
const bcrypt = require('bcrypt');
const Walk = require('./models/walk');

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

        // hash password before saving
        const hashedPassword = await bcrypt.hash(password, 10);

        // create user with hashed password
        const user = await User.create({ email, password: hashedPassword });

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
        // Compare password with hashed password
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid email or password' });        
        }

        // Success!
        res.json({ message: 'Login successful', userId: user._id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/walks', async (req, res) => {
    try {
        const { userId, coordinates, distance } = req.body;
        const walk = await Walk.create({ userId, coordinates, distance });
        res.status(201).json({ message: 'Walk recorded successfully!', walkId: walk._id });
    } catch (error) {
        res.status(400).json({ message: 'Error recording walk', error: error.message });
    }
});

app.get('/walks/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const walks = await Walk.find({ userId: userId });
        res.json({
            message: 'Walks retrieved successfully',
            count: walks.length,
            walks: walks
        });
    } catch (err) {
        res.status(500).json({ error: 'Error retrieving walks',
            message: err.message
        })
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});