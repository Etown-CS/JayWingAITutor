<?php
require_once '../includes/session_handler.php';
require_once '../includes/db_connect.php';

header('Content-Type: application/json');

$data = json_decode(file_get_contents('php://input'), true);

$username = $data['username'] ?? '';
$password = $data['password'] ?? '';
$role = $data['role'] ?? '';

if (!$username || !$password || !$role) {
    echo json_encode(['success' => false, 'message' => 'Missing username, password, or role']);
    exit;
}

$roleValue = $role === 'proctor' ? 1 : 0;

$stmt = $connection->prepare("SELECT id, username, password, role FROM users WHERE username = ? AND role = ?");
$stmt->bind_param("si", $username, $roleValue);
$stmt->execute();
$result = $stmt->get_result();

if ($user = $result->fetch_assoc()) {
    if (password_verify($password, $user['password'])) {
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['username'] = $user['username'];
        $_SESSION['admin'] = $user['role'];

        echo json_encode([
            'success' => true,
            'route' => $user['role'] === 1 ? 'proctor.php' : 'student.php'
        ]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Incorrect password']);
    }
} else {
    echo json_encode(['success' => false, 'message' => 'User not found']);
}

$stmt->close();
?>