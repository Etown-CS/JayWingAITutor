<?php
require_once '../backend/includes/session_handler.php';
require_once '../backend/includes/db_connect.php';

$isUserLoggedIn = isLoggedIn();
if ($isUserLoggedIn) {
    $userId = $_SESSION['user_id'];
}

// Handle new message submission
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'send_message') {
    $messageContent = $_POST['message'];
    $chatId = $_POST['chat_id'];

    // Validate that the user is a participant of the chat before inserting the message
    $stmt = $connection->prepare("
        SELECT 1 
        FROM chats 
        WHERE chatId = ? AND userCoursesId = ?
    ");
    $stmt->bind_param("ii", $chatId, $userCoursesId);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 0) {
        // User is not part of this chat, redirect them or show an error
        header("Location: index.php"); // Redirect to a safe page
        exit();
    }

    // Insert the message if validation passes
    $stmt = $connection->prepare("INSERT INTO messages (chatId, question) VALUES (?, ?)");
    $stmt->bind_param("iis", $chatId, $messageContent);
    $stmt->execute();
    $stmt->close();
    
    header("Location: ?chatId=" . $chatId);
    exit();
}


if (isset($_GET['chatId']) && filter_var($_GET['chatId'], FILTER_VALIDATE_INT)) {
    $currentChat = (int) $_GET['chatId'];
    
    // Validate that the user is a participant of the chat
    $stmt = $connection->prepare("
        SELECT 1 
        FROM chats 
        WHERE chatId = ? AND userCoursesId = ?
    ");
    $stmt->bind_param("ii", $currentChat, $userCoursesId);
    $stmt->execute();
    $result = $stmt->get_result();
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
</head>
<body class="flex flex-col h-screen gap-0 overflow-hidden">
    <header id="header" class="d-flex justify-content-center py-3 bg-primary text-white w-full mb-0">
        Student Page
    </header>
    <div id="my-content" class="flex-grow w-full mt-0 overflow-hidden">
        
        <!-- Sidebar with chats list -->
        <div id="sidebar" class="d-flex flex-column flex-shrink-0 bg-gray-100 h-full overflow-hidden max-w-sm">
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
                        oninput="filterClasses()"
                    >
                    <button
                        type="button"
                        class="block p-2 rounded bg-gray-100 hover:bg-gray-200 active:bg-gray-300"
                        id="toggle-sidebar"
                        aria-label="Toggle Sidebar"
                    >≣</button>
                </div>
            </div>

            <!-- Sorts/Filters -->
            <div class="d-flex gap-2 px-3 pb-3 sidebar-content-hide">
                <select class="form-select bg-primary text-white w-75" id="sort-by-btn" name="sortBy">
                    <option value="coursesByRecent">Sort by: Recent</option>
                    <option value="coursesByDiscipline">Sort by: Discipline</option>
                </select>
                <select class="form-select bg-primary text-white w-25" id="filter-by-btn" name="filterBy">
                    <option value="allCourses">All</option>
                    <!-- List disciplines -->
                </select>
            </div>

            <!-- List of existing chats -->
            <div class="space-y-2 flex-grow ps-3 pb-3 overflow-y-auto sidebar-content-hide">
                <!-- TODO: implement with php -->
                <div id="chat-div" class="d-grid gap-2">
                    <?php
                        $stmt = $connection->prepare("
                        SELECT 
                            c.name AS courseName,
                            ch.chatId,
                            m.question AS latestQuestion,
                            latest.latestTimestamp AS lastInteracted
                        FROM user_courses uc
                        JOIN courses c ON c.id = uc.courseId
                        LEFT JOIN chats ch ON ch.userCoursesId = uc.userCoursesId
                        LEFT JOIN (
                            SELECT chatId, MAX(timestamp) AS latestTimestamp
                            FROM messages
                            GROUP BY chatId
                        ) latest ON latest.chatId = ch.chatId
                        LEFT JOIN messages m ON m.chatId = ch.chatId AND m.timestamp = latest.latestTimestamp
                        WHERE uc.userId = ?
                        ORDER BY 
                            latest.latestTimestamp IS NULL,   -- Push NULLs to bottom
                            latest.latestTimestamp DESC;      -- Most recent messages first
                        ");
                        $stmt->bind_param("i", $userId);
                        $stmt->execute();
                        $chats = $stmt->get_result();
                        
                        if (isset($error)) {
                            echo '<div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">';
                            echo '<strong class="font-bold">Error!</strong>';
                            echo '<span class="block sm:inline"> ' . htmlspecialchars($error) . '</span>';
                            echo '</div>';
                        }

                        while ($chat = $chats->fetch_assoc()):
                    ?>
                    <a href="?chatId=<?php echo htmlspecialchars($chat['chatId'], ENT_QUOTES, 'UTF-8'); ?>" 
                        class="block p-3 rounded bg-gray-100 <?php echo $currentChat == $chat['chatId'] ? 'bg-gray-100' : ''; ?> message-container">
                        <div class="font-medium truncate"><?php echo htmlspecialchars($chat['courseName'], ENT_QUOTES, 'UTF-8'); ?></div>
                        <?php if ($chat['latestQuestion']): ?>
                            <div class="text-xs text-gray-500 truncate"><?php echo htmlspecialchars($chat['latestQuestion'], ENT_QUOTES, 'UTF-8'); ?></div>
                        <?php else: ?>
                            <div class="text-xs text-gray-500">No messages yet</div>
                        <?php endif; ?>
                    </a>
                    <?php endwhile; ?>
                </div>

            </div>
        </div>
        


        <!-- Main chat area JAYWING -->
        <div id="chat-container" class="flex flex-col bg-white py-2 h-full overflow-hidden">
            <?php if ($currentChat): ?>
                <?php
                // Get chat details
                $stmt = $connection->prepare("SELECT * FROM chats WHERE chatId = ?");
                $stmt->bind_param("i", $currentChat);
                $stmt->execute();
                $chatDetails = $stmt->get_result()->fetch_assoc();
                ?>
                
                <div class="flex flex-col h-[600px]">
                    <!-- Chat header -->
                    <div class="align-self-start px-3 w-full border-b-2 border-gray-100">
                        <h2 class="text-xl font-bold"><?php echo htmlspecialchars($chatDetails['courseName'], ENT_QUOTES, 'UTF-8'); ?></h2>
                    </div>
                    
                    <!-- Messages area -->
                    <div id="conversation" class="flex-1 overflow-y-auto space-y-4 -mb-3 -mt-2 w-full">
                        <?php
                        $stmt = $connection->prepare("
                            SELECT m.question, m.answer, m.sourceName
                            FROM messages m
                            JOIN chats c ON c.chatId = m.chatId
                            WHERE m.chatId = ?
                            ORDER BY m.timestamp ASC;
                        ");
                        $stmt->bind_param("i", $currentChat);
                        $stmt->execute();
                        $messages = $stmt->get_result();
                        
                        while ($message = $messages->fetch_assoc()):
                        ?>
                            <div class="sm:px-3 md:px-12 lg:px-24 xl:px-36">
                                <div data-message-id="<?php echo $message['message_id']; ?>" class="flex py-2 <?php echo $isOwnMessage ? 'justify-end' : 'justify-start'; ?>">
                                    <div class="max-w-2xl <?php echo $isOwnMessage ? 'bg-blue-500 text-white' : 'bg-gray-100'; ?> rounded-lg p-2">
                                        <?php if (!$isOwnMessage): ?>
                                            <div class="text-sm font-medium <?php echo $isOwnMessage ? 'text-white' : 'text-gray-900'; ?>">
                                                <?php echo htmlspecialchars($message['username']); ?>
                                            </div>
                                        <?php endif; ?>
                                        <div><?php echo nl2br(htmlspecialchars($message['messageContent'])); ?></div>
                                    </div>
                                </div>
                            </div>
                        <?php endwhile; ?>
                    </div>
                    
                    <!-- Message input -->
                    <form method="POST" name="messageForm" class="mt-auto w-full">
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
                </div>
            <?php else: ?>
                <div class="h-[600px] flex items-center justify-center text-gray-500">
                    Select a chat to start messaging
                </div>
            <?php endif; ?>
        </div>
    </div>

    <!-- <footer id="footer"></footer> -->

    <!-- Bootstrap JS -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>

    <!-- Custom JS -->
    <script src="static/student.js"></script>
</body>
</html>