<!-- TODO: fix and implement with new db when ready -->

<?php
require_once '../includes/session_handler.php';
require_once '../includes/db_connect.php';

header('Content-Type: application/json');

if (!isLoggedIn()) {
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

$userId = $_SESSION['user_id'];
$sortMethod = $_GET['sortBy'] ?? 'coursesByRecent';

$orderClause = match($sortMethod) {
    'coursesByDiscipline' => 'ORDER BY c.name ASC',
    default => 'ORDER BY MAX(m.timestamp) DESC'
};

$query = "
    SELECT c.name AS courseName, MAX(m.timestamp) AS latestMessageTime, m.answer, ch.chatId
    FROM courses AS c
    JOIN user_courses AS uc ON c.id = uc.courseId
    JOIN chats AS ch ON uc.userCoursesId = ch.userCoursesId
    JOIN messages AS m ON ch.chatId = m.chatId
    WHERE uc.userId = ?
    GROUP BY ch.chatId
    $orderClause
";

$stmt = $connection->prepare($query);
$stmt->bind_param("i", $userId);
$stmt->execute();
$result = $stmt->get_result();

$chats = [];
while ($row = $result->fetch_assoc()) {
    $chats[] = $row;
}

echo json_encode($chats);