<?php
require_once '../../includes/session_handler.php';
require_once '../../includes/db_connect.php';

header('Content-Type: application/json');

if (!isLoggedIn()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit();
}

$userId = $_SESSION['user_id'];
$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true);

switch ($method) {
    case 'getMessages':
        $messageId = $_GET['messageId'] ?? null;
        if (!$messageId) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Missing messageId']);
            exit();
        }

        // Get message content
        $stmt = $connection->prepare("SELECT * FROM messages WHERE messageId = ?");
        $stmt->bind_param("i", $messageId);
        $stmt->execute();
        $result = $stmt->get_result();
        if ($result->num_rows > 0) {
            $message = $result->fetch_assoc();
            echo json_encode(['success' => true, 'message' => $message]);
        } else {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Message not found. ID: ' . $messageId]);
        }
        break;

        default:
            http_response_code(405);
            echo json_encode(['success' => false, 'message' => 'Method not allowed']);
            exit();
}
?>