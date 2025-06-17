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
    $stats = [];

    // Get filters
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
    $qa_filter = $_GET['qa_filter'] ?? 'Both'; // Might not be used here?

    $paramTypes = 'i'; // For loggedInUserId
    $params = [$loggedInUserId];

    // Construct filters
    if ($userFilter === 'All') {
        $userCondition = "";
    } else {
        $userCondition = "AND userId = ?";
        $paramTypes .= 'i';
        $params[] = $userFilter;
    }

    if ($classFilter === 'All') {
        $classCondition = "";
    } else {
        $classCondition = "AND courseId = ?";
        $paramTypes .= 'i';
        $params[] = $classFilter;
    }

    if ($startDate && $endDate) {
        $dateCondition = "AND m.timestamp BETWEEN ? AND ?";
        $paramTypes .= 'ss';
        $params[] = $startDate;
        $params[] = $endDate;
    } elseif ($startDate) {
        $dateCondition = "AND m.timestamp >= ?";
        $paramTypes .= 's';
        $params[] = $startDate;
    } elseif ($endDate) {
        $dateCondition = "AND m.timestamp <= ?";
        $paramTypes .= 's';
        $params[] = $endDate;
    } else {
        $dateCondition = "";
    }

    // Query for message counts
    $messageCounts = "SELECT 
            SUM(CASE WHEN m.feedbackRating = 'up' THEN 1 ELSE 0 END) AS liked_messages,
            SUM(CASE WHEN m.feedbackRating = 'down' THEN 1 ELSE 0 END) AS disliked_messages,
            COUNT(*) AS message_count
        FROM messages m
        WHERE m.userCoursesId IN (
            SELECT userCoursesId
            FROM user_courses
            WHERE courseId IN (
                SELECT courseId
                FROM user_courses
                WHERE userId = ? -- prof user
            )
            $userCondition
            $classCondition
        )
        $dateCondition
    ";

    $stmt = $connection->prepare($messageCounts);
    
    if (!$stmt) {
        throw new Exception("Prepare failed: " . $connection->error);
    }
    $stmt->bind_param($paramTypes, ...$params);
    if (!$stmt->execute()) {
        throw new Exception("Execution failed: " . $stmt->error);
    }
    $result = $stmt->get_result();
    if (!$result) {
        throw new Exception("Query failed: " . $stmt->error);
    }
    $row = $result->fetch_assoc();
    $stats['message_counts'] = [
        'liked_messages' => (int)$row['liked_messages'],
        'disliked_messages' => (int)$row['disliked_messages'],
        'message_count' => (int)$row['message_count']
    ];
    $stmt->close();

    // Determine which query to do next based on date filters
    if ($startDate === $ogEndDate && $endDate !== null) { // Make sure they are equal and not null
        // Query for most active hour
        $mostActiveHourQuery = "
            SELECT 
                DATE_FORMAT(m.timestamp, '%Y-%m-%d %H:00:00') AS message_hour, COUNT(*) AS total_messages
            FROM messages m
            WHERE m.userCoursesId IN (
                SELECT userCoursesId
                FROM user_courses
                WHERE courseId IN (
                    SELECT courseId
                    FROM user_courses
                    WHERE userId = ? -- prof user
                )
                $userCondition
                $classCondition
            )
            $dateCondition
            GROUP BY message_hour
            ORDER BY total_messages DESC
            LIMIT 1;
        ";

        $stmt = $connection->prepare($mostActiveHourQuery);
        if (!$stmt) {
            throw new Exception("Prepare failed: " . $connection->error);
        }
        $stmt->bind_param($paramTypes, ...$params);
        if (!$stmt->execute()) {
            throw new Exception("Execution failed: " . $stmt->error);
        }
        $result = $stmt->get_result();
        if (!$result) {
            throw new Exception("Query failed: " . $stmt->error);
        }
        $mostActiveHour = $result->fetch_assoc();
        $stats['most_active_hour'] = [
            'hour' => $mostActiveHour['message_hour'],
            'total_messages' => (int)$mostActiveHour['total_messages']
        ];
        $stmt->close();
    } else {
        // Query for most active day
        $mostActiveDayQuery = "
            SELECT 
                DATE(m.timestamp) AS message_day, COUNT(*) AS total_messages
            FROM messages m
            WHERE m.userCoursesId IN (
                SELECT userCoursesId
                FROM user_courses
                WHERE courseId IN (
                    SELECT courseId
                    FROM user_courses
                    WHERE userId = ? -- prof user
                )
                $userCondition
                $classCondition
            )
            $dateCondition
            GROUP BY message_day
            ORDER BY total_messages DESC
            LIMIT 1;
        ";

        $stmt = $connection->prepare($mostActiveDayQuery);
        if (!$stmt) {
            throw new Exception("Prepare failed: " . $connection->error);
        }
        $stmt->bind_param($paramTypes, ...$params);
        if (!$stmt->execute()) {
            throw new Exception("Execution failed: " . $stmt->error);
        }
        $result = $stmt->get_result();
        if (!$result) {
            throw new Exception("Query failed: " . $stmt->error);
        }
        $mostActiveDay = $result->fetch_assoc();
        $stats['most_active_day'] = [
            'day' => $mostActiveDay['message_day'],
            'total_messages' => (int)$mostActiveDay['total_messages']
        ];
        $stmt->close();
    }
    
    // Determine which query to do next based on course and user filters
    if ($userFilter !== 'All' && $classFilter !== 'All') {
        // Average words per message for user in a specific course
        $avgMessageQuery = "
            SELECT
                ROUND(AVG(CHAR_LENGTH(m.question) - CHAR_LENGTH(REPLACE(m.question, ' ', '')) + 1), 1) AS student_avg_words,
                (
                    SELECT ROUND(AVG(CHAR_LENGTH(m2.question) - CHAR_LENGTH(REPLACE(m2.question, ' ', '')) + 1), 1)
                    FROM messages m2
                    JOIN user_courses uc2 ON m2.userCoursesId = uc2.userCoursesId
                    WHERE uc2.courseId = ?
                ) AS course_avg_words
            FROM messages m
            JOIN user_courses uc ON m.userCoursesId = uc.userCoursesId
            WHERE uc.userId = ? AND uc.courseId = ?
            ";

        $stmt = $connection->prepare($avgMessageQuery);
        $stmt->bind_param("iii", $classFilter, $userFilter, $classFilter);
        $stmt->execute();
        $result = $stmt->get_result();
        $avgMessages = $result->fetch_assoc();
        
        $stats['average_words_per_message'] = [
            'student_avg_words' => (float)$avgMessages['student_avg_words'],
            'course_avg_words' => (float)$avgMessages['course_avg_words']
        ];

        $stmt->close();
    } else if ($userFilter === 'All' && $classFilter !== 'All') {
        // Only class filter is applied so multiple users can be queried
        // Query for most active user in a specific course
        $mostActiveUserQuery = "
            SELECT 
                u.id AS user_id,
                u.username AS user_name,
                COUNT(m.messageId) AS total_messages
            FROM messages m
            JOIN user_courses uc ON m.userCoursesId = uc.userCoursesId
            JOIN users u ON uc.userId = u.id
            WHERE uc.courseId IN (
                SELECT courseId
                FROM user_courses
                WHERE userId = ? -- professor's user ID
            ) -- Maybe not necessary
            $classCondition
            $dateCondition
            GROUP BY u.id, u.username
            ORDER BY total_messages DESC
            LIMIT 1;
        ";
        $stmt = $connection->prepare($mostActiveUserQuery);
        if (!$stmt) {
            throw new Exception("Prepare failed: " . $connection->error);
        }
        $stmt->bind_param($paramTypes, ...$params);
        if (!$stmt->execute()) {
            throw new Exception("Execution failed: " . $stmt->error);
        }
        $result = $stmt->get_result();
        if (!$result) {
            throw new Exception("Query failed: " . $stmt->error);
        }
        $mostActiveUser = $result->fetch_assoc();
        $stats['most_active_user'] = [
            'user_id' => (int)$mostActiveUser['user_id'],
            'user_name' => $mostActiveUser['user_name'],
            'total_messages' => (int)$mostActiveUser['total_messages']
        ];
        $stmt->close();
    } else {
        // No specific filters applied, most active course query
        $mostActiveCourseQuery = "
            SELECT 
                c.name AS course_name, COUNT(*) AS total_messages
            FROM messages m
            JOIN user_courses uc ON m.userCoursesId = uc.userCoursesId
            JOIN courses c ON uc.courseId = c.id
            WHERE m.userCoursesId IN (
                SELECT userCoursesId
                FROM user_courses
                WHERE courseId IN (
                    SELECT courseId
                    FROM user_courses
                    WHERE userId = ? -- prof user
                )
                $userCondition
                $classCondition
            )
            $dateCondition
            GROUP BY c.id
            ORDER BY total_messages DESC
            LIMIT 1;
        ";
        $stmt = $connection->prepare($mostActiveCourseQuery);
        if (!$stmt) {
            throw new Exception("Prepare failed: " . $connection->error);
        }
        $stmt->bind_param($paramTypes, ...$params);
        if (!$stmt->execute()) {
            throw new Exception("Execution failed: " . $stmt->error);
        }
        $result = $stmt->get_result();
        if (!$result) {
            throw new Exception("Query failed: " . $stmt->error);
        }
        $mostActiveCourse = $result->fetch_assoc();
        $stats['most_active_course'] = [
            'course_name' => $mostActiveCourse['course_name'],
            'total_messages' => (int)$mostActiveCourse['total_messages']
        ];
        $stmt->close();
    }
        
        

    
    
    echo json_encode([
        'success' => true,
        'data' => $stats
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error fetching carousel: ' . $e->getMessage()
    ]);
} finally {
    if (isset($connection)) {
        $connection->close();
    }
}
?>