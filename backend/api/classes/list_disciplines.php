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
        SELECT DISTINCT
            REGEXP_SUBSTR(c.courseCode, '^[A-Z]+') AS discipline
        FROM courses c
        JOIN user_courses uc ON uc.courseId = c.id
        WHERE courseCode REGEXP '^[A-Z]+[0-9]+$'
        AND uc.userId = ?
        ORDER BY discipline DESC
    ";

    $stmt = $connection->prepare($query);
    $stmt->bind_param("i", $loggedInUserId);
    $stmt->execute();
    $result = $stmt->get_result();

    $disciplines = [];
    while ($row = $result->fetch_assoc()) {
        if (!empty($row['discipline'])) {
            $disciplines[] = $row['discipline'];
        }
    }

    echo json_encode([
        'success' => true,
        'data' => $disciplines
    ]);
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}