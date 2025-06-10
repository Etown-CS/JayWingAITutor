<?php
require_once '../includes/session_handler.php';
require_once '../includes/db_connect.php';

header('Content-Type: application/json');

if (!isAdmin()) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Not authorized']);
    exit();
}

$loggedInUserId = $_SESSION['user_id'];

try {
    $query = "
        SELECT 
            uc.userCoursesId, 
            uc.courseId, 
            uc.userId, 
            c.name, 
            c.courseCode, 
            u.username, 
            u.role
        FROM user_courses uc
        JOIN courses c ON uc.courseId = c.id
        JOIN users u ON uc.userId = u.id
        WHERE 
            uc.courseId IN (
                SELECT courseId 
                FROM user_courses 
                WHERE userId = ? 
            )
            AND uc.userId != ? -- Exclude the professor themselves
    ";

    $stmt = $connection->prepare($query);
    // Bind the loggedInUserId twice for the two placeholders in the WHERE clause
    $stmt->bind_param("ii", $loggedInUserId, $loggedInUserId); 
    $stmt->execute();
    $result = $stmt->get_result();
    
    if (!$result) {
        throw new Exception("Query failed: " . $stmt->error);
    }

    $enrollments = [];
    while ($row = $result->fetch_assoc()) {
        $enrollments[] = $row;
    }

    echo json_encode([
        'success' => true,
        'data' => $enrollments
    ]);

    $stmt->close();

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error fetching enrollments: ' . $e->getMessage()
    ]);
} finally {
    if (isset($connection)) {
        $connection->close();
    }
}
?>