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


// --------------------- General JavaScript ------------------------


document.addEventListener('DOMContentLoaded', function () {
    loadClasses();
    initializeSearchableClassTable();
    initializeSearchableEnrollmentTable();
    initializeSearchableDropdowns();

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
                searchInput.dispatchEvent(new Event('input'));
            }
        });
    });
    
    const classForm = document.getElementById('classForm');
    const enrollmentForm = document.getElementById('enrollmentForm');
    const editClassForm = document.getElementById('editClassForm');
    const editEnrollmentForm = document.getElementById('editEnrollmentForm');

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
            
            // Use the reusable function here as well
            if (isValidCourseCode(courseCode)) {
                console.log("Add Form: Course code is valid.");

                if (courseCode === '') { courseCode = null; }
                if (classDescription === '') { classDescription = null; }

                const data = {
                    userId: userId,
                    name: document.getElementById('class_name').value,
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
                        alert("Course added successfully!");
                        loadClasses();
                        reloadClassDropdowns();
                        initializeSearchableClassTable();
                        reloadFilterDropdowns();
                        this.reset();
                    } else {
                        alert(`Error: ${data.message}`);
                    }
                })
                .catch(error => {
                    alert('An unexpected error occurred: ' + error.message);
                });
            } else {
                // Input is not empty and does not match the required format
                alert("Invalid course code format. Please use formats like 'EN100' or 'CS/EGR222', or leave it blank.");
                courseCodeInput.focus(); // Optional: bring focus to the incorrect field
            } 
        });
    }


    loadEnrollments();

    // Add Enrollment Form Handler (Create Enrollment)
    if (enrollmentForm) {
        enrollmentForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const form = this;
            
            const data = {
                courseId: document.getElementById('class_id').value,
                userId: document.getElementById('user_id').value,
                // roleOfClass: document.getElementById('roleOfClass').value
            };
            
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
                    alert("Enrollment added successfully!");
                    loadEnrollments();
                    initializeSearchableEnrollmentTable();
                    reloadFilterDropdowns();
                    form.reset();
                } else {
                    alert(`Error: ${data.message}`);
                }
            })
            .catch(error => {
                alert('An unexpected error occurred: ' + error.message);
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

            // Use the reusable function to validate the input
            if (isValidCourseCode(courseCodeGet)) {
                console.log("Edit Form: Course code is valid.");

                if (courseCodeGet === '') { courseCodeGet = null; }
                if (classDescription === '') { classDescription = null; }

                const data = {
                    courseId: document.getElementById('edit_course_id').value,
                    name: document.getElementById('edit_class_name').value,
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
                        loadClasses();
                        reloadFilterDropdowns();
                        initializeSearchableClassTable();
                        classModal.hide();
                    }
                });

            } else {
                alert("Invalid course code format. Please use formats like 'EN100' or 'CS/EGR222', or leave it blank.");
                courseCodeInput.focus();
            }

            
            
        });
    }

    // Edit Enrollment Form Handler
    if (editEnrollmentForm) {
        editEnrollmentForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const data = {
                userCourseId: document.getElementById('edit_enrollment_id').value,
                courseId: document.getElementById('edit_class_id').value,
                userId: document.getElementById('edit_user_id').value,
                roleOfClass: document.getElementById('edit_roleOfClass').value
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
                    loadEnrollments();
                    initializeSearchableEnrollmentTable();
                    reloadFilterDropdowns();
                    enrollmentModal.hide();
                }
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
        loadEnrollments();      // Assuming this is needed
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
                desc.includes(descFilter); // TODO: Algorithm for this needs updated

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
                        data-created-by-username="${userCourse.createdByUsername}">
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

        classModal.show();
    }
    
    if (e.target.classList.contains('edit-enrollment-btn')) {
        const btn = e.target;
        document.getElementById('edit_enrollment_id').value = btn.dataset.usercourseId;
        document.getElementById('edit_class_id').value = btn.dataset.courseId;
        document.getElementById('edit_user_id').value = btn.dataset.userId;
        // document.getElementById('edit_roleOfClass').value = btn.dataset.role;

        let mainDisplayText = btn.dataset.usercourseName + ' ';
        if (btn.dataset.courseCode) { mainDisplayText += (btn.dataset.courseCode) + ' '}
        document.getElementById('selectedEditClassText').textContent = mainDisplayText + 'Created by: ' + btn.dataset.createdByUsername;
        document.getElementById('selectedEditUserText').textContent = btn.dataset.usercourseUser;

        enrollmentModal.show();
    }
});

// Delete Class
function deleteClass(classId) {
    if (confirm('Are you sure? This will also delete all enrollments for this class.')) {
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
                initializeSearchableEnrollmentTable();
                reloadFilterDropdowns();
                loadEnrollments();
            }
        });
    }
}


// --------------------- Dropdown Management JavaScript ------------------------


function initializeSearchableDropdowns() {
    // re-query these now that the DOM is ready
    const classSearchInput = document.getElementById('classSearchInput');
    const userSearchInput  = document.getElementById('userSearchInput');
    const classEditSearchInput = document.getElementById('classEditSearchInput');
    const userEditSearchInput  = document.getElementById('userEditSearchInput');
    const classNotesSearchInput  = document.getElementById('classNotesSearchInput');

    const classListContainer = document.querySelector('.class-list');
    const userListContainer  = document.querySelector('.user-list');
    const classEditListContainer = document.querySelector('.class-edit-list');
    const userEditListContainer  = document.querySelector('.user-edit-list');
    const classNotesListContainer  = document.querySelector('.class-notes-list');

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
            // item.style.display = item.textContent.toLowerCase().includes(searchText) ? 'block' : 'none'; // Original method - no typos allowed
            item.style.display = fuzzyIncludes(item.textContent, searchText) ? 'block' : 'none'; // Allow typos
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

    // Delegate click inside .class-list
    if (classListContainer) {
        classListContainer.addEventListener('click', function(e) {
            const dropdownItem = e.target.closest('.dropdown-item');
            if (dropdownItem && classListContainer.contains(dropdownItem)) {
                const value = dropdownItem.dataset.value;
                const text  = dropdownItem.textContent;
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
                const text  = dropdownItem.textContent;
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
                const text  = dropdownItem.textContent;
                document.getElementById('notes_class_id').value = value;
                document.getElementById('selectedNotesClassText').textContent = text;

                const dropdownToggle = dropdownItem.closest('.dropdown')?.querySelector('[data-bs-toggle="dropdown"]');
                const dropdownInstance = bootstrap.Dropdown.getInstance(dropdownToggle);
                if (dropdownInstance) dropdownInstance.hide();
            }
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

            // Reinitialize search functionality
            initializeSearchableDropdowns();
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

            const dropdown2 = document.getElementById('filter-by-btn-2');
            if (dropdown2) dropdown2.innerHTML = '';
            
            

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
    const selectedCourse = coursesDropdownUpload.value;
    const selectedCourseName = document.getElementById('selectedNotesClassText').innerText;
    // if the above name call doesnt work, consider .text instead (data seemed to contain the text but maybe it doesnt always?)
    if (!selectedCourseName || selectedCourseName === "Select Class") {
        alert("Please select a course before uploading files.");
        return;
    }

    for (const file of files) {
        saveFileToDocsFolder(file, selectedCourse); // Pass selected course
        displayFilePreview(file.name, file.type, false); // Mark file as untrained initially
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
function displayFilePreview(fileName, fileType, isTrained) {
    const preview = document.createElement('div');
    preview.className = 'file-preview flex flex-col items-center gap-1 p-0 rounded bg-gray-200 text-white w-40';

    if (!isTrained) {
        preview.classList.add('border', 'border-yellow-500');
    }

    // Extract short name
    const abbreviatedFileName = fileName.split("/").pop().split(".")[0].replace(/_/g, " ");

    // Create download link
    const coursesDropdownUpload = document.getElementById('notes_class_id');
    const selectedCourseName = document.getElementById('selectedNotesClassText').innerText || '';
    const link = document.createElement('a');
    link.href = `${FLASK_API}/download?file=${encodeURIComponent(fileName)}&course=${encodeURIComponent(selectedCourseName)}`;
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
        alert("Please select a course.");
        return;
    }
    // console.log(fileName)
    // console.log(selectedCourseName)
    fetch(`${FLASK_API}/delete?file=${fileName}&course=${selectedCourseName}`, {
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
    const selectedCourseName = document.getElementById('selectedNotesClassText').innerText;

    if (!selectedCourseName) {
        console.warn("No course selected, skipping file load.");
        return;
    }

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
                displayFilePreview(file.name, file.type, file.isTrained);
            });
        })
        .catch(err => console.error("Error loading files:", err));
}