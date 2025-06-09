<?php
require_once '../includes/session_handler.php';
require_once '../includes/db_connect.php';

header('Content-Type: application/json');

// Ensure user is logged in
if (!isLoggedIn()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit();
}

$userId = $_SESSION['user_id'] ?? null;

// Get request method and parse input
$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true);
$action = $_GET['action'] ?? $input['action'] ?? null;

switch ($action) {
    case 'get':
        // Return archived courses
        $stmt = $connection->prepare("
            SELECT c.name AS courseName, uc.userCoursesId
            FROM user_courses uc
            JOIN courses c ON c.id = uc.courseId
            WHERE uc.userId = ? AND uc.archived = 1
            ORDER BY c.name ASC
        ");
        $stmt->bind_param("i", $userId);
        $stmt->execute();
        $result = $stmt->get_result();

        $archivedCourses = [];
        while ($row = $result->fetch_assoc()) {
            $archivedCourses[] = [
                'id' => $row['userCoursesId'],
                'name' => $row['courseName']
            ];
        }

        echo json_encode($archivedCourses);
        break;

    case 'restore':
        // Change archived status to false (0)
        $name = $input['courseName'] ?? null;
        if (!$name) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Missing Name']);
            break;
        }

        // Get userCoursesId based on course name and userId
        $stmt = $connection->prepare("
            SELECT uc.userCoursesId, c.id AS courseId
            FROM user_courses uc
            JOIN courses c ON uc.courseId = c.id
            WHERE c.name = ? AND uc.userId = ? AND uc.archived = 1
            LIMIT 1
        ");
        $stmt->bind_param("si", $name, $userId);
        $stmt->execute();
        $result = $stmt->get_result();
        $row = $result->fetch_assoc();

        if (!$row) {
            echo json_encode(['success' => false, 'message' => 'Course not found or already active']);
            break;
        }

        $userCoursesId = $row['userCoursesId'];
        $courseId = $row['courseId'];

        // Update archived status to false (0)
        $stmt = $connection->prepare("
            UPDATE user_courses SET archived = 0 WHERE userCoursesId = ?
        ");
        $stmt->bind_param("i", $userCoursesId);
        $success = $stmt->execute();

        // Get latest message from course
        $stmt = $connection->prepare("
            SELECT question FROM messages
            WHERE userCoursesId = ?
            ORDER BY timestamp DESC
            LIMIT 1
        ");
        $stmt->bind_param("i", $userCoursesId);
        $stmt->execute();
        $msgResult = $stmt->get_result();
        $messageRow = $msgResult->fetch_assoc();
        $latestMessage = $messageRow['question'] ?? null;

        // Return relevant information for the restored course
        echo json_encode([
            'success' => $success,
            'userCoursesId' => $userCoursesId,
            'latestMessage' => $latestMessage,
            'courseName' => $name
        ]);
        break;

    case 'archive':
        // Change archived status to true (1)
        $id = $input['userCoursesId'] ?? null;
        if (!$id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Missing ID']);
            break;
        }

        $stmt = $connection->prepare("
            UPDATE user_courses SET archived = 1
            WHERE userCoursesId = ? AND userId = ?
        ");
        $stmt->bind_param("ii", $id, $userId);
        $success = $stmt->execute();
        echo json_encode(['success' => $success]);
        break;

    default:
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid action']);
}
