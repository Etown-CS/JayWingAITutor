<?php
require_once '../includes/session_handler.php';
require_once '../includes/db_connect.php';

header('Content-Type: application/json');

if (!isAdmin()) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Not authorized']);
    exit();
}

try {
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($data['name'])) {
        throw new Exception('Class name is required');
    }

    // Create variables for binding
    $userId = $_SESSION['user_id'] ?? null;
    if (!$userId) {
        throw new Exception("User ID not found in session");
    }
    $name = $data['name'];
    $courseCode = $data['courseCode'] ?? null;
    $description = $data['description'] ?? null;

    // Get user name from ID
    $stmt = $connection->prepare("SELECT username FROM users WHERE id = ?");
    $stmt->bind_param("i", $userId);
    if (!$stmt->execute()) {
        throw new Exception("Execution failed: " . $stmt->error);
    }
    $result = $stmt->get_result();
    $user = $result->fetch_assoc();
    $stmt->close();
    $username = $user['username'];

    // Create filepath
    $filepath = "" . $username . "_" . $userId . "/" . $name . "/";

    $stmt = $connection->prepare("INSERT INTO courses (name, filepath, courseCode, description) VALUES (?, ?, ?, ?)"); // TODO: Add filepath
    
    if (!$stmt) {
        throw new Exception("Prepare failed: " . $connection->error);
    }

    // Bind using variables
    $stmt->bind_param("ssss", $name, $filepath, $courseCode, $description);

    if (!$stmt->execute()) {
        throw new Exception("Execution failed: " . $stmt->error);
    }

    $newId = $connection->insert_id;
    
    echo json_encode([
        'success' => true,
        'message' => 'Class created successfully',
        'id' => $newId
    ]);

    $stmt->close();

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error creating class: ' . $e->getMessage()
    ]);
} finally {
    $connection->close();
}