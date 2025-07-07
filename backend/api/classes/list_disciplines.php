<?php
require_once '../../includes/session_handler.php';
require_once '../../includes/db_connect.php';

header('Content-Type: application/json');

if (!isAdmin()) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Not authorized']);
    exit();
}

$loggedInUserId = $_SESSION['user_id'];

try {
    $query = "
        SELECT DISTINCT c.courseCode
        FROM courses c
        JOIN user_courses uc ON uc.courseId = c.id
        WHERE uc.userId = ?
    ";

    $stmt = $connection->prepare($query);
    $stmt->bind_param("i", $loggedInUserId);
    $stmt->execute();
    $results = $stmt->get_result();

    $disciplinesSet = [];

    while ($row = $results->fetch_assoc()) {
        $code = $row['courseCode'];

        // Extract discipline(s) like CSC or CSC/ENG
        if (preg_match('/^([A-Z]{2,3})(?:\/([A-Z]{2,3}))?/', $code, $matches)) {
            if (!empty($matches[1])) {
                $disciplinesSet[$matches[1]] = true;
            }
            if (!empty($matches[2])) {
                $disciplinesSet[$matches[2]] = true;
            }
        }
    }

    ksort($disciplinesSet); // Alphabetical order

    echo json_encode([
        'success' => true,
        'data' => array_keys($disciplinesSet)
    ]);
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}