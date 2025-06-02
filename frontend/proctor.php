<?php
session_start();
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
<body>

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

<header>
    <h1>Proctor Page</h1>
</header>

<div class="container">

    <!-- Class Management Section -->
    <div class="card bg-dark text-white mb-4">
        <div class="card-header">
            <h5 class="mb-0">Manage Classes</h5>
        </div>
        <div class="card-body">
            <form id="classForm">
                <div class="row">
                    <div class="col-md-4 mb-3">
                        <label for="course-name-input" class="form-label">Class Name</label>
                        <input type="text" class="form-control bg-dark text-white" id="course-name-input" required>
                    </div>
                    <div class="col-md-4 mb-3">
                        <label for="course-code" class="form-label">Course Code (TODO: implement in JayWing)</label>
                        <input type="text" readonly class="form-control bg-dark text-white" id="course-code" maxlength="7">
                    </div>
                    <div class="col-md-4 mb-3">
                        <label for="class-description" class="form-label">Description (TODO: implement in JayWing)</label>
                        <textarea readonly class="form-control bg-dark text-white" id="class-description" style="height: 37.6px;"></textarea>
                    </div>
                </div>
                <button type="button" id="add-course-btn" class="btn btn-primary">Add New Course</button>
            </form>
            
            <div class="table-responsive mt-4">
                <table class="table table-dark">
                    <thead>
                        <tr>
                            <th>Class Name</th>
                            <th>Course Code</th>
                            <th>Description</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                </table>
            </div>
            <label>TODO: implement in JayWing</label>
        </div>
    </div>

    <!-- Add Enrollment Form -->
    <div class="card bg-dark text-white mb-4">
        <div class="card-header">
            <h5 class="mb-0">Manage Enrollment</h5>
        </div>
        <div class="card-body">
            <form id="enrollmentForm">
                <div class="row">
                    <!-- Class dropdown -->
                    <div class="col-md-4 mb-3">
                        <label for="courses-dropdown-enroll" class="form-label">Select Course:</label>
                        <select class="form-select bg-dark text-white" id="courses-dropdown-enroll">
                            <!-- Courses will be dynamically populated here -->
                        </select>
                    </div>

                    <!-- User input -->
                    <div class="col-md-4 mb-3">
                        <label for="student-username" class="form-label">Student Name</label>
                        <input type="text" class="form-control bg-dark text-white" id="student-username">
                    </div>
                
                    <!-- User role -->
                    <div class="col-md-4 mb-3">
                        <label for="roleOfClass" class="form-label">Role (TODO: implement in JayWing)</label>
                        <select class="form-select bg-dark text-white" id="roleOfClass" name="roleOfClass" disabled>
                            <option value="tutor">Tutor</option>
                            <option value="tutee">Tutee</option>
                        </select>
                    </div>
                </div>
                <button id="assign-student-btn" type="button" class="btn btn-primary">Add Enrollment</button>
            </form>

            <div class="table-responsive mt-4">
                <table class="table table-dark">
                    <thead>
                        <tr>
                            <th>Class Name</th>
                            <th>User</th>
                            <th>Role</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                </table>
            </div>
            <label>TODO: implement in JayWing</label>
        </div>
    </div>

    <!-- File Upload Section -->
    <div class="card bg-dark text-white mb-4">
        <div class="card-header">
            <h5 class="mb-0">Manage Proctor Notes</h5>
        </div>
        <div class="card-body">
            <form id="proctorForm">
                <div class="row">
                    <!-- Class dropdown -->
                    <div class="col-md-4 mb-3">
                        <label for="courses-dropdown-upload" class="form-label">Select Course:</label>
                        <select class="form-select bg-dark text-white" id="courses-dropdown-upload">
                            <!-- Courses will be dynamically populated here -->
                        </select>
                    </div>

                    <!-- User input -->
                    <div class="col-md-4 mb-3" id="file-upload-div">
                        <label class="form-label" for="file-input">Upload Documents</label>
                        <input type="file" class="form-control-file" id="file-input" multiple>
                    </div>
                
                </div>
                <!-- <button id="train-button" type="button" class="btn btn-primary">Train Model</button> -->

                <!-- Preview Section -->
                <div id="preview-div">
                    <!-- Thumbnails of uploaded files will appear here -->
                </div>
            </form>
        </div>
    </div>
</div>

<footer>
    <p> 2024 AI Tutor Proctor Page</p>
</footer>
<script>
    const userId = "<?php echo $_SESSION['user_id']; ?>";
    const username = "<?php echo $_SESSION['username']; ?>";
    const userRole = "<?php echo $_SESSION['admin']; ?>"; // 1 = proctor, 0 = student
</script>

<script src="static/proctor.js"></script>
</body>
</html>
