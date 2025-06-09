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
    $query = "
        SELECT DISTINCT
            REGEXP_SUBSTR(courseCode, '^[A-Z]+') AS discipline
        FROM courses
        WHERE courseCode REGEXP '^[A-Z]+[0-9]+$'
        ORDER BY discipline ASC
    ";

    $stmt = $connection->prepare($query);
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