const fileUploadDiv = document.getElementById('file-upload-div');
const fileInput = document.getElementById('file-input');
const previewDiv = document.getElementById('preview-div');
const trainButton = document.getElementById('train-button');
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

    fetch("/upload", {
        method: "POST",
        body: formData
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
    preview.className = 'file-preview flex items-center gap-3 p-2 rounded bg-gray-800 text-white shadow-sm';

    if (!isTrained) {
        preview.classList.add('border', 'border-yellow-500');
    }

    // Extract short name
    let abbreviatedFileName = fileName.split("/").pop().split(".")[0];

    // File icon
    const img = document.createElement('img');
    img.className = 'w-8 h-8';
    img.src = fileType.includes("pdf") ? "static/img/pdf-new.png" :
              fileType.includes("pptx") ? "static/img/pptx.png" :
              "static/img/default.png";

    // File name text
    const fileNameElement = document.createElement('div');
    fileNameElement.className = 'file-name truncate max-w-[200px]';
    fileNameElement.title = abbreviatedFileName;  // Tooltip on hover
    fileNameElement.textContent = abbreviatedFileName;

    // Delete button
    const deleteButton = document.createElement('button');
    deleteButton.className = 'delete-icon text-red-400 hover:text-red-600 font-bold ml-auto';
    deleteButton.innerText = 'X';
    deleteButton.title = "Remove file";
    deleteButton.addEventListener('click', () => {
        preview.remove();
        removeFileFromDocsFolder(fileName);
    });

    // Combine
    preview.appendChild(img);
    preview.appendChild(fileNameElement);
    preview.appendChild(deleteButton);
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
    console.log(fileName)
    console.log(selectedCourseName)
    fetch(`/delete?file=${fileName}&course=${selectedCourseName}`, {
        method: "DELETE"
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

// Run the take_prompts.py script when the button is clicked
trainButton.addEventListener('click', () => {
    console.log("Running read_docs.py...");
    const coursesDropdownUpload = document.getElementById('courses-dropdown-upload');
    const selectedCourseName = coursesDropdownUpload.selectedOptions[0].text;  // This gets the course name
    console.log("Trying to train for course"+selectedCourseName)
    if (!selectedCourseName) {
        alert("Please select a course.");
        return;
    }

    fetch("/train", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ course_name: selectedCourseName })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            console.log("Model trained successfully.");
            updateTrainedFiles();
        } else {
            console.error(`Error training model: ${data.message}`);
        }
    })
    .catch(err => console.error('Error training model:', err));
});

// Update preview after training to mark files as trained
function updateTrainedFiles() {
    const previews = document.querySelectorAll('.file-preview');
    previews.forEach(preview => {
        preview.classList.remove('untrained');
    });
}

// Function to load existing files in the docs folder
function loadExistingFiles() {
    fetch("/load-docs")
    .then(response => response.json())
    .then(files => {
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

    // Fetch courses from the server
    fetch('/get-courses')
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

        // TODO: Check if course already exists
        
        console.log('Sending new course name:', courseName); // delete
        fetch('/add-course', {
            method: 'POST',
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

        fetch('/assign-student', {
            method: 'POST',
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
window.onload = loadExistingFiles;
