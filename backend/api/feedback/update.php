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
    case 'PATCH':
    case 'PUT':
        $messageId = $input['messageId'] ?? null;
        $feedbackRating = $input['feedbackRating'] ?? null;
        $feedbackExplanation = $input['feedbackExplanation'] ?? null;

        // If feedbackExplanation is "" --> null
        if ($feedbackExplanation === "") {
            $feedbackExplanation = null;
        }

        if (!$messageId) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Missing messageId']);
            exit();
        }
        if ($feedbackRating === null && $feedbackExplanation === null) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Missing feedbackRating or feedbackExplanation']);
            exit();
        }

        // Update both feedbackRating and feedbackExplanation
        if ($feedbackRating && $feedbackExplanation) {
            // Ensure feedbackRating is a valid value ('up', 'down', null)
            if (!in_array($feedbackRating, ['up', 'down', null], true)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Invalid feedbackRating value']);
                exit();
            }

            // Update database
            $stmt = $connection->prepare("
                UPDATE messages
                SET feedbackRating = ?, feedbackExplanation = ?, feedbackTimestamp = NOW()
                WHERE messageId = ?
            ");
            $stmt->bind_param("ssi", $feedbackRating, $feedbackExplanation, $messageId);
            $success = $stmt->execute();
            echo json_encode(['success' => $success]);
            break;
        }

        // Update feedbackRating
        if ($feedbackRating) {
            // Ensure feedbackRating is a valid value ('up', 'down', null)
            if (!in_array($feedbackRating, ['up', 'down', null], true)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Invalid feedbackRating value']);
                exit();
            }

            // Update database
            $stmt = $connection->prepare("
                UPDATE messages
                SET feedbackRating = ?, feedbackExplanation = null, feedbackTimestamp = NOW()
                WHERE messageId = ?
            ");
            $stmt->bind_param("si", $feedbackRating, $messageId);
            $success = $stmt->execute();
            echo json_encode(['success' => $success]);
            break;
        }

        // Update feedbackExplanation
        if ($feedbackExplanation) {
            // Update database
            $stmt = $connection->prepare("
                UPDATE messages
                SET feedbackExplanation = ?, feedbackTimestamp = NOW()
                WHERE messageId = ?
            ");
            $stmt->bind_param("si", $feedbackExplanation, $messageId);
            $success = $stmt->execute();
            echo json_encode(['success' => $success]);
            break;
        }
        break;

    case 'DELETE':
        $messageId = $input['messageId'] ?? null;
        if (!$messageId) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Missing messageId']);
            exit();
        }

        // Delete feedback
        $stmt = $connection->prepare("
            UPDATE messages
            SET feedbackRating = NULL, feedbackExplanation = NULL, feedbackTimestamp = NULL
            WHERE messageId = ?
        ");
        $stmt->bind_param("i", $messageId);
        $success = $stmt->execute();

        echo json_encode(['success' => $success]);
        break;

    default:
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Method not allowed']);
}
?>