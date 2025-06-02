<?php
// /src/data_src/includes/session_handler.php

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Function to check if user is logged in
function isLoggedIn() {
    return isset($_SESSION['user_id']);
}

// Function to get current user ID
function getCurrentUserId() {
    return $_SESSION['user_id'] ?? null;
}

// Function to get current username
function getCurrentUsername() {
    return $_SESSION['username'] ?? null;
}

// Function to check if user is an admin
function isAdmin() {
    return isset($_SESSION['admin']) && $_SESSION['admin'] === 1;
}