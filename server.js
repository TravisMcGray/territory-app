const express = require('express');
const mongoose = require('mongoose');
const app = express();
const User = require('./models/user');
const bcrypt = require('bcrypt');
const geolib = require('geolib');
const Walk = require('./models/walk');
const { latLngToCell, cellToBoundary } = require('h3-js');


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
            return res.status(401).json({ 
                error: 'Invalid email or password' 
            });
        }
        // Compare password with hashed password
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({ 
                error: 'Invalid email or password' 
            });        
        }

        // Success!
        res.json({ 
            message: 'Login successful', 
            userId: user._id 
        });
    } catch (err) {
        res.status(500).json({ 
            error: err.message 
        });
    }
});

app.post('/walks', async (req, res) => {
    try {
        const { userId, coordinates } = req.body;

        // Calculate distance from coordinates
        let distance = 0;
        if (coordinates.length > 1) {
            distance = geolib.getPathLength (
                coordinates.map(coord => ({
                    latitude: coord.latitude,
                    longitude: coord.longitude
                }))
            );
            // Convert meters to miles 
            distance = (distance * 0.000621371).toFixed(2);
        }

        // convert GPS coordinates to H3 hexagons (more accurate)
        const hexagons = coordinates.map(coord => 
            latLngToCell(coord.latitude, coord.longitude, 10)
        );

        // Get unique hexagons only (remove duplicates)
        const uniqueHexagons = [...new Set(hexagons)];

        // Create walk with captured hexagons
        const walk = await Walk.create({
            userId, 
            coordinates, 
            distance: parseFloat(distance),
            capturedHexagons: uniqueHexagons
        });
        res.status(201).json({ 
            message: 'Walk recorded successfully!',
            walkId: walk._id,
            distance: distance + ' miles',
            hexagonsCaptured: uniqueHexagons.length,
            hexagons: uniqueHexagons
        });
    } catch (error) {
        res.status(400).json({ 
            message: 'Error recording walk', 
            error: error.message 
        });
    }
});

app.get('/walks/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const walks = await Walk.find({ 
            userId: userId 
        });
        res.json({
            message: 'Walks retrieved successfully',
            count: walks.length,
            walks: walks
        });
    } catch (err) {
        res.status(500).json({ 
            error: 'Error retrieving walks',
            message: err.message
        })
    }
});

app.delete('/walks/:walkId', async (req, res) => {
    try {
        const { walkId } = req.params;
        const walk = await Walk.findByIdAndDelete(walkId);
        if (!walk) {
            return res.status(404).json({ error: 'Walk not found' });
        }
        res.json({ message: 'Walk deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/test-h3', (req, res) => {
    try { 
        const { latitude, longitude } = req.body;

        // Conver GPS to H3 hexagon at resolution 10 :)
        const hexId = latLngToCell(latitude, longitude, 10);

        // This gets boundary coordinates of the hexagon
        const boundary = cellToBoundary(hexId);

        res.json({
            message: 'H3 test successful',
            input: { latitude, longitude },
            hexagonId: hexId,
            hexagonBoundary: boundary
        });
    } catch (error) {
        res.status(400).json({
            error: 'H3 test failed',
            message: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});