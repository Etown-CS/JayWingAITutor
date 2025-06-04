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

    <!-- custom css -->
    <link rel="stylesheet" href="static/student.css">
    <script>
        const currentCourseName = <?php echo json_encode($chatCourseName); ?>;
        const currentChatId = <?php echo json_encode($currentChat); ?>;
        const username = <?php echo json_encode($username ?? null); ?>;
        const userId = <?php echo json_encode($userId ?? null); ?>;
        const userRole = <?php echo json_encode($userRole ?? null); ?>;
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
    <header id="header" class="d-flex justify-content-center py-3 bg-primary text-white w-full mb-0">
        Student Page
    </header>
    <div id="my-content" class="right-collapsed flex flex-row flex-grow w-full mt-0 overflow-hidden">
        
        <!-- Left sidebar with chats list -->
        <div id="sidebar" class="d-flex flex-column flex-shrink-0 bg-gray-100 h-full overflow-hidden max-w-sm w-full">
            <div class="flex justify-between items-center mb-4">
                <!-- Chat Search Bar -->
                <div class="px-3 pt-3 d-flex align-items-center w-full">
                    <input
                        type="text"
                        id="searchBar"
                        class="form-control flex-grow-1 me-2 sidebar-content-hide"
                        placeholder="🔍 Search Chats..."
                        aria-label="ChatSearch"
                        aria-describedby="basic-addon1"
                        oninput="filterChats()"
                    >
                    <button
                        type="button"
                        class="block p-2 rounded bg-gray-100 hover:bg-gray-250 active:bg-gray-300"
                        id="toggle-sidebar"
                        aria-label="Toggle Sidebar"
                    >≣</button>
                </div>
            </div>

            <!-- Sorts/Filters -->
            <div class="d-flex gap-2 px-3 pb-3 sidebar-content-hide">
                <select class="form-select bg-primary text-white w-75" id="sort-by-btn" name="sortBy">
                    <option value="sortRecent">Sort by: Recent</option>
                    <option value="sortAlphabetical">Sort by: Alphabetical</option>
                </select>
                <select class="form-select bg-primary text-white w-25" id="filter-by-btn" name="filterBy">
                    <option value="allCourses">All</option>
                    <!-- List disciplines -->
                </select>
            </div>

            <!-- List of existing chats -->
            <div id="sidebar-courses" class="space-y-2 flex-grow ps-3 pb-3 overflow-y-auto overflow-x-hidden sidebar-content-hide p-sidebar-noshow">
                <div id="chat-div" class="d-grid gap-2">
                    <?php
                        // Need courseName, chatId, latestQuestion, lastInteracted
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
                            if (in_array($courseName, $displayedCourses)) {
                                continue; // Skip if course already displayed
                            }
                            $displayedCourses[] = $courseName; // Add to displayed courses to avoid duplicates
                    ?>
                    <div class="relative group bg-gray-100 p-3 rounded <?php echo $currentChat == $chat['userCoursesId'] ? 'bg-gray-200' : ''; ?> w-full overflow-hidden hover:bg-gray-250">
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
                            onclick="archiveCourse(<?php echo htmlspecialchars($chat['userCoursesId'], ENT_QUOTES, 'UTF-8'); ?>)">
                        </div>
                    </div>
                    <?php endwhile; ?>
                </div>
            </div>
            <!-- Archive Button -->
            <!-- Horizontal Separator -->
            <hr class="border-t border-gray-300 mx-4 my-2">

            <!-- Archive Button -->
            <div id="archive-button" class="archive-button relative bg-gray-100 p-3 rounded mx-4 mb-4 hover:bg-gray-200 cursor-pointer flex items-center gap-2">
                <div class="archive-icon w-6 h-6"></div>
                <span class="text-gray-700 font-medium text-lg">Archived</span>
            </div>
        </div>

        <!-- Main chat area JAYWING -->
        <div id="chat-container" class="flex flex-col bg-white py-2 overflow-hidden">
            <?php if ($currentChat): ?>
                <?php
                // Get chat details
                $stmt = $connection->prepare("SELECT * FROM user_courses WHERE userCoursesId = ?");
                $stmt->bind_param("i", $currentChat);
                $stmt->execute();
                $chatDetails = $stmt->get_result()->fetch_assoc();
                ?>
                
                    <!-- Chat header -->
                    <div class="align-self-start px-3 py-2 w-full border-b-4 border-gray-50">
                        <h2 class="text-xl font-bold text-left"><?php echo "$chatCourseName"; ?></h2>
                    </div>
                    
                    <!-- Messages area -->
                    <div id="conversation" class="flex-1 overflow-y-auto space-y-4 -mb-3 -mt-2 w-full p-chat-noshow">
                        <div id="chat-locaction" class="sm:px-3 md:px-12 lg:px-24 xl:px-36 space-y-2">
                            <?php
                            $stmt = $connection->prepare("
                                SELECT m.question, m.answer, m.sourceName
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
                                            <div class="text-sm font-medium">AI Tutor</div>
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
                                                        $encodedCourseName = urlencode($chatCourseName);
                                                        $downloadLink = "http://localhost:5000/download?file={$encodedFileName}&course={$encodedCourseName}";

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
                                        </div>
                                    </div>
                                <?php endif; ?>
                            <?php endwhile; ?>
                        </div>
                    </div>

                    
                    <!-- Message input -->
                    <form id="message-input" method="POST" name="messageForm" class="mt-auto w-full pr-4">
                        <input type="hidden" name="action" value="send_message">
                        <div id="input-container" class="flex gap-2 sm:px-3 md:px-12 lg:px-24 xl:px-36">
                            <textarea
                                id="student-question"
                                name="message"
                                class="flex-1 border rounded-lg p-2 m-0 focus:outline-none focus:ring-2 focus:ring-blue-500 break-words resize-none overflow-y-auto max-h-48"
                                placeholder="Ask a question..."
                                rows="1"
                                required
                            ></textarea>
                        </div>
                        <div class="text-xs text-center text-gray-500 pb-2">AI Tutor can make mistakes. Chat is logged and viewable by teachers.</div>
                    </form>
            <?php else: ?>
                <div class="h-[600px] flex items-center justify-center text-gray-500">
                    Select a chat to start messaging
                </div>
            <?php endif; ?>
        </div>

        <!-- Right sidebar with chat options -->
        <div id="right-sidebar" class="collapsed d-flex flex-column flex-shrink-0 bg-gray-100 h-full overflow-hidden max-w-sm w-full">
            
            <!-- Top bar: Hamburger and Title -->
            <div class="px-3 pt-3 d-flex align-items-center w-full gap-2">
                <!-- Hamburger -->
                <button
                    type="button"
                    class="p-2 rounded bg-gray-100 hover:bg-gray-250 active:bg-gray-300"
                    id="toggle-right-sidebar"
                    aria-label="Toggle Right Sidebar"
                >≣</button>

                <!-- Title -->
                <h2 class="text-lg font-semibold text-gray-800 mb-0 right-sidebar-content-hide">Chat Options</h2>
            </div>


            <?php if ($currentChat): ?>
                <!-- Response Length Selector -->
                <div class="px-3 pt-3 pb-3 right-sidebar-content-hide">
                    <label for="response-length" class="text-sm text-gray-700 block mb-1">Response Length</label>
                    <select id="response-length" class="form-select w-full bg-primary text-white">
                        <option value="short">Short</option>
                        <option value="average" selected>Average</option>
                        <option value="detailed">Detailed</option>
                    </select>
                </div>

                <!-- Interest Input -->
                <div class="px-3 pb-3 right-sidebar-content-hide">
                    <label for="interest-input" class="text-sm text-gray-700 block mb-1">Your Interests</label>
                    <input
                        type="text"
                        id="interest-input"
                        class="form-control w-full"
                        placeholder="e.g. sports, tech, history"
                    >
                </div>
                <!-- Archive Button -->
                <div class="px-3 pb-3 right-sidebar-content-hide">
                    <button
                        id="archive-chat-button"
                        class="w-full bg-red-500 hover:bg-red-600 active:bg-red-700 text-white font-medium py-2 px-4 rounded-lg"
                        onclick="archiveChat(<?php echo htmlspecialchars($currentChat, ENT_QUOTES, 'UTF-8'); ?>)"
                    >
                        Archive Chat
                    </button>
                </div>
            <?php else: ?>
                <!-- Placeholder when no chat is selected -->
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
                <button id="close-archive-modal" class="absolute top-2 right-2 text-gray-600 hover:text-black text-2xl">
                    &times;
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