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

$classes = $connection->query("SELECT * FROM courses");
$users = $connection->query("SELECT * FROM users");
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
    </style>

    <header id="header" class="d-flex justify-content-center py-3 bg-primary text-white w-full mb-0">
        Proctor Page
    </header>

    <div class="flex flex-grow w-full mt-0 overflow-hidden">

<!-- Sidebar with Proctor Management Links -->
        <div id="sidebar" class="d-flex flex-column flex-shrink-0 bg-gray-100 h-full max-w-xs w-full overflow-hidden">
            <div id="sidebar-options" class="space-y-2 flex-grow p-3 overflow-y-auto overflow-x-hidden sidebar-content-hide p-sidebar-noshow">
                <div id="chat-div" class="d-grid gap-2">
                    <a href="proctor.php" class="block p-3 rounded bg-gray-100 <?php echo $currentPage == "Dashboard" ? 'bg-gray-200' : ''; ?> message-container w-full overflow-hidden">
                        <div class="font-medium truncate">Dashboard</div>
                    </a>
                    <a href="?manageclasses" class="block p-3 rounded bg-gray-100 <?php echo $currentPage == "Manage Classes" ? 'bg-gray-200' : ''; ?> message-container w-full overflow-hidden">
                        <div class="font-medium truncate">Manage Classes</div>
                    </a>
                    <a href="?manageenrollments" class="block p-3 rounded bg-gray-100 <?php echo $currentPage == "Manage Enrollments" ? 'bg-gray-200' : ''; ?> message-container w-full overflow-hidden">
                        <div class="font-medium truncate">Manage Enrollments</div>
                    </a>
                    <a href="?manageproctornotes" class="block p-3 rounded bg-gray-100 <?php echo $currentPage == "Manage Proctor Notes" ? 'bg-gray-200' : ''; ?> message-container w-full overflow-hidden">
                        <div class="font-medium truncate">Manage Proctor Notes</div>
                    </a>
                </div>
            </div>
        </div>

        <div id="chat-container" class="flex flex-col bg-white py-2 h-full w-full overflow-hidden">
            <!-- Chat header -->
            <div class="align-self-start px-3 py-2 w-full border-b-4 border-gray-50">
                <h2 class="text-xl font-bold text-left"> <?php echo htmlspecialchars($currentPage); ?> </h2>
            </div>
            
            <!-- Main area -->
            <div id="conversation" class="flex-1 overflow-y-auto space-y-4 w-full p-chat-noshow">
                <?php if($currentPage == "Dashboard") : ?>
                    <div>
                        <!-- TODO: Dashboard Page -->
                    </div>

<!-- Class Management Section -->
                <?php elseif($currentPage == "Manage Classes") : ?>
                    <div class="m-4">
                        <form id="classForm">
                            <div class="row">
                                <!-- Class Name -->
                                <div class="col-md-4 mb-3">
                                    <label for="class_name" class="form-label">
                                        Class Name <span class="text-danger">*</span>
                                    </label>
                                    <input type="text" class="form-control" id="class_name" required>
                                </div>
                                <!-- Course Code -->
                                <div class="col-md-4 mb-3">
                                    <label for="course_code" class="form-label">Course Code</label>
                                    <input type="text" class="form-control" id="course_code" maxlength="20">
                                </div>
                                <!-- Class Description -->
                                <div class="col-md-4 mb-3">
                                    <label for="class_description" class="form-label">Description</label>
                                    <textarea class="form-control" id="class_description" style="height: 37.6px;"></textarea>
                                </div>
                            </div>
                            <button type="submit" class="btn btn-primary">Add Class</button>
                        </form>
                        
                        <!-- Classes Table -->
                        <div class="table-responsive mt-4">
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
                                            <select class="form-select bg-primary text-white" id="filter-by-btn" name="filterBy" onchange="filterCourses(this.value)">
                                                <option value="allCourses">Filter: All</option>
                                                <?php
                                                    $query = "
                                                        SELECT DISTINCT
                                                            REGEXP_SUBSTR(courseCode, '^[A-Z]+') AS discipline
                                                        FROM courses
                                                        WHERE courseCode REGEXP '^[A-Z]+[0-9]+$'
                                                        ORDER BY discipline ASC
                                                    ";

                                                    $stmt = $connection->prepare($query);
                                                    $stmt->execute();
                                                    $disciplines = $stmt->get_result();

                                                    while ($discipline = $disciplines->fetch_assoc()):
                                                ?>
                                                    <option value="<?= $discipline['discipline'] ?>"><?= $discipline['discipline'] ?></option>
                                                <?php endwhile; ?>
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

<!-- Enrollment Management Section -->
                <?php elseif($currentPage == "Manage Enrollments") : ?>
                    <div class="m-4">
                        <form id="enrollmentForm">
                            <div class="row">
                                <!-- Class Dropdown -->
                                <div class="col-md-4 mb-3">
                                    <label for="class_id" class="form-label">
                                        Class Name <span class="text-danger">*</span>
                                    </label>
                                    <div class="dropdown">
                                        <button class="btn dropdown-toggle w-100 text-start d-flex justify-content-between align-items-center m-0" type="button" data-bs-toggle="dropdown" aria-expanded="false">
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
                                                <?php while($class = $classes->fetch_assoc()): ?>
                                                    <div class="dropdown-item" data-value="<?= $class['id'] ?>">
                                                        <?= htmlspecialchars($class['name']) ?> 
                                                        <?php if (!empty($class['courseCode'])): ?>
                                                            (<?= htmlspecialchars($class['courseCode']) ?>)
                                                        <?php endif; ?>
                                                    </div>
                                                <?php endwhile; ?>
                                            </div>
                                        </div>
                                        <input type="hidden" id="class_id" name="class_id" required>
                                    </div>
                                </div>
                                <!-- User Dropdown -->
                                <div class="col-md-4 mb-3">
                                    <label for="user_id" class="form-label">
                                        User <span class="text-danger">*</span>
                                    </label>
                                    <div class="dropdown">
                                        <button class="btn dropdown-toggle w-100 text-start d-flex justify-content-between align-items-center m-0" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                                            <span id="selectedUserText">Select User</span>
                                        </button>
                                        <div class="dropdown-menu w-100 p-2">
                                            <input type="text" class="form-control mb-2" id="userSearchInput" placeholder="Search users...">
                                            <div class="user-list -p-2" style="max-height: 200px; overflow-y: auto; margin: 0 -0.5rem;">
                                                <?php while($user = $users->fetch_assoc()): ?>
                                                    <div class="dropdown-item" data-value="<?= $user['id'] ?>">
                                                        <?= htmlspecialchars($user['username']) ?>
                                                    </div>
                                                <?php endwhile; ?>
                                            </div>
                                        </div>
                                        <input type="hidden" id="user_id" name="user_id" required>
                                    </div>
                                </div>
                                <!-- Class Role Dropdown -->
                                <div class="col-md-4 mb-3">
                                    <label for="roleOfClass" class="form-label">
                                        Role (JayWing)
                                    </label>
                                    <select class="form-select" id="roleOfClass" name="roleOfClass" required>
                                        <option value="tutor">Tutor</option>
                                        <option value="tutee">Tutee</option>
                                    </select>
                                </div>
                            </div>
                            <button type="submit" class="btn btn-primary">Add Enrollment</button>
                        </form>
                        
                        <!-- Enrollments Table -->
                        <div class="table mt-4">
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
                                            <select class="form-select bg-primary text-white" id="filter-by-btn-2" name="filterBy" onchange="filterEnrollments(this.value)">
                                                <option value="allCourses">Filter: All</option>
                                                <?php
                                                    $query = "
                                                        SELECT DISTINCT
                                                            REGEXP_SUBSTR(courseCode, '^[A-Z]+') AS discipline
                                                        FROM courses
                                                        WHERE courseCode REGEXP '^[A-Z]+[0-9]+$'
                                                        ORDER BY discipline ASC
                                                    ";

                                                    $stmt = $connection->prepare($query);
                                                    $stmt->execute();
                                                    $disciplines = $stmt->get_result();

                                                    while ($discipline = $disciplines->fetch_assoc()):
                                                ?>
                                                    <option value="<?= $discipline['discipline'] ?>"><?= $discipline['discipline'] ?></option>
                                                <?php endwhile; ?>
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

<!-- Proctor Note Management Section -->
                <?php elseif($currentPage == "Manage Proctor Notes") : ?>
                    <div class="m-4">
                        <form id="proctorForm">
                            <div class="row">
                                <!-- Class dropdown -->
                                <!-- <div class="col-md-4 mb-3">
                                    <label for="courses-dropdown-upload" class="form-label">Select Course:</label>
                                    <select class="form-select bg-dark text-white" id="courses-dropdown-upload">
                                    </select>
                                </div> -->

                                <div class="col-md-4 mb-3">
                                    <label for="notes_class_id" class="form-label">
                                        Class Name <span class="text-danger">*</span>
                                    </label>
                                    <div class="dropdown">
                                        <button class="btn dropdown-toggle w-100 text-start d-flex justify-content-between align-items-center m-0" type="button" data-bs-toggle="dropdown" aria-expanded="false">
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
                                                <?php while($class = $classes->fetch_assoc()): ?>
                                                    <div class="dropdown-item" data-value="<?= $class['id'] ?>">
                                                        <?= htmlspecialchars($class['name']) ?> 
                                                        <?php if (!empty($class['courseCode'])): ?>
                                                            (<?= htmlspecialchars($class['courseCode']) ?>)
                                                        <?php endif; ?>
                                                    </div>
                                                <?php endwhile; ?>
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
                            <div id="preview-div">
                                <!-- Thumbnails of uploaded files will appear here -->
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
        <div class="modal-dialog">
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
                            <label for="edit_course_code" class="form-label">Course Code</label>
                            <input type="text" class="form-control" id="edit_course_code" maxlength="7">
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
        <div class="modal-dialog">
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
                            <label for="edit_class_id" class="form-label">Class Name</label>
                            <div class="dropdown">
                                <button class="btn dropdown-toggle w-100 text-start d-flex justify-content-between align-items-center m-0" type="button" data-bs-toggle="dropdown" aria-expanded="false">
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
                                        <?php
                                        $classes->data_seek(0);
                                        while($class = $classes->fetch_assoc()): ?>
                                            <div class="dropdown-item" data-value="<?= $class['id'] ?>">
                                                <?= htmlspecialchars($class['name']) ?> 
                                                <?php if (!empty($class['courseCode'])): ?>
                                                    (<?= htmlspecialchars($class['courseCode']) ?>)
                                                <?php endif; ?>
                                            </div>
                                        <?php endwhile; ?>
                                    </div>
                                </div>
                                <input type="hidden" id="edit_class_id" name="edit_class_id" required>
                            </div>
                        </div>
                        <!-- Edit User Dropdown -->
                        <div class="mb-3">
                            <label for="edit_user_id" class="form-label">User</label>
                            <div class="dropdown">
                                <button class="btn dropdown-toggle w-100 text-start d-flex justify-content-between align-items-center m-0" type="button" data-bs-toggle="dropdown" aria-expanded="false">
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
                                        <?php
                                        $users->data_seek(0);
                                        while($user = $users->fetch_assoc()): ?>
                                            <div class="dropdown-item" data-value="<?= $user['id'] ?>">
                                                <?= htmlspecialchars($user['username']) ?>
                                            </div>
                                        <?php endwhile; ?>
                                    </div>
                                </div>
                                <input type="hidden" id="edit_user_id" name="edit_user_id" required>
                            </div>
                        </div>
                        <!-- Edit Class Role Dropdown -->
                        <div class="mb-3">
                            <label for="edit_roleOfClass" class="form-label">Role (JayWing)</label>
                            <select class="form-select" id="edit_roleOfClass" required>
                                <option value="tutor">Tutor</option>
                                <option value="tutee">Tutee</option>
                            </select>
                        </div>
                        <button type="submit" class="btn btn-primary w-full mb-0">Save Changes</button>
                    </form>
                </div>
            </div>
        </div>
    </div>

    <!-- <footer>
        <p> 2024 AI Tutor Proctor Page</p>
    </footer> -->

    <script>
        const userId = "<?php echo $_SESSION['user_id']; ?>";
        const username = "<?php echo $_SESSION['username']; ?>";
        const userRole = "<?php echo $_SESSION['admin']; ?>"; // 1 = proctor, 0 = student
    </script>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>

    <script src="static/proctor.js"></script>
</body>
</html>
