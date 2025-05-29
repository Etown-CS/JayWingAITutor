<?php
require_once '../includes/session_handler.php';
require_once '../includes/db_connect.php';

header('Content-Type: application/json');

if (!isLoggedIn()) {
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

$userId = $_SESSION['user_id'];
$sortMethod = $_GET['sortBy'] ?? 'sortRecent';

$orderClause = match($sortMethod) {
    'sortAlphabetical' => 'ORDER BY c.name ASC',
    default => 'ORDER BY latestMessageTime DESC'
};

$query = "
    SELECT 
        c.name AS courseName,
        uc.userCoursesId,
        MAX(m.timestamp) AS latestMessageTime,
        (
            SELECT m2.answer 
            FROM messages m2 
            WHERE m2.userCoursesId = uc.userCoursesId 
              AND m2.answer IS NOT NULL 
            ORDER BY m2.timestamp DESC 
            LIMIT 1
        ) AS answer
    FROM user_courses uc
    JOIN courses c ON uc.courseId = c.id
    LEFT JOIN messages m ON uc.userCoursesId = m.userCoursesId
    WHERE uc.userId = ?
    GROUP BY uc.userCoursesId
    $orderClause
";

$stmt = $connection->prepare($query);
$stmt->bind_param("i", $userId);
$stmt->execute();
$result = $stmt->get_result();

$courses = [];
while ($row = $result->fetch_assoc()) {
    $courses[] = $row;
}

echo json_encode($courses);