<?php
require_once '../../includes/session_handler.php';
require_once '../../includes/db_connect.php';

header('Content-Type: application/json');

if (!isAdmin()) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Not authorized']);
    exit();
}

try {
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($data['userCoursesId'])) {
        throw new Exception('Enrollment ID is required');
    }

    $stmt = $connection->prepare("DELETE FROM user_courses WHERE userCoursesId = ?");
    
    if (!$stmt) {
        throw new Exception("Prepare failed: " . $connection->error);
    }

    $stmt->bind_param("i", $data['userCoursesId']);

    if (!$stmt->execute()) {
        throw new Exception("Execution failed: " . $stmt->error);
    }

    if ($stmt->affected_rows === 0) {
        throw new Exception("No enrollment found with the given ID");
    }

    echo json_encode([
        'success' => true,
        'message' => 'Enrollment deleted successfully'
    ]);

    $stmt->close();

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error deleting enrollment: ' . $e->getMessage()
    ]);
} finally {
    $connection->close();
}