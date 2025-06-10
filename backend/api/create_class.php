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

    // Start transaction
    $connection->begin_transaction();

    // 1. Insert into courses table
    $stmt_course = $connection->prepare("INSERT INTO courses (name, courseCode, description) VALUES (?, ?, ?)");

    if (!$stmt_course) {
        throw new Exception("Prepare statement for courses failed: " . $connection->error);
    }

    $name = $data['name'];
    $courseCode = $data['courseCode'] ?? null;
    $description = $data['description'] ?? null;

    $stmt_course->bind_param("sss", $name, $courseCode, $description);

    if (!$stmt_course->execute()) {
        throw new Exception("Execution failed for courses: " . $stmt_course->error);
    }

    $newCourseId = $connection->insert_id; // Get the ID of the newly created course
    $stmt_course->close();

    // 2. Enroll the professor in the newly created course in user_courses table
    // Assuming 'professor' or similar is the role you want to assign
    // The 'interest' field in user_courses could be used for the role (e.g., 'professor')
    $stmt_enrollment = $connection->prepare("INSERT INTO user_courses (userId, courseId, interest) VALUES (?, ?, ?)");

    if (!$stmt_enrollment) {
        throw new Exception("Prepare statement for user_courses failed: " . $connection->error);
    }

    $roleInClass = 'professor'; // Or whatever string makes sense for a professor's role/interest
                               // The ERD shows 'interest VARCHAR(100)', so 'professor' is suitable.
    $stmt_enrollment->bind_param("iis", $professorId, $newCourseId, $roleInClass);

    if (!$stmt_enrollment->execute()) {
        throw new Exception("Execution failed for user_courses enrollment: " . $stmt_enrollment->error);
    }

    $stmt_enrollment->close();

    // Commit transaction if both operations were successful
    $connection->commit();

    echo json_encode([
        'success' => true,
        'message' => 'Class created and professor enrolled successfully!',
        'id' => $newCourseId
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