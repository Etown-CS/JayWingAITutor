const FLASK_API = "http://localhost:5000";
const fileUploadDiv = document.getElementById('file-upload-div');
const fileInput = document.getElementById('file-input');
const previewDiv = document.getElementById('preview-div');
const pdfDiv = document.getElementById('pdf-div');
const pptxDiv = document.getElementById('pptx-div');
const pngDiv = document.getElementById('png-div');
const docsFolder = "docs"; // Folder to store files

const tbodyclasses = document.getElementById('classesTable');
const tbodyenrollments = document.getElementById('enrollmentsTable');

const classNotesId = document.getElementById('notes_class_id');

const classModal = new bootstrap.Modal(document.getElementById('editClassesModal'));
const enrollmentModal = new bootstrap.Modal(document.getElementById('editEnrollmentsModal'));
const multipleEnrollmentsModal = new bootstrap.Modal(document.getElementById('multipleEnrollmentsModal'));


// --------------------- General JavaScript ------------------------


/**
 * Handles clicks on "Home" button.
 * Returns user to login page.
 */
document.getElementById('home').addEventListener('click', function () {
    const currentPath = window.location.pathname;
    const query = window.location.search;

    // Find everything after '/frontend/' in the pathname
    const match = currentPath.match(/\/frontend\/(.+)$/);
    if (match) {
        const relativePath = match[1] + query;
        window.location.href = '/jaywingaitutor/frontend/';
    }
});

// Specific to Multiple User Selection
const selectedUsers = new Set(); // Stores IDs of selected users
const selectedMultipleUserText = document.getElementById('selectedMultipleUserText'); // Element to display selected users
const multipleUserIdInput = document.getElementById('multiple_user_id'); // Hidden input to store selected user IDs

// Global variable for all users, will be populated via API call
let allUsers = [];

// Date selection for dashboard
const startDateInput = document.getElementById('selectedStartDate');
const endDateInput = document.getElementById('selectedEndDate');
dateValidation = true; // Global variable to track date validation state

document.addEventListener('DOMContentLoaded', function () {
    // Page setup
    loadClasses();
    loadEnrollments();
    reloadClassDropdowns();
    reloadUserDropdowns();
    initializeSearchableClassTable();
    initializeSearchableEnrollmentTable();
    initializeSearchableDropdowns(); // This now includes loading all users for regular dropdowns
    handleDateSelection(); // Initialize date selection for dashboard
    generateReport(); // Initial report generation with default filters

    $(document).ready(function(){
        $(".owl-carousel").owlCarousel({
            items: 3,
            loop: true,
            margin: 20,
            autoplay: true,
            autoplayTimeout: 10000, // 10 seconds
            autoplayHoverPause: true,
            smartSpeed: 700,
            responsive: {
            0: { items: 1 },
            768: { items: 2 },
            1024: { items: 3 }
            }
        });
    });

    // Bootstrap Tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.forEach(function (el) {
      new bootstrap.Tooltip(el, {
        customClass: 'tooltip-left-align'
      });
    });

    // Add event listener for when the multiple enrollments modal is shown
    multipleEnrollmentsModal._element.addEventListener('shown.bs.modal', function () {
        // Ensure the container element is available when the modal is shown
        loadAllUsersForMultipleSelect(); // Load users when the modal opens
        selectedUsers.clear(); // Clear selections when opening the modal for a new selection
        updateSelectedUsersDisplay(); // Reset display text
    });

    if (classNotesId) {
        const courseId = classNotesId.value;
        const courseName = document.getElementById('selectedNotesClassText').innerText;

        if (courseId && courseName && courseName !== "Select Class") {
            loadExistingFiles();
        }
    }

    // When button dropdowns are closed
    document.querySelectorAll('.dropdown').forEach(dropdownEl => {
        dropdownEl.addEventListener('hidden.bs.dropdown', () => {
            // Clear search input
            const searchInput = dropdownEl.querySelector('input.form-control');
            if (searchInput) {
                searchInput.value = '';
                // Trigger input event to re-filter if necessary (e.g., show all items again)
                searchInput.dispatchEvent(new Event('input'));
            }
        });
    });

    // Modify loaded files when a new course is selected
    if (classNotesId) {
        classNotesId.addEventListener('change', () => {
            const selectedOption = document.querySelector('#notes_class_id option:checked');
            const selectedText = selectedOption ? selectedOption.textContent.trim() : "";

            document.getElementById('selectedNotesClassText').innerText = selectedText;

            previewDiv.innerHTML = '';
            loadExistingFiles();
        });
    }
    
    const dashFilterForm = document.getElementById('dashboardFilterForm');
    const classForm = document.getElementById('classForm');
    const enrollmentForm = document.getElementById('enrollmentForm');
    const editClassForm = document.getElementById('editClassForm');
    const editEnrollmentForm = document.getElementById('editEnrollmentForm');
    const addMultipleEnrollmentsForm = document.getElementById('addMultipleEnrollmentsForm'); // Ensure this is defined

    /**
     * Adds a submit event listener to the dashboard filter form.
     * 
     * When the form is submitted, prevents the default submission,
     * extracts relevant form values, logs them to the console,
     * and calls generateReport with those values.
     */
    if (dashFilterForm) {
        dashFilterForm.addEventListener('submit', function (e) {
            e.preventDefault();
            const form = document.getElementById('dashboardFilterForm');
            console.log("Dashboard Filter Form submitted");

            // Dates are automatically validated in handleDateSelection

            // Get form contents
            const formData = new FormData(form);

            const classId   = formData.get('class_id');
            const userId    = formData.get('user_id');
            const startDate = formData.get('selectedStartDate');
            const endDate   = formData.get('selectedEndDate');
            const qaFilter  = formData.get('qa_filter');
            const stopWords = formData.get('customStopWords');

            console.log({ classId, userId, startDate, endDate, qaFilter, stopWords });
            generateReport(classId, userId, startDate, endDate, qaFilter, stopWords);
        });
    }

    /**
     * Adds a submit event listener to the class creation form.
     * 
     * On form submission:
     * - Prevents the default form submission.
     * - Validates that the class name is provided.
     * - Converts the course code to uppercase and validates its format.
     * - Fetches existing classes for the user to check for duplicates
     *   (matching class name and/or course code).
     * - If duplicates exist, shows error banners and aborts submission.
     * - If validation passes, sends a POST request to create the new class.
     * - On success, shows a success banner, reloads class lists and dropdowns,
     *   and resets the form.
     * - On failure, shows an error banner with the returned message.
     */
    if (classForm) {
        classForm.addEventListener('submit', function (e) {
            e.preventDefault();

            const courseCodeInput = document.getElementById('course_code');
            let courseCode = courseCodeInput.value.toUpperCase();
            let classDescription = document.getElementById('class_description').value;
            const className = document.getElementById('class_name').value.trim();

            if (!(className)) {
                showErrorBanner("Please enter a class name.");
                return;
            }

            if (isValidCourseCode(courseCode)) {
                console.log("Add Form: Course code is valid.");

                if (courseCode === '') courseCode = null;
                if (classDescription === '') classDescription = null;

                // Fetch all classes to check for duplicates
                fetch('../backend/api/classes/list_by_professor.php')
                    .then(response => response.json())
                    .then(result => {
                        if (!result.success) {
                            console.error('Error loading classes for duplicate check:', result.message);
                            return;
                        }

                        const allClassesForCheck = result.data;
                        let duplicateFound = false;

                        for (const cls of allClassesForCheck) {
                            // Check for duplicate class name and course code if provided
                            if ((courseCode && cls.courseCode && cls.courseCode.toLowerCase() === courseCode.toLowerCase()) &&
                                (className && cls.name && cls.name.toLowerCase() === className.toLowerCase())) {
                                showErrorBanner(`A class with the name "${className}" and course code "${courseCode}" already exists for this user.`);
                                duplicateFound = true;
                                break;
                            }
                            // Check for duplicate class name
                            if (className && cls.name && cls.name.toLowerCase() === className.toLowerCase()) {
                                showErrorBanner(`A class with the name "${className}" already exists for this user.`);
                                duplicateFound = true;
                                break;
                            }
                            // Check for duplicate course code if provided
                            if (courseCode && cls.courseCode && cls.courseCode.toLowerCase() === courseCode.toLowerCase()) {
                                showErrorBanner(`A class with the course code "${courseCode}" already exists for this user.`);
                                duplicateFound = true;
                                break;
                            }
                        }

                        if (duplicateFound) {
                            return;
                        }

                        // If no duplicates found, proceed with class creation
                        const data = {
                            userId: userId,
                            name: className,
                            courseCode: courseCode,
                            description: classDescription
                        };

                        fetch('../backend/api/classes/create.php', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(data)
                        })
                            .then(response => response.json())
                            .then(data => {
                                if (data.success) {
                                    showSuccessBanner("Class added successfully!");
                                    loadClasses();
                                    reloadClassDropdowns();
                                    initializeSearchableClassTable();
                                    reloadFilterDropdowns();
                                    this.reset();
                                } else {
                                    showErrorBanner(`Error: ${data.message}`);
                                }
                            })
                            .catch(error => {
                                showErrorBanner('An unexpected error occurred: ' + error.message);
                            });
                    })
                    .catch(error => console.error('Error fetching classes for validation:', error));

            } else {
                showErrorBanner("Invalid course code format. Course codes must have a department code and be followed by numbers (Ex: EN100, PYS200, CS/EGR222). Please format correctly or leave blank.");
                courseCodeInput.focus();
            }
        });
    }

    /**
     * Adds a submit event listener to the enrollment form.
     * 
     * On form submission:
     * - Prevents the default form submission behavior.
     * - Validates that the course, user, and role selections are made.
     * - Fetches all existing enrollments to check for duplicates.
     * - If the user is already enrolled in the selected course, shows an error banner.
     * - Otherwise, sends a POST request to create the enrollment.
     * - On success, shows a success banner, reloads enrollment data and tables, and resets the form.
     * - Handles and logs errors appropriately.
     */
    if (enrollmentForm) {
        enrollmentForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const form = this;

            // Check that user filled required fields
            const courseId = document.getElementById('class_id').value;
            const userId = document.getElementById('user_id').value;
            const roleOfClass = document.getElementById('roleOfClass').value;
            if (!(courseId)) {
                showErrorBanner("Please select a class in the dropdown.");
                return;
            }
            if (!(userId)) {
                showErrorBanner("Please select a user in the dropdown.");
                return;
            }
            if (!(roleOfClass)) {
                showErrorBanner("Please select a role in the dropdown.");
                return;
            }

            fetch('../backend/api/enrollments/list_by_professor.php')
                .then(response => response.json())
                .then(result => {
                    if (!result.success) {
                        console.error('Error loading user courses:', result.message);
                        return;
                    }

                    allEnrollments = result.data;
                    console.log('All enrollments loaded:', allEnrollments);

                    const data = {
                        courseId: courseId,
                        userId: userId,
                        // roleOfClass: document.getElementById('roleOfClass').value
                    };

                    // Check if user is already enrolled in the class
                    const isAlreadyEnrolled = allEnrollments.some(enrollment =>
                        enrollment.courseId == data.courseId && enrollment.userId == data.userId
                    );

                    if (isAlreadyEnrolled) {
                        showErrorBanner("This user is already enrolled in the selected class.");
                        return;
                    }

                    // Proceed with enrollment
                    fetch('../backend/api/enrollments/create.php', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(data)
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            showSuccessBanner("Enrollment added successfully!");
                            loadEnrollments();
                            initializeSearchableEnrollmentTable();
                            reloadFilterDropdowns();
                            form.reset();
                        } else {
                            showErrorBanner(`Error: ${data.message}`);
                        }
                    })
                    .catch(error => {
                        showErrorBanner('An unexpected error occurred: ' + error.message);
                    });
                })
                .catch(error => console.error('Error:', error)); 
        });
    }

    /**
     * Adds a submit event listener to the "Add Multiple Enrollments" form.
     * 
     * On submission:
     * - Prevents default form behavior.
     * - Validates that a class and at least one user are selected.
     * - Constructs an array of enrollment objects to be sent to the server.
     * - Sends POST requests to create each enrollment in parallel using `Promise.all`.
     * - Displays error banners for individual failures and logs detailed messages to the console.
     * - If all enrollments succeed:
     *   • Displays a success banner.
     *   • Reloads enrollment data, tables, and dropdowns.
     *   • Resets the form and UI state.
     * - If some enrollments fail:
     *   • Displays an error banner and performs the same reset and reload actions.
     * 
     * Dependencies:
     * - Uses global `selectedUsers`, `updateSelectedUsersDisplay`, and `multipleEnrollmentsModal`.
     */
    if (addMultipleEnrollmentsForm) {
        addMultipleEnrollmentsForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const form = this;

            const courseId = document.getElementById('multiple_class_id').value;
            const userIds = multipleUserIdInput.value.split(',').filter(id => id.trim() !== '');

            if (!(courseId)) {
                showErrorBanner("Please select a class in the dropdown.");
                return;
            }
            if (userIds.length === 0) {
                showErrorBanner("Please select at least one user in the dropdown.");
                return;
            }

            let enrollmentsToCreate = [];
            userIds.forEach(userId => {
                enrollmentsToCreate.push({
                    courseId: courseId,
                    userId: userId,
                    // roleOfClass: document.getElementById('multiple_roleOfClass').value
                });
            });

            const createEnrollmentPromises = enrollmentsToCreate.map(data => {
                return fetch('../backend/api/create_enrollment.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                })
                .then(response => response.json())
                .then(result => {
                    if (!result.success) {
                        console.error(`Error enrolling user ${data.userId} in class ${data.courseId}:`, result.message);
                        showErrorBanner(`Error enrolling some users: ${result.message}`);
                    }
                    return result;
                })
                .catch(error => {
                    showErrorBanner('An unexpected error occurred during enrollment: ' + error.message);
                    return { success: false, message: error.message };
                });
            });

            Promise.all(createEnrollmentPromises)
                .then(results => {
                    const allSuccess = results.every(result => result.success);
                    if (allSuccess) {
                        showSuccessBanner("Enrollments added successfully!");
                        loadEnrollments();
                        initializeSearchableEnrollmentTable();
                        reloadFilterDropdowns();
                        form.reset();
                        selectedUsers.clear();
                        updateSelectedUsersDisplay();
                        // Clear selected values in main class dropdown
                        document.getElementById('class_id').value = null;
                        document.getElementById('selectedClassText').textContent = 'Select Class';
                        document.getElementById('user_id').value = null;
                        document.getElementById('selectedUserText').textContent = 'Select User';
                        multipleEnrollmentsModal.hide();
                    } else {
                        showErrorBanner("Some enrollments could not be added. Check console for details.");
                        loadEnrollments();
                        initializeSearchableEnrollmentTable();
                        reloadFilterDropdowns();
                        form.reset();
                        selectedUsers.clear();
                        updateSelectedUsersDisplay();
                        // Clear selected values in main class dropdown
                        document.getElementById('class_id').value = null;
                        document.getElementById('selectedClassText').textContent = 'Select Class';
                        document.getElementById('user_id').value = null;
                        document.getElementById('selectedUserText').textContent = 'Select User';
                        multipleEnrollmentsModal.hide();
                    }
                })
                .catch(error => {
                    showErrorBanner('An unexpected error occurred during batch enrollment: ' + error.message);
                });
        });
    }
    
    /**
     * Adds a submit event listener to the class editing form.
     * 
     * On submission:
     * - Prevents the default form behavior.
     * - Validates and transforms the course code input.
     * - Checks for duplicate class names or course codes (excluding the class being edited).
     * - If duplicates are found, displays appropriate error banners and aborts the update.
     * - If validation passes:
     *   • Sends a POST request to update the class details.
     *   • On success, reloads class data, refreshes UI elements, and closes the modal.
     *   • On failure, hides banners and closes the modal (silent fail).
     * - If the course code format is invalid, shows a specific formatting error.
     *
     * Dependencies:
     * - Uses global `classModal` to hide the modal dialog.
     * - Uses `isValidCourseCode`, `showSuccessBanner`, `showErrorBanner`, `hideAllBanners`,
     *   `loadClasses`, `reloadFilterDropdowns`, `initializeSearchableClassTable`.
     */
    if (editClassForm) {
        editClassForm.addEventListener('submit', function(e) {
            e.preventDefault();

            const courseCodeInput = document.getElementById('edit_course_code');
            let courseCodeGet = courseCodeInput.value.toUpperCase();
            let classDescription = document.getElementById('edit_class_description').value;
            const courseIdBeingEdited = document.getElementById('edit_course_id').value;
            const newClassName = document.getElementById('edit_class_name').value.trim();

            // Use the reusable function to validate the input
            if (isValidCourseCode(courseCodeGet)) {
                console.log("Edit Form: Course code is valid.");

                if (courseCodeGet === '') courseCodeGet = null;
                if (classDescription === '') classDescription = null;

                // Fetch all classes to check for duplicates (excluding the current one)
                fetch('../backend/api/classes/list_by_professor.php')
                    .then(response => response.json())
                    .then(result => {
                        if (!result.success) {
                            console.error('Error loading classes for duplicate check:', result.message);
                            return;
                        }

                        const allClassesForCheck = result.data;
                        let duplicateFound = false;

                        for (const cls of allClassesForCheck) {
                            // Skip the class currently being edited
                            if (cls.id == courseIdBeingEdited) {
                                continue;
                            }

                            // Check for duplicate class name and course code if new code provided
                            if ((cls.name && newClassName && cls.name.toLowerCase() === newClassName.toLowerCase()) &&
                                (courseCodeGet && cls.courseCode && cls.courseCode.toLowerCase() === courseCodeGet.toLowerCase())) {
                                showErrorBanner(`A class with the name "${newClassName}" and course code "${courseCodeGet}" already exists for this user.`);
                                duplicateFound = true;
                                break;
                            }

                            // Check for duplicate class name
                            if (cls.name && newClassName && cls.name.toLowerCase() === newClassName.toLowerCase()) {
                                showErrorBanner(`A class with the name "${newClassName}" already exists for this user.`);
                                duplicateFound = true;
                                break;
                            }
                            // Check for duplicate course code if new code provided
                            if (courseCodeGet && cls.courseCode && cls.courseCode.toLowerCase() === courseCodeGet.toLowerCase()) {
                                showErrorBanner(`A class with the course code "${courseCodeGet}" already exists for this user.`);
                                duplicateFound = true;
                                break;
                            }
                        }

                        if (duplicateFound) {
                            return;
                        }

                        const data = {
                            courseId: courseIdBeingEdited,
                            name: newClassName,
                            courseCode: courseCodeGet,
                            description: classDescription
                        };
                        
                        fetch('../backend/api/classes/update.php', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(data)
                        })
                        .then(response => response.json())
                        .then(data => {
                            if (data.success) {
                                showSuccessBanner("Class updated successfully!");
                                loadClasses();
                                reloadFilterDropdowns();
                                initializeSearchableClassTable();
                                classModal.hide();
                            } else {
                                hideAllBanners();
                                classModal.hide();
                            }
                        })
                        .catch(error => {
                            showErrorBanner('An unexpected error occurred during update: ' + error.message);
                        });
                    })
                    .catch(error => console.error('Error fetching classes for validation:', error));

            } else {
                showErrorBanner("Invalid course code format. Course codes must have a department code and be followed by numbers (Ex: EN100, PYS200, CS/EGR222). Please format correctly or leave blank.");
                courseCodeInput.focus();
            }
        });
    }

    /**
     * Adds a submit event listener to the enrollment editing form.
     * 
     * On submission:
     * - Prevents default form behavior.
     * - Retrieves input values including enrollment ID, course ID, user ID, and role.
     * - Fetches all existing enrollments to check for duplicates (excluding the one being edited).
     * - If the same user is already enrolled in the selected course, shows an error banner and aborts.
     * - If validation passes:
     *   • Sends a POST request to update the enrollment record.
     *   • On success, shows a success banner, refreshes enrollments and UI elements, and closes the modal.
     *   • On error, displays an appropriate error banner.
     * 
     * Dependencies:
     * - Uses global `enrollmentModal`, `showErrorBanner`, `showSuccessBanner`, 
     *   `loadEnrollments`, `reloadFilterDropdowns`, `initializeSearchableEnrollmentTable`.
     */
    if (editEnrollmentForm) {
        editEnrollmentForm.addEventListener('submit', function(e) {
            e.preventDefault();

            const userCourseId = document.getElementById('edit_enrollment_id').value;
            const courseId = document.getElementById('edit_class_id').value;
            const userId = document.getElementById('edit_user_id').value;
            const roleOfClass = document.getElementById('edit_roleOfClass').value;

            fetch('../backend/api/enrollments/list_by_professor.php')
                .then(response => response.json())
                .then(result => {
                    if (!result.success) {
                        console.error('Error loading enrollments:', result.message);
                        return;
                    }

                    const enrollments = result.data;
                    let duplicateFound = false;

                    for (const enrollment of enrollments) {
                        if (enrollment.userCoursesId == userCourseId) continue;

                        if (enrollment.courseId == courseId && enrollment.userId == userId) {
                            showErrorBanner(`This user is already enrolled in the selected class.`);
                            duplicateFound = true;
                            break;
                        }
                    }

                    if (duplicateFound) return;
                    
                    const data = {
                        userCourseId,
                        courseId,
                        userId,
                        roleOfClass
                    };

                    fetch('../backend/api/enrollments/update.php', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(data)
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            showSuccessBanner("Enrollment updated successfully!");
                            loadEnrollments();
                            initializeSearchableEnrollmentTable();
                            reloadFilterDropdowns();
                            enrollmentModal.hide();
                        }
                    })
                    .catch(error => {
                        showErrorBanner("An error occurred: " + error.message);
                    });
                })
                .catch(error => {
                    console.error('Error fetching enrollments:', error);
                });
        });
    }
});


// --------------------- Dashboard JavaScript ------------------------


/**
 * Initializes the dashboard date pickers by constraining their selectable range to today
 * and wiring up change listeners for validation.
 *
 * @global {HTMLInputElement|null} startDateInput – the input element for the start date (may be null if not found)
 * @global {HTMLInputElement|null} endDateInput – the input element for the end date (may be null if not found)
 * @global {boolean} dateValidation – flag indicating whether the current date inputs are valid
 *
 * @see validateDates
 */
function handleDateSelection() {
    const today = new Date().toISOString().split('T')[0]; // Get today's date in YYYY-MM-DD format

    // Set max value to today
    if (startDateInput) {
        startDateInput.setAttribute('max', today);
        startDateInput.addEventListener('change', validateDates);
    }
    if (endDateInput) {
        endDateInput.setAttribute('max', today);
        endDateInput.addEventListener('change', validateDates);
    }
}

/**
 * Makes sure the start date is before the end date.
 *
 * @global {HTMLInputElement|null} startDateInput – the input element for the start date (may be null if not found)
 * @global {HTMLInputElement|null} endDateInput – the input element for the end date (may be null if not found)
 * @global {boolean} dateValidation – flag indicating whether the current date inputs are valid
 */
function validateDates() {
    dataValidation = false; // Reset validation state

    const start = startDateInput.value;
    const end = endDateInput.value;

    startDateInput.setCustomValidity('');
    endDateInput.setCustomValidity('');

    // Make sure start is before end
    if (start && end) {
        if (start > end) {
            startDateInput.setCustomValidity('Start date must be before or equal to end date.');
            endDateInput.setCustomValidity('End date must be after or equal to start date.');
        } else {
            dateValidation = true;
        }
    }

    startDateInput.reportValidity();
    endDateInput.reportValidity();
}

/**
 * Generates and displays the dashboard report based on the given filters.
 * 
 * - Updates the “carousel-description” text to reflect whether filters are applied.
 * - Validates that start/end dates are set when required.
 * - Shows a loading shimmer and placeholder word‑cloud image.
 * - Sends a POST to the backend to generate the report and, on success, updates the word‑cloud
 *   image and dashboard statistics; shows error banners on failure.
 *
 * @param {string} [classFilter='All']          - The course ID to filter by, or 'All' for no filter.
 * @param {string} [userFilter='All']           - The user ID to filter by, or 'All' for no filter.
 * @param {?string} [startDate=null]            - The start date in 'YYYY-MM-DD' format; empty string is treated as null.
 * @param {?string} [endDate=null]              - The end date in 'YYYY-MM-DD' format; empty string is treated as null.
 * @param {('Both'|'Q'|'A')} [qaFilter='Both']  - Whether to include questions ('Q'), answers ('A'), or both.
 * @param {string} [stopWords='']               - Comma‑separated words to exclude from the word cloud.
 */
function generateReport(classFilter='All', userFilter='All', startDate=null, endDate=null, qaFilter='Both', stopWords='') {
    if (startDate === '') startDate = null;
    if (endDate === '') endDate = null;

    if (classFilter === 'All' && userFilter === 'All' && !startDate && !endDate && qaFilter === 'Both') {
        if (document.getElementById('carousel-description')) {
            document.getElementById('carousel-description').textContent = `*Showing stats for all ${username}'s courses`;
        }
    } else {
        if (document.getElementById('carousel-description')) {
            document.getElementById('carousel-description').textContent = `*Showing stats for the applied filters`;
        }
    }
    // Only generate on dashboard (no parameters set)
    const urlParams = new URLSearchParams(window.location.search);
    if ([...urlParams].length === 0) {
        if (!dateValidation) {
            showErrorBanner("Please select valid start and end dates.");
            return;
        }

        // Modifying the word cloud to show generating state
        // Reset the word cloud image
        const cloud = document.getElementById('word_cloud_img');
        const container = document.querySelector('.wordcloud-container');
        
        // Remove shimmer first (in case it's already there)
        container.classList.remove('shimmer');
        
        // Force a reflow to ensure the removal is processed
        container.offsetHeight;
        
        // Add shimmer class
        container.classList.add('shimmer');
        
        // Force another reflow to ensure shimmer is applied
        container.offsetHeight;

        cloud.src = 'static/img/word_cloud_placeholder.png?ts=' + Date.now();

        // Gathering set filters to send to backend
        const params = new URLSearchParams({
            class_id: classFilter,
            user_id: userFilter,
            start_date: startDate,
            end_date: endDate,
            qa_filter: qaFilter,
            stop_words: stopWords
        });

        // Call flask API to generate report
        fetch(`${FLASK_API}/generate-report?${params.toString()}`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Id': userId,
                'X-User-Role': userRole,
                'X-Username': username
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showSuccessBanner("Report generated successfully!");
                cloud.src = data.image;
                container.classList.remove('shimmer');

                // Load carousel data
                fetch(`../backend/api/carousel/list.php?${params}`)
                    .then(response => response.json())
                    .then(stats => {
                        if (!stats.success) {
                            console.error('Error loading carousel data:', stats.message);
                            return;
                        }
                        console.log('Dashboard summary data:', stats);
                        const data = stats.data;
                        document.querySelectorAll('.liked-count').forEach(el => {
                            el.textContent = data.message_counts.liked_messages;
                        });
                        document.querySelectorAll('.disliked-count').forEach(el => {
                            el.textContent = data.message_counts.disliked_messages;
                        });
                        document.querySelectorAll('.total-count').forEach(el => {
                            el.textContent = data.message_counts.message_count;
                        });
                        document.querySelectorAll('.active-day').forEach(el => {
                            if (data.most_active_day) {
                                el.textContent = data.most_active_day.day ?? 'N/A';
                                if (el.textContent !== 'N/A') {
                                    document.querySelectorAll('.active-day-title').forEach(titleEl => {
                                        titleEl.textContent = 'Most Active Day';
                                    });
                                    document.querySelectorAll('.active-day-subtext').forEach(subtext => {
                                        subtext.textContent = 'Messages: ' + data.most_active_day.total_messages ?? 'N/A';
                                    });
                                }
                            } else {
                                el.textContent = data.most_active_hour.hour ?? 'N/A';
                                if (el.textContent !== 'N/A') {
                                    // Strip date from text content
                                    el.textContent = el.textContent.split(' ')[1] ?? 'N/A';

                                    document.querySelectorAll('.active-day-title').forEach(titleEl => {
                                        titleEl.textContent = 'Most Active Hour';
                                    });
                                    document.querySelectorAll('.active-day-subtext').forEach(subtext => {
                                        subtext.textContent = 'Messages: ' + data.most_active_hour.total_messages ?? 'N/A';
                                    });
                                }
                            }
                        });
                        document.querySelectorAll('.active-course').forEach(el => {
                            if (data.most_active_course) {
                                el.textContent = data.most_active_course.course_name ?? 'N/A';
                                if (el.textContent !== 'N/A') {
                                    document.querySelectorAll('.active-course-title').forEach(titleEl => {
                                        titleEl.textContent = 'Most Active Course';
                                    });
                                    document.querySelectorAll('.active-course-subtext').forEach(subtext => {
                                        subtext.textContent = 'Messages: ' + data.most_active_course.total_messages ?? 'N/A';
                                    });
                                }
                            } else if (data.most_active_user) {
                                el.textContent = data.most_active_user.user_name ?? 'N/A';
                                if (el.textContent !== 'N/A') {
                                    document.querySelectorAll('.active-course-title').forEach(titleEl => {
                                        titleEl.textContent = 'Most Active User';
                                    });
                                    document.querySelectorAll('.active-course-subtext').forEach(subtext => {
                                        subtext.textContent = 'Messages: ' + data.most_active_user.total_messages ?? 'N/A';
                                    });
                                }
                            } else if (data.average_words_per_message) {
                                el.textContent = data.average_words_per_message.student_avg_words + ' words';
                                document.querySelectorAll('.active-course-title').forEach(titleEl => {
                                    titleEl.textContent = 'Average Message Length';
                                });
                                document.querySelectorAll('.active-course-subtext').forEach(subtext => {
                                    subtext.textContent = 'Class Average: ' + data.average_words_per_message.course_avg_words + ' words';
                                });
                            }
                            
                        });
                        // TODO: Future implementation
                        // document.querySelectorAll('.recommended-topics').forEach(el => {
                        //     el.textContent = data.recommended_topics?.join(', ') ?? 'N/A';
                        // });
                    })
                    .catch(error => {
                        console.error('Error loading dashboard summary:', error);
                    });
            }
            else {
                showErrorBanner(`Error generating report: ${data.message}`);
                container.classList.remove('shimmer');
            }
        })
        .catch(error => {
            showErrorBanner('An unexpected error occurred while generating the report: ' + error.message);
        });

        
        console.log("Generating report with parameters:", params.toString());
    }
}

/**
 * Clears all of the filters in the dashboard and then regernates the report.
 * 
 * @see generateReport
 */
function clearDashboardFilters() {
    // Reset hidden values
    document.getElementById('class_id').value = 'All';
    document.getElementById('user_id').value = 'All';
    document.getElementById('qa_filter').value = 'Both';
    document.getElementById('selectedStartDate').value = '';
    document.getElementById('selectedEndDate').value = '';
    document.getElementById('customStopWords').value = '';

    // Reset visible labels
    document.getElementById('selectedDashboardClassText').innerText = 'All';
    document.getElementById('selectedDashboardUserText').innerText = 'All';
    document.getElementById('selectedQAFilterText').innerText = 'Both';

    // Regenerate report with default parameters
    generateReport();
}

/**
 * Displays and populates the feedback modal.
 * 
 * - Fetches feedback entries from the backend using current dashboard filters.
 * - Renders each entry (question, AI answer, user explanation, timestamp) into the modal.
 * - Attaches toggle handlers for “Show More/Less” on answer snippets.
 * - Finally, displays the Bootstrap modal.
 * 
 * @param {'up'|'down'} feedbackRating - Whether the student liked ('up') or disliked ('down') the message
 * 
 * @see ../backend/api/feedback/list.php
 */
function openFeedbackModal(feedbackRating) {
    const classId = document.getElementById('class_id').value || 'All';
    const userId = document.getElementById('user_id').value || 'All';
    const startDate = document.getElementById('selectedStartDate').value || null;
    const endDate = document.getElementById('selectedEndDate').value || null;

    const params = new URLSearchParams({
        class_id: classId,
        user_id: userId,
        start_date: startDate,
        end_date: endDate,
        rating: feedbackRating
    });

    fetch(`../backend/api/feedback/list.php?${params.toString()}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            'X-User-Id': userId,
            'X-User-Role': userRole,
            'X-Username': username
        }
    })
    .then(res => res.json())
    .then(data => {
        console.log('Feedback data:', data);

        const container = document.getElementById('feedbackModalBody');
        container.innerHTML = '';

        if (!data.success || data.entries.length === 0) {
            container.innerHTML = `<p class="text-muted">No feedback found for this filter.</p>`;
            return;
        }

        data.entries.forEach(entry => {
            const card = document.createElement('div');
            card.className = 'p-3 mb-3 border rounded bg-white';

            const answerId = `answer-${entry.messageId}`;

            const answerBlock = `
                <div class="answer-snippet" id="${answerId}">
                    ${entry.answer}
                </div>
                <a href="#" class="toggle-answer text-blue-600 text-sm" data-target="${answerId}">Show More</a>
            `;

            card.innerHTML = `
                <div><strong>🧠 Question:</strong> ${entry.question}</div>
                <div><strong>💬 AI Answer:</strong> ${answerBlock}</div>
                <div><strong>📝 Feedback:</strong> ${entry.feedbackExplanation || '<em>No comment provided</em>'}</div>
                <div class="text-muted text-sm mt-2">👤 ${entry.username} | 📅 ${entry.messageTimestamp}</div>
            `;

            container.appendChild(card);
        });

        document.querySelectorAll('.toggle-answer').forEach(link => {
            link.addEventListener('click', function (e) {
                e.preventDefault();
                const targetId = e.target.dataset.target;
                const snippet = document.getElementById(targetId);
                const isExpanded = snippet.classList.toggle('expanded');
                e.target.textContent = isExpanded ? 'Show Less' : 'Show More';
            });
        });

        const modal = new bootstrap.Modal(document.getElementById('feedbackModal'));
        modal.show();

    });
}


// --------------------- Class and Enrollment Management JavaScript ------------------------


/**
 * Validates a course code matches required format.
 * 
 * Accepted formats:
 *   - Two or three uppercase letters followed by three digits, e.g. "EN100" or "CS/EGR222"
 *   - An empty string (no code)
 * 
 * @param {string} code - the course code to validate
 * 
 * @returns {boolean} `true` if the code matches one of the accepted formats; otherwise `false`
 */
function isValidCourseCode(code) {
    const courseCodePattern = /^$|^[A-Z]{2,3}(\/[A-Z]{2,3})?\d{3}$/;
    return courseCodePattern.test(code);
}

// Load Classes
let allClasses = []; // Store full class list globally

/**
 * Loads all classes a professor is enrolled in.
 * 
 * - Sends a GET request to retrieve the professor’s courses from the backend.
 * - On success, stores the full list in the global `allClasses` variable.
 * 
 * @global {Array<Object>} allClasses - holds the fetched list of course objects
 * 
 * @see '../backend/api/classes/list_by_professor.php'
 * @see renderClassTable
 */
function loadClasses() {
    fetch('../backend/api/classes/list_by_professor.php')
        .then(response => response.json())
        .then(result => {
            if (!result.success) {
                console.error('Error loading classes:', result.message);
                return;
            }

            allClasses = result.data; // Save full list globally
            renderClassTable(allClasses);
        })
        .catch(error => console.error('Error:', error));
}

/**
 * Populates the classes table with the provided list of classes.
 *
 * - Clears any existing rows in the <tbody id="classesTable"> element.
 * - Creates a table row for each class item, including name, creator, course code,
 *   description, and action buttons.
 * - Appends each row to the table body and then refreshes any class dropdowns.
 *
 * @param {{ 
 *   id: number, 
 *   name: string, 
 *   courseCode?: string, 
 *   description?: string, 
 *   createdByUsername: string 
 * }[]} classList – an array of class objects to render
 *
 * @see deleteClass
 * @see reloadClassDropdowns
 */
function renderClassTable(classList) {
    const tbodyclasses = document.getElementById('classesTable');
    if (tbodyclasses) {
        tbodyclasses.innerHTML = '';

        classList.forEach(classItem => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td data-label="Class Name">
                    <div class="main-line">
                        ${classItem.name}
                    </div>
                    <div class="subheader-line">
                        Created by: ${classItem.createdByUsername}
                    </div>
                </td>
                <td data-label="Course Code">${classItem.courseCode || ''}</td>
                <td data-label="Description">${classItem.description || ''}</td>
                <td data-label="Actions">
                    <button class="btn btn-sm btn-primary m-0 edit-class-btn"
                        data-class-id="${classItem.id}"
                        data-class-name="${classItem.name}"
                        data-course-code="${classItem.courseCode || ''}"
                        data-class-description="${classItem.description || ''}"
                        data-created-by-username="${classItem.createdByUsername}">
                        Edit
                    </button>
                    <button class="btn btn-sm btn-danger m-0" onclick="deleteClass(${classItem.id})">
                        Delete
                    </button>
                </td>
            `;
            tbodyclasses.appendChild(tr);
        });

        reloadClassDropdowns();
    }
}

/**
 * Filters courses based on their discipline and re-renders the class table.
 * 
 * @param {string} discipline - The discipline of a given course, e.g. "CS" for Computer Science.
 * 
 * @global {Array<Object>} allClasses - holds the fetched list of course objects
 * 
 * @see renderClassTable
 */
function filterCourses(discipline) {
    if (discipline === 'allCourses') {
        renderClassTable(allClasses);
    } else {
        const filtered = allClasses.filter(cls => {
            if (!cls.courseCode) return false;
            const match = cls.courseCode.match(/^([A-Z]{2,3}(?:\/[A-Z]{2,3})?)/);
            if (!match) return false;

            const disciplines = match[1].split('/');
            return disciplines.includes(discipline);
        });
        renderClassTable(filtered);
    }
}

/**
 *  Initializes live search filtering on the classes table.
 *
 * - Binds `input` events on the class name, course code, and description search fields.
 * - On each input (or window resize), filters table rows by matching class name,
 *   course code, or description.
 * - Toggles the `hidden` class on rows that don’t match.
 * 
 * @see filterTable
 * @see fuzzyIncludes
 */
function initializeSearchableClassTable() {
    const classNameTableInput = document.getElementById('classNameTableInput');
    const courseCodeTableInput = document.getElementById('courseCodeTableInput');
    const classDescriptionTableInput = document.getElementById('classDescriptionTableInput');

    const filterTable = () => {
        const nameFilter = classNameTableInput?.value.toLowerCase() || '';
        const codeFilter = courseCodeTableInput?.value.toLowerCase() || '';
        const descFilter = classDescriptionTableInput?.value.toLowerCase() || '';

        const rows = document.querySelectorAll('#classesTableConfig tbody tr');

        const isMobileView = () => window.innerWidth < 1024;
        const displayStyleForMatchedRow = isMobileView() ? 'block' : 'table-row';

        rows.forEach(row => {
            const name = row.children[0]?.textContent.toLowerCase() || '';
            const code = row.children[1]?.textContent.toLowerCase() || '';
            const desc = row.children[2]?.textContent.toLowerCase() || '';

            const matches =
                fuzzyIncludes(name, nameFilter) &&
                code.includes(codeFilter) &&
                desc.includes(descFilter);

            row.classList.toggle('hidden', !matches);
        });
    };

    [classNameTableInput, courseCodeTableInput, classDescriptionTableInput].forEach(input => {
        if (input) input.addEventListener('input', filterTable);
    });

    filterTable();
    window.addEventListener('resize', filterTable);
}

// Load Enrollments
let allEnrollments = []; // Store full enrollment list globally

/**
 * Loads all enrollments for classes a professor is enrolled in.
 * 
 * - Sends a GET request to retrieve the professor’s enrollments from the backend.
 * - On success, stores the full list in the global `allEnrollments` variable.
 * 
 * @global {Array<Object>} allEnrollments - holds the fetched list of enrollment objects
 * 
 * @see '../backend/api/enrollments/list_by_professor.php'
 * @see renderEnrollmentTable
 */
function loadEnrollments() {
    fetch('../backend/api/enrollments/list_by_professor.php')
        .then(response => response.json())
        .then(result => {
            if (!result.success) {
                console.error('Error loading user courses:', result.message);
                return;
            }

            allEnrollments = result.data; // Save full list globally
            renderEnrollmentTable(allEnrollments); // Render all initially
        })
        .catch(error => console.error('Error:', error));
}

/**
 * Populates the enrollments table with the provided list of enrollments.
 *
 * - Clears any existing rows in the <tbody id="enrollmentsTable"> element.
 * - Creates a table row for each enrollment, including class name, course code, user,
 *   role, and action buttons.
 * - Appends each row to the table body and then refreshes any class dropdowns.
 *
 * @param {{ 
 *   id: number, 
 *   name: string,
 *   username: string,
 *   courseId: number,
 *   userId: number,
 *   createdByUsername: string,
 *   courseCode?: string 
 * }[]} userCourses – an array of enrollment objects to render
 *
 * @see deleteEnrollment
 * @see reloadClassDropdowns
 */
function renderEnrollmentTable(userCourses) {
    const tbodyenrollments = document.getElementById('enrollmentsTable');
    if (tbodyenrollments) {
        tbodyenrollments.innerHTML = ''; // Clears existing rows

        userCourses.forEach(userCourse => {
            const tr = document.createElement('tr');
            const courseCodeDisplay = userCourse.courseCode ? ` (${userCourse.courseCode})` : '';
            tr.innerHTML = `
                <td data-label="Class Name">
                    <div class="main-line">
                        ${userCourse.name}${courseCodeDisplay}
                    </div>
                    <div class="subheader-line">
                        Created by: ${userCourse.createdByUsername}
                    </div>
                </td>
                <td data-label="User">${userCourse.username}</td>
                <td data-label="Role (JayWing)">${userCourse.role}</td>
                <td data-label="Actions">
                    <button class="btn btn-sm btn-primary m-0 edit-enrollment-btn"
                        data-usercourse-id="${userCourse.userCoursesId}"
                        data-usercourse-name="${userCourse.name}"
                        data-usercourse-user="${userCourse.username}"
                        data-course-id="${userCourse.courseId}"
                        data-user-id="${userCourse.userId}"
                        data-created-by-username="${userCourse.createdByUsername}"
                        data-course-code="${userCourse.courseCode}">
                        Edit
                    </button>
                    <button class="btn btn-sm btn-danger m-0" onclick="deleteEnrollment(${userCourse.userCoursesId})">
                        Delete
                    </button>
                </td>
            `;
            tbodyenrollments.appendChild(tr);
        });

        reloadClassDropdowns(); 
        }
}

/**
 * Filters enrollments based on their class discipline and re-renders the enrollments table.
 * 
 * @param {string} discipline - The discipline of a given course, e.g. "CS" for Computer Science.
 * 
 * @global {Array<Object>} allEnrollments - holds the fetched list of enrollment objects
 * 
 * @see renderEnrollmentTable
 */
function filterEnrollments(discipline) {
    if (discipline === 'allCourses') {
        renderEnrollmentTable(allEnrollments);
    } else {
        const filtered = allEnrollments.filter(enrollment => {
            if (!enrollment.courseCode) return false;
            const match = enrollment.courseCode.match(/^([A-Z]{2,3}(?:\/[A-Z]{2,3})?)/);
            if (!match) return false;

            const disciplines = match[1].split('/');
            return disciplines.includes(discipline);
        });

        renderEnrollmentTable(filtered);
    }
}

/**
 *  Initializes live search filtering on the enrollments table.
 *
 * - Binds `input` events on the class name and course code, user, and role search fields.
 * - On each input (or window resize), filters table rows by matching class name and
 *   course code, user, or role.
 * - Toggles the `hidden` class on rows that don’t match.
 * 
 * @see filterTable
 * @see fuzzyIncludes
 */

function initializeSearchableEnrollmentTable() {
    const classNamesTableInput = document.getElementById('classNamesTableInput');
    const userTableInput = document.getElementById('userTableInput');
    const roleTableInput = document.getElementById('roleTableInput');

    const filterTable = () => {
        const namesFilter = classNamesTableInput?.value.toLowerCase() || '';
        const userFilter = userTableInput?.value.toLowerCase() || '';
        const roleFilter = roleTableInput?.value.toLowerCase() || '';

        const rows = document.querySelectorAll('#enrollmentsTableConfig tbody tr');

        const isMobileView = () => window.innerWidth < 1024;
        const displayStyleForMatchedRow = isMobileView() ? 'block' : 'table-row';

        rows.forEach(row => {
            const name = row.children[0]?.textContent.toLowerCase() || '';
            const user = row.children[1]?.textContent.toLowerCase() || '';
            const role = row.children[2]?.textContent.toLowerCase() || '';

            const matches =
                fuzzyIncludes(name, namesFilter) &&
                fuzzyIncludes(user, userFilter) &&
                role.includes(roleFilter);

            row.classList.toggle('hidden', !matches);
        });
    };

    [classNamesTableInput, userTableInput, roleTableInput].forEach(input => {
        if (input) input.addEventListener('input', filterTable);
    });

    filterTable();
    window.addEventListener('resize', filterTable);
}

/**
 * Handles clicks on “Edit” buttons in the classes and enrollments tables.
 * Populates and shows the appropriate Bootstrap modal.
 */
document.addEventListener('click', function (e) {
    if (e.target.classList.contains('edit-class-btn')) {
        const btn = e.target;
        document.getElementById('edit_course_id').value = btn.dataset.classId;
        document.getElementById('edit_class_name').value = btn.dataset.className;
        document.getElementById('edit_course_code').value = btn.dataset.courseCode || '';
        document.getElementById('edit_class_description').value = btn.dataset.classDescription || '';

        hideAllBanners();
        classModal.show();
    }
    
    if (e.target.classList.contains('edit-enrollment-btn')) {
        const btn = e.target;
        document.getElementById('edit_enrollment_id').value = btn.dataset.usercourseId;
        document.getElementById('edit_class_id').value = btn.dataset.courseId;
        document.getElementById('edit_user_id').value = btn.dataset.userId;
        // document.getElementById('edit_roleOfClass').value = btn.dataset.role;

        let mainDisplayText = btn.dataset.usercourseName + ' ';
        if (btn.dataset.courseCode && btn.dataset.courseCode !== 'null') mainDisplayText += '(' + (btn.dataset.courseCode) + ') '
        document.getElementById('selectedEditClassText').textContent = mainDisplayText;
        document.getElementById('selectedEditUserText').textContent = btn.dataset.usercourseUser;
        // document.getElementById('selectedEditRoleText').textContent = btn.dataset.usercourseRole;

        hideAllBanners();
        enrollmentModal.show();
    }
});

/**
 * Clears the input fields for class name, course code, and class description.
 */
function clearClassInputs() {
    const className = document.getElementById('class_name');
    if (className) {
        className.value = '';
    }
    const courseCode = document.getElementById('course_code');
    if (courseCode) {
        courseCode.value = '';
    }
    const classDescription = document.getElementById('class_description');
    if (classDescription) {
        classDescription.value = '';
    }
}

/**
 * Clears the dropdowns for class name, user, and role.
 */
function clearEnrollmentInputs() {
    const classListContainer = document.querySelector('.class-list');
    if (classListContainer) {
        document.getElementById('class_id').value = null;
        document.getElementById('selectedClassText').textContent = 'Select Class';
    }
    const userListContainer  = document.querySelector('.user-list');
    if (userListContainer) {
        document.getElementById('user_id').value = null;
        document.getElementById('selectedUserText').textContent = 'Select User';
    }
    const roleOfClassDropdown = document.querySelector('.role-list');
    if (roleOfClassDropdown) {
        document.getElementById('roleOfClass').value = "Tutor";
        document.getElementById('selectedRoleText').textContent = 'Tutor';
    }
}

/**
 * Handles clicks to the "Add Multiple Enrollments" button.
 * 
 * - Hides existing banners and clears any previously selected users.
 * - Reads the currently selected class text and ID from the main dashboard controls.
 * - Populates the multiple‑enrollments modal with that class information.
 * - Refreshes the display of selected users and then shows the modal.
 * - If the user‑list dropdown is open, closes it.
 */
const addMultipleEnrollments = document.getElementById('add-multiple-enrollments');
if (addMultipleEnrollments) {
    addMultipleEnrollments.addEventListener('click', function (e) {
        hideAllBanners();
        // Clear selected users when opening the modal for a new selection
        selectedUsers.clear();

        // Get selected values from main class dropdown
        const selectedClassText = document.getElementById('selectedClassText').textContent.trim();
        const selectedClassId = document.getElementById('class_id').value;

        // Apply those values to the modal dropdown
        document.getElementById('selectedMultipleClassText').textContent = selectedClassText;
        document.getElementById('multiple_class_id').value = selectedClassId;

        updateSelectedUsersDisplay();
        multipleEnrollmentsModal.show();

        // Close the user-list dropdown if it's open
        const userDropdownToggle = document.querySelector('.user-list')?.closest('.dropdown')?.querySelector('[data-bs-toggle="dropdown"]');
        const userDropdownInstance = bootstrap.Dropdown.getInstance(userDropdownToggle);
        if (userDropdownInstance) {
            userDropdownInstance.hide();
        }
    })
}

/**
 * Deletes a class and its associated enrollments and files, after user confirmation.
 *
 * - Prompts the user to confirm deletion.
 * - Shows a loading spinner and interim success banner.
 * - Sends a DELETE request to remove all files for the class via the Flask API.
 * - Upon success, sends a POST request to delete the class record.
 * - Finally, hides the spinner, shows a “Class deleted” banner, and refreshes UI:
 *   reloads classes, dropdowns, searchable table, and enrollments.
 *
 * @param {number} classId – The ID of the class to delete.
 *
 * @global {string} FLASK_API – Base URL for the Flask backend API.
 * @global {string} userId – Current user’s ID for request authentication.
 * @global {string} userRole – Current user’s role for request authentication.
 * @global {string} username – Current user’s username for request authentication.
 *
 * @see loadClasses
 * @see reloadClassDropdowns
 * @see reloadFilterDropdowns
 * @see initializeSearchableClassTable
 * @see loadEnrollments
 */
function deleteClass(classId) {
    if (confirm('Are you sure? This will also delete all enrollments for this class.')) {
        document.getElementById('loading-spinner').classList.remove('hidden');
        showSuccessBanner("Deleting class...");
        // First delete all files from class
        fetch(`${FLASK_API}/delete-course`, {
            method: 'DELETE',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Id': userId,
                'X-User-Role': userRole,
                'X-Username': username
            },
            body: JSON.stringify({ courseId: classId})
        })
        .then(response => response.json())
        .then(data => {
            if (!data.success) {
                console.error(`Error deleting files for class ${classId}:`, data.message);
                return;
            }
            console.log(`Files for class ${classId} deleted successfully.`);
            // Now delete the class itself
            fetch('../backend/api/classes/delete.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ id: classId })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {                
                    loadClasses();
                    reloadClassDropdowns();
                    reloadFilterDropdowns();
                    initializeSearchableClassTable();
                    loadEnrollments();
                }
            });
        })
        .finally(() => {
            showSuccessBanner("Class deleted.");
            document.getElementById('loading-spinner').classList.add('hidden');
        });
    }
}

/**
 * Deletes an enrollment after user confirmation.
 *
 * - Shows a confirmation dialog.
 * - Sends a POST request to remove the enrollment on the server.
 * - On success, displays a success banner and refreshes the enrollment table and related UI.
 *
 * @param {number} enrollmentId – The ID of the enrollment to delete.
 *
 * @see initializeSearchableEnrollmentTable
 * @see reloadFilterDropdowns
 * @see loadEnrollments
 */
function deleteEnrollment(enrollmentId) {
    if (confirm('Are you sure you want to delete this enrollment?')) {
        fetch('../backend/api/enrollments/delete.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userCoursesId: enrollmentId })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showSuccessBanner("Enrollment deleted.");
                initializeSearchableEnrollmentTable();
                reloadFilterDropdowns();
                loadEnrollments();
            }
        });
    }
}


// --------------------- Dropdown Management JavaScript ------------------------


// Search Inputs in Dropdowns
const classSearchInput = document.getElementById('classSearchInput');
const userSearchInput  = document.getElementById('userSearchInput');

const classEditSearchInput = document.getElementById('classEditSearchInput');
const userEditSearchInput  = document.getElementById('userEditSearchInput');

const classNotesSearchInput  = document.getElementById('classNotesSearchInput');

const classMultipleSearchInput  = document.getElementById('classMultipleSearchInput');
const userMultipleSearchInput  = document.getElementById('userMultipleSearchInput');

const classSearchInputDash = document.getElementById('classSearchInputDash');
const userSearchInputDash  = document.getElementById('userSearchInputDash');

// Containers in Dropdowns
const classListContainer = document.querySelector('.class-list');
const userListContainer  = document.querySelector('.user-list');
const roleListContainer  = document.querySelector('.role-list');

const classEditListContainer = document.querySelector('.class-edit-list');
const userEditListContainer  = document.querySelector('.user-edit-list');
const roleEditListContainer  = document.querySelector('.role-edit-list');

const classNotesListContainer  = document.querySelector('.class-notes-list');

const classMultipleListContainer  = document.querySelector('.class-multiple-list');
const userMultipleListContainer  = document.querySelector('.user-multiple-list'); // Redefining this here is harmless but redundant with the top-level declaration
const roleMultipleListContainer  = document.querySelector('.role-multiple-list');

// Dashboard-specific dropdowns
const classDashListContainer = document.querySelector('.class-dash-list');
const userDashListContainer  = document.querySelector('.user-dash-list');
const qaListContainer        = document.querySelector('.qa-list');  // static list


/**
 * Initializes all custom dropdown buttons with live-search filtering and click delegation.
 *
 * - Prevents dropdowns from closing when clicking inside their menus.
 * - Attaches `input` listeners to various search fields (class, user, notes, multiple‑select, etc.)
 *   to hide/show items via the `fuzzyIncludes` helper.
 * - Delegates click events on each dropdown container to:
 *     • Update the corresponding hidden input value.
 *     • Update the visible label text.
 *     • Hide the Bootstrap dropdown after selection.
 * - Implements multi‑select logic for adding multiple users to a class.
 *
 * @see fuzzyIncludes
 * @see updateSelectedUsersDisplay
 */
function initializeSearchableDropdowns() {
    // Prevent dropdown from closing when clicking inside the menu
    document.querySelectorAll('.dropdown-menu').forEach(menu => {
        menu.addEventListener('click', e => e.stopPropagation());
    });

    if (classSearchInputDash) {
        classSearchInputDash.addEventListener('input', function(e) {
            const searchText = e.target.value.toLowerCase();
            document.querySelectorAll('.class-dash-list .dropdown-item').forEach(item => {
                item.style.display = fuzzyIncludes(item.textContent, searchText) ? 'block' : 'none';
            });
        });
    }

    if (userSearchInputDash) {
        userSearchInputDash.addEventListener('input', function(e) {
            const searchText = e.target.value.toLowerCase();
            document.querySelectorAll('.user-dash-list .dropdown-item').forEach(item => {
                item.style.display = fuzzyIncludes(item.textContent, searchText) ? 'block' : 'none';
            });
        });
    }

    // “Search” filter for classes
    if (classSearchInput) {
        classSearchInput.addEventListener('input', function(e) {
        const searchText = e.target.value.toLowerCase();
        document.querySelectorAll('.class-list .dropdown-item').forEach(item => {
            item.style.display = fuzzyIncludes(item.textContent, searchText) ? 'block' : 'none';
        });
        });
    }

    // “Search” filter for users
    if (userSearchInput) {
        userSearchInput.addEventListener('input', function(e) {
            const searchText = e.target.value.toLowerCase();
            document.querySelectorAll('.user-list .dropdown-item').forEach(item => {
                item.style.display = fuzzyIncludes(item.textContent, searchText) ? 'block' : 'none';
            });
        });
    }

    // “Search” filter for editting classes
    if (classEditSearchInput) {
        classEditSearchInput.addEventListener('input', function(e) {
        const searchText = e.target.value.toLowerCase();
        document.querySelectorAll('.class-edit-list .dropdown-item').forEach(item => {
            item.style.display = fuzzyIncludes(item.textContent, searchText) ? 'block' : 'none';
        });
        });
    }

    // “Search” filter for editting users
    if (userEditSearchInput) {
        userEditSearchInput.addEventListener('input', function(e) {
        const searchText = e.target.value.toLowerCase();
        document.querySelectorAll('.user-edit-list .dropdown-item').forEach(item => {
            item.style.display = fuzzyIncludes(item.textContent, searchText) ? 'block' : 'none';
        });
        });
    }

    // “Search” filter for class notes
    if (classNotesSearchInput) {
        classNotesSearchInput.addEventListener('input', function(e) {
        const searchText = e.target.value.toLowerCase();
        document.querySelectorAll('.class-notes-list .dropdown-item').forEach(item => {
            item.style.display = fuzzyIncludes(item.textContent, searchText) ? 'block' : 'none';
        });
        });
    }

    // “Search” filter for multiple classes
    if (classMultipleSearchInput) {
        classMultipleSearchInput.addEventListener('input', function(e) {
        const searchText = e.target.value.toLowerCase();
        document.querySelectorAll('.class-multiple-list .dropdown-item').forEach(item => {
            item.style.display = fuzzyIncludes(item.textContent, searchText) ? 'block' : 'none';
        });
        });
    }

    // “Search” filter for multiple users
    if (userMultipleSearchInput && userMultipleListContainer) {
        userMultipleSearchInput.addEventListener('input', function(e) {
            const searchText = e.target.value.toLowerCase();
            const items = userMultipleListContainer.querySelectorAll('.dropdown-item');
            items.forEach(item => {
                const userName = item.textContent.toLowerCase();
                // CORRECTED: Call fuzzyIncludes as a global function
                item.style.display = fuzzyIncludes(userName, searchText) ? '' : 'none';
            });
        });
    }


    // Delegate click inside .class-list
    if (classListContainer) {
        classListContainer.addEventListener('click', function(e) {
            const dropdownItem = e.target.closest('.dropdown-item');
            if (dropdownItem && classListContainer.contains(dropdownItem)) {
                const value = dropdownItem.dataset.value;
                let text  = dropdownItem.textContent;
                text = text.replace(/Created by: .*/, '').trim();
                document.getElementById('class_id').value = value;
                targetLoc = document.getElementById('selectedClassText');
                if (targetLoc) {
                    targetLoc.textContent = text;
                }
                
                const dropdownToggle = dropdownItem.closest('.dropdown')?.querySelector('[data-bs-toggle="dropdown"]');
                const dropdownInstance = bootstrap.Dropdown.getInstance(dropdownToggle);
                if (dropdownInstance) dropdownInstance.hide();
            }
        });
    }

    // Delegate click inside .user-list
    if (userListContainer) {
        userListContainer.addEventListener('click', function(e) {
            const dropdownItem = e.target.closest('.dropdown-item');
            if (dropdownItem && userListContainer.contains(dropdownItem)) {
                const value = dropdownItem.dataset.value;
                const text  = dropdownItem.textContent;
                document.getElementById('user_id').value = value;
                targetLoc = document.getElementById('selectedUserText');
                if (targetLoc) {
                    targetLoc.textContent = text;
                }

                const dropdownToggle = dropdownItem.closest('.dropdown')?.querySelector('[data-bs-toggle="dropdown"]');
                const dropdownInstance = bootstrap.Dropdown.getInstance(dropdownToggle);
                if (dropdownInstance) dropdownInstance.hide();
            }
        });
    }

    // Delegate click inside .role-list
    if (roleListContainer) {
        roleListContainer.addEventListener('click', function (e) {
            const dropdownItem = e.target.closest('.dropdown-item');
            if (dropdownItem) {
                const value = dropdownItem.dataset.value;
                const text = dropdownItem.textContent.trim();
                document.getElementById('roleOfClass').value = value;
                document.getElementById('selectedRoleText').textContent = text;

                const dropdownToggle = dropdownItem.closest('.dropdown')?.querySelector('[data-bs-toggle="dropdown"]');
                const dropdownInstance = bootstrap.Dropdown.getInstance(dropdownToggle);
                if (dropdownInstance) dropdownInstance.hide();
            }
        });
    }

    // Delegate click inside .class-edit-list
    if (classEditListContainer) {
        classEditListContainer.addEventListener('click', function(e) {
            const dropdownItem = e.target.closest('.dropdown-item');
            if (dropdownItem && classEditListContainer.contains(dropdownItem)) {
                const value = dropdownItem.dataset.value;
                let text  = dropdownItem.textContent;
                text = text.replace(/Created by: .*/, '').trim();
                document.getElementById('edit_class_id').value = value;
                document.getElementById('selectedEditClassText').textContent = text;

                const dropdownToggle = dropdownItem.closest('.dropdown')?.querySelector('[data-bs-toggle="dropdown"]');
                const dropdownInstance = bootstrap.Dropdown.getInstance(dropdownToggle);
                if (dropdownInstance) dropdownInstance.hide();
            }
        });
    }

    // Delegate click inside .user-edit-list
    if (userEditListContainer) {
        userEditListContainer.addEventListener('click', function(e) {
            const dropdownItem = e.target.closest('.dropdown-item');
            if (dropdownItem && userEditListContainer.contains(dropdownItem)) {
                const value = dropdownItem.dataset.value;
                const text  = dropdownItem.textContent;
                document.getElementById('edit_user_id').value = value;
                document.getElementById('selectedEditUserText').textContent = text;

                const dropdownToggle = dropdownItem.closest('.dropdown')?.querySelector('[data-bs-toggle="dropdown"]');
                const dropdownInstance = bootstrap.Dropdown.getInstance(dropdownToggle);
                if (dropdownInstance) dropdownInstance.hide();
            }
        });
    }

    // Delegate click inside .role-edit-list
    if (roleEditListContainer) {
        roleEditListContainer.addEventListener('click', function (e) {
            const dropdownItem = e.target.closest('.dropdown-item');
            if (dropdownItem) {
                const value = dropdownItem.dataset.value;
                const text = dropdownItem.textContent.trim();
                document.getElementById('edit_roleOfClass').value = value;
                document.getElementById('selectedEditRoleText').textContent = text;

                const dropdownToggle = dropdownItem.closest('.dropdown')?.querySelector('[data-bs-toggle="dropdown"]');
                const dropdownInstance = bootstrap.Dropdown.getInstance(dropdownToggle);
                if (dropdownInstance) dropdownInstance.hide();
            }
        });
    }

    // Delegate click inside .class-notes-list
    if (classNotesListContainer) {
        classNotesListContainer.addEventListener('click', function(e) {
            const dropdownItem = e.target.closest('.dropdown-item');
            if (dropdownItem && classNotesListContainer.contains(dropdownItem)) {
                const value = dropdownItem.dataset.value;
                text  = dropdownItem.textContent;
                text = text.replace(/Created by: .*/, '').trim();
                document.getElementById('notes_class_id').value = value;
                document.getElementById('notes_class_id').dispatchEvent(new Event('change'));
                document.getElementById('selectedNotesClassText').textContent = text;

                const dropdownToggle = dropdownItem.closest('.dropdown')?.querySelector('[data-bs-toggle="dropdown"]');
                const dropdownInstance = bootstrap.Dropdown.getInstance(dropdownToggle);
                if (dropdownInstance) dropdownInstance.hide();
            }
        });
    }

    // Delegate click inside .class-multiple-list
    if (classMultipleListContainer) {
        classMultipleListContainer.addEventListener('click', function(e) {
            const dropdownItem = e.target.closest('.dropdown-item');
            if (dropdownItem && classMultipleListContainer.contains(dropdownItem)) {
                const value = dropdownItem.dataset.value;
                let text  = dropdownItem.textContent;
                text = text.replace(/Created by: .*/, '').trim();
                document.getElementById('multiple_class_id').value = value;
                document.getElementById('selectedMultipleClassText').textContent = text;

                const dropdownToggle = dropdownItem.closest('.dropdown')?.querySelector('[data-bs-toggle="dropdown"]');
                const dropdownInstance = bootstrap.Dropdown.getInstance(dropdownToggle);
                if (dropdownInstance) dropdownInstance.hide();
            }
        });
    }

    // Delegate click inside .user-multiple-list
    const userMultipleListContainerForListener = document.querySelector('.user-multiple-list');
    if (userMultipleListContainerForListener) {
        userMultipleListContainerForListener.addEventListener('click', function(e) {
            const dropdownItem = e.target.closest('.dropdown-item');
            if (dropdownItem) {
                const userId = dropdownItem.dataset.value;
                const userName = dropdownItem.textContent.trim();

                if (selectedUsers.has(userId)) {
                    selectedUsers.delete(userId);
                    dropdownItem.classList.remove('active');
                } else {
                    selectedUsers.add(userId);
                    dropdownItem.classList.add('active');
                }
                updateSelectedUsersDisplay();
            }
        });
    }

    // Delegate click inside .role-multiple-list
    if (roleMultipleListContainer) {
        roleMultipleListContainer.addEventListener('click', function (e) {
            const dropdownItem = e.target.closest('.dropdown-item');
            if (dropdownItem) {
                const value = dropdownItem.dataset.value;
                const text = dropdownItem.textContent.trim();
                document.getElementById('multiple_roleOfClass').value = value;
                document.getElementById('selectedMultipleRoleText').textContent = text;

                const dropdownToggle = dropdownItem.closest('.dropdown')?.querySelector('[data-bs-toggle="dropdown"]');
                const dropdownInstance = bootstrap.Dropdown.getInstance(dropdownToggle);
                if (dropdownInstance) dropdownInstance.hide();
            }
        });
    }

    // Delegate click inside dashboard class dropdown
    if (classDashListContainer) {
        classDashListContainer.addEventListener('click', function (e) {
            const dropdownItem = e.target.closest('.dropdown-item');
            if (dropdownItem) {
                const value = dropdownItem.dataset.value;
                let text = dropdownItem.textContent.trim();
                text = text.replace(/Created by: .*/, '').trim();
                text = text.replace(/Includes all courses/, '').trim();
                document.getElementById('class_id').value = value;
                document.getElementById('selectedDashboardClassText').textContent = text;

                const dropdownToggle = dropdownItem.closest('.dropdown')?.querySelector('[data-bs-toggle="dropdown"]');
                const dropdownInstance = bootstrap.Dropdown.getInstance(dropdownToggle);
                if (dropdownInstance) dropdownInstance.hide();
            }
        });
    }

    // Delegate click inside dashboard user dropdown
    if (userDashListContainer) {
        userDashListContainer.addEventListener('click', function (e) {
            const dropdownItem = e.target.closest('.dropdown-item');
            if (dropdownItem) {
                const value = dropdownItem.dataset.value;
                const text = dropdownItem.textContent.trim();
                document.getElementById('user_id').value = value;
                document.getElementById('selectedDashboardUserText').textContent = text;

                const dropdownToggle = dropdownItem.closest('.dropdown')?.querySelector('[data-bs-toggle="dropdown"]');
                const dropdownInstance = bootstrap.Dropdown.getInstance(dropdownToggle);
                if (dropdownInstance) dropdownInstance.hide();
            }
        });
    }

    // Delegate click inside dashboard QA dropdown
    if (qaListContainer) {
        qaListContainer.addEventListener('click', function (e) {
            const dropdownItem = e.target.closest('.dropdown-item');
            if (dropdownItem) {
                const value = dropdownItem.dataset.value;
                const text = dropdownItem.textContent.trim();
                document.getElementById('qa_filter').value = value;
                document.getElementById('selectedQAFilterText').textContent = text;

                const dropdownToggle = dropdownItem.closest('.dropdown')?.querySelector('[data-bs-toggle="dropdown"]');
                const dropdownInstance = bootstrap.Dropdown.getInstance(dropdownToggle);
                if (dropdownInstance) dropdownInstance.hide();
            }
        });
    }
}

/**
 * Updates the displayed list of selected users in the “Add Multiple Enrollments” modal.
 *
 * - Re‑queries the `.user-multiple-list` container (in case it wasn’t in the DOM at load time).
 * - Collects the names of users whose IDs are in the global `selectedUsers` set.
 * - If any users are selected:
 *     • Sets `selectedMultipleUserText.textContent` to the comma‑separated names.
 *     • Sets `multipleUserIdInput.value` to the comma‑separated IDs.
 * - If no users are selected:
 *     • Resets the display text to `"Select Users"`.
 *     • Clears the hidden input’s value.
 *
 * @global {Set<string>} selectedUsers – Set of user IDs currently selected.
 * @global {HTMLElement} selectedMultipleUserText – Element showing the selected user names.
 * @global {HTMLInputElement} multipleUserIdInput – Hidden input holding the selected user IDs.
 */

function updateSelectedUsersDisplay() {
    const userNames = [];
    // Ensure userMultipleListContainer is queried again here in case it wasn't available at initial script load
    const currentListContainer = document.querySelector('.user-multiple-list');
    if (!currentListContainer) {
        console.error('userMultipleListContainer not found in updateSelectedUsersDisplay');
        return;
    }

    selectedUsers.forEach(userId => {
        const userItem = currentListContainer.querySelector(`.dropdown-item[data-value="${userId}"]`);
        if (userItem) {
            userNames.push(userItem.textContent.trim());
        }
    });

    if (userNames.length > 0) {
        selectedMultipleUserText.textContent = userNames.join(', ');
        multipleUserIdInput.value = Array.from(selectedUsers).join(',');
    } else {
        selectedMultipleUserText.textContent = 'Select Users';
        multipleUserIdInput.value = '';
    }
}

/**
 * Fetches all users for the “Add Multiple Enrollments” modal and renders the list.
 *
 * - Re‑queries the `.user-multiple-list` container (in case it wasn’t in the DOM at load time).
 * - Sends a GET request to retrieve all users from the backend.
 * - On success, populates the global `allUsers` array and calls `renderUserMultipleList()`.
 * - Logs an error if the request fails or the container is missing.
 *
 * @global {Array<Object>} allUsers – Array holding all user objects fetched from the server.
 * 
 * @see renderUserMultipleList
 */
function loadAllUsersForMultipleSelect() {
    const currentListContainer = document.querySelector('.user-multiple-list');
    if (!currentListContainer) {
        console.error('userMultipleListContainer not found in loadAllUsersForMultipleSelect');
        return;
    }

    fetch('../backend/api/users/list.php')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                allUsers = data.data; // Populate the global allUsers array
                renderUserMultipleList(); // Render the list after data is fetched
            } else {
                console.error("Failed to load users for multiple select:", data.message);
            }
        })
        .catch(error => console.error("Error loading users for multiple select:", error));
}

/**
 * Renders the list of users in the “Add Multiple Enrollments” dropdown.
 *
 * - Clears any existing content inside the `.user-multiple-list` container.
 * - If `allUsers` is empty, shows a “No users found” message.
 * - Otherwise, creates a `.dropdown-item` element for each user:
 *     • Applies the `active` class if the user is already in the `selectedUsers` set.
 *     • Sets `data-value` to the user’s ID and the text content to the username.
 *
 * @global {Array<Object>} allUsers – Array of user objects to render (must include `id` and `username`).
 * @global {Set<string>} selectedUsers – Set of currently selected user IDs (as strings).
 */
function renderUserMultipleList() {
    const currentListContainer = document.querySelector('.user-multiple-list');
    if (currentListContainer) {
        currentListContainer.innerHTML = '';

        if (allUsers.length === 0) {
            const noUsersMessage = document.createElement('div');
            noUsersMessage.classList.add('dropdown-item', 'text-gray-500');
            noUsersMessage.textContent = 'No users found.';
            currentListContainer.appendChild(noUsersMessage);
            return;
        }

        allUsers.forEach(user => {
            const div = document.createElement('div');
            div.classList.add('dropdown-item');
            if (selectedUsers.has(String(user.id))) {
                div.classList.add('active');
            }
            div.dataset.value = user.id;
            div.textContent = user.username;
            currentListContainer.appendChild(div);
        });
    }
}

/**
 * Fetches all classes associated with the professor and updates all relevant dropdown menus.
 *
 * - Sends a GET request to `list_by_professor.php` to retrieve the professor’s classes.
 * - On success, updates each of the following dropdowns:
 *   • `.class-list` – for general class selection
 *   • `.class-dash-list` – for dashboard filtering (includes an "All" option)
 *   • `classEditDropdown` – for editing a class
 *   • `.class-notes-list` – for selecting a class for notes
 *   • `.class-multiple-list` – for multi-enrollment class selection
 * - Each dropdown item includes a main line (class name + optional course code)
 *   and a subheader line ("Created by: ...").
 *
 * @global {HTMLElement} classEditDropdown – Container for class edit dropdown.
 * 
 * @see ../backend/api/classes/list_by_professor.php
 */
function reloadClassDropdowns() {
    fetch('../backend/api/classes/list_by_professor.php')
        .then(response => response.json())
        .then(result => {
            if (!result.success) {
                console.error('Error loading classes:', result.message);
                return;
            }

            const courses = result.data;

            // Update class list dropdown menu
            const classDropdown = document.querySelector('.class-list');
            if (classDropdown) {
                classDropdown.innerHTML = '';
                if (Array.isArray(courses)) {
                    courses.forEach(classItem => {
                        const dropdownItem = document.createElement('div');
                        dropdownItem.className = 'dropdown-item';
                        dropdownItem.dataset.value = classItem.id;

                        const mainLineDiv = document.createElement('div');
                        mainLineDiv.className = 'main-line';

                        let mainDisplayText = classItem.name + ' ';
                        if (classItem.courseCode) {
                            mainDisplayText += `(${classItem.courseCode}) `;
                        }
                        mainLineDiv.textContent = mainDisplayText;

                        const subheaderLineDiv = document.createElement('div');
                        subheaderLineDiv.className = 'subheader-line';
                        subheaderLineDiv.textContent = 'Created by: ' + classItem.createdByUsername;

                        dropdownItem.appendChild(mainLineDiv);
                        dropdownItem.appendChild(subheaderLineDiv);

                        classDropdown.appendChild(dropdownItem);
                    });
                }
            }

            // Update dashboard class list dropdown menu
            const classDashListContainer = document.querySelector('.class-dash-list');
            if (classDashListContainer) {
                classDashListContainer.innerHTML = '';

                // Add "All" option
                const allOption = document.createElement('div');
                allOption.className = 'dropdown-item';
                allOption.dataset.value = 'All';

                const mainAllDiv = document.createElement('div');
                mainAllDiv.className = 'main-line';
                mainAllDiv.textContent = 'All';

                const subAllDiv = document.createElement('div');
                subAllDiv.className = 'subheader-line';
                subAllDiv.textContent = 'Includes all courses';

                allOption.appendChild(mainAllDiv);
                allOption.appendChild(subAllDiv);
                classDashListContainer.appendChild(allOption);

                if (Array.isArray(courses)) {
                    courses.forEach(classItem => {
                        const dropdownItem = document.createElement('div');
                        dropdownItem.className = 'dropdown-item';
                        dropdownItem.dataset.value = classItem.id;

                        const mainLineDiv = document.createElement('div');
                        mainLineDiv.className = 'main-line';
                        let mainDisplayText = classItem.name;
                        if (classItem.courseCode) {
                            mainDisplayText += ` (${classItem.courseCode})`;
                        }
                        mainLineDiv.textContent = mainDisplayText;

                        const subheaderLineDiv = document.createElement('div');
                        subheaderLineDiv.className = 'subheader-line';
                        subheaderLineDiv.textContent = 'Created by: ' + classItem.createdByUsername;

                        dropdownItem.appendChild(mainLineDiv);
                        dropdownItem.appendChild(subheaderLineDiv);

                        classDashListContainer.appendChild(dropdownItem);
                    });
                }
            }

            // Update class edit list dropdown menu
            if (classEditDropdown) {
                classEditDropdown.innerHTML = '';
                if (Array.isArray(courses)) {
                    courses.forEach(classItem => {
                        const dropdownItem = document.createElement('div');
                        dropdownItem.className = 'dropdown-item';
                        dropdownItem.dataset.value = classItem.id;

                        const mainLineDiv = document.createElement('div');
                        mainLineDiv.className = 'main-line';

                        let mainDisplayText = classItem.name + ' ';
                        if (classItem.courseCode) {
                            mainDisplayText += `(${classItem.courseCode}) `;
                        }
                        mainLineDiv.textContent = mainDisplayText;

                        const subheaderLineDiv = document.createElement('div');
                        subheaderLineDiv.className = 'subheader-line';
                        subheaderLineDiv.textContent = 'Created by: ' + classItem.createdByUsername;

                        dropdownItem.appendChild(mainLineDiv);
                        dropdownItem.appendChild(subheaderLineDiv);

                        classEditDropdown.appendChild(dropdownItem);
                    });
                }
            }

            // Update class notes list dropdown menu
            const classNotesDropdown = document.querySelector('.class-notes-list');
            if (classNotesDropdown) {
                classNotesDropdown.innerHTML = '';
                if (Array.isArray(courses)) {
                    courses.forEach(classItem => {
                        const dropdownItem = document.createElement('div');
                        dropdownItem.className = 'dropdown-item';
                        dropdownItem.dataset.value = classItem.id;

                        const mainLineDiv = document.createElement('div');
                        mainLineDiv.className = 'main-line';

                        let mainDisplayText = classItem.name + ' ';
                        if (classItem.courseCode) {
                            mainDisplayText += `(${classItem.courseCode})`;
                        }
                        mainLineDiv.textContent = mainDisplayText;

                        const subheaderLineDiv = document.createElement('div');
                        subheaderLineDiv.className = 'subheader-line';
                        subheaderLineDiv.textContent = 'Created by: ' + classItem.createdByUsername;

                        dropdownItem.appendChild(mainLineDiv);
                        dropdownItem.appendChild(subheaderLineDiv);

                        classNotesDropdown.appendChild(dropdownItem);
                    });
                }
            }

            // Update class multiple list dropdown menu
            const classMultipleDropdown = document.querySelector('.class-multiple-list');
            if (classMultipleDropdown) {
                classMultipleDropdown.innerHTML = '';
                if (Array.isArray(courses)) {
                    courses.forEach(classItem => {
                        const dropdownItem = document.createElement('div');
                        dropdownItem.className = 'dropdown-item';
                        dropdownItem.dataset.value = classItem.id;

                        const mainLineDiv = document.createElement('div');
                        mainLineDiv.className = 'main-line';

                        let mainDisplayText = classItem.name + ' ';
                        if (classItem.courseCode) {
                            mainDisplayText += `(${classItem.courseCode}) `;
                        }
                        mainLineDiv.textContent = mainDisplayText;

                        const subheaderLineDiv = document.createElement('div');
                        subheaderLineDiv.className = 'subheader-line';
                        subheaderLineDiv.textContent = 'Created by: ' + classItem.createdByUsername;

                        dropdownItem.appendChild(mainLineDiv);
                        dropdownItem.appendChild(subheaderLineDiv);

                        classMultipleDropdown.appendChild(dropdownItem);
                    });
                }
            }
        });
}

/**
 * Fetches all users and updates the relevant dropdown menus across the dashboard.
 *
 * - Sends a GET request to `users/list.php` to retrieve user data.
 * - On success, updates the following dropdowns:
 *   • `.user-list` – standard user selection menu
 *   • `.user-edit-list` – user selection in the edit modal
 *   • `.user-dash-list` – dashboard filter menu, including an "All" option
 * - Each dropdown item is assigned the user’s ID as `data-value` and displays the username.
 *
 * @see ../backend/api/users/list.php
 */
function reloadUserDropdowns() {
    fetch('../backend/api/users/list.php')
        .then(response => response.json())
        .then(result => {
            if (!result.success) {
                console.error('Error loading users:', result.message);
                return;
            }

            const users = result.data;

            // Update user list dropdown menu
            const userDropdown = document.querySelector('.user-list');
            if (userDropdown) {
                userDropdown.innerHTML = '';
                if (Array.isArray(users)) {
                    users.forEach(user => {
                        const dropdownItem = document.createElement('div');
                        dropdownItem.className = 'dropdown-item';
                        dropdownItem.dataset.value = user.id;
                        dropdownItem.textContent = user.username;

                        userDropdown.appendChild(dropdownItem);
                    });
                }
            }

            // Update user edit list dropdown menu
            const userEditDropdown = document.querySelector('.user-edit-list');
            if (userEditDropdown) {
                userEditDropdown.innerHTML = '';
                if (Array.isArray(users)) {
                    users.forEach(user => {
                        const dropdownItem = document.createElement('div');
                        dropdownItem.className = 'dropdown-item';
                        dropdownItem.dataset.value = user.id;
                        dropdownItem.textContent = user.username;

                        userEditDropdown.appendChild(dropdownItem);
                    });
                }
            }

            // Update dashboard user list dropdown menu
            const userDashListContainer = document.querySelector('.user-dash-list');
            if (userDashListContainer) {
                userDashListContainer.innerHTML = '';

                // Add "All" option
                const allOption = document.createElement('div');
                allOption.className = 'dropdown-item';
                allOption.dataset.value = 'All';
                allOption.textContent = 'All';
                userDashListContainer.appendChild(allOption);

                if (Array.isArray(users)) {
                    users.forEach(user => {
                        const dropdownItem = document.createElement('div');
                        dropdownItem.className = 'dropdown-item';
                        dropdownItem.dataset.value = user.id;
                        dropdownItem.textContent = user.username;

                        userDashListContainer.appendChild(dropdownItem);
                    });
                }
            }
        });
}

/**
 * Reloads and repopulates the discipline filter dropdowns used in the dashboard and enrollment views.
 *
 * - Fetches a list of available disciplines from `list_disciplines.php`.
 * - Updates:
 *   • `#filter-by-btn` – used for filtering class-related dashboard content.
 *   • `#filter-by-btn-2` – used for filtering enrollment data.
 * - Each dropdown receives:
 *   • A default "All" option.
 *   • An `<option>` for each discipline received from the backend.
 *
 * @see ../backend/api/classes/list_disciplines.php
 */
function reloadFilterDropdowns() {
    fetch('../backend/api/classes/list_disciplines.php')
        .then(response => response.json())
        .then(result => {
            if (!result.success) {
                console.error('Error loading disciplines:', result.message);
                return;
            }

            const dropdown = document.getElementById('filter-by-btn');
            if (dropdown) {
                dropdown.innerHTML = '';

                // Add "All" option
                const allOption = document.createElement('option');
                allOption.value = 'allCourses';
                allOption.textContent = 'Filter: All';
                dropdown.appendChild(allOption);

                // Add discipline options
                result.data.forEach(discipline => {
                    const option = document.createElement('option');
                    option.value = discipline;
                    option.textContent = discipline;
                    dropdown.appendChild(option);
                });

            }
            
            const dropdown2 = document.getElementById('filter-by-btn-2');
            if (dropdown2) {
                dropdown2.innerHTML = '';

                // Add "All" option
                const allOption2 = document.createElement('option');
                allOption2.value = 'allCourses';
                allOption2.textContent = 'All';
                if (dropdown2) dropdown2.appendChild(allOption2);

                // Add discipline options
                result.data.forEach(discipline => {
                    const option = document.createElement('option');
                    option.value = discipline;
                    option.textContent = discipline;
                    if (dropdown2) dropdown2.appendChild(option);
                });
            }
        })
        .catch(error => console.error('Error fetching disciplines:', error));
}


// --------------------- File Management JavaScript ------------------------


// Handle file input
if (fileInput) fileInput.addEventListener('change', handleFiles);

if (fileUploadDiv) {
    fileUploadDiv.addEventListener('drop', (e) => {
        e.preventDefault();
        const files = e.dataTransfer.files;
        handleFiles({ target: { files } });
    });
}

/**
 * Handles file selection and uploads files to the selected course’s documents folder.
 *
 * - Validates that a course is selected before proceeding.
 * - Displays a loading spinner during upload.
 * - Iterates through each selected file:
 *   • Uploads it using `saveFileToDocsFolder(file, courseId)`.
 *   • If successful, displays a file preview with `displayFilePreview()`.
 * - Once all uploads are complete:
 *   • Reloads the list of existing files using `loadExistingFiles()`.
 *   • Shows a success banner and hides the loading spinner.
 *
 * @async
 * @param {Event} event – The file input change event containing `event.target.files`.
 *
 * @see saveFileToDocsFolder
 * @see displayFilePreview
 * @see loadExistingFiles
 */
async function handleFiles(event) {
    const coursesDropdownUpload = document.getElementById('notes_class_id');
    const files = Array.from(event.target.files);
    const selectedCourse = coursesDropdownUpload.value;
    const selectedCourseName = document.getElementById('selectedNotesClassText').innerText;

    if (!selectedCourseName || selectedCourseName === "Select Class") {
        showErrorBanner("Please select a course before uploading files.");
        return;
    }

    document.getElementById('loading-spinner').classList.remove('hidden');

    const uploadPromises = files.map(async (file) => {
        try {
            const success = await saveFileToDocsFolder(file, selectedCourse);
            if (success) {
                displayFilePreview(file.name, file.type, selectedCourse);
            }
        } catch (err) {
            console.error(`Failed to upload ${file.name}:`, err);
        }
    });

    await Promise.all(uploadPromises);
    loadExistingFiles(); // call after all uploads

    showSuccessBanner(`Successfully uploaded ${files.length} file(s) to ${selectedCourseName}.`);
    document.getElementById('loading-spinner').classList.add('hidden');
}

/**
 * Uploads a single file to the documents folder for a given course via the Flask backend.
 *
 * - Constructs a `FormData` payload with the file and course ID.
 * - Sends a POST request to the Flask `/upload` endpoint with authentication headers.
 * - On success, logs a confirmation and returns `true`.
 * - On failure, logs the error, displays an error banner, and returns `false`.
 *
 * @param {File} file – The file object to upload.
 * @param {number} courseId – The ID of the course the file should be associated with.
 * @returns {Promise<boolean>} Resolves to `true` if upload succeeds; otherwise `false`.
 *
 * @global {string} FLASK_API – Base URL for the Flask backend API.
 * @global {string} userId – Current user's ID.
 * @global {string} userRole – Current user's role.
 * @global {string} username – Current user's username.
 */
function saveFileToDocsFolder(file, courseId) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("courseId", courseId);

    return fetch(`${FLASK_API}/upload`, {
        method: "POST",
        body: formData,
        credentials: 'include',
        headers: {
            'X-User-Id': userId,
            'X-User-Role': userRole,
            'X-Username': username
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            console.log(`${file.name} saved to course id ${courseId}.`);
            return true;
        } else {
            console.error(`Error saving ${file.name}: ${data.message}`);
            showErrorBanner(`Upload failed: ${file.name}`);
            return false;
        }
    })
    .catch(err => {
        console.error('Error saving file:', err);
        showErrorBanner(`Upload error: ${file.name}`);
        return false;
    });
}

/**
 * Creates and displays a file preview element in the appropriate section based on file type.
 *
 * - Displays a preview card with:
 *   • A file-type-specific icon (PDF, PPTX, or default)
 *   • A shortened, readable file name
 *   • A download link with proper attributes
 *   • A delete button that removes the file from the backend and UI
 * - Appends the preview to one of: `pdfDiv`, `pptxDiv`, or `pngDiv` based on file type.
 *
 * @param {string} fileName – The full file name or path (used to generate name and download URL).
 * @param {string} fileType – The MIME type or extension (e.g., `"application/pdf"`, `"application/vnd.openxmlformats-officedocument.presentationml.presentation"`).
 * @param {string|number} courseId – The ID of the course this file is associated with.
 *
 * @see removeFileFromDocsFolder
 * @global {HTMLElement} pdfDiv – Container for PDF file previews.
 * @global {HTMLElement} pptxDiv – Container for PPTX file previews.
 * @global {HTMLElement} pngDiv – Container for all other file previews.
 * @global {string} FLASK_API – Base URL for the Flask backend API.
 */
function displayFilePreview(fileName, fileType, courseId) {
    const preview = document.createElement('div');
    preview.className = 'file-preview flex flex-col items-center gap-1 p-0 rounded bg-gray-200 text-white w-40';

    // Extract short name
    const abbreviatedFileName = fileName.split("/").pop().split(".")[0].replace(/_/g, " ");

    // Create download link
    const coursesDropdownUpload = document.getElementById('notes_class_id');
    console.log(coursesDropdownUpload.textContent)
    const selectedCourseName = document.getElementById('selectedNotesClassText').innerText || '';
    const link = document.createElement('a');
    link.href = `${FLASK_API}/download?file=${encodeURIComponent(fileName)}&courseId=${encodeURIComponent(courseId)}`;
    link.title = "Download file";
    link.setAttribute('download', fileName);

    // File icon
    const img = document.createElement('img');
    img.className = 'w-16 h-16 object-contain';  // Fixes size & prevents stretching
    img.src = fileType.includes("pdf") ? "static/img/pdf-new.png" :
              fileType.includes("pptx") ? "static/img/pptx.png" :
              "static/img/default.png";

    link.appendChild(img);

    // File name text
    const fileNameElement = document.createElement('div');
    fileNameElement.className = 'file-name text-sm text-center break-words w-full leading-tight mt-1';
    fileNameElement.title = abbreviatedFileName;
    fileNameElement.textContent = abbreviatedFileName;

    // Delete button
    const deleteButton = document.createElement('button');
    deleteButton.className = 'delete-icon absolute top-1 right-1 text-white bg-red-600 px-2 rounded';
    deleteButton.innerText = 'X';
    deleteButton.title = "Remove file";
    deleteButton.addEventListener('click', (event) => {
        event.preventDefault(); // Prevents form submission or navigation
        removeFileFromDocsFolder(fileName, preview);
    });

    // Wrapper to position delete icon
    const wrapper = document.createElement('div');
    wrapper.className = 'relative';
    wrapper.appendChild(link);
    wrapper.appendChild(deleteButton)

    // Combine
    preview.appendChild(wrapper);
    preview.appendChild(fileNameElement);

    if (fileType.includes("pdf")) {
        pdfDiv.appendChild(preview);
    } else if (fileType.includes("pptx")) {
        pptxDiv.appendChild(preview);
    } else {
        pngDiv.appendChild(preview);
    }
}

/**
 * Removes a file from the documents folder of the selected course.
 *
 * Sends a DELETE request to the server to remove the specified file
 * from the course folder identified by the selected course ID.
 * On success, removes the file preview element from the DOM and shows a success banner.
 * On failure, logs an error to the console.
 *
 * @param {string} fileName - The name of the file to be removed.
 * @param {HTMLElement} preview - The DOM element representing the file preview to remove upon success.
 */
function removeFileFromDocsFolder(fileName, preview) {
    const coursesDropdownUpload = document.getElementById('notes_class_id');
    const selectedCourse = coursesDropdownUpload.value;
    const selectedCourseName = document.getElementById('selectedNotesClassText').innerText;

    if (!selectedCourseName) {
        showErrorBanner("Please select a course."); 
        return;
    }
    fetch(`${FLASK_API}/delete?file=${fileName}&courseId=${selectedCourse}`, {
        method: "DELETE",
        credentials: 'include',
        headers: {
            'X-User-Id': userId,
            'X-User-Role': userRole,
            'X-Username': username
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            console.log(`${fileName} removed from ${selectedCourseName} folder.`);
            showSuccessBanner(`Successfully removed ${fileName} from ${selectedCourseName}.`);
            preview.remove();
        } else {
            console.error(`Error removing ${fileName}: ${data.message}`);
        }
    })
    .catch(err => console.error('Error removing file:', err));
}

/**
 * Update preview after training to mark files as trained.
 */
function updateTrainedFiles() {
    const previews = document.querySelectorAll('.file-preview');
    previews.forEach(preview => {
        preview.classList.remove('untrained');
    });
}

/**
 * Loads and displays existing files for the selected course.
 * 
 * Fetches files from the server based on the selected course ID,
 * clears any existing file previews, and displays the files grouped
 * by type (PDF, PPTX, and others) in their respective containers.
 * Adds headings above each file group if files of that type exist.
 */
function loadExistingFiles() {
    const coursesDropdownUpload = document.getElementById('notes_class_id');
    const selectedCourse = coursesDropdownUpload.value; // This is the course ID

    if (!selectedCourse) {
        console.warn("No course selected, skipping file load.");
        return;
    }

    console.log(`Loading files for course ID: ${selectedCourse}`);
    fetch(`${FLASK_API}/load-docs?courseId=${encodeURIComponent(selectedCourse)}`, {
        method: "GET",
        credentials: 'include',
        headers: {
            'X-User-Id': userId,
            'X-User-Role': userRole,
            'X-Username': username
        }
    })
        .then(response => response.json())
        .then(files => {
            // Clear existing previews
            previewDiv.innerHTML = '';
            pdfDiv.innerHTML = '';
            pptxDiv.innerHTML = '';
            pngDiv.innerHTML = '';
            files.forEach(file => {
                displayFilePreview(file.name, file.type, selectedCourse);
            });
        })
        .finally(() => {
            // Add in headers for file types if they exist
            if (pdfDiv.querySelector('.file-preview')) {
                const heading = document.createElement('h6');
                heading.className = 'text-sm font-semibold mb-0';
                heading.textContent = 'PDF Files';
                previewDiv.appendChild(heading);
            }
            previewDiv.appendChild(pdfDiv);
            if (pptxDiv.querySelector('.file-preview')) {
                const heading = document.createElement('h6');
                heading.className = 'text-sm font-semibold mb-0';
                heading.textContent = 'PPTX Files';
                previewDiv.appendChild(heading);
            }
            previewDiv.appendChild(pptxDiv);
            if (pngDiv.querySelector('.file-preview')) {
                const heading = document.createElement('h6');
                heading.className = 'text-sm font-semibold mb-0';
                heading.textContent = 'Other Files';
                previewDiv.appendChild(heading);
            }
            previewDiv.appendChild(pngDiv);

            console.log("File loading complete.");
        })
        .catch(err => console.error("Error loading files:", err));
}


// --------------------- Banner Management JavaScript ------------------------


// Global timeout holders
let successTimeoutId = null;
let errorTimeoutId = null;

/**
 * Hides both success and error banners if they exist,
 * and clears any existing timeout that would auto-hide them.
 *
 * @modifies {successTimeoutId, errorTimeoutId}
 */
function hideAllBanners() {
    const successBanner = document.getElementById('success-banner');
    const errorBanner = document.getElementById('error-banner');

    if (successBanner) {
        successBanner.classList.add('hidden');
        if (successTimeoutId) {
            clearTimeout(successTimeoutId);
            successTimeoutId = null;
        }
    }

    if (errorBanner) {
        errorBanner.classList.add('hidden');
        if (errorTimeoutId) {
            clearTimeout(errorTimeoutId);
            errorTimeoutId = null;
        }
    }
}

/**
 * Displays the green success banner with the provided message,
 * hides any other visible banners, and sets a timeout to hide the success banner after 10 seconds.
 *
 * @param {string} message - The message to display in the success banner.
 * @modifies {successTimeoutId}
 */
function showSuccessBanner(message) {
    hideAllBanners(); // Hide others and clear their timeouts

    const banner = document.getElementById('success-banner');
    if (!banner) return;

    banner.textContent = message;
    banner.classList.remove('hidden');

    successTimeoutId = setTimeout(() => {
        banner.classList.add('hidden');
        successTimeoutId = null;
    }, 10000); // 10 seconds
}

/**
 * Displays the red error banner with the provided message,
 * hides any other visible banners, and sets a timeout to hide the success banner after 10 seconds.
 *
 * @param {string} message - The message to display in the error banner.
 * @modifies {successTimeoutId}
 */
function showErrorBanner(message) {
    hideAllBanners(); // Hide others and clear their timeouts

    const banner = document.getElementById('error-banner');
    if (!banner) return;

    banner.textContent = message;
    banner.classList.remove('hidden');

    errorTimeoutId = setTimeout(() => {
        banner.classList.add('hidden');
        errorTimeoutId = null;
    }, 10000); // 10 seconds
}


// --------------------- Left Sidebar and Responsive Design JavaScript ------------------------


const dropdown = document.getElementById('dropdown-sidebar');
const toggleBtnMobile = document.getElementById('toggle-dropdown-mobile');
const toggleIconMobile = document.getElementById('toggle-dropdown-mobile-icon');
const content = document.getElementById('my-content');
const chatContainer = document.getElementById('chat-container');

/**
 * Handles clicks on "toggle-dropdown-mobile" button.
 * Toggles sidebar when viewing on smaller screens and changes button icons.
 */
if (toggleBtnMobile) {
    toggleBtnMobile.addEventListener('click', () => {
        console.log("Toggle button clicked!");
        dropdown.classList.toggle('hidden');
        if (toggleIconMobile.classList.contains('fa-caret-down')) {
            toggleIconMobile.classList.remove('fa-caret-down');
            toggleIconMobile.classList.add('fa-xmark');
        } else {
            toggleIconMobile.classList.remove('fa-xmark');
            toggleIconMobile.classList.add('fa-caret-down');
        }
        console.log("Left sidebar classes:", sidebar.classList);
        console.log("Content classes:", content.classList);
    });
}

/**
 * Handles UI adjustments based on the current window width.
 * 
 * For screens wider than or equal to 1024px:
 * - Shows the sidebar.
 * - Sets header and header text styles for large screens.
 * - Removes mobile-specific layout class from the content area.
 * 
 * For smaller screens:
 * - Hides the sidebar.
 * - Sets header and header text styles for small screens.
 * - Applies mobile-specific layout class to the content area.
 */
function handleResize() {
    const sidebar = document.getElementById('sidebar');
    const header = document.getElementById('chat-header');
    const headerText = document.getElementById('chat-header-text');
    const content = document.getElementById('my-content');

    if (window.innerWidth >= 1024) {
        sidebar.classList.remove('hidden');
        if (header) header.className = "flex items-center justify-start p-3 w-full gap-2 border-b-4 border-gray-50";
        if (headerText) headerText.className = "text-xl font-bold text-left m-0";
        content.classList.remove('mobile');
    } else {
        sidebar.classList.add('hidden');
        if (header) header.className = "flex items-center p-3 w-full bg-gray-100 border-b-4 border-gray-200";
        if (headerText) headerText.className = "text-xl font-bold text-center m-0 flex-grow-1 pr-8";
        content.classList.add('mobile');
    }
}

window.addEventListener('resize', handleResize);
handleResize();


// --------------------- Filter Management JavaScript ------------------------


/**
 * Performs a fuzzy substring match between a full string and a user input string.
 * This allows minor typos (e.g., 1-character difference) to still register as a match.
 *
 * - Returns `true` if the `input` is found exactly within `full`.
 * - Otherwise, slides a window the length of `input` across `full` and compares each chunk.
 * - If any chunk has a Levenshtein distance ≤ 1 from `input`, it’s considered a fuzzy match.
 *
 * @param {string} full – The full string to search within.
 * @param {string} input – The user-provided input string to match (with potential typos).
 * @returns {boolean} `true` if a fuzzy match is found; otherwise `false`.
 *
 * @see levenshtein
 */
function fuzzyIncludes(full, input) {
    full = full.toLowerCase();
    input = input.toLowerCase();

    // If exact substring match, return true immediately
    if (full.includes(input)) return true;

    // Slide input window across full text
    for (let i = 0; i <= full.length - input.length; i++) {
        const chunk = full.slice(i, i + input.length);
        const dist = levenshtein(chunk, input);
        if (dist <= 1) return true; // Controls amount of typos allowed
    }

    return false;
}

/**
 * Calculates the Levenshtein distance between two strings.
 *
 * The Levenshtein distance is the minimum number of single-character
 * edits (insertions, deletions, or substitutions) required to change one string into the other.
 *
 * Commonly used for fuzzy string matching and typo tolerance.
 *
 * @param {string} a – The first string to compare.
 * @param {string} b – The second string to compare.
 * @returns {number} The Levenshtein distance between `a` and `b`.
 *
 * @example
 * levenshtein('kitten', 'sitting'); // returns 3
 * levenshtein('flaw', 'lawn');      // returns 2
 */
function levenshtein(a, b) {
    const matrix = Array.from({ length: a.length + 1 }, () =>
        Array(b.length + 1).fill(0)
    );

    for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,      // deletion
                matrix[i][j - 1] + 1,      // insertion
                matrix[i - 1][j - 1] + cost // substitution
            );
        }
    }

    return matrix[a.length][b.length];
}