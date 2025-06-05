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
    
    if (!isset($data['userCourseId']) || !isset($data['courseId']) || 
        !isset($data['userId'])) {      // || !isset($data['roleOfClass'])
        throw new Exception('Missing required fields');
    }

    $stmt = $connection->prepare("UPDATE user_courses SET courseId = ?, userId = ? WHERE userCoursesId = ?");    // , roleOfClass = ?
    
    if (!$stmt) {
        throw new Exception("Prepare failed: " . $connection->error);
    }

    $stmt->bind_param("iii", 
        $data['courseId'],
        $data['userId'],
        // $data['roleOfClass'],
        $data['userCourseId']
    );

    if (!$stmt->execute()) {
        throw new Exception("Execution failed: " . $stmt->error);
    }

    if ($stmt->affected_rows === 0) {
        throw new Exception("No enrollment found with the given ID");
    }

    echo json_encode([
        'success' => true,
        'message' => 'Enrollment updated successfully'
    ]);

    $stmt->close();

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error updating enrollment: ' . $e->getMessage()
    ]);
} finally {
    $connection->close();
}