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
    $classFilter = $_GET['class_id'] ?? 'All';
    $userFilter = $_GET['user_id'] ?? 'All';
    $startDate = $_GET['start_date'] ?? null;
    if ($startDate === 'null') {
        $startDate = null; // Handle 'null' string as null
    }
    $endDate = $_GET['end_date'] ?? null;
    $ogEndDate = $endDate; // Store original end date for later use
    if ($endDate === 'null') {
        $endDate = null; // Handle 'null' string as null
    } else {
        $endDate = $endDate . ' 23:59:59';
    }
    $feedbackRating = $_GET['rating'] ?? null;

    if (!$feedbackRating) {
        echo json_encode(['success' => false, 'message' => 'Missing feedback rating']);
        exit;
    }

    $conditions = [];
    $paramTypes = 'si'; // feedbackRating + loggedInUserId
    $params = [$feedbackRating, $loggedInUserId];

    if ($userFilter !== 'All') {
        $conditions[] = "AND userId = ?";
        $paramTypes .= 'i';
        $params[] = $userFilter;
    }

    if ($classFilter !== 'All') {
        $conditions[] = "AND courseId = ?";
        $paramTypes .= 'i';
        $params[] = $classFilter;
    }

    if ($startDate && $endDate) {
        $dateCondition = "AND m.feedbackTimestamp BETWEEN ? AND ?";
        $paramTypes .= 'ss';
        $params[] = $startDate;
        $params[] = $endDate;
    } elseif ($startDate) {
        $dateCondition = "AND m.feedbackTimestamp >= ?";
        $paramTypes .= 's';
        $params[] = $startDate;
    } elseif ($endDate) {
        $dateCondition = "AND m.feedbackTimestamp <= ?";
        $paramTypes .= 's';
        $params[] = $endDate;
    } else {
        $dateCondition = "";
    }

    // Assemble user/class subconditions
    $userClassConditions = implode(" ", $conditions);

    $sql = "
        SELECT 
            m.messageId,
            m.question,
            m.answer,
            m.feedbackRating,
            m.feedbackExplanation,
            m.feedbackTimestamp,
            u.username,
            m.timestamp AS messageTimestamp
        FROM messages m
        JOIN user_courses uc ON m.userCoursesId = uc.userCoursesId
        JOIN users u ON uc.userId = u.id
        WHERE m.feedbackRating = ?
        AND m.userCoursesId IN (
            SELECT userCoursesId
            FROM user_courses
            WHERE courseId IN (
                SELECT courseId
                FROM user_courses
                WHERE userId = ?
            )
            $userClassConditions
        )
        $dateCondition
        ORDER BY m.feedbackTimestamp DESC;
    ";

    $stmt = $connection->prepare($sql);
    $stmt->bind_param($paramTypes, ...$params);
    $stmt->execute();
    $result = $stmt->get_result();
    $entries = [];

    while ($row = $result->fetch_assoc()) {
        $entries[] = $row;
    }

    echo json_encode(['success' => true, 'entries' => $entries]);




} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error fetching feedback: ' . $e->getMessage()
    ]);
} finally {
    if (isset($connection)) {
        $connection->close();
    }
}
?>