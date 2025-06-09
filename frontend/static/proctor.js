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

            const data = {
                name: document.getElementById('class_name').value,
                courseCode: document.getElementById('course_code').value,
                description: document.getElementById('class_description').value
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
        });
    }


    loadEnrollments();

    // Add Enrollment Form Handler (Create Enrollment)
    if (enrollmentForm) {
        enrollmentForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
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
                    this.reset();
                    // Reset selected class text
                    document.getElementById('selectedClassText').textContent = 'Select Class';
                    document.getElementById('selectedUserText').textContent = 'Select User';
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
            
            const data = {
                courseId: document.getElementById('edit_course_id').value,
                name: document.getElementById('edit_class_name').value,
                courseCode: document.getElementById('edit_course_code').value,
                description: document.getElementById('edit_class_description').value
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


// Load Classes
let allClasses = []; // Store full class list globally

function loadClasses() {
    fetch('../backend/api/get_all_classes.php')
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
                <td>${classItem.name}</td>
                <td>${classItem.courseCode || ''}</td>
                <td>${classItem.description || ''}</td>
                <td>
                    <button class="btn btn-sm btn-primary m-0 edit-class-btn"
                        data-class-id="${classItem.id}"
                        data-class-name="${classItem.name}"
                        data-course-code="${classItem.courseCode || ''}"
                        data-class-description="${classItem.description || ''}">
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
                name.includes(nameFilter) &&
                code.includes(codeFilter) &&
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
    fetch('../backend/api/get_classes.php')
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
            tr.innerHTML = `
                <td>${userCourse.name}</td>
                <td>${userCourse.username}</td>
                <td>${userCourse.role}</td>
                <td>
                    <button class="btn btn-sm btn-primary m-0 edit-enrollment-btn"
                        data-usercourse-id="${userCourse.userCoursesId}"
                        data-usercourse-name="${userCourse.name}"
                        data-usercourse-user="${userCourse.username}"
                        data-course-id="${userCourse.courseId}"
                        data-user-id="${userCourse.userId}">
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
                name.includes(namesFilter) &&
                user.includes(userFilter) &&
                role.includes(roleFilter);

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

        document.getElementById('selectedEditClassText').textContent = btn.dataset.usercourseName;
        document.getElementById('selectedEditUserText').textContent = btn.dataset.usercourseUser;

        enrollmentModal.show();
    }
});

// Delete Class
function deleteClass(classId) {
    if (confirm('Are you sure? This will also delete all enrollments for this class.')) {
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
            item.style.display = item.textContent.toLowerCase().includes(searchText) ? 'block' : 'none';
        });
        });
    }

    // “Search” filter for users
    if (userSearchInput) {
        userSearchInput.addEventListener('input', function(e) {
        const searchText = e.target.value.toLowerCase();
        document.querySelectorAll('.user-list .dropdown-item').forEach(item => {
            item.style.display = item.textContent.toLowerCase().includes(searchText) ? 'block' : 'none';
        });
        });
    }

    // “Search” filter for editting classes
    if (classEditSearchInput) {
        classEditSearchInput.addEventListener('input', function(e) {
        const searchText = e.target.value.toLowerCase();
        document.querySelectorAll('.class-edit-list .dropdown-item').forEach(item => {
            item.style.display = item.textContent.toLowerCase().includes(searchText) ? 'block' : 'none';
        });
        });
    }

    // “Search” filter for editting users
    if (userEditSearchInput) {
        userEditSearchInput.addEventListener('input', function(e) {
        const searchText = e.target.value.toLowerCase();
        document.querySelectorAll('.user-edit-list .dropdown-item').forEach(item => {
            item.style.display = item.textContent.toLowerCase().includes(searchText) ? 'block' : 'none';
        });
        });
    }

    // “Search” filter for class notes
    if (classNotesSearchInput) {
        classNotesSearchInput.addEventListener('input', function(e) {
        const searchText = e.target.value.toLowerCase();
        document.querySelectorAll('.class-notes-list .dropdown-item').forEach(item => {
            item.style.display = item.textContent.toLowerCase().includes(searchText) ? 'block' : 'none';
        });
        });
    }

    // Delegate click inside .class-list
    if (classListContainer) {
        classListContainer.addEventListener('click', function(e) {
            if (e.target.classList.contains('dropdown-item')) {
                const value = e.target.dataset.value;
                const text  = e.target.textContent;
                document.getElementById('class_id').value = value;
                document.getElementById('selectedClassText').textContent = text;

                const dropdownToggle = e.target.closest('.dropdown').querySelector('[data-bs-toggle="dropdown"]');
                const dropdownInstance = bootstrap.Dropdown.getInstance(dropdownToggle);
                if (dropdownInstance) dropdownInstance.hide();
            }
        });
    }

    // Delegate click inside .user-list
    if (userListContainer) {
        userListContainer.addEventListener('click', function(e) {
            if (e.target.classList.contains('dropdown-item')) {
                const value = e.target.dataset.value;
                const text  = e.target.textContent;
                document.getElementById('user_id').value = value;
                document.getElementById('selectedUserText').textContent = text;

                const dropdownToggle = e.target.closest('.dropdown').querySelector('[data-bs-toggle="dropdown"]');
                const dropdownInstance = bootstrap.Dropdown.getInstance(dropdownToggle);
                if (dropdownInstance) dropdownInstance.hide();  // <-- Close dropdown here
            }
        });
    }

    // Delegate click inside .class-edit-list
    if (classEditListContainer) {
        classEditListContainer.addEventListener('click', function(e) {
            if (e.target.classList.contains('dropdown-item')) {
                const value = e.target.dataset.value;
                const text  = e.target.textContent;
                document.getElementById('edit_class_id').value = value;
                document.getElementById('selectedEditClassText').textContent = text;

                const dropdownToggle = e.target.closest('.dropdown').querySelector('[data-bs-toggle="dropdown"]');
                const dropdownInstance = bootstrap.Dropdown.getInstance(dropdownToggle);
                if (dropdownInstance) dropdownInstance.hide();
            }
        });
    }

    // Delegate click inside .user-edit-list
    if (userEditListContainer) {
        userEditListContainer.addEventListener('click', function(e) {
            if (e.target.classList.contains('dropdown-item')) {
                const value = e.target.dataset.value;
                const text  = e.target.textContent;
                document.getElementById('edit_user_id').value = value;
                document.getElementById('selectedEditUserText').textContent = text;

                const dropdownToggle = e.target.closest('.dropdown').querySelector('[data-bs-toggle="dropdown"]');
                const dropdownInstance = bootstrap.Dropdown.getInstance(dropdownToggle);
                if (dropdownInstance) dropdownInstance.hide();  // <-- Close dropdown here
            }
        });
    }

    // Delegate click inside .class-notes-list
    if (classNotesListContainer) {
        classNotesListContainer.addEventListener('click', function(e) {
            if (e.target.classList.contains('dropdown-item')) {
                const value = e.target.dataset.value;
                const text  = e.target.textContent;
                document.getElementById('notes_class_id').value = value;
                document.getElementById('selectedNotesClassText').textContent = text;

                const dropdownToggle = e.target.closest('.dropdown').querySelector('[data-bs-toggle="dropdown"]');
                const dropdownInstance = bootstrap.Dropdown.getInstance(dropdownToggle);
                if (dropdownInstance) dropdownInstance.hide();

                previewDiv.innerHTML = '';
                loadExistingFiles();
            }
        });
    }
}

// Reload Class Dropdowns
function reloadClassDropdowns() {
    fetch('../backend/api/get_all_classes.php')
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
                        dropdownItem.className = 'dropdown-item text-white';
                        dropdownItem.dataset.value = classItem.id;
                        dropdownItem.textContent = `${classItem.name} (${classItem.courseCode || ''})`;
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
                        dropdownItem.className = 'dropdown-item text-white';
                        dropdownItem.dataset.value = classItem.id;
                        dropdownItem.textContent = `${classItem.name} (${classItem.courseCode || ''})`;
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
                        dropdownItem.className = 'dropdown-item text-white';
                        dropdownItem.dataset.value = classItem.id;
                        dropdownItem.textContent = `${classItem.name} (${classItem.courseCode || ''})`;
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
        saveFileToDocsFolder(file, selectedCourseName); // Pass selected course
        displayFilePreview(file.name, file.type, false); // Mark file as untrained initially
    }
}

// Save file to the appropriate course's folder
function saveFileToDocsFolder(file, course) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("course", course); // course name

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
            console.log(`${file.name} saved to ${course} folder.`);
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
    const selectedCourse = coursesDropdownUpload.value;
    const selectedCourseName = document.getElementById('selectedNotesClassText').innerText;

    if (!selectedCourseName) {
        console.warn("No course selected, skipping file load.");
        return;
    }

    fetch(`${FLASK_API}/load-docs?course=${encodeURIComponent(selectedCourseName)}`, {
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