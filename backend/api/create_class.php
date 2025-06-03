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

    $stmt = $connection->prepare("INSERT INTO courses (name, courseCode, description) VALUES (?, ?, ?)");
    
    if (!$stmt) {
        throw new Exception("Prepare failed: " . $connection->error);
    }

    // Create variables for binding
    $name = $data['name'];
    $courseCode = $data['courseCode'] ?? null;
    $description = $data['description'] ?? null;

    // Bind using variables
    $stmt->bind_param("sss", $name, $courseCode, $description);

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