<?php
require_once '../../includes/session_handler.php';
require_once '../../includes/db_connect.php';

// Set the content type to JSON for the response
header('Content-Type: application/json');

// Check if the user is an admin. If not, return a 403 Forbidden response.
if (!isAdmin()) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Not authorized']);
    exit();
}

// Get the ID of the currently logged-in user from the session.
$loggedInUserId = $_SESSION['user_id'];

try {
    // Prepare a SQL statement to select all users, excluding the logged-in user.
    // The 'id' column from the 'users' table is used to identify users.
    $stmt = $connection->prepare("
        SELECT id, username, role 
        FROM users
        WHERE id != ?
    ");
    // Bind the logged-in user's ID to the prepared statement to exclude them from the results.
    $stmt->bind_param("i", $loggedInUserId);
    // Execute the prepared statement.
    $stmt->execute();
    // Get the result set from the executed statement.
    $result = $stmt->get_result();
    
    // Check if the query execution was successful.
    if (!$result) {
        // If not successful, throw an exception with the error message.
        throw new Exception("Query failed: " . $stmt->error);
    }

    $users = [];
    // Fetch each row from the result set and add it to the $users array.
    while ($row = $result->fetch_assoc()) {
        $users[] = $row;
    }

    // Encode the success status and the fetched users data as a JSON object and echo it.
    echo json_encode([
        'success' => true,
        'data' => $users
    ]);

    // Close the prepared statement.
    $stmt->close();

} catch (Exception $e) {
    // If an exception occurs, set the HTTP response code to 500 Internal Server Error.
    http_response_code(500);
    // Encode the failure status and the error message as a JSON object and echo it.
    echo json_encode([
        'success' => false,
        'message' => 'Error fetching users: ' . $e->getMessage()
    ]);
} finally {
    // Ensure the database connection is closed, regardless of success or failure.
    if (isset($connection)) {
        $connection->close();
    }
}
?>