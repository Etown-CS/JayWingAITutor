const FLASK_API = "http://127.0.0.1:5000";
const chatDiv = document.getElementById('chat-div');

window.onload = function() {
      const scrollable = document.getElementById('conversation');
      scrollable.scrollTop = scrollable.scrollHeight;
    };


// Existing question submission functionality
// TODO: find a way to get the course from the database to fix
function askQuestion() {
    const question = document.getElementById('student-question').value;
    // const coursesDropdown = document.getElementById('courses-dropdown');
    // const selectedCourseName = coursesDropdown.selectedOptions[0].text;

    fetch('/ask-question', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            question: question,
            courseName: selectedCourseName,
        }),
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                updateConversation(data.response);
            } else {
                console.error("Error in response:", data.message);
            }
        })
        .catch(err => {
            console.error("Error:", err);
        });
};

function updateConversation(tutorResponse) {
    const conversationDiv = document.getElementById('conversation');
    const newMessage = document.createElement('p');
    newMessage.textContent = tutorResponse;
    conversationDiv.appendChild(newMessage);
    conversationDiv.scrollTop = conversationDiv.scrollHeight;
}

// Text area expands with text when typed
document.addEventListener('DOMContentLoaded', () => {
    const textarea = document.getElementById('student-question');
    const form = document.forms.messageForm; // Or document.querySelector('form[name="messageForm"]');

    function autoResizeTextarea() {
        // Reset height to 'auto' to correctly calculate scrollHeight
        textarea.style.height = 'auto';
        // Set height to scrollHeight (content height)
        textarea.style.height = textarea.scrollHeight + 'px';
    }

    // Adjust height on input (typing, pasting, cutting)
    textarea.addEventListener('input', autoResizeTextarea);

    // Initial resize in case there's pre-filled content
    autoResizeTextarea();

    // Enter to send, Shift+Enter for new line
    textarea.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault(); // Prevent default new line
            askQuestion(); // Submit question to AI Tutor
            form.submit(); // Submit the form
            textarea.value = ''; // Clear textarea after sending
            autoResizeTextarea(); // Reset height
        }
    });
});

// Sidebar toggle button logic
const sidebar = document.getElementById('sidebar');
const toggleBtn = document.getElementById('toggle-sidebar');
const content = document.getElementById('my-content');

toggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    content.classList.toggle('collapsed-sidebar');

    // Optional: Change button text/icon for better UX
    if (sidebar.classList.contains('collapsed')) {
        toggleBtn.textContent = '☰'; // Icon for "expand"
    } else {
        toggleBtn.textContent = '≣'; // Icon for "collapse"
    }
});


// Fetch courses from the server
fetch('/get-courses')
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Populate both dropdowns with the same course options
            data.courses.forEach(course => {
                displayCourses(course)
            });
        } else {
            console.error(data.message);
        }
    })
    .catch(error => console.error('Error fetching courses:', error));

// Display courses in sidebar
function displayCourses(course) {
    const courseBtn = document.createElement('a');
    courseBtn.className = 'block p-3 rounded hover:bg-gray-200 bg-gray-100 message-container';
    courseBtn.href = `?chat_id=${course.id}`;

    // Name of Course
    const courseName = document.createElement('div');
    courseName.className = 'font-medium truncate';
    courseName.textContent = course.name;

    courseBtn.appendChild(courseName);


    // Most Recent Message
    const mostRecentMessage = document.createElement('div');
    mostRecentMessage.className = 'text-xs text-gray-500 truncate';
    mostRecentMessage.textContent = 'TODO: mostRecentMessage';

    courseBtn.appendChild(mostRecentMessage);


    // Combine
    chatDiv.appendChild(courseBtn);
}


// // Fetch messages from the server
// fetch('/get-messages')
//     .then(response => response.json())
//     .then(data => {
//         if (data.success) {
//             // Populate both dropdowns with the same course options
//             data.courses.forEach(message => {
//                 displayMessages(message)
//             });
//         } else {
//             console.error(data.message);
//         }
//     })
//     .catch(error => console.error('Error fetching messages:', error));

// // Display messages in chat area
// function displayMessages(message) {
//     const message = document.createElement('div');
//     courseBtn.className = 'block p-3 rounded hover:bg-gray-200 bg-gray-100 message-container';
//     courseBtn.href = `?chat_id=${course.id}`;

//     // Name of Course
//     const courseName = document.createElement('div');
//     courseName.className = 'font-medium truncate';
//     courseName.textContent = course.name;

//     courseBtn.appendChild(courseName);


//     // Most Recent Message
//     const mostRecentMessage = document.createElement('div');
//     mostRecentMessage.className = 'text-xs text-gray-500 truncate';
//     mostRecentMessage.textContent = 'TODO: mostRecentMessage';

//     courseBtn.appendChild(mostRecentMessage);


//     // Combine
//     chatDiv.appendChild(courseBtn);
// }