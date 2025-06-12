const FLASK_API = "http://localhost:5000";
const fileUploadDiv = document.getElementById('file-upload-div');
const fileInput = document.getElementById('file-input');
const previewDiv = document.getElementById('preview-div');
const docsFolder = "docs"; // Folder to store files

const tbodyclasses = document.getElementById('classesTable');
const tbodyenrollments = document.getElementById('enrollmentsTable');

const classNotesId = document.getElementById('notes_class_id');

const classModal = new bootstrap.Modal(document.getElementById('editClassesModal'));
const enrollmentModal = new bootstrap.Modal(document.getElementById('editEnrollmentsModal'));
const multipleEnrollmentsModal = new bootstrap.Modal(document.getElementById('multipleEnrollmentsModal'));


// --------------------- General JavaScript ------------------------

// Specific to Multiple User Selection
const selectedUsers = new Set(); // Stores IDs of selected users
const selectedMultipleUserText = document.getElementById('selectedMultipleUserText'); // Element to display selected users
const multipleUserIdInput = document.getElementById('multiple_user_id'); // Hidden input to store selected user IDs

// Global variable for all users, will be populated via API call
let allUsers = [];

document.addEventListener('DOMContentLoaded', function () {
    loadClasses();
    loadEnrollments(); // Ensure enrollments are loaded to populate tables
    initializeSearchableClassTable();
    initializeSearchableEnrollmentTable();
    initializeSearchableDropdowns(); // This now includes loading all users for regular dropdowns

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
    
    const classForm = document.getElementById('classForm');
    const enrollmentForm = document.getElementById('enrollmentForm');
    const editClassForm = document.getElementById('editClassForm');
    const editEnrollmentForm = document.getElementById('editEnrollmentForm');
    const addMultipleEnrollmentsForm = document.getElementById('addMultipleEnrollmentsForm'); // Ensure this is defined

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

    // Add Class Form Handler (Create Class)
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

                if (courseCode === '') { courseCode = null; }
                if (classDescription === '') { classDescription = null; }

                // Fetch all classes to check for duplicates
                fetch('../backend/api/get_professor_classes.php')
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

                        fetch('../backend/api/create_class.php', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(data)
                        })
                            .then(response => response.json())
                            .then(data => {
                                if (data.success) {
                                    showFeedbackBanner("Class added successfully!");
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
                showErrorBanner("Invalid course code format. Please use formats like 'EN100' or 'CS/EGR222', or leave it blank.");
                courseCodeInput.focus();
            }
        });
    }

    // Add Enrollment Form Handler (Create Enrollment)
    if (enrollmentForm) {
        enrollmentForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const form = this;

            // Check that user filled required fields
            const courseId = document.getElementById('class_id').value;
            const userId = document.getElementById('user_id').value;
            if (!(courseId)) {
                showErrorBanner("Please select a class in the dropdown.");
                return;
            }
            if (!(userId)) {
                showErrorBanner("Please select a user in the dropdown.");
                return;
            }

            fetch('../backend/api/get_professor_enrollments.php')
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
                    fetch('../backend/api/create_enrollment.php', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(data)
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            showFeedbackBanner("Enrollment added successfully!");
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
                        showFeedbackBanner("Enrollments added successfully!");
                        loadEnrollments();
                        initializeSearchableEnrollmentTable();
                        reloadFilterDropdowns();
                        form.reset();
                        selectedUsers.clear();
                        updateSelectedUsersDisplay();
                        // Clear selected values in main class dropdown
                        document.getElementById('class_id').value = null;
                        document.getElementById('selectedClassText').textContent = 'Select Class';
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
                        multipleEnrollmentsModal.hide();
                    }
                })
                .catch(error => {
                    showErrorBanner('An unexpected error occurred during batch enrollment: ' + error.message);
                });
        });
    }
    
    // Edit Class Form Handler
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

                if (courseCodeGet === '') { courseCodeGet = null; }
                if (classDescription === '') { classDescription = null; }

                // Fetch all classes to check for duplicates (excluding the current one)
                fetch('../backend/api/get_professor_classes.php')
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
                        
                        fetch('../backend/api/update_class.php', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(data)
                        })
                        .then(response => response.json())
                        .then(data => {
                            if (data.success) {
                                showFeedbackBanner("Class updated successfully!");
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
                showErrorBanner("Invalid course code format. Please use formats like 'EN100' or 'CS/EGR222', or leave it blank.");
                courseCodeInput.focus();
            }
        });
    }

    // Edit Enrollment Form Handler
    if (editEnrollmentForm) {
        editEnrollmentForm.addEventListener('submit', function(e) {
            e.preventDefault();

            const userCourseId = document.getElementById('edit_enrollment_id').value;
            const courseId = document.getElementById('edit_class_id').value;
            const userId = document.getElementById('edit_user_id').value;
            const roleOfClass = document.getElementById('edit_roleOfClass').value;

            fetch('../backend/api/get_professor_enrollments.php')
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

                    fetch('../backend/api/update_enrollment.php', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(data)
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            showFeedbackBanner("Enrollment updated successfully!");
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


// --------------------- Class and Enrollment Management JavaScript ------------------------


// Validates a course code against specific formats.
function isValidCourseCode(code) {
    const courseCodePattern = /^$|^[A-Z]{2,3}(\/[A-Z]{2,3})?\d{3}$/;
    return courseCodePattern.test(code);
}

// Load Classes
let allClasses = []; // Store full class list globally

function loadClasses() {
    fetch('../backend/api/get_professor_classes.php')
        .then(response => response.json())
        .then(result => {
            if (!result.success) {
                console.error('Error loading classes:', result.message);
                return;
            }

            allClasses = result.data; // Save full list globally
            renderClassTable(allClasses); // Render all initially
        })
        .catch(error => console.error('Error:', error));
}

function renderClassTable(classList) {
    const tbodyclasses = document.getElementById('classesTable');
    if (tbodyclasses) {
        tbodyclasses.innerHTML = '';

        classList.forEach(classItem => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div class="main-line">
                        ${classItem.name}
                    </div>
                    <div class="subheader-line">
                        Created by: ${classItem.createdByUsername}
                    </div>
                </td>
                <td>${classItem.courseCode || ''}</td>
                <td>${classItem.description || ''}</td>
                <td>
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

        reloadClassDropdowns(); // Assuming this is needed
    }
}

function filterCourses(discipline) {
    if (discipline === 'allCourses') {
        renderClassTable(allClasses);
    } else {
        const filtered = allClasses.filter(cls => 
            cls.courseCode && cls.courseCode.startsWith(discipline)
        );
        renderClassTable(filtered);
    }
}

function initializeSearchableClassTable() {
    const classNameTableInput = document.getElementById('classNameTableInput');
    const courseCodeTableInput = document.getElementById('courseCodeTableInput');
    const classDescriptionTableInput = document.getElementById('classDescriptionTableInput');

    const filterTable = () => {
        const nameFilter = classNameTableInput?.value.toLowerCase() || '';
        const codeFilter = courseCodeTableInput?.value.toLowerCase() || '';
        const descFilter = classDescriptionTableInput?.value.toLowerCase() || '';

        const rows = document.querySelectorAll('#classesTable tr');

        rows.forEach(row => {
            const name = row.children[0]?.textContent.toLowerCase() || '';
            const code = row.children[1]?.textContent.toLowerCase() || '';
            const desc = row.children[2]?.textContent.toLowerCase() || '';

            const matches =
                fuzzyIncludes(name, nameFilter) &&
                fuzzyIncludes(code, codeFilter) &&
                desc.includes(descFilter);
            row.style.display = matches ? 'table-row' : 'none';
        });
    };

    [classNameTableInput, courseCodeTableInput, classDescriptionTableInput].forEach(input => {
        if (input) input.addEventListener('input', filterTable);
    });
}

// Load Enrollments
let allEnrollments = []; // Store full enrollment list globally

function loadEnrollments() {
    fetch('../backend/api/get_professor_enrollments.php')
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

function renderEnrollmentTable(userCourses) {
    const tbodyenrollments = document.getElementById('enrollmentsTable');
    if (tbodyenrollments) {
        tbodyenrollments.innerHTML = '';

        userCourses.forEach(userCourse => {
            const tr = document.createElement('tr');
            const courseCodeDisplay = userCourse.courseCode ? ` (${userCourse.courseCode})` : '';
            tr.innerHTML = `
                <td>
                    <div class="main-line">
                        ${userCourse.name}${courseCodeDisplay}
                    </div>
                    <div class="subheader-line">
                        Created by: ${userCourse.createdByUsername}
                    </div>
                </td>
                <td>${userCourse.username}</td>
                <td>${userCourse.role}</td>
                <td>
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

        reloadClassDropdowns(); // Assuming this is needed
    }
}

function filterEnrollments(discipline) {
    if (discipline === 'allCourses') {
        renderEnrollmentTable(allEnrollments);
    } else {
        const filtered = allEnrollments.filter(cls => 
            cls.courseCode && cls.courseCode.startsWith(discipline)
        );
        renderEnrollmentTable(filtered);
    }
}

function initializeSearchableEnrollmentTable() {
    const classNamesTableInput = document.getElementById('classNamesTableInput');
    const userTableInput = document.getElementById('userTableInput');
    const roleTableInput = document.getElementById('roleTableInput');

    const filterTable = () => {
        const namesFilter = classNamesTableInput?.value.toLowerCase() || '';
        const userFilter = userTableInput?.value.toLowerCase() || '';
        const roleFilter = roleTableInput?.value.toLowerCase() || '';

        const rows = document.querySelectorAll('#enrollmentsTable tr');

        rows.forEach(row => {
            const name = row.children[0]?.textContent.toLowerCase() || '';
            const user = row.children[1]?.textContent.toLowerCase() || '';
            const role = row.children[2]?.textContent.toLowerCase() || '';

            const matches =
                fuzzyIncludes(name, namesFilter) &&
                fuzzyIncludes(user, userFilter) &&
                role.includes(roleFilter); // No point to fuzzy match roles - allowing for a one character typo prevents any filtering at all

            row.style.display = matches ? 'table-row' : 'none';
        });
    };

    [classNamesTableInput, userTableInput, roleTableInput].forEach(input => {
        if (input) input.addEventListener('input', filterTable);
    });
}

// Edit Class/Enrollment
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
        if (btn.dataset.courseCode) { mainDisplayText += '(' + (btn.dataset.courseCode) + ') '}
        document.getElementById('selectedEditClassText').textContent = mainDisplayText;
        document.getElementById('selectedEditUserText').textContent = btn.dataset.usercourseUser;

        hideAllBanners();
        enrollmentModal.show();
    }
});

// Clear Class Form
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

// Clear Enrollment Form
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
    const roleOfClassDropdown = document.getElementById('roleOfClass');
    if (roleOfClassDropdown) {
        roleOfClassDropdown.value = roleOfClassDropdown.options[0].value;
    }
}

// Add Multiple Enrollments
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

        updateSelectedUsersDisplay(); // Update display to "Select User(s)"
        multipleEnrollmentsModal.show();
    })
}

// Delete Class
function deleteClass(classId) {
    if (confirm('Are you sure? This will also delete all enrollments for this class.')) {
        document.getElementById('loading-spinner').classList.remove('hidden');
        showFeedbackBanner("Deleting class...");
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
            fetch('../backend/api/delete_class.php', {
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
            showFeedbackBanner("Class deleted.");
            document.getElementById('loading-spinner').classList.add('hidden');
        });
    }
}

// Delete Enrollment
function deleteEnrollment(enrollmentId) {
    if (confirm('Are you sure you want to delete this enrollment?')) {
        fetch('../backend/api/delete_enrollment.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userCoursesId: enrollmentId })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showFeedbackBanner("Enrollment deleted.");
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

// Containers in Dropdowns
const classListContainer = document.querySelector('.class-list');
const userListContainer  = document.querySelector('.user-list');

const classEditListContainer = document.querySelector('.class-edit-list');
const userEditListContainer  = document.querySelector('.user-edit-list');

const classNotesListContainer  = document.querySelector('.class-notes-list');

const classMultipleListContainer  = document.querySelector('.class-multiple-list');
const userMultipleListContainer  = document.querySelector('.user-multiple-list'); // Redefining this here is harmless but redundant with the top-level declaration


// Initialize Dropdown Buttons
function initializeSearchableDropdowns() {
    
    // Prevent dropdown from closing when clicking inside the menu
    document.querySelectorAll('.dropdown-menu').forEach(menu => {
        menu.addEventListener('click', e => e.stopPropagation());
    });

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

    // “Search” filter for multiple users (CORRECTED fuzzyIncludes call)
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
                document.getElementById('selectedClassText').textContent = text;

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
                document.getElementById('selectedUserText').textContent = text;

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


    // Delegate click inside .class-notes-list
    if (classNotesListContainer) {
        classNotesListContainer.addEventListener('click', function(e) {
            const dropdownItem = e.target.closest('.dropdown-item');
            if (dropdownItem && classNotesListContainer.contains(dropdownItem)) {
                const value = dropdownItem.dataset.value;
                text  = dropdownItem.textContent;
                text = text.replace(/Created by: .*/, '').trim(); // Remove "Created by" part
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
    // This listener needs to be outside initializeSearchableDropdowns if the container is always present,
    // or ensure it's called after the container is available.
    // For now, it's called when the modal is shown.
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

    // Removed direct call to renderUserMultipleList() and loadAllUsersForMultipleSelect() here
    // as they are now called when the multipleEnrollmentsModal is shown.
}

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
        selectedMultipleUserText.textContent = 'Select User(s)';
        multipleUserIdInput.value = '';
    }
}

// Global variable for all users, will be populated via API call
// let allUsers = []; // Already declared at the top

function loadAllUsersForMultipleSelect() {
    // Ensure userMultipleListContainer is available before attempting to load/render
    const currentListContainer = document.querySelector('.user-multiple-list');
    if (!currentListContainer) {
        console.error('userMultipleListContainer not found in loadAllUsersForMultipleSelect');
        return;
    }

    fetch('../backend/api/get_all_users.php')
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

function renderUserMultipleList() {
    const currentListContainer = document.querySelector('.user-multiple-list');
    if (currentListContainer) {
        currentListContainer.innerHTML = ''; // Clear existing items

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
            if (selectedUsers.has(String(user.id))) { // Ensure ID is string for comparison
                div.classList.add('active');
            }
            div.dataset.value = user.id;
            div.textContent = user.username;
            currentListContainer.appendChild(div);
        });
    }
}

// Reload Class Dropdowns
function reloadClassDropdowns() {
    fetch('../backend/api/get_professor_classes.php')
        .then(response => response.json())
        .then(result => {
            if (!result.success) {
                console.error('Error loading classes:', result.message);
                return;
            }

            const courses = result.data;

            // Update dropdown menus
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

            // Update dropdown menus
            const classEditDropdown = document.querySelector('.class-edit-list');
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

            // Update dropdown menus
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

            // Update dropdown menus
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

            // Update edit form select
            const editClassSelect = document.getElementById('edit_class_id');
            if (editClassSelect) {
                editClassSelect.innerHTML = '';
                if (Array.isArray(courses)) {
                    courses.forEach(classItem => {
                        const option = document.createElement('option');
                        option.value = classItem.id;
                        option.textContent = `${classItem.name} (${classItem.courseCode || ''})`;
                        editClassSelect.appendChild(option);
                    });
                }
            }
        });
}

// Reload Filter Dropdowns
function reloadFilterDropdowns() {
    fetch('../backend/api/get_disciplines.php')
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
                allOption.textContent = 'All';
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


// --------------------- Filter Management JavaScript ------------------------


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

// Function to handle files and display thumbnails
function handleFiles(event) {
    console.log(event)
    const coursesDropdownUpload = document.getElementById('notes_class_id');
    const files = event.target.files;
    const selectedCourse = coursesDropdownUpload.value; // This is the course ID
    const selectedCourseName = document.getElementById('selectedNotesClassText').innerText;
    // if the above name call doesnt work, consider .text instead (data seemed to contain the text but maybe it doesnt always?)
    if (!selectedCourseName || selectedCourseName === "Select Class") {
        // Changed from alert to showErrorBanner for better UI
        showErrorBanner("Please select a course before uploading files."); 
        return;
    }

    for (const file of files) {
        saveFileToDocsFolder(file, selectedCourse); // Pass selected course
        displayFilePreview(file.name, file.type, selectedCourse);
        
    }
}

// Save file to the appropriate course's folder
function saveFileToDocsFolder(file, courseId) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("courseId", courseId); // course name

    document.getElementById('loading-spinner').classList.remove('hidden');


    fetch(`${FLASK_API}/upload`, {
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
            console.log(`${file.name} saved to course id ${courseId} folder.`);
            console.log("Suspected over triggering of loading existing files here but it works so leaving it for now");
            loadExistingFiles();
        } else {
            console.error(`Error saving ${file.name}: ${data.message}`);
        }
    })
    .catch(err => console.error('Error saving file:', err))
    .finally(() => {
        document.getElementById('loading-spinner').classList.add('hidden');
    });
}

// Display file preview based on file type
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
    deleteButton.addEventListener('click', () => {
        preview.remove();
        removeFileFromDocsFolder(fileName);
    });

    // Wrapper to position delete icon
    const wrapper = document.createElement('div');
    wrapper.className = 'relative';
    wrapper.appendChild(link);
    wrapper.appendChild(deleteButton)

    // Combine
    preview.appendChild(wrapper);
    preview.appendChild(fileNameElement);
    previewDiv.appendChild(preview);
}


function removeFileFromDocsFolder(fileName) {
    const coursesDropdownUpload = document.getElementById('notes_class_id');
    const selectedCourse = coursesDropdownUpload.value;
    const selectedCourseName = document.getElementById('selectedNotesClassText').innerText;

    if (!selectedCourseName) {
        // Changed from alert to showErrorBanner for better UI
        showErrorBanner("Please select a course."); 
        return;
    }
    // console.log(fileName)
    // console.log(selectedCourseName)
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
        } else {
            console.error(`Error removing ${fileName}: ${data.message}`);
        }
    })
    .catch(err => console.error('Error removing file:', err));
}

// Update preview after training to mark files as trained
function updateTrainedFiles() {
    const previews = document.querySelectorAll('.file-preview');
    previews.forEach(preview => {
        preview.classList.remove('untrained');
    });
}

// Function to load existing files from currently selected course
// and display them in the preview area
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
            previewDiv.innerHTML = ''; // Clear existing previews
            files.forEach(file => {
                displayFilePreview(file.name, file.type, selectedCourse);
            });
        })
        .catch(err => console.error("Error loading files:", err));
}


// --------------------- Banner Management JavaScript ------------------------


// Global timeout holders
let feedbackTimeoutId = null;
let errorTimeoutId = null;

function hideAllBanners() {
    const feedbackBanner = document.getElementById('feedback-banner');
    const errorBanner = document.getElementById('error-banner');

    if (feedbackBanner) {
        feedbackBanner.classList.add('hidden');
        if (feedbackTimeoutId) {
            clearTimeout(feedbackTimeoutId);
            feedbackTimeoutId = null;
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

function showFeedbackBanner(message) {
    hideAllBanners(); // Hide others and clear their timeouts

    const banner = document.getElementById('feedback-banner');
    if (!banner) return;

    banner.textContent = message;
    banner.classList.remove('hidden');

    feedbackTimeoutId = setTimeout(() => {
        banner.classList.add('hidden');
        feedbackTimeoutId = null;
    }, 10000); // 10 seconds
}

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