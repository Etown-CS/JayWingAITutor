const express = require('express');
const router = express.Router();
const pool = require('../utils/db');

// POST /login
router.post('/login', async (req, res) => {
    // Check if the request body contains the required fields
    const { username, password, role } = req.body;
    if (!username || !password || !role) {
        return res.status(400).json({ success: false, message: "Missing login fields." });
    }

    const roleValue = role === "student" ? 0 : 1;

    try {
        const result = await pool.query(
        'SELECT id, password FROM users WHERE username = $1 AND role = $2',
        [username, roleValue]
        );

        const user = result.rows[0];
        if (!user || user.password !== password) {
        return res.status(401).json({ success: false, message: "Invalid credentials." });
        }

        // Set session values
        req.session.userId = user.id;
        req.session.username = username;
        req.session.role = role;

        // Optionally set folder_prefix like you did in Flask
        if (role === 'proctor') {
        req.session.folder_prefix = `${username}_${user.id}`;
        }

        return res.json({ success: true, message: "Login successful", route: `/${role}` });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "Internal server error." });
    }
});

module.exports = router;
