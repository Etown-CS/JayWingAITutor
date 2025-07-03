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
    
    if (!isset($data['courseId']) || !isset($data['userId'])) {     // || !isset($data['roleOfClass']
        throw new Exception('Missing required fields');
    }

    $stmt = $connection->prepare("INSERT INTO user_courses (courseId, userId) VALUES (?, ?)");   // roleOfClass - , ?
    
    if (!$stmt) {
        throw new Exception("Prepare failed: " . $connection->error);
    }

    $stmt->bind_param("ii", 
        $data['courseId'],
        $data['userId'],
        // $data['roleOfClass']
    );

    if (!$stmt->execute()) {
        throw new Exception("Execution failed: " . $stmt->error);
    }

    $newUserCourseId = $connection->insert_id;
    echo json_encode([
        'success' => true,
        'message' => 'Enrollment created successfully',
        'id' => $newUserCourseId
    ]);

    $stmt->close();

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error creating enrollment: ' . $e->getMessage()
    ]);
} finally {
    $connection->close();
}