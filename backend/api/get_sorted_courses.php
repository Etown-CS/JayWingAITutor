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
        m.question AS latestQuestion,
        latest.latestTimestamp AS lastInteracted
    FROM user_courses uc
    JOIN courses c ON c.id = uc.courseId
    LEFT JOIN (
        SELECT userCoursesId, MAX(timestamp) AS latestTimestamp
        FROM messages
        GROUP BY userCoursesId
    ) latest ON latest.userCoursesId = uc.userCoursesId
    LEFT JOIN messages m ON m.userCoursesId = uc.userCoursesId AND m.timestamp = latest.latestTimestamp
    WHERE uc.userId = ?
    $orderClause;
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