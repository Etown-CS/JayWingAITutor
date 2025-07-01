<?php
require_once '../backend/includes/session_handler.php';
require_once '../backend/includes/db_connect.php';

$isUserLoggedIn = isLoggedIn();
if ($isUserLoggedIn) {
    $userId = $_SESSION['user_id'];
}

// Executes when chat is opened
if (isset($_GET['chatId']) && filter_var($_GET['chatId'], FILTER_VALIDATE_INT)) {
    $currentChat = (int) $_GET['chatId'];
    // echo "DEBUG: userId = $userId, chatId = $currentChat";
    
    // Validate that the user is a participant of the chat before inserting the message
    $stmt = $connection->prepare("
        SELECT 1
        FROM user_courses uc
        WHERE uc.userId = ?
        AND uc.userCoursesId = ?;
    ");
    $stmt->bind_param("ii", $userId, $currentChat);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 0) {
        // User is not part of this chat, redirect them or show an error
        header("Location: index.php"); // Redirect to a safe page
        exit();
    }

    // User is validated at this point
    // Get course name chat is for
    $stmt = $connection->prepare("
        SELECT c.name, u.username, u.role
        FROM user_courses uc
        JOIN courses c ON c.id = uc.courseId
        JOIN users u ON u.id = uc.userId
        WHERE uc.userCoursesId = ?
        AND uc.userId = ?;
    ");
    $stmt->bind_param("ii", $currentChat, $userId);
    $stmt->execute();
    $result = $stmt->get_result();

    // Store results
    $row = $result->fetch_assoc();
    $chatCourseName = $row['name'] ?? '';
    $username = $row['username'] ?? '';
    $userRole = $row['role'] ?? '';

} else {
    $currentChat = 0;
}

?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Messages</title>

    <!-- tailwind css -->
    <link href="https://cdnjs.cloudflare.com/ajax/libs/tailwindcss/2.2.19/tailwind.min.css" rel="stylesheet">

    <!-- bootstrap css -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH" crossorigin="anonymous">

    <!-- font awesome -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">

    <!-- custom css -->
    <link rel="stylesheet" href="static/student.css">
    <script>
        // Global variables for JS - must have current chat defined
        <?php if ($currentChat) : ?>
            const currentCourseName = <?php echo json_encode($chatCourseName); ?>;
            const currentChatId = <?php echo json_encode($currentChat); ?>;
            const username = <?php echo json_encode($username ?? null); ?>;
            const userId = <?php echo json_encode($userId ?? null); ?>;
            const userRole = <?php echo json_encode($userRole ?? null); ?>;
        <?php endif; ?>
    </script>
    <style>
    .typing-dots {
        display: inline-block;
    }

    .typing-dots span {
        display: inline-block;
        width: 6px;
        height: 6px;
        margin: 0 2px;
        background-color: #3498db; /* Blue dot color */
        border-radius: 50%;
        opacity: 0.4;
        animation: blink 1.4s infinite both;
    }

    .typing-dots span:nth-child(1) { animation-delay: 0s; }
    .typing-dots span:nth-child(2) { animation-delay: 0.2s; }
    .typing-dots span:nth-child(3) { animation-delay: 0.4s; }

    @keyframes blink {
        0%, 80%, 100% { opacity: 0.4; }
        40% { opacity: 1; }
    }
    </style>

</head>
<body class="flex flex-col h-screen gap-0 overflow-hidden">
    <header id="header" class="position-relative d-flex justify-content-center align-items-center py-3 bg-primary text-white w-100 mb-0">
        <button
            type="button"
            class="position-absolute start-0 ms-3 rounded bg-primary text-white"
            id="home"
            aria-label="Home">
            <i class="fas fa-house"></i>
        </button>
        <span>Student Page</span>
    </header>


    <div id="feedback-banner" class="fixed top-0 left-1/2 transform -translate-x-1/2 mt-4 bg-blue-100 text-blue-800 px-4 py-2 rounded shadow hidden z-50 text-sm">
        Thank you for your feedback!
        <button id="add-comment-btn" class="ml-2 underline hover:text-blue-900">Add a comment?</button>
    </div>

    <div id="success-banner" class="fixed top-0 left-1/2 transform -translate-x-1/2 mt-4 bg-green-100 text-green-800 px-4 py-2 rounded shadow hidden text-sm">
        Changes saved successfully!
    </div>

    <div id="error-banner" class="fixed top-0 left-1/2 transform -translate-x-1/2 mt-4 bg-red-100 text-red-800 px-4 py-2 rounded shadow hidden text-sm">
        <!-- JavaScript -->
    </div>

    <div id="my-content" class="right-collapsed flex flex-row flex-grow w-full mt-0 overflow-hidden">
        
        <!-- Left sidebar with chats list -->
        <div id="left-sidebar" class="d-flex flex-column flex-shrink-0 bg-gray-100 h-full overflow-hidden w-full">
            <div class="flex justify-between items-center mb-4">
                <!-- Chat Search Bar -->
                <div class="px-3 pt-3 d-flex align-items-center w-full">
                    <input
                        type="text"
                        id="searchBar"
                        class="form-control flex-grow-1 me-2 left-sidebar-content-hide"
                        placeholder="⌕ Search Chats..."
                        aria-label="ChatSearch"
                        aria-describedby="basic-addon1"
                        oninput="filterChats()"
                    >
                    <button
                        type="button"
                        class="block p-2 rounded bg-gray-100 hover:bg-gray-250 active:bg-gray-300"
                        id="toggle-left-sidebar"
                        aria-label="Toggle Left Sidebar">
                        <i class="fas fa-bars"></i>
                    </button>
                    <button
                        type="button"
                        class="block p-2 rounded bg-gray-100 hover:bg-gray-250 active:bg-gray-300 hidden"
                        id="hide-left-sidebar-mobile"
                        aria-label="Hide Left Sidebar Mobile">
                        <i class="fas fa-xmark"></i>
                    </button>
                </div>
            </div>

            <!-- Sorts/Filters -->
            <div class="d-flex gap-2 px-3 pb-3 left-sidebar-content-hide">
                <select class="form-select bg-primary text-white w-75" id="sort-by-btn" name="sortBy">
                    <option value="sortRecent">Sort by: Recent</option>
                    <option value="sortAlphabetical">Sort by: Alphabetical</option>
                </select>
                <?php
                    $query = "
                        SELECT DISTINCT c.courseCode
                        FROM courses c
                        JOIN user_courses uc ON uc.courseId = c.id
                        WHERE uc.userId = ?
                    ";

                    $stmt = $connection->prepare($query);
                    $stmt->bind_param("i", $userId);
                    $stmt->execute();
                    $results = $stmt->get_result();

                    $disciplinesSet = [];

                    while ($row = $results->fetch_assoc()) {
                        $code = $row['courseCode'];
                        // Updated regex to capture both parts
                        if (preg_match('/^([A-Z]{2,3})(?:\/([A-Z]{2,3}))?/', $code, $matches)) {
                            if (!empty($matches[1])) {
                                $disciplinesSet[$matches[1]] = true;
                            }
                            if (!empty($matches[2])) {
                                $disciplinesSet[$matches[2]] = true;
                            }
                        }
                    }

                    ksort($disciplinesSet); // Sort alphabetically
                ?>
                <select class="form-select bg-primary text-white w-25" id="filter-by-button" name="filterBy">
                    <option value="allCourses">All</option>
                    <?php foreach ($disciplinesSet as $discipline => $_): ?>
                        <option value="<?= $discipline ?>"><?= $discipline ?></option>
                    <?php endforeach; ?>
                </select>
            </div>

            <!-- List of existing chats -->
            <div id="sidebar-courses" class="space-y-2 flex-grow ps-3 pb-3 overflow-y-auto overflow-x-hidden left-sidebar-content-hide p-sidebar-noshow">
                <div id="chat-div" class="d-grid gap-2">
                    <?php
                        // Getting discipline filter
                        $filterBy = $_GET['filterBy'] ?? 'allCourses';
                        if ($filterBy !== 'allCourses') {
                            // Escape filter value for SQL query
                            $filterBy = $connection->real_escape_string($filterBy);
                            $filterClause = "AND (c.courseCode LIKE '$filterBy%' OR c.courseCode REGEXP '^[^/]+/{$filterBy}.*')";
                        } else {
                            $filterClause = '';
                        }
                        
                        // Getting sort
                        $sortBy = $_GET['sortBy'] ?? 'sortRecent';

                        $orderClause = match($sortBy) {
                            'sortAlphabetical' => 'ORDER BY c.name ASC',
                            default => 'ORDER BY 
                                            latest.latestTimestamp IS NULL,
                                            latest.latestTimestamp DESC'
                        };

                        $query = "
                            SELECT 
                                c.name AS courseName,
                                uc.userCoursesId,
                                m.question AS latestQuestion,
                                latest.latestTimestamp AS lastInteracted
                            FROM user_courses uc
                            JOIN courses c ON c.id = uc.courseId
                            LEFT JOIN (
                                SELECT userCoursesId, MAX(timestamp) AS latestTimestamp
                                FROM messages
                                GROUP BY userCoursesId
                            ) latest ON latest.userCoursesId = uc.userCoursesId
                            LEFT JOIN messages m ON m.userCoursesId = uc.userCoursesId AND m.timestamp = latest.latestTimestamp
                            WHERE uc.userId = ?
                            AND uc.archived = 0
                            $filterClause
                            $orderClause;
                        ";

                        $stmt = $connection->prepare($query);
                        $stmt->bind_param("i", $userId);
                        $stmt->execute();
                        $chats = $stmt->get_result();

                        // For tracking courses already displayed
                        $displayedCourses = [];
                        
                        if (isset($error)) {
                            echo '<div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">';
                            echo '<strong class="font-bold">Error!</strong>';
                            echo '<span class="block sm:inline"> ' . htmlspecialchars($error) . '</span>';
                            echo '</div>';
                        }

                        while ($chat = $chats->fetch_assoc()):
                            $courseName = $chat['courseName'];
                            // I don't remember why we needed this?
                            // if (in_array($courseName, $displayedCourses)) { 
                            //     continue; // Skip if course already displayed
                            // }
                            $displayedCourses[] = $courseName; // Add to displayed courses to avoid duplicates
                    ?>
                    <div class="relative group bg-gray-100 p-3 rounded <?php echo $currentChat == $chat['userCoursesId'] ? 'bg-gray-200' : ''; ?> w-full overflow-hidden hover:bg-gray-200">
                        <a href="?sortBy=<?php echo urlencode($_GET['sortBy'] ?? 'sortRecent'); ?>&chatId=<?php echo htmlspecialchars($chat['userCoursesId'], ENT_QUOTES, 'UTF-8'); ?>"
                            class="block w-full">
                            <div class="font-medium truncate"><?php echo htmlspecialchars($chat['courseName'], ENT_QUOTES, 'UTF-8'); ?></div>
                            <?php if ($chat['latestQuestion']): ?>
                                <div class="text-xs text-gray-500 truncate"><?php echo htmlspecialchars($chat['latestQuestion'], ENT_QUOTES, 'UTF-8'); ?></div>
                            <?php else: ?>
                                <div class="text-xs text-gray-500">No messages yet</div>
                            <?php endif; ?>
                        </a>
                        <!-- Small Archive Button -->
                        <div 
                            class="hover-child archive-icon-button absolute top-2 right-2 w-4 h-4 opacity-0 group-hover:opacity-100 cursor-pointer transition-all"
                            title="Archive this course"
                            onclick="archiveCourse(<?php echo htmlspecialchars($chat['userCoursesId'], ENT_QUOTES, 'UTF-8'); ?>)">
                        </div>
                    </div>
                    <?php endwhile; ?>
                </div>
            </div>
            <!-- Horizontal Separator -->
            <hr class="border-t-2 border-gray-300 mx-3 mb-2 mt-0 left-sidebar-content-hide">

            <!-- Archive Button -->
            <div id="archive-button" class="archive-button relative bg-gray-100 p-3 rounded mx-3 mb-4 hover:bg-gray-200 cursor-pointer flex items-center gap-2 left-sidebar-content-hide">
                <div class="archive-icon w-6 h-6"></div>
                <span class="text-gray-700 font-medium text-lg">Archived</span>
            </div>
        </div>

        <!-- Main chat area JAYWING -->
        <div id="chat-container" class="flex flex-col bg-white pb-2 overflow-hidden">
            <?php if ($currentChat): ?>
                <?php
                // Get chat details
                $stmt = $connection->prepare("SELECT * FROM user_courses WHERE userCoursesId = ?");
                $stmt->bind_param("i", $currentChat);
                $stmt->execute();
                $chatDetails = $stmt->get_result()->fetch_assoc();
                ?>
                
                    <!-- Chat header -->
                    <div id="chat-header" class="flex items-center justify-between p-3 w-full border-b-4 border-gray-50">
                        <button
                            type="button"
                            class="p-2 rounded bg-gray-100 hover:bg-gray-250 active:bg-gray-300 lg:hidden"
                            id="show-left-sidebar-mobile"
                            aria-label="Toggle Left Sidebar Mobile">
                            <i class="fas fa-bars"></i>
                        </button>
                        <h2 class="text-xl font-bold text-left m-0"><?php echo "$chatCourseName"; ?></h2>
                        <button
                            type="button"
                            class="p-2 rounded bg-gray-100 hover:bg-gray-250 active:bg-gray-300 lg:hidden"
                            id="show-right-sidebar-mobile"
                            aria-label="Toggle Right Sidebar Mobile">
                            <i class="fas fa-gear"></i>
                        </button>
                    </div>
                    
                    <!-- Messages area -->
                    <div id="conversation" class="flex-1 overflow-y-auto space-y-4 -mb-3 -mt-2 w-full p-chat-noshow">
                        <div id="chat-location" class="sm:px-3 md:px-12 lg:px-24 xl:px-36 space-y-2">
                            <?php
                            $stmt = $connection->prepare("
                                SELECT m.messageId, m.question, m.answer, m.sourceName, m.feedbackRating
                                FROM messages m
                                JOIN user_courses uc ON uc.userCoursesId = m.userCoursesId
                                WHERE uc.userCoursesId = ?
                                ORDER BY m.timestamp ASC;
                            ");
                            $stmt->bind_param("i", $currentChat);
                            $stmt->execute();
                            $messages = $stmt->get_result();

                            while ($message = $messages->fetch_assoc()):
                            ?>
                                <!-- User Question (Gray) -->
                                <?php if (!empty($message['question'])): ?>
                                    <div class="flex py-2 justify-end">
                                        <div class="max-w-2xl bg-blue-500 text-white rounded-lg p-2">
                                            <div class="text-sm font-medium">You</div>
                                            <div><?php echo nl2br(htmlspecialchars($message['question'])); ?></div>
                                        </div>
                                    </div>
                                <?php endif; ?>

                                <!-- AI Answer (Blue) -->
                                <?php if (!empty($message['answer'])): ?>
                                    <div class="flex py-2 justify-start">
                                        <div class="max-w-2xl bg-gray-100 text-gray-900 rounded-lg p-2">
                                            <div class="text-sm font-medium">JayBot</div>
                                            <div class="ai-message-content">
                                                <?php echo $message['answer']; ?>
                                            </div>

                                            <?php if (!empty($message['sourceName'])): ?>
                                                <div class="text-xs mt-1">
                                                    Source: 
                                                    <?php
                                                    $htmlOutput = '';
                                                    $sources = array_filter(array_map('trim', explode(',', $message['sourceName'])));
                                                    foreach ($sources as $index => $fileName) {
                                                        $encodedFileName = urlencode($fileName);
                                                        $encodedCourseId = urlencode($currentChat);
                                                        $downloadLink = "http://localhost:5000/download?file={$encodedFileName}&chatId={$encodedCourseId}";

                                                        $htmlOutput .= '<a href="' . htmlspecialchars($downloadLink) . '" ';
                                                        $htmlOutput .= 'title="Download file" ';
                                                        $htmlOutput .= 'download="' . htmlspecialchars($fileName) . '" ';
                                                        $htmlOutput .= 'class="underline text-blue-600 hover:text-blue-800">';
                                                        $htmlOutput .= htmlspecialchars($fileName);
                                                        $htmlOutput .= '</a>';

                                                        if ($index < count($sources) - 1) {
                                                            $htmlOutput .= ', ';
                                                        }
                                                    }

                                                    echo $htmlOutput;
                                                    ?>
                                                </div>
                                            <?php endif; ?>
                                            <!-- Feedback button row -->
                                            <div class="flex flex-wrap gap-2 mt-2 text-xs text-gray-600">
                                                <button class="thumbs-up px-2 py-1 text-xs rounded transition-colors duration-150 <?php 
                                                    if ($message['feedbackRating'] === 'up') {
                                                        echo 'bg-green-600 hover:bg-green-700 rounded-full text-white';
                                                    } else {
                                                        echo 'hover:bg-green-100';
                                                    }
                                                ?>"
                                                title="This response was helpful"
                                                data-message-id="<?php echo $message['messageId']; ?>">👍</button>

                                                <button class="thumbs-down px-2 py-1 text-xs rounded transition-colors duration-150 <?php 
                                                    if ($message['feedbackRating'] === 'down') {
                                                        echo 'bg-red-600 hover:bg-red-700 rounded-full text-white';
                                                    } else {
                                                        echo 'hover:bg-red-100';
                                                    }
                                                ?>"
                                                title="This response was not helpful"
                                                data-message-id="<?php echo $message['messageId']; ?>">👎</button>

                                                <div class="flex gap-2 w-full md:w-auto">
                                                    <button class="simplify px-2 py-1 text-xs text-gray-600 rounded hover:text-blue-600 hover:bg-blue-100 transition-colors duration-150"
                                                            title="Simplify this response"
                                                            data-message-id="<?php echo $message['messageId']; ?>">Simplify</button>

                                                    <button class="examples px-2 py-1 text-xs text-gray-600 rounded hover:text-blue-600 hover:bg-blue-100 transition-colors duration-150"
                                                            title="Get more examples"
                                                            data-message-id="<?php echo $message['messageId']; ?>">Examples</button>
                                                    
                                                    <button class="explain px-2 py-1 text-xs text-gray-600 rounded hover:text-blue-600 hover:bg-blue-100 transition-colors duration-150"
                                                            title="Get a deeper explanation"
                                                            data-message-id="<?php echo $message['messageId']; ?>">Explain</button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                <?php endif; ?>

                            <?php endwhile; ?>
                        </div>
                    </div>

                    
                    <!-- Message input -->
                    <form id="message-input" method="POST" name="messageForm" class="mt-auto w-full pr-4">
                        <input type="hidden" name="action" value="send_message">

                        <!-- Wrap textarea in a relative container -->
                        <div id="input-container" class="flex gap-2 sm:px-3 md:px-12 lg:px-24 xl:px-36 w-full">
                            <div class="relative w-full">
                            <!-- Textarea -->
                            <textarea
                                id="student-question"
                                name="message"
                                class="w-full border rounded-lg py-2 pr-12 m-0 break-words resize-none max-h-48"
                                placeholder="Ask a question..."
                                rows="1"
                            ></textarea>

                            <!-- Floating Send Button -->
                            <button id="send-button" type="submit" class="absolute bottom-1.5 right-4 p-0 bg-transparent transition-opacity duration-150">
                                <div id="send-circle" class="w-8 h-8 flex items-center justify-center rounded-full
                                            border-2 border-blue-600 text-blue-600 shadow-md
                                            hover:bg-blue-600 hover:text-white
                                            transition-colors duration-200">
                                <i id="send-icon" class="fas fa-arrow-up"></i>
                                </div>
                            </button>
                            </div>
                        </div>

                        <div class="text-xs text-center text-gray-500 pb-2">
                            JayBot can make mistakes. Chat is logged and viewable by teachers.
                        </div>
                    </form>
            <?php else: ?>
                <div class="h-20 flex items-center justify-center text-gray-500">
                    Select a chat to start messaging
                </div>
                <img src="static/img/etownEngineeringCSSticker.png" alt="ETown CS Sticker" class="h-full object-contain m-36">
            <?php endif; ?>
        </div>

        <!-- Right sidebar with chat options -->
        <div id="right-sidebar" class="collapsed d-flex flex-column flex-shrink-0 bg-gray-100 h-full overflow-hidden w-full">

            <!-- Top bar: Hamburger and Title -->
            <div class="pl-4 pt-3 d-flex align-items-center w-full gap-2">
                <button
                    type="button"
                    class="p-2 rounded bg-gray-100 hover:bg-gray-250 active:bg-gray-300"
                    id="toggle-right-sidebar"
                    aria-label="Toggle Right Sidebar">
                    <i class="fas fa-gear"></i>
                </button>
                <button
                    type="button"
                    class="p-2 rounded bg-gray-100 hover:bg-gray-250 active:bg-gray-300 hidden"
                    id="hide-right-sidebar-mobile"
                    aria-label="Hide Right Sidebar Mobile">
                    <i class="fas fa-xmark"></i>
                </button>
                <h2 class="text-lg font-semibold text-gray-800 mb-0 right-sidebar-content-hide">Chat Options</h2>
            </div>

            <?php if ($currentChat): ?>
                <!-- Main content container to allow footer-style stickiness -->
                <div class="flex-grow d-flex flex-column justify-between">
                    <div class="right-sidebar-content-hide px-3 pt-3">
                        <!-- Response Length Selector -->
                        <label for="response-length" class="text-sm text-gray-700 block mb-1">Response Length</label>
                        <select id="response-length" class="form-select w-full bg-primary text-white mb-3">
                            <option value="Short">Short</option>
                            <option value="Average" selected>Average</option>
                            <option value="Detailed">Detailed</option>
                        </select>

                        <!-- Interest Input -->
                        <div class="flex items-center gap-1 mb-1">
                            <label for="interest-input" class="text-sm text-gray-700">Your Interests</label>
                            <i
                                class="fas fa-question-circle text-gray-500 hover:text-gray-700 cursor-default"
                                title="Used to personalize responses for this course. Consider entering your major, hobbies, or specific topics you enjoy."
                            ></i>
                        </div>
                        <!-- Input with max chars as 100 to match database -->
                        <input
                            type="text"
                            id="interest-input"
                            class="form-control w-full mb-3"
                            placeholder="e.g. sports, tech, history"
                            maxlength="100"
                        />

                        <!-- Save Changes Button -->
                        <button
                            id="save-changes-button"
                            class="w-full bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg"
                        >
                            Save Changes
                        </button>
                    </div>

                    <!-- Archive Button Stuck to Bottom -->
                    <div class="px-3 pb-3 right-sidebar-content-hide">
                        <button
                            id="archive-chat-button"
                            class="w-full bg-red-500 hover:bg-red-600 active:bg-red-700 text-white font-medium py-2 px-4 rounded-lg"
                            onclick="archiveCourse(<?php echo htmlspecialchars($currentChat, ENT_QUOTES, 'UTF-8'); ?>)">
                            Archive Chat
                        </button>
                    </div>
                </div>
            <?php else: ?>
                <!-- Placeholder -->
                <div class="h-full flex items-center justify-center text-gray-500 text-center px-3 right-sidebar-content-hide">
                    Select a chat for options
                </div>
            <?php endif; ?>
        </div>
        
    </div>

    <!-- Archive Modal -->
    <div id="archive-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center pt-12 z-50 hidden">
        <div class="bg-white rounded-lg shadow-lg w-full max-w-lg relative" style="height: 500px; overflow-y: auto;">
            <div class="p-6">
                <h2 class="text-xl font-semibold mb-4">Archived Courses</h2>
                <div id="archived-courses-list" class="space-y-2">
                    <!-- Dynamically populated list -->
                </div>
                <button id="close-archive-modal" class="absolute top-2 right-3 text-gray-600 hover:text-black text-2xl">
                    <i class="fas fa-xmark"></i>
                </button>
            </div>
        </div>
    </div>



    <!-- <footer id="footer"></footer> -->

    <!-- Bootstrap JS -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>

    <!-- Custom JS -->
    <script src="static/student.js"></script>
</body>
</html>