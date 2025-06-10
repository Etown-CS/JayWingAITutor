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
    
    if (!isset($data['courseId']) || !isset($data['name'])) {
        throw new Exception('Class ID and name are required');
    }

    $userId = $_SESSION['user_id'] ?? null;
    if (!$userId) {
        throw new Exception("User ID not found in session");
    }
    $name = $data['name'];
    $courseCode = $data['courseCode'] ?? null;
    $description = $data['description'] ?? null; 
    $courseId = $data['courseId'];

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

    $stmt = $connection->prepare("UPDATE courses SET name = ?, filepath = ?, courseCode = ?, description = ? WHERE id = ?");
    
    if (!$stmt) {
        throw new Exception("Prepare failed: " . $connection->error);
    }

    $stmt->bind_param("ssssi", 
        $name,
        $filepath,
        $courseCode,
        $description,
        $courseId
    );

    if (!$stmt->execute()) {
        throw new Exception("Execution failed: " . $stmt->error);
    }
    
    // Check if any rows were affected
    if ($stmt->affected_rows === 0) {
        throw new Exception("No class found with the provided information: " . $courseId . " - " . $name . " - " . $filepath . " - " . $courseCode . " - " . $description);
    }

    echo json_encode([
        'success' => true,
        'message' => 'Class updated successfully'
    ]);

    $stmt->close();

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error updating class: ' . $e->getMessage()
    ]);
} finally {
    $connection->close();
}