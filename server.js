const express = require('express');
const app = express();

const PORT = 3000;

app.get('/hello', (req, res) => {
    res.send('Hello World');
});

app.get('/status', (req, res) => {
    res.send('Server is running smoothly!');
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});