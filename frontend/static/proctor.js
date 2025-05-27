const FLASK_API = "http://localhost:5000";
const fileUploadDiv = document.getElementById('file-upload-div');
const fileInput = document.getElementById('file-input');
const previewDiv = document.getElementById('preview-div');
const docsFolder = "docs"; // Folder to store files

// Handle file input
fileInput.addEventListener('change', handleFiles);

fileUploadDiv.addEventListener('drop', (e) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    handleFiles({ target: { files } });
});

// Function to handle files and display thumbnails
function handleFiles(event) {
    console.log(event)
    const coursesDropdownUpload = document.getElementById('courses-dropdown-upload');
    const files = event.target.files;
    const selectedCourse = coursesDropdownUpload.value;
    const selectedCourseName = coursesDropdownUpload.selectedOptions[0].text;  // This gets the course name
    // if the above name call doesnt work, consider .text instead (data seemed to contain the text but maybe it doesnt always?)
    if (!selectedCourseName) {
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

    fetch(`${FLASK_API}/upload`, {
        method: "POST",
        body: formData,
        credentials: 'include'
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            console.log(`${file.name} saved to ${course} folder.`);
        } else {
            console.error(`Error saving ${file.name}: ${data.message}`);
        }
    })
    .catch(err => console.error('Error saving file:', err));
}

// Display file preview based on file type
function displayFilePreview(fileName, fileType, isTrained) {
    const preview = document.createElement('div');
    preview.className = 'file-preview flex flex-col items-center gap-1 p-3 rounded bg-gray-800 text-white shadow-sm w-40';

    if (!isTrained) {
        preview.classList.add('border', 'border-yellow-500');
    }

    // Extract short name
    const abbreviatedFileName = fileName.split("/").pop().split(".")[0];

    // Create download link
    const coursesDropdownUpload = document.getElementById('courses-dropdown-upload');
    const selectedCourseName = coursesDropdownUpload.selectedOptions[0]?.text || '';
    const link = document.createElement('a');
    link.href = `/download?file=${encodeURIComponent(fileName)}&course=${encodeURIComponent(selectedCourseName)}`;
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
    const coursesDropdownUpload = document.getElementById('courses-dropdown-upload');
    const selectedCourse = coursesDropdownUpload.value;
    const selectedCourseName = coursesDropdownUpload.selectedOptions[0].text;  // This gets the course name

    if (!selectedCourseName) {
        alert("Please select a course.");
        return;
    }
    // console.log(fileName)
    // console.log(selectedCourseName)
    fetch(`${FLASK_API}/delete?file=${fileName}&course=${selectedCourseName}`, {
        method: "DELETE",
        credentials: 'include'
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
    const coursesDropdownUpload = document.getElementById('courses-dropdown-upload');
    const selectedCourse = coursesDropdownUpload.value;
    const selectedCourseName = coursesDropdownUpload.selectedOptions[0]?.text;

    if (!selectedCourseName) {
        console.warn("No course selected, skipping file load.");
        return;
    }

    fetch(`${FLASK_API}/load-docs?course=${encodeURIComponent(selectedCourseName)}`, {
        method: "GET",
        credentials: 'include'
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

document.addEventListener('DOMContentLoaded', function () {
    const coursesDropdownEnroll = document.getElementById('courses-dropdown-enroll');
    const coursesDropdownUpload = document.getElementById('courses-dropdown-upload');
    const addCourseBtn = document.getElementById('add-course-btn');
    const modal = document.getElementById('add-course-modal');
    const courseNameInput = document.getElementById('course-name-input');

    // Modify loaded files when a new course is selected
    coursesDropdownUpload.addEventListener('change', loadExistingFiles);

    // Fetch courses from the server
    fetch(`${FLASK_API}/get-courses`, {
        method: 'GET',
        credentials: 'include'
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Populate both dropdowns with the same course options
                data.courses.forEach(course => {
                    const option1 = document.createElement('option');
                    option1.value = course.id;
                    option1.textContent = course.name;
                    coursesDropdownEnroll.appendChild(option1);

                    const option2 = document.createElement('option');
                    option2.value = course.id;
                    option2.textContent = course.name;
                    coursesDropdownUpload.appendChild(option2);
                });

                if (data.courses.length > 0) {
                    coursesDropdownUpload.value = data.courses[0].id;
                    loadExistingFiles();
                }
            } else {
                console.error(data.message);
            }
        })
        .catch(error => console.error('Error fetching courses:', error));

    // Add/Save the new course
    addCourseBtn.addEventListener('click', function (event) {
        event.preventDefault(); // Prevent form submission and page reload
        const courseName = courseNameInput.value.trim();

        if (!courseName) {
            alert('Please enter a course name.');
            return;
        }
        
        console.log('Sending new course name:', courseName); // delete
        fetch(`${FLASK_API}/add-course`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: courseName })
        })
        .then(response => response.json())
        .then(data => {
            console.log('Server response:', data); // delete
            if (data.success) {
                alert('Course added successfully!');
                // Add the new course to the dropdown
                const optionUpload = document.createElement('option');
                optionUpload.value = data.course.id;
                optionUpload.textContent = courseName;

                const optionEnroll = document.createElement('option');
                optionEnroll.value = data.course.id;
                optionEnroll.textContent = courseName;

                coursesDropdownUpload.appendChild(optionUpload);
                coursesDropdownEnroll.appendChild(optionEnroll);


                courseNameInput.value = '';
            } else {
                alert('Error adding course: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Error adding course:', error);
            alert('An unexpected error occurred.');
        });
    });

    document.getElementById('assign-student-btn').addEventListener('click', (event) => {
        event.preventDefault(); // Prevent form submission and page reload
        const studentUsername = document.getElementById('student-username').value.trim();
        const coursesDropdownEnroll = document.getElementById('courses-dropdown-enroll'); 
        const selectedCourseName = coursesDropdownEnroll.selectedOptions[0].text;  // This gets the course name.

        if (!studentUsername) {
            alert("Please enter a student username.");
            return;
        }

        fetch(`${FLASK_API}/assign-student`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                username: studentUsername, 
                course_name: selectedCourseName 
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert(`Student "${studentUsername}" successfully assigned to the course "${selectedCourseName}".`);
            } else {
                alert(`Error: ${data.message}`);
            }
        })
        .catch(err => {
            console.error('Error assigning student:', err);
            console.trace();
            alert('An error occurred while assigning the student.');
        });
    });

});


// Load existing files on page load
// window.onload = loadExistingFiles;
