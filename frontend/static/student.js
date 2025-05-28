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
    console.log("Toggle button clicked!");
    sidebar.classList.toggle('collapsed');
    content.classList.toggle('collapsed-sidebar');
    console.log("Sidebar classes:", sidebar.classList);
    console.log("Content classes:", content.classList);

});