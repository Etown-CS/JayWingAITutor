<?php
require_once '../includes/session_handler.php';
require_once '../includes/db_connect.php';

header('Content-Type: application/json');

if (!isAdmin()) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Not authorized']);
    exit();
}

try {
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($data['id'])) {
        throw new Exception('Class ID is required');
    }

    $connection->begin_transaction();

    // First delete related enrollments
    $stmt1 = $connection->prepare("DELETE FROM user_courses WHERE courseId = ?");
    if (!$stmt1) {
        throw new Exception("Prepare failed for enrollment deletion: " . $connection->error);
    }
    
    $stmt1->bind_param("i", $data['courseId']);
    if (!$stmt1->execute()) {
        throw new Exception("Failed to delete enrollments: " . $stmt1->error);
    }
    
    // Then delete the class
    $stmt2 = $connection->prepare("DELETE FROM courses WHERE id = ?");
    if (!$stmt2) {
        throw new Exception("Prepare failed for class deletion: " . $connection->error);
    }
    
    $stmt2->bind_param("i", $data['id']);
    if (!$stmt2->execute()) {
        throw new Exception("Failed to delete class: " . $stmt2->error);
    }

    $connection->commit();
    
    echo json_encode([
        'success' => true,
        'message' => 'Class and related enrollments deleted successfully'
    ]);

    $stmt1->close();
    $stmt2->close();

} catch (Exception $e) {
    if ($connection->connect_errno) {
        $connection->rollback();
    }
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error deleting class: ' . $e->getMessage()
    ]);
} finally {
    $connection->close();
}