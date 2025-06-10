<?php
require_once '../includes/session_handler.php';
require_once '../includes/db_connect.php';

header('Content-Type: application/json');

// Ensure the user is logged in and is an admin (professor)
if (!isLoggedIn() || !isAdmin()) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Not authorized']);
    exit();
}

// Get the logged-in user's ID (professor's ID)
// This assumes your session_handler.php or similar mechanism makes $_SESSION['user_id'] available.
$professorId = $_SESSION['user_id'] ?? null;

if ($professorId === null) {
    http_response_code(401); // Unauthorized if user_id is not in session
    echo json_encode(['success' => false, 'message' => 'User ID not found in session. Please log in again.']);
    exit();
}


try {
    $data = json_decode(file_get_contents('php://input'), true);

    if (!isset($data['name'])) {
        throw new Exception('Class name is required');
    }

    // Create variables for binding
    $userId = $_SESSION['user_id'] ?? null;
    if (!$userId) {
        throw new Exception("User ID not found in session");
    }
    $name = $data['name'];
    $courseCode = $data['courseCode'] ?? null;
    $description = $data['description'] ?? null;

    // Get user name from ID
    $stmt = $connection->prepare("SELECT username FROM users WHERE id = ?");
    $stmt->bind_param("i", $userId);
    if (!$stmt->execute()) {
        throw new Exception("Execution failed: " . $stmt->error);
    }
    $result = $stmt->get_result();
    $user = $result->fetch_assoc();
    $stmt->close();
    $username = $user['username'];

    // Create filepath
    $filepath = "" . $username . "_" . $userId . "/" . $name . "/";

    $stmt = $connection->prepare("INSERT INTO courses (name, filepath, courseCode, description) VALUES (?, ?, ?, ?)"); // TODO: Add filepath
    
    if (!$stmt) {
        throw new Exception("Prepare failed: " . $connection->error);
    }

    // Bind using variables
    $stmt->bind_param("ssss", $name, $filepath, $courseCode, $description);

    if (!$stmt->execute()) {
        throw new Exception("Execution failed: " . $stmt->error);
    }

    $newId = $connection->insert_id;

    // Enroll the professor in the newly created class
    $stmt = $connection->prepare("INSERT INTO user_courses (courseId, userId) VALUES (?, ?)");
    if (!$stmt) {
        throw new Exception("Prepare failed: " . $connection->error);
    }
    $stmt->bind_param("ii", $newId, $professorId);
    if (!$stmt->execute()) {
        throw new Exception("Execution failed: " . $stmt->error);
    }
    $stmt->close();

    
    echo json_encode([
        'success' => true,
        'message' => 'Class created and professor enrolled successfully!',
        'id' => $newId
    ]);

} catch (Exception $e) {
    // Rollback transaction on error
    $connection->rollback();
    http_response_code(500);
    error_log("Error creating class and enrolling professor: " . $e->getMessage()); // Log error for debugging
    echo json_encode([
        'success' => false,
        'message' => 'Error creating class and enrolling professor: ' . $e->getMessage()
    ]);
} finally {
    $connection->close();
}
?>