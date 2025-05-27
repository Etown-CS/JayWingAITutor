<?php
require_once 'includes/db_connect.php';
session_start();

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);

    $username = $data['username'] ?? '';
    $password = $data['password'] ?? '';
    $role = $data['role'] === 'proctor' ? 1 : 0;

    if (!$username || !$password) {
        echo json_encode(['success' => false, 'message' => 'All fields are required']);
        exit;
    }

    try {
        $stmt = $connection->prepare("SELECT id FROM users WHERE username = ?");
        $stmt->bind_param("s", $username);
        $stmt->execute();
        $stmt->store_result();

        if ($stmt->num_rows > 0) {
            echo json_encode(['success' => false, 'message' => 'Username already exists']);
            $stmt->close();
            exit;
        }
        $stmt->close();

        $hashedPassword = password_hash($password, PASSWORD_DEFAULT);
        $stmt = $connection->prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)");
        $stmt->bind_param("ssi", $username, $hashedPassword, $role);
        $stmt->execute();

        $_SESSION['user_id'] = $stmt->insert_id;
        $_SESSION['username'] = $username;
        $_SESSION['admin'] = $role;

        $stmt->close();

        echo json_encode(['success' => true, 'route' => $role === 1 ? 'proctor.php' : 'student.php']);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => 'Signup failed: ' . $e->getMessage()]);
    }
} else {
    echo json_encode(['success' => false, 'message' => 'Invalid request method']);
}
?>