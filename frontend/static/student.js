const FLASK_API = "http://localhost:5000";
const chatDiv = document.getElementById('chat-div');

window.onload = function() {
      const scrollable = document.getElementById('conversation');
      scrollable.scrollTop = scrollable.scrollHeight;
    };


// Existing question submission functionality
// TODO: find a way to get the course from the database to fix
function askQuestion(selectedCourseName) {
    const question = document.getElementById('student-question').value;

    fetch(`${FLASK_API}/ask-question`, {
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

    // Global variables defined in PHP
    console.log(currentCourseName); // Should show course name in browser console
    console.log(currentChatId);     // Should show chatId


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
            askQuestion(currentCourseName); // Submit question to AI Tutor
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

// TODO: Change the way different courses are sorted (fix and implement with new db when ready)
document.getElementById('sort-by-btn').addEventListener('change', function () {
    const sortBy = this.value;
    
    fetch(`get_sorted_chats.php?sortBy=${sortBy}`)
        .then(response => response.json())
        .then(data => {
            const chatDiv = document.getElementById('chat-div');
            chatDiv.innerHTML = ''; // Clear current list

            data.forEach(chat => {
                const a = document.createElement('a');
                a.href = `?chatId=${chat.chatId}`;
                a.className = 'block p-3 rounded bg-gray-100 message-container';

                const title = document.createElement('div');
                title.className = 'font-medium truncate';
                title.textContent = chat.courseName;

                a.appendChild(title);

                if (chat.answer) {
                    const subtitle = document.createElement('div');
                    subtitle.className = 'text-xs text-gray-500 truncate';
                    subtitle.textContent = chat.answer;
                    a.appendChild(subtitle);
                }

                chatDiv.appendChild(a);
            });
        })
        .catch(error => {
            console.error('Error fetching chats:', error);
        });
});
