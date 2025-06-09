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

    $stmt = $connection->prepare("UPDATE courses SET name = ?, courseCode = ?, description = ? WHERE id = ?");
    
    if (!$stmt) {
        throw new Exception("Prepare failed: " . $connection->error);
    }

    $name = $data['name'];
    $courseCode = $data['courseCode'] ?? null;
    $description = $data['description'] ?? null;
    $courseId = $data['courseId'];

    $stmt->bind_param("sssi", 
        $name,
        $courseCode,
        $description,
        $courseId
    );

    if (!$stmt->execute()) {
        throw new Exception("Execution failed: " . $stmt->error);
    }

    if ($stmt->affected_rows === 0) {
        throw new Exception("No class found with the given ID");
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