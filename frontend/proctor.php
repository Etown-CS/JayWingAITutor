<?php
require_once '../backend/includes/session_handler.php';
require_once '../backend/includes/db_connect.php';

if (!isAdmin()) {
    header('Location: index.php');
    exit();
}

$isUserLoggedIn = isLoggedIn();
if ($isUserLoggedIn) {
    $userId = $_SESSION['user_id'];
}

// Default
$currentPage = "Dashboard";

// Detect via GET parameters
if (isset($_GET['manageclasses'])) {
    $currentPage = "Manage Classes";
} elseif (isset($_GET['manageenrollments'])) {
    $currentPage = "Manage Enrollments";
} elseif (isset($_GET['manageproctornotes'])) {
    $currentPage = "Manage Proctor Notes";
}

// classes
if ($isUserLoggedIn) {
    $query = "
        SELECT c.*, u.username AS created_by_username
        FROM user_courses uc
        JOIN courses c ON uc.courseId = c.id
        LEFT JOIN users u ON c.createdBy = u.id
        WHERE uc.userId = ?
    ";
    
    $stmt = $connection->prepare($query);
    $stmt->bind_param("i", $userId); // Bind the logged-in user's ID
    $stmt->execute();
    $classes = $stmt->get_result();
    $stmt->close();
} else {
    $classes = [];
}

// users
$isUserLoggedIn = isLoggedIn();
$currentUserId = null;
if ($isUserLoggedIn) {
    $currentUserId = $_SESSION['user_id'];
}

// Modify the query to exclude the current user if logged in
if ($currentUserId) {
    $users = $connection->query("SELECT * FROM users WHERE id != " . (int)$currentUserId);
} else {
    $users = $connection->query("SELECT * FROM users");
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Proctor Page</title>

    <!-- tailwind css -->
    <link href="https://cdnjs.cloudflare.com/ajax/libs/tailwindcss/2.2.19/tailwind.min.css" rel="stylesheet">

    <!-- bootstrap css -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH" crossorigin="anonymous">

    <!-- font awesome -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">

    <!-- custom css -->
    <link rel="stylesheet" href="static/proctor.css">
</head>
<body class="flex flex-col h-screen gap-0 overflow-hidden">

    <!-- Loading Spinner -->
    <div id="loading-spinner" class="hidden fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
        <div class="loader border-4 border-t-4 border-gray-200 rounded-full w-12 h-12 animate-spin"></div>
    </div>


    <style>
        /* Spinner customization (optional) */
        .loader {
            border-top-color: #3498db; /* Blue spinner */
            border-radius: 50%;
            width: 50px;
            height: 50px;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        #success-banner,
        #error-banner {
            z-index: 1060; /* Bootstrap modals typically use z-index around 1050 */
        }
    </style>

    <script>
        const userId = "<?php echo $_SESSION['user_id']; ?>";
        const username = "<?php echo $_SESSION['username']; ?>";
        const userRole = "<?php echo $_SESSION['admin']; ?>"; // 1 = proctor, 0 = student
    </script>

    <header id="header" class="d-flex justify-content-center py-3 bg-primary text-white w-full mb-0">
        <button
            type="button"
            class="position-absolute start-0 ms-3 rounded bg-primary text-white"
            id="home"
            aria-label="Home">
            <i class="fas fa-house"></i>
        </button>
        <span>Proctor Page</span>
    </header>

    <div id="success-banner" class="fixed top-0 left-1/2 transform -translate-x-1/2 mt-4 bg-green-100 text-green-800 px-4 py-2 rounded shadow hidden text-sm">
        <!-- JavaScript -->
    </div>

    <div id="error-banner" class="fixed top-0 left-1/2 transform -translate-x-1/2 mt-4 bg-red-100 text-red-800 px-4 py-2 rounded shadow hidden text-sm">
        <!-- JavaScript -->
    </div>

    <div id="my-content" class="flex flex-grow w-full mt-0 overflow-hidden">

<!-- Sidebar with Proctor Management Links -->
        <div id="sidebar" class="d-flex flex-column flex-shrink-0 bg-gray-100 h-full max-w-2xs w-full overflow-hidden">
            <div id="sidebar-options" class="space-y-2 flex-grow p-3 overflow-y-auto overflow-x-hidden">
        
                <div id="sidebar-div" class="d-grid gap-2">
                    <a href="proctor.php" class="block p-3 rounded bg-gray-100 <?php echo $currentPage == "Dashboard" ? 'bg-gray-200' : ''; ?> hover:bg-gray-250 message-container w-full overflow-hidden">
                        <div class="font-medium truncate">Dashboard</div>
                    </a>
                    <a href="?manageclasses" class="block p-3 rounded bg-gray-100 <?php echo $currentPage == "Manage Classes" ? 'bg-gray-200' : ''; ?> hover:bg-gray-250 message-container w-full overflow-hidden">
                        <div class="font-medium truncate">Manage Classes</div>
                    </a>

                    <a href="?manageenrollments" class="block p-3 rounded bg-gray-100 <?php echo $currentPage == "Manage Enrollments" ? 'bg-gray-200' : ''; ?> hover:bg-gray-250 message-container w-full overflow-hidden">
                        <div class="font-medium truncate">Manage Enrollments</div>
                    </a>

                    <a href="?manageproctornotes" class="block p-3 rounded bg-gray-100 <?php echo $currentPage == "Manage Proctor Notes" ? 'bg-gray-200' : ''; ?> hover:bg-gray-250 message-container w-full overflow-hidden">
                        <div class="font-medium truncate">Manage Proctor Notes</div>
                    </a>
                </div>
            </div>
        </div>

        <div id="chat-container" class="flex flex-col bg-white pb-2 overflow-hidden">
            <!-- Chat header -->
            <div id="chat-header" class="flex items-center justify-start p-3 w-full gap-2 border-b-4 border-gray-50">
                <button
                    type="button"
                    class="p-2 rounded bg-gray-100 hover:bg-gray-250 active:bg-gray-300 lg:hidden"
                    id="toggle-dropdown-mobile"
                    aria-label="Toggle Dropdown Mobile">
                    <i id="toggle-dropdown-mobile-icon" class="fas fa-caret-down"></i>
                </button>
                <h2 id="chat-header-text" class="text-xl font-bold text-left m-0"> <?php echo htmlspecialchars($currentPage); ?> </h2>
            </div>

            <!-- Outer scrollable container -->
            <div id="dropdown-sidebar" class="hidden bg-gray-100 overflow-x-auto p-2">
            <!-- Inner flex container that centers content when there's room -->
            <div class="flex flex-row gap-2 min-w-max justify-center">
                <a href="proctor.php" class="block p-3 rounded bg-gray-100 <?php echo $currentPage == "Dashboard" ? 'bg-gray-200' : ''; ?> hover:bg-gray-250 message-container flex-shrink-0">
                    <div class="font-medium">Dashboard</div>
                </a>
                <a href="?manageclasses" class="block p-3 rounded bg-gray-100 <?php echo $currentPage == "Manage Classes" ? 'bg-gray-200' : ''; ?> hover:bg-gray-250 message-container flex-shrink-0">
                    <div class="font-medium">Manage Classes</div>
                </a>
                <a href="?manageenrollments" class="block p-3 rounded bg-gray-100 <?php echo $currentPage == "Manage Enrollments" ? 'bg-gray-200' : ''; ?> hover:bg-gray-250 message-container flex-shrink-0">
                    <div class="font-medium">Manage Enrollments</div>
                </a>
                <a href="?manageproctornotes" class="block p-3 rounded bg-gray-100 <?php echo $currentPage == "Manage Proctor Notes" ? 'bg-gray-200' : ''; ?> hover:bg-gray-250 message-container flex-shrink-0">
                    <div class="font-medium">Manage Proctor Notes</div>
                </a>
            </div>
            </div>
            
            <!-- Main area -->
            <div id="conversation" class="flex-1 overflow-y-auto space-y-4 w-full p-chat-noshow">
<!-- Dashboard Section -->
                <?php if($currentPage == "Dashboard") : ?>
                    <div class="p-4 w-full h-full bg-white">
                        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <!-- Left: Filters -->
                            <div class="w-full">
                                <h2 class="text-xl font-bold mb-4">Welcome <?php echo htmlspecialchars($_SESSION['username']); ?></h2>
                                <form id="dashboardFilterForm">
                                    <div class="grid grid-cols-2 gap-4">
                                        <!-- Course Selection -->
                                        <div class="dropdown">
                                            <label for="courseSelection" class="form-label">Select Class</label>
                                            <button id="courseSelection" class="btn dropdown-toggle w-100 text-start d-flex justify-content-between align-items-center m-0" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                                                <span id="selectedDashboardClassText">All</span>
                                            </button>
                                            <div class="dropdown-menu w-100 p-2" id="classDropdown">
                                                <input
                                                    type="text"
                                                    class="form-control mb-2"
                                                    id="classSearchInputDash"
                                                    placeholder="Search classes..."
                                                />
                                                <div class="class-dash-list" style="max-height: 200px; overflow-y: auto; margin: 0 -0.5rem;">
                                                    <!-- JavaScript -->
                                                </div>
                                            </div>
                                            <!-- Default is set to all -->
                                            <input type="hidden" id="class_id" name="class_id" value="All" required> 
                                        </div>
                                        
                                        <!-- User Selection -->
                                        <div class="dropdown">
                                            <label for="userSelection" class="form-label">Select User</label>
                                            <button id="userSelection" class="btn dropdown-toggle w-100 text-start d-flex justify-content-between align-items-center m-0" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                                                <span id="selectedDashboardUserText">All</span>
                                            </button>
                                            <div class="dropdown-menu w-100 p-2" id="userDropdown">
                                                <input
                                                    type="text"
                                                    class="form-control mb-2"
                                                    id="userSearchInputDash"
                                                    placeholder="Search users..."
                                                />
                                                <div class="user-dash-list" style="max-height: 200px; overflow-y: auto; margin: 0 -0.5rem;">
                                                    <!-- JavaScript -->
                                                </div>
                                            </div>
                                            <!-- Default is set to all -->
                                            <input type="hidden" id="user_id" name="user_id" value="All" required>
                                        </div>
                                        <!-- Start Date -->
                                        <div>
                                            <label for="selectedStartDate" class="form-label">Start Date</label>
                                            <input type="date" id="selectedStartDate" name="selectedStartDate" class="form-control bg-gray-300 text-center" />
                                        </div>
                                        <!-- End Date -->
                                        <div>
                                            <label for="selectedEndDate" class="form-label">End Date</label>
                                            <input type="date" id="selectedEndDate" name="selectedEndDate" class="form-control bg-gray-300 text-center"/>
                                        </div>
                                        <!-- Q/A/QA -->
                                        <div class="dropdown">
                                            <label for="qaSelection" class="form-label">Contents</label>
                                            <button id="qaSelection" class="btn dropdown-toggle w-100 text-start d-flex justify-content-between align-items-center m-0" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                                                <span id="selectedQAFilterText">Both</span>
                                            </button>
                                            <div class="dropdown-menu w-100 p-2" id="qaFilterDropdown">
                                                <div class="qa-list" style="max-height: 200px; overflow-y: auto; margin: 0 -0.5rem;">
                                                    <div class="dropdown-item" data-value="Both">Both</div>
                                                    <div class="dropdown-item" data-value="Questions">Questions</div>
                                                    <div class="dropdown-item" data-value="Answers">Answers</div>
                                                </div>
                                            </div>
                                            <input type="hidden" id="qa_filter" name="qa_filter" value="Both">
                                        </div>
                                        <!-- Custom Stop Words -->
                                        <div class="items-end">
                                            <label for="customStopWords" class="form-label">Word Filter</label>
                                            <input 
                                                type="text" 
                                                id="customStopWords" 
                                                name="customStopWords" 
                                                placeholder="e.g. word1, word2, word3..." 
                                                class="form-control bg-gray-300" 
                                            />
                                        </div>
                                        <!-- Clear/Submit Buttons -->
                                        <button type="button" class="btn btn-danger w-full" onclick="clearDashboardFilters()">Clear Filters</button>
                                        <button type="submit" class="btn btn-primary w-full">Generate Report</button>
                                    </div>
                                    
                                    
                                </form>
                            </div>

                            <!-- Right: Word Cloud -->                                    
                            <div class="wordcloud-container">
                                <img id='word_cloud_img' src="static/img/word_cloud_placeholder.png" alt="Word Cloud" class="w-full h-auto rounded border border-gray-300" />
                            </div>
                        </div>

                        <!-- Bottom: Summary Cards -->
                        <!-- Owl Carousel Wrapper -->
                        <div class="owl-carousel owl-theme mt-8 h-full">
                            <div class="item w-full flex flex-col">
                                <div class="bg-gray-200 p-6 rounded shadow text-center flex flex-col justify-between h-48 w-full">
                                    <h3 class="text-xl font-semibold mb-2">Liked Messages</h3>
                                    <p class="text-4xl font-bold liked-count">%%</p>
                                    <a href="#" class="text-blue-600 underline text-sm mt-2 inline-block" onclick="openFeedbackModal('up')">View Feedback</a>
                                </div>
                            </div>

                            <div class="item w-full flex flex-col">
                                <div class="bg-gray-200 p-6 rounded shadow text-center flex flex-col justify-between h-48 w-full">
                                    <h3 class="text-xl font-semibold mb-2">Disliked Messages</h3>
                                    <p class="text-4xl font-bold disliked-count">%%</p>
                                    <a href="#" class="text-blue-600 underline text-sm mt-2 inline-block" onclick="openFeedbackModal('down')">View Feedback</a>
                                </div>
                            </div>

                            <div class="item w-full flex flex-col">
                                <div class="bg-gray-200 p-6 rounded shadow text-center flex flex-col justify-between h-48 w-full">
                                    <h3 class="text-xl font-semibold mb-2">Total Messages</h3>
                                    <p class="text-4xl font-bold total-count">%%</p>
                                    <a href="#" class="text-blue-600 underline text-sm mt-2 inline-block"></a>
                                </div>
                            </div>

                            <div class="item w-full flex flex-col">
                                <div class="bg-gray-200 p-6 rounded shadow text-center flex flex-col justify-between h-48 w-full">
                                    <h3 class="text-xl font-semibold mb-2 active-day-title">Most Active Day</h3>
                                    <p class="text-4xl font-bold active-day">MM-DD-YYYY</p>
                                    <p class="text-sm mt-2 inline-block active-day-subtext"></p>
                                </div>
                            </div>

                            <!-- TODO: Future implementation -->
                            <!-- Use AI to get recommended review topics based on student queries -->
                            <!-- <div class="item w-full flex flex-col">
                                <div class="bg-gray-200 p-6 rounded shadow text-center flex flex-col justify-between h-48 w-full">
                                    <h3 class="text-xl font-semibold mb-2">Recommended Review Topics</h3>
                                    <p class="text-3xl font-bold recommended-topics">(Placeholder, Placeholder...)</p>
                                    <a href="#" class="text-blue-600 underline text-sm mt-2 inline-block">View AI Report</a>
                                </div>
                            </div> -->

                            <div class="item w-full flex flex-col most-active-course-card">
                                <div class="bg-gray-200 p-6 rounded shadow text-center flex flex-col justify-between h-48 w-full">
                                    <h3 class="text-xl font-semibold mb-2 active-course-title">Most Active Course</h3>
                                    <p class="text-3xl font-bold active-course">(Placeholder)</p>
                                    <p class="text-sm mt-2 inline-block active-course-subtext"></p>
                                </div>
                            </div>
                        </div>


                        <div id="carousel-description" class="text-xs text-gray-500">*Showing stats for all <?php echo htmlspecialchars($_SESSION['username']); ?>'s courses </div>

                    </div>


<!-- Class Management Section -->
                <?php elseif($currentPage == "Manage Classes") : ?>
                    <!-- Add Classes -->
                    <div class="card m-4">
                        <div class="card-header">
                            <h5 class="mb-0">Add Class</h5>
                        </div>
                        <div class="card-body">
                            <form id="classForm">
                                <div class="row">
                                    <!-- Class Name -->
                                    <div class="col-md-4 mb-3">
                                        <label for="class_name" class="form-label">
                                            Class Name <span class="text-danger">*</span>
                                        </label>
                                        <input type="text" class="form-control" id="class_name">
                                    </div>
                                    <!-- Course Code -->
                                    <div class="col-md-4 mb-3">
                                        <div class="flex items-center gap-1">
                                            <label for="course_code" class="form-label">Course Code</label>
                                            <i
                                                class="mb-2 fas fa-question-circle text-gray-500 hover:text-gray-700 cursor-default"
                                                data-bs-toggle="tooltip"
                                                data-bs-html="true"
                                                title="Course codes must have a department code and be followed by numbers (Ex: EN100, PYS200, CS/EGR222)."
                                            ></i>
                                        </div>
                                        <input type="text" class="form-control" id="course_code" maxlength="20">
                                    </div>
                                    <!-- Class Description -->
                                    <div class="col-md-4 mb-3">
                                        <label for="class_description" class="form-label">Description</label>
                                        <textarea class="form-control" id="class_description" style="height: 37.6px;"></textarea>
                                    </div>
                                </div>
                                <div>
                                    <button type="submit" class="btn btn-primary">Add Class</button>
                                    <button type="button" onclick="clearClassInputs()" class="btn btn-danger">Clear Fields</button>
                                </div>
                            </form>
                        </div>
                    </div>

                    <div class="pt-1"></div>

                    <!-- Classes Table -->
                    <div class="card m-4">
                        <div class="card-header">
                            <h5 class="mb-0">Current Classes</h5>
                        </div>
                        <div class="card-body">    
                            <div class="table-responsive">
                                <table class="table" id="classesTableConfig">
                                    <thead>
                                        <tr>
                                            <th>
                                                Class Name
                                                <input
                                                    type="text"
                                                    class="form-control"
                                                    id="classNameTableInput"
                                                    placeholder="Search..."
                                                />
                                            </th>
                                            <th>
                                                Course Code
                                                <input
                                                    type="text"
                                                    class="form-control"
                                                    id="courseCodeTableInput"
                                                    placeholder="Search..."
                                                />
                                            </th>
                                            <th>
                                                Description
                                                <input
                                                    type="text"
                                                    class="form-control"
                                                    id="classDescriptionTableInput"
                                                    placeholder="Search..."
                                                />
                                            </th>
                                            <th>
                                                Actions
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

                                                <select class="form-select bg-primary text-white" id="filter-by-btn" name="filterBy" onchange="filterCourses(this.value)">
                                                    <option value="allCourses">Filter: All</option>
                                                    <?php foreach ($disciplinesSet as $discipline => $_): ?>
                                                        <option value="<?= $discipline ?>"><?= $discipline ?></option>
                                                    <?php endforeach; ?>
                                                </select>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody id="classesTable">
                                        <!-- Filled dynamically -->
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

<!-- Enrollment Management Section -->
                <?php elseif($currentPage == "Manage Enrollments") : ?>
                    <!-- Add Enrollments -->
                    <div class="card m-4">
                        <div class="card-header">
                            <h5 class="mb-0">Add Enrollment</h5>
                        </div>
                        <div class="card-body">
                            <form id="enrollmentForm">
                                <div class="row">
                                    <!-- Class Dropdown -->
                                    <div class="col-md-4 mb-3">
                                        <label for="classDropdownBtn" class="form-label">
                                            Class Name <span class="text-danger">*</span>
                                        </label>
                                        <div class="dropdown">
                                            <button id="classDropdownBtn" class="btn dropdown-toggle w-100 text-start d-flex justify-content-between align-items-center m-0" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                                                <span id="selectedClassText">Select Class</span>
                                            </button>
                                            <div class="dropdown-menu w-100 p-2" id="classDropdown">
                                                <input
                                                    type="text"
                                                    class="form-control mb-2"
                                                    id="classSearchInput"
                                                    placeholder="Search classes..."
                                                />
                                                <div class="class-list" style="max-height: 200px; overflow-y: auto; margin: 0 -0.5rem;">
                                                    <!-- JavaScript -->
                                                </div>
                                            </div>
                                            <input type="hidden" id="class_id" name="class_id" required>
                                        </div>
                                    </div>
                                    <!-- User Dropdown -->
                                    <div class="col-md-4 mb-3">
                                        <label for="userDropdownBtn" class="form-label">
                                            User <span class="text-danger">*</span>
                                        </label>
                                        <div class="dropdown">
                                            <button id="userDropdownBtn" class="btn dropdown-toggle w-100 text-start d-flex justify-content-between align-items-center m-0" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                                                <span id="selectedUserText">Select User</span>
                                            </button>
                                            <div class="dropdown-menu w-100 p-2">
                                                <input type="text" class="form-control mb-2" id="userSearchInput" placeholder="Search users...">
                                                <div class="user-list -p-2" style="max-height: 200px; overflow-y: auto; margin: 0 -0.5rem;">
                                                    <!-- JavaScript -->
                                                </div>
                                                <button id="add-multiple-enrollments" type="button" class="btn btn-outline-primary w-full mt-2">Add Multiple Enrollments</button>
                                            </div>
                                            <input type="hidden" id="user_id" name="user_id" required>
                                        </div>
                                    </div>
                                    <!-- Class Role Dropdown -->
                                    <div class="col-md-4 mb-3">
                                        <label for="roleDropdownBtn" class="form-label">
                                            Role (JayWing)
                                        </label>
                                        <div class="dropdown">
                                            <button id="roleDropdownBtn" class="btn dropdown-toggle w-100 text-start d-flex justify-content-between align-items-center m-0" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                                                <span id="selectedRoleText">Tutor</span>
                                            </button>
                                            <div class="dropdown-menu w-100 p-2">
                                                <div class="role-list -p-2" style="max-height: 200px; overflow-y: auto; margin: 0 -0.5rem;">
                                                    <div class="dropdown-item" data-value="Tutor">Tutor</div>
                                                    <div class="dropdown-item" data-value="Tutee">Tutee</div>
                                                </div>
                                            </div>
                                            <input type="hidden" id="roleOfClass" name="roleOfClass" value="Tutor">
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <button type="submit" class="btn btn-primary">Add Enrollment</button>    
                                    <button type="button" onclick="clearEnrollmentInputs()" class="btn btn-danger">Clear Fields</button>
                                </div>
                            </form>
                        </div>
                    </div>

                    <div class="pt-1"></div>

                    <!-- Enrollments Table -->
                    <div class="card m-4">
                        <div class="card-header">
                            <h5 class="mb-0">Current Enrollments</h5>
                        </div>
                        <div class="card-body">
                            <div class="table-responsive">
                                <table class="table" id="enrollmentsTableConfig">
                                    <thead>
                                        <tr>
                                            <th>
                                                Class Name
                                                <input
                                                    type="text"
                                                    class="form-control"
                                                    id="classNamesTableInput"
                                                    placeholder="Search..."
                                                />
                                            </th>
                                            <th>
                                                User
                                                <input
                                                    type="text"
                                                    class="form-control"
                                                    id="userTableInput"
                                                    placeholder="Search..."
                                                />
                                            </th>
                                            <th>
                                                Role (JayWing)
                                                <input
                                                    type="text"
                                                    class="form-control"
                                                    id="roleTableInput"
                                                    placeholder="Search..."
                                                />
                                            </th>
                                            <th>
                                                Actions
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
                                                <select class="form-select bg-primary text-white" id="filter-by-btn-2" name="filterBy" onchange="filterEnrollments(this.value)">
                                                    <option value="allCourses">Filter: All</option>
                                                    <?php foreach ($disciplinesSet as $discipline => $_): ?>
                                                        <option value="<?= $discipline ?>"><?= $discipline ?></option>
                                                    <?php endforeach; ?>
                                                </select>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody id="enrollmentsTable">
                                        <!-- Filled dynamically -->
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

<!-- Proctor Note Management Section -->
                <?php elseif($currentPage == "Manage Proctor Notes") : ?>
                    <div class="m-4">
                        <form id="proctorForm">
                            <div class="row">
                                <div class="col-md-4 mb-3">
                                    <label for="classNotesDropdownBtn" class="form-label">
                                        Class Name <span class="text-danger">*</span>
                                    </label>
                                    <div class="dropdown">
                                        <button id="classNotesDropdownBtn" class="btn dropdown-toggle w-100 text-start d-flex justify-content-between align-items-center m-0" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                                            <span id="selectedNotesClassText">Select Class</span>
                                        </button>
                                        <div class="dropdown-menu w-100 p-2" id="classNotesDropdown">
                                            <input
                                                type="text"
                                                class="form-control mb-2"
                                                id="classNotesSearchInput"
                                                placeholder="Search classes..."
                                            />
                                            <div class="class-notes-list" style="max-height: 200px; overflow-y: auto; margin: 0 -0.5rem;">
                                                <!-- JavaScript -->
                                            </div>
                                        </div>
                                        <input type="hidden" id="notes_class_id" name="notes_class_id" required>
                                    </div>
                                </div>

                                <!-- User input -->
                                <div class="col mb-3" id="file-upload-div">
                                    <label class="form-label" for="file-input">Upload Documents</label>
                                    <input type="file" class="form-control" id="file-input" multiple>
                                </div>
                            </div>

                            <!-- Preview Section -->
                            <div id="preview-div" class="flex flex-col">
                                <!-- Thumbnails of uploaded files will appear here -->
                                <div id="pdf-div" class="flex justify-center lg:justify-start flex-wrap gap-2 mb-4"></div>
                                <div id="pptx-div" class="flex justify-center lg:justify-start flex-wrap gap-2 mb-4"></div>
                                <div id="png-div" class="flex justify-center lg:justify-start flex-wrap gap-2 mb-4"></div>
                            </div>
                        </form>
                    </div>

                <?php endif; ?>
            </div>
        </div>
    </div>

<!-- Modals -->

    <!-- Edit Classes Modal -->
    <div class="modal fade" id="editClassesModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-lower">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Edit Class</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <form id="editClassForm">
                        <input type="hidden" id="edit_course_id">
                        <!-- Edit Class Name -->
                        <div class="mb-3">
                            <label for="edit_class_name" class="form-label">
                                Class Name <span class="text-danger">*</span>
                            </label>
                            <input type="text" class="form-control" id="edit_class_name" required>
                        </div>
                        <!-- Edit Course Code -->
                        <div class="mb-3">
                            <div class="flex items-center gap-1">
                                <label for="edit_course_code" class="form-label">Course Code</label>
                                <i
                                    class="mb-2 fas fa-question-circle text-gray-500 hover:text-gray-700 cursor-default"
                                    data-bs-toggle="tooltip"
                                    data-bs-html="true"
                                    title="Course codes must have a department code and be followed by numbers (Ex: EN100, PYS200, CS/EGR222)."
                                ></i>
                            </div>
                            <input type="text" class="form-control" id="edit_course_code" maxlength="20">
                        </div>
                        <!-- Edit Class Description -->
                        <div class="mb-3">
                            <label for="edit_class_description" class="form-label">Description</label>
                            <textarea class="form-control" id="edit_class_description"></textarea>
                        </div>
                        <button type="submit" class="btn btn-primary w-full mb-0">Save Changes</button>
                    </form>
                </div>
            </div>
        </div>
    </div>

    <!-- Edit Enrollments Modal -->
    <div class="modal fade" id="editEnrollmentsModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-lower">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Edit Enrollment</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <form id="editEnrollmentForm">
                        <input type="hidden" id="edit_enrollment_id">
                        <!-- Edit Class Dropdown -->
                        <div class="mb-3">
                            <label for="classEditDropdownBtn" class="form-label">Class Name</label>
                            <div class="dropdown">
                                <button id="classEditDropdownBtn" class="btn dropdown-toggle w-100 text-start d-flex justify-content-between align-items-center m-0" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                                    <span id="selectedEditClassText">Select Class</span>
                                </button>
                                <div class="dropdown-menu w-100 p-2" id="classEditDropdown">
                                    <input
                                        type="text"
                                        class="form-control mb-2"
                                        id="classEditSearchInput"
                                        placeholder="Search classes..."
                                    />
                                    <div class="class-edit-list" style="max-height: 200px; overflow-y: auto; margin: 0 -0.5rem;">
                                        <!-- JavaScript -->
                                    </div>
                                </div>
                                <input type="hidden" id="edit_class_id" name="edit_class_id" required>
                            </div>
                        </div>
                        <!-- Edit User Dropdown -->
                        <div class="mb-3">
                            <label for="userEditDropdownBtn" class="form-label">User</label>
                            <div class="dropdown">
                                <button id="userEditDropdownBtn" class="btn dropdown-toggle w-100 text-start d-flex justify-content-between align-items-center m-0" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                                    <span id="selectedEditUserText">Select User</span>
                                </button>
                                <div class="dropdown-menu w-100 p-2">
                                    <input
                                        type="text"
                                        class="form-control mb-2"
                                        id="userEditSearchInput"
                                        placeholder="Search users..."
                                    />
                                    <div class="user-edit-list -p-2" style="max-height: 200px; overflow-y: auto; margin: 0 -0.5rem;">
                                        <!-- JavaScript -->
                                    </div>
                                </div>
                                <input type="hidden" id="edit_user_id" name="edit_user_id" required>
                            </div>
                        </div>
                        <!-- Edit Class Role Dropdown -->
                        <div class="mb-3">
                            <label for="roleEditDropdownBtn" class="form-label">
                                Role (JayWing)
                            </label>
                            <div class="dropdown">
                                <button id="roleEditDropdownBtn" class="btn dropdown-toggle w-100 text-start d-flex justify-content-between align-items-center m-0" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                                    <span id="selectedEditRoleText">Tutor</span>
                                </button>
                                <div class="dropdown-menu w-100 p-2">
                                    <div class="role-edit-list -p-2" style="max-height: 200px; overflow-y: auto; margin: 0 -0.5rem;">
                                        <div class="dropdown-item" data-value="Tutor">Tutor</div>
                                        <div class="dropdown-item" data-value="Tutee">Tutee</div>
                                    </div>
                                </div>
                                <input type="hidden" id="edit_roleOfClass" name="edit_roleOfClass" value="Tutor">
                            </div>
                        </div>
                        <button type="submit" class="btn btn-primary w-full mb-0">Save Changes</button>
                    </form>
                </div>
            </div>
        </div>
    </div>

    <!-- Add Multiple Enrollments Modal -->
    <div class="modal fade" id="multipleEnrollmentsModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-lower">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Add Multiple Enrollments</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <form id="addMultipleEnrollmentsForm">
                        <!-- Class Multiple Dropdown -->
                        <div class="mb-3">
                            <label for="classMultipleDropdownBtn" class="form-label">
                                Class Name <span class="text-danger">*</span>
                            </label>
                            <div class="dropdown">
                                <button id="classMultipleDropdownBtn" class="btn dropdown-toggle w-100 text-start d-flex justify-content-between align-items-center m-0" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                                    <span id="selectedMultipleClassText">Select Class</span>
                                </button>
                                <div class="dropdown-menu w-100 p-2" id="classMultipleDropdown">
                                    <input
                                        type="text"
                                        class="form-control mb-2"
                                        id="classMultipleSearchInput"
                                        placeholder="Search classes..."
                                    />
                                    <div class="class-multiple-list" style="max-height: 200px; overflow-y: auto; margin: 0 -0.5rem;">
                                        <!-- JavaScript -->
                                    </div>
                                </div>
                                <input type="hidden" id="multiple_class_id" name="multiple_class_id" required>
                            </div>
                        </div>
                        <!-- User Multiple Dropdown -->
                        <div class="mb-3">
                            <label for="userMultipleDropdownBtn" class="form-label">
                                User <span class="text-danger">*</span>
                            </label>
                            <div class="dropdown">
                                <button id="userMultipleDropdownBtn" class="btn dropdown-toggle w-100 text-start d-flex justify-content-between align-items-center m-0" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                                    <span id="selectedMultipleUserText">Select Users</span>
                                </button>
                                <div class="dropdown-menu w-100 p-2">
                                    <input
                                        type="text"
                                        class="form-control mb-2"
                                        id="userMultipleSearchInput"
                                        placeholder="Search users..."
                                    />
                                    <div class="user-multiple-list -p-2" style="max-height: 200px; overflow-y: auto; margin: 0 -0.5rem;">
                                        <!-- JavaScript -->
                                    </div>
                                </div>
                                <input type="hidden" id="multiple_user_id" name="multiple_user_id" required>
                            </div>
                        </div>
                        <!-- Class Role Dropdown -->
                        <div class="mb-3">
                            <label for="roleMultipleDropdownBtn" class="form-label">
                                Role (JayWing)
                            </label>
                            <div class="dropdown">
                                <button id="roleMultipleDropdownBtn" class="btn dropdown-toggle w-100 text-start d-flex justify-content-between align-items-center m-0" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                                    <span id="selectedMultipleRoleText">Tutor</span>
                                </button>
                                <div class="dropdown-menu w-100 p-2">
                                    <div class="role-multiple-list -p-2" style="max-height: 200px; overflow-y: auto; margin: 0 -0.5rem;">
                                        <div class="dropdown-item" data-value="Tutor">Tutor</div>
                                        <div class="dropdown-item" data-value="Tutee">Tutee</div>
                                    </div>
                                </div>
                                <input type="hidden" id="multiple_roleOfClass" name="multiple_roleOfClass" value="Tutor">
                            </div>
                        </div>
                        <button type="submit" class="btn btn-primary w-full">Add Enrollments</button>
                    </form>
                </div>
            </div>
        </div>
    </div>

    <!-- Feedback Modal -->
    <div class="modal fade" id="feedbackModal" tabindex="-1" aria-labelledby="feedbackModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-xl modal-dialog-scrollable">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="feedbackModalLabel">Feedback on AI Responses</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body" id="feedbackModalBody">
                    <!-- Feedback cards inserted here dynamically -->
                </div>
            </div>
        </div>
    </div>


    <!-- <footer>
        <p> 2024 AI Tutor Proctor Page</p>
    </footer> -->

    

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>

    <!-- Owl Carousel CSS -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/OwlCarousel2/2.3.4/assets/owl.carousel.min.css" integrity="sha512-tS3S5qG0BlhnQROyJXvNjeEM4UpMXHrQfTGmbQ1gKmelCxlSEBUaxhRBj/EFTzpbP4RVSrpEikbmdJobCvhE3g==" crossorigin="anonymous" />

    <!-- Optional Theme -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/OwlCarousel2/2.3.4/assets/owl.theme.default.min.css" />

    <!-- jQuery -->
    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>

    <!-- Owl Carousel JS -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/OwlCarousel2/2.3.4/owl.carousel.min.js" integrity="sha512-bPs7Ae6pVvhOSiIcyUClR7/q2OAsRiovw4vAkX+zJbw3ShAeeqezq50RIIcIURq7Oa20rW2n2q+fyXBNcU9lrw==" crossorigin="anonymous"></script>

    <script src="static/proctor.js"></script>
</body>
</html>