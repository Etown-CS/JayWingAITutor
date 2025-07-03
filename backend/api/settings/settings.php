<?php
require_once '../../includes/session_handler.php';
require_once '../../includes/db_connect.php';

header('Content-Type: application/json');

// Ensure user is logged in
if (!isLoggedIn()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit();
}

$userId = $_SESSION['user_id'] ?? null;
$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true);
$action = $_GET['action'] ?? $input['action'] ?? null;

switch ($action) {
    case 'saveSettings':
        $responseLength = $input['responseLength'] ?? null;
        $interestInput = $input['interestInput'] ?? null;
        // If interest is "" --> null
        if ($interestInput === "") {
            $interestInput = null;
        }
        $chatId = $input['chatId'] ?? null;

        if ($responseLength === null) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Missing parameters']);
            break;
        }

        // Update settings
        $stmt = $connection->prepare("
            UPDATE user_courses SET responseLength = ?, interest = ?
            WHERE userCoursesId = ?
        ");
        $stmt->bind_param("ssi", $responseLength, $interestInput, $chatId);
        $success = $stmt->execute();

        if ($success) {
            echo json_encode(['success' => true, 'message' => 'Settings saved']);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Database error']);
        }
        break;

    case 'getSettings':
        $chatId = $input['chatId'] ?? $_GET['chatId'] ?? null;
        if (!$chatId) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Missing chatId']);
            break;
        }

        $stmt = $connection->prepare("
            SELECT responseLength, interest
            FROM user_courses
            WHERE userCoursesId = ?
        ");
        $stmt->bind_param("i", $chatId);
        $stmt->execute();
        $result = $stmt->get_result();
        $settings = $result->fetch_assoc();

        if ($settings) {
            echo json_encode(['success' => true, 'settings' => $settings]);
        } else {
            echo json_encode(['success' => true, 'settings' => null]);
        }
        break;

    default:
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid action']);
}
