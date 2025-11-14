const express = require('express');
const router = express.Router();
const { latLngToCell, cellToBoundary } = require ('h3-js');

router.get ('/hello', (req, res) => {
    res.send('Hello World');
});

router.get('/status', (req, res) => {
    res.sendStatus('Server is running smoothly!');
});

router.post('/h3', (req, res) => {
    try {
        const { latitude, longitude } = req.body;
        const hexId = latLngToCell(latitude, longitude, 10);
        const boundary = cellToBoundary(hexId);

        res.json({
            message: 'H3 test successful',
            input: { latitude, longitude },
            hexagonId: hexId,
            hexagonBoundary: boundary
        });
    } catch (error) {
        res.status(500).json({
            error: 'H3 test failed',
            message: error.message
        });
    }
});

module.exports = router;