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
    $query = "SELECT uc.userCoursesId, uc.courseId, uc.userId, c.name, c.courseCode, u.username, u.role
              FROM user_courses uc
              JOIN courses c ON uc.courseId = c.id
              JOIN users u ON uc.userId = u.id";

    $result = $connection->query($query);
    
    if (!$result) {
        throw new Exception("Query failed: " . $connection->error);
    }

    $enrollments = [];
    while ($row = $result->fetch_assoc()) {
        $enrollments[] = $row;
    }

    echo json_encode([
        'success' => true,
        'data' => $enrollments
    ]);

    $result->close();

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error fetching enrollments: ' . $e->getMessage()
    ]);
} finally {
    $connection->close();
}