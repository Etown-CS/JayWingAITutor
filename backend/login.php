<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once 'includes/session_handler.php';
require_once 'includes/db_connect.php';

header('Content-Type: application/json');

$data = json_decode(file_get_contents('php://input'), true);

$username = $data['username'] ?? '';
$password = $data['password'] ?? '';

if (!$username || !$password) {
    echo json_encode(['success' => false, 'message' => 'Missing username or password']);
    exit;
}

// Query by username only (no role filtering)
$stmt = $connection->prepare("SELECT id, username, password, role FROM users WHERE username = ?");
$stmt->bind_param("s", $username);
$stmt->execute();
$result = $stmt->get_result();

if ($user = $result->fetch_assoc()) {
    if (password_verify($password, $user['password'])) {
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['username'] = $user['username'];
        $_SESSION['admin'] = $user['role'];

        // Redirect based on role (1 = proctor, 0 = student)
        $route = ($user['role'] == 1) ? 'proctor.php' : 'student.php';
        echo json_encode([
            'success' => true,
            'route' => $route,
            'user_id' => $user['id'],
            'role' => $user['role']
        ]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Incorrect password']);
    }
} else {
    echo json_encode(['success' => false, 'message' => 'User not found']);
}

$stmt->close();
?>
