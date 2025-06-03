const FLASK_API = "http://localhost:5000";
const fileUploadDiv = document.getElementById('file-upload-div');
const fileInput = document.getElementById('file-input');
const previewDiv = document.getElementById('preview-div');
const docsFolder = "docs"; // Folder to store files

const tbodyclasses = document.getElementById('classesTable');
const tbodyenrollments = document.getElementById('enrollmentsTable');

// ***** General JS *****

document.addEventListener('DOMContentLoaded', function () {
    loadClasses();
    initializeSearchableDropdowns();
    
    const coursesDropdownEnroll = document.getElementById('courses-dropdown-enroll');
    const coursesDropdownUpload = document.getElementById('courses-dropdown-upload');
    const addCourseBtn = document.getElementById('add-course-btn');
    const modal = document.getElementById('add-course-modal');
    const courseNameInput = document.getElementById('course-name-input');

    const classForm = document.getElementById('classForm');
    const enrollmentForm = document.getElementById('enrollmentForm');
    const editForm = document.getElementById('editForm');

    // // Modify loaded files when a new course is selected
    // coursesDropdownUpload.addEventListener('change', loadExistingFiles);

    // Add Course Form Handler
    if (classForm) {
        classForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const data = {
                name: document.getElementById('className').value,
                courseCode: document.getElementById('courseCode').value,
                description: document.getElementById('classDescription').value
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
                    loadClasses();
                    reloadClassDropdowns();
                    this.reset();
                    // Reset selected class text
                    document.getElementById('selectedClassText').textContent = 'Select Class';
                }
            });
        });
    }

    loadEnrollments();

    // Add Enrollment Form Handler
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
                    loadEnrollments();
                    this.reset();
                }
            });
        });
    }
    
    // Edit Form Handler
    if (editForm) {
        editForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const data = {
                userCourseId: document.getElementById('edit_enrollment_id').value,
                id: document.getElementById('edit_class_id').value,
                userId: document.getElementById('edit_user_id').value,
                // roleOfClass: document.getElementById('edit_roleOfClass').value
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
                    bootstrap.Modal.getInstance(document.getElementById('editModal')).hide();
                }
            });
        });
    }
});

// ***** Class Management JS *****

function loadClasses() {
    fetch('../backend/api/get_all_classes.php')
        .then(response => response.json())
        .then(result => {
            if (!result.success) {
                console.error('Error loading classes:', result.message);
                return;
            }
            
            const classes = result.data; // Access the data array from response
            if (tbodyclasses) {
                tbodyclasses.innerHTML = '';
                
                if (Array.isArray(classes)) {
                    classes.forEach(classItem => {
                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td>${classItem.name}</td>
                            <td>${classItem.courseCode || ''}</td>
                            <td>${classItem.description || ''}</td>
                            <td>
                                <button class="btn btn-sm btn-primary" onclick="editClass(${JSON.stringify(classItem)})">
                                    Edit
                                </button>
                                <button class="btn btn-sm btn-danger" onclick="deleteClass(${classItem.id})">
                                    Delete
                                </button>
                            </td>
                        `;
                        tbodyclasses.appendChild(tr);
                    });
                }
                // Reload enrollment dropdowns
                reloadClassDropdowns();
                loadEnrollments();
            }
        })
        .catch(error => console.error('Error:', error));
}

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
                // Reset selected class text (**TODO: fix these they are in refrence to HTML elements in enrollments)
                document.getElementById('selectedClassText').textContent = 'Select Class';
                document.getElementById('class_id').value = '';
                
                loadClasses();
                reloadClassDropdowns();
                loadEnrollments();
            }
        });
    }
}

// ***** Enrollment Management JS *****

function loadEnrollments() {
    fetch('../backend/api/get_classes.php')
        .then(response => response.json())
        .then(result => {
            if (!result.success) {
                console.error('Error loading user courses:', result.message);
                return;
            }

            const userCourses = result.data; // Access the data array from response
            if (tbodyenrollments) {
                tbodyenrollments.innerHTML = '';
                
                if (Array.isArray(userCourses)) {
                    userCourses.forEach(userCourse => {
                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td>${userCourse.name}</td>
                            <td>${userCourse.username}</td>
                            <td>${'TODO'}</td>
                            <td>
                                <button class="btn btn-sm btn-primary" onclick="editEnrollment(${JSON.stringify(userCourse)})">
                                    Edit
                                </button>
                                <button class="btn btn-sm btn-danger" onclick="deleteEnrollment(${userCourse.userCourseId})">
                                    Delete
                                </button>
                            </td>
                        `;
                        tbodyenrollments.appendChild(tr);
                    });
                }
            }
        })
        .catch(error => console.error('Error:', error));
}

function editEnrollment(userCourse) {
    document.getElementById('edit_enrollment_id').value = userCourse.userCourseId;
    document.getElementById('edit_class_id').value = userCourse.courseId;
    document.getElementById('edit_user_id').value = userCourse.userId;
    // document.getElementById('edit_roleOfClass').value = userCourse.roleOfClass;
    
    new bootstrap.Modal(document.getElementById('editModal')).show();
}

function deleteEnrollment(enrollmentId) {
    if (confirm('Are you sure you want to delete this enrollment?')) {
        fetch('../backend/api/delete_enrollment.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userCourseId: enrollmentId })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                loadEnrollments();
            }
        });
    }
}

// ***** Dropdown Management JS *****

function initializeSearchableDropdowns() {
    // re-query these now that the DOM is ready
    const classSearchInput = document.getElementById('classSearchInput');
    const userSearchInput  = document.getElementById('userSearchInput');
    const classListContainer = document.querySelector('.class-list');
    const userListContainer  = document.querySelector('.user-list');

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

    // Delegate click inside .class-list
    if (classListContainer) {
        classListContainer.addEventListener('click', function(e) {
        if (e.target.classList.contains('dropdown-item')) {
            const value = e.target.dataset.value;
            const text  = e.target.textContent;
            document.getElementById('class_id').value = value;
            document.getElementById('selectedClassText').textContent = text;
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
        }
        });
    }
}

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
                        if (classItem.courseCode === null) { dropdownItem.textContent = `${classItem.name}`; }
                        else { dropdownItem.textContent = `${classItem.name} (${classItem.courseCode || ''})`; }
                        classDropdown.appendChild(dropdownItem);
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

// ***** File Management JS *****

// // Handle file input
// fileInput.addEventListener('change', handleFiles);

// fileUploadDiv.addEventListener('drop', (e) => {
//     e.preventDefault();
//     const files = e.dataTransfer.files;
//     handleFiles({ target: { files } });
// });

// // Function to handle files and display thumbnails
// function handleFiles(event) {
//     console.log(event)
//     const coursesDropdownUpload = document.getElementById('courses-dropdown-upload');
//     const files = event.target.files;
//     const selectedCourse = coursesDropdownUpload.value;
//     const selectedCourseName = coursesDropdownUpload.selectedOptions[0].text;  // This gets the course name
//     // if the above name call doesnt work, consider .text instead (data seemed to contain the text but maybe it doesnt always?)
//     if (!selectedCourseName) {
//         alert("Please select a course before uploading files.");
//         return;
//     }

//     for (const file of files) {
//         saveFileToDocsFolder(file, selectedCourseName); // Pass selected course
//         displayFilePreview(file.name, file.type, false); // Mark file as untrained initially
//     }
// }

// // Save file to the appropriate course's folder
// function saveFileToDocsFolder(file, course) {
//     const formData = new FormData();
//     formData.append("file", file);
//     formData.append("course", course); // course name

//     document.getElementById('loading-spinner').classList.remove('hidden');


//     fetch(`${FLASK_API}/upload`, {
//         method: "POST",
//         body: formData,
//         credentials: 'include',
//         headers: {
//             'X-User-Id': userId,
//             'X-User-Role': userRole,
//             'X-Username': username
//         }
//     })
//     .then(response => response.json())
//     .then(data => {
//         if (data.success) {
//             console.log(`${file.name} saved to ${course} folder.`);
//         } else {
//             console.error(`Error saving ${file.name}: ${data.message}`);
//         }
//     })
//     .catch(err => console.error('Error saving file:', err))
//     .finally(() => {
//         document.getElementById('loading-spinner').classList.add('hidden');
//     });
// }

// // Display file preview based on file type
// function displayFilePreview(fileName, fileType, isTrained) {
//     const preview = document.createElement('div');
//     preview.className = 'file-preview flex flex-col items-center gap-1 p-3 rounded bg-gray-800 text-white shadow-sm w-40';

//     if (!isTrained) {
//         preview.classList.add('border', 'border-yellow-500');
//     }

//     // Extract short name
//     const abbreviatedFileName = fileName.split("/").pop().split(".")[0];

//     // Create download link
//     const coursesDropdownUpload = document.getElementById('courses-dropdown-upload');
//     const selectedCourseName = coursesDropdownUpload.selectedOptions[0]?.text || '';
//     const link = document.createElement('a');
//     link.href = `${FLASK_API}/download?file=${encodeURIComponent(fileName)}&course=${encodeURIComponent(selectedCourseName)}`;
//     link.title = "Download file";
//     link.setAttribute('download', fileName);

//     // File icon
//     const img = document.createElement('img');
//     img.className = 'w-16 h-16 object-contain';  // Fixes size & prevents stretching
//     img.src = fileType.includes("pdf") ? "static/img/pdf-new.png" :
//               fileType.includes("pptx") ? "static/img/pptx.png" :
//               "static/img/default.png";

//     link.appendChild(img);

//     // File name text
//     const fileNameElement = document.createElement('div');
//     fileNameElement.className = 'file-name text-sm text-center break-words w-full leading-tight mt-1';
//     fileNameElement.title = abbreviatedFileName;
//     fileNameElement.textContent = abbreviatedFileName;

//     // Delete button
//     const deleteButton = document.createElement('button');
//     deleteButton.className = 'delete-icon absolute top-1 right-1 text-white bg-red-600 px-2 rounded';
//     deleteButton.innerText = 'X';
//     deleteButton.title = "Remove file";
//     deleteButton.addEventListener('click', () => {
//         preview.remove();
//         removeFileFromDocsFolder(fileName);
//     });

//     // Wrapper to position delete icon
//     const wrapper = document.createElement('div');
//     wrapper.className = 'relative';
//     wrapper.appendChild(link);
//     wrapper.appendChild(deleteButton)

//     // Combine
//     preview.appendChild(wrapper);
//     preview.appendChild(fileNameElement);
//     previewDiv.appendChild(preview);
// }


// function removeFileFromDocsFolder(fileName) {
//     const coursesDropdownUpload = document.getElementById('courses-dropdown-upload');
//     const selectedCourse = coursesDropdownUpload.value;
//     const selectedCourseName = coursesDropdownUpload.selectedOptions[0].text;  // This gets the course name

//     if (!selectedCourseName) {
//         alert("Please select a course.");
//         return;
//     }
//     // console.log(fileName)
//     // console.log(selectedCourseName)
//     fetch(`${FLASK_API}/delete?file=${fileName}&course=${selectedCourseName}`, {
//         method: "DELETE",
//         credentials: 'include',
//         headers: {
//             'X-User-Id': userId,
//             'X-User-Role': userRole,
//             'X-Username': username
//         }
//     })
//     .then(response => response.json())
//     .then(data => {
//         if (data.success) {
//             console.log(`${fileName} removed from ${selectedCourseName} folder.`);
//         } else {
//             console.error(`Error removing ${fileName}: ${data.message}`);
//         }
//     })
//     .catch(err => console.error('Error removing file:', err));
// }

// // Update preview after training to mark files as trained
// function updateTrainedFiles() {
//     const previews = document.querySelectorAll('.file-preview');
//     previews.forEach(preview => {
//         preview.classList.remove('untrained');
//     });
// }

// // Function to load existing files from currently selected course
// // and display them in the preview area
// function loadExistingFiles() {
//     const coursesDropdownUpload = document.getElementById('courses-dropdown-upload');
//     const selectedCourse = coursesDropdownUpload.value;
//     const selectedCourseName = coursesDropdownUpload.selectedOptions[0]?.text;

//     if (!selectedCourseName) {
//         console.warn("No course selected, skipping file load.");
//         return;
//     }

//     fetch(`${FLASK_API}/load-docs?course=${encodeURIComponent(selectedCourseName)}`, {
//         method: "GET",
//         credentials: 'include',
//         headers: {
//             'X-User-Id': userId,
//             'X-User-Role': userRole,
//             'X-Username': username
//         }
//     })
//         .then(response => response.json())
//         .then(files => {
//             previewDiv.innerHTML = ''; // Clear existing previews
//             files.forEach(file => {
//                 displayFilePreview(file.name, file.type, file.isTrained);
//             });
//         })
//         .catch(err => console.error("Error loading files:", err));
// }