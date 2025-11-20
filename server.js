const express = require('express');
const connectDB = require('./config/db');
const userRoutes = require('.routes/users');

const app = express();
const PORT = 3000;

app.use(express.json());

connectDB();

const authRoutes = require('./routes/auth');
const walkRoutes = require('./routes/walks');
const testRoutes = require('./routes/test');

app.use('/api/auth', authRoutes);
app.use('/api/walks', walkRoutes);
app.use('/api/test', testRoutes);
app.use('/api/users', userRoutes);

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});