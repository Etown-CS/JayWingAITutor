const FLASK_API = "http://localhost:5000";
const chatDiv = document.getElementById('chat-div');

window.onload = function() {
    const scrollable = document.getElementById('conversation');
    if (scrollable) {
        scrollable.scrollTop = scrollable.scrollHeight;
    }
};



// Existing question submission functionality
// TODO: find a way to get the course from the database to fix
function askQuestion(selectedCourseName) {
    const question = document.getElementById('student-question').value;
    updateConversation(question, 0);

    fetch(`${FLASK_API}/ask-question`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-User-Id': userId,
            'X-User-Role': userRole, // defaults to 'student' in app.py
            'X-Username': username
        },
        body: JSON.stringify({
            question: question,
            courseName: selectedCourseName,
        }),
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                if (data.sourceName) {
                    updateConversationSources(data.response, data.sourceName);
                }
                else {
                    updateConversation(data.response, 1);
                }
            } else {
                console.error("Error in response:", data.message);
            }
        })
        .catch(err => {
            console.error("Error:", err);
        });
};

function updateConversation(text, role) {
    const chatLocactionDiv = document.getElementById('chat-locaction');

    const newMessageAlignment = document.createElement('div');
    if (role == 0) { newMessageAlignment.className = "flex py-2 justify-end"; }
    else { newMessageAlignment.className = "flex py-2 justify-start"; }
    
    const newMessageBubble = document.createElement('div');
    if (role == 0) { newMessageBubble.className = "max-w-2xl bg-blue-500 text-white rounded-lg p-2"; }
    else { newMessageBubble.className = "max-w-2xl bg-gray-100 text-gray-900 rounded-lg p-2"; }


    const newMessageFrom = document.createElement('div');
    newMessageFrom.className = "text-sm font-medium";
    if (role == 0) { newMessageFrom.textContent = "You"; }
    else { newMessageFrom.textContent = "AI Tutor"; }

    const newMessageText = document.createElement('div');
    newMessageText.textContent = text;

    newMessageBubble.appendChild(newMessageFrom);
    newMessageBubble.appendChild(newMessageText);

    newMessageAlignment.appendChild(newMessageBubble);

    chatLocactionDiv.appendChild(newMessageAlignment);
}

function updateConversationSources(text, sourceName) {
    const chatLocactionDiv = document.getElementById('chat-locaction');

    const newMessageAlignment = document.createElement('div');
    newMessageAlignment.className = "flex py-2 justify-start";

    const newMessageBubble = document.createElement('div');
    newMessageBubble.className = "max-w-2xl bg-gray-100 text-gray-900 rounded-lg p-2";

    const newMessageFrom = document.createElement('div');
    newMessageFrom.className = "text-sm font-medium";
    newMessageFrom.textContent = "AI Tutor";

    const newMessageText = document.createElement('div');
    newMessageText.textContent = tutorResponse;

    const newMessageSource = document.createElement('div');
    newMessageSource.className = "text-xs text-gray-200 mt-1";
    newMessageSource.textContent = "Source: " + sourceName;

    newMessageBubble.appendChild(newMessageFrom);
    newMessageBubble.appendChild(newMessageText);
    newMessageBubble.appendChild(newMessageSource);

    newMessageAlignment.appendChild(newMessageBubble);

    chatLocactionDiv.appendChild(newMessageAlignment);
}

// Text area expands with text when typed
document.addEventListener('DOMContentLoaded', () => {
    const textarea = document.getElementById('student-question');
    const form = document.forms.messageForm; // Or document.querySelector('form[name="messageForm"]');

    // Global variables defined in PHP
    // console.log(currentCourseName); // Should show course name in browser console
    // console.log(currentChatId);     // Should show chatId

    if (textarea) {
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
            textarea.value = ''; // Clear textarea after sending
            autoResizeTextarea(); // Reset height
        }
    });
}
});

// Sidebar toggle button logic
const sidebar = document.getElementById('sidebar');
const toggleBtn = document.getElementById('toggle-sidebar');
const content = document.getElementById('my-content');

if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
        console.log("Toggle button clicked!");
        sidebar.classList.toggle('collapsed');
        content.classList.toggle('collapsed-sidebar');
        console.log("Sidebar classes:", sidebar.classList);
        console.log("Content classes:", content.classList);
    });
}


// TODO: Change the way different courses are sorted (fix and implement with new db when ready)
document.getElementById('sort-by-btn').addEventListener('change', function () {
    const sortBy = this.value;
    const urlParams = new URLSearchParams(window.location.search);
    
    // Preserve current chatId if it exists
    const chatId = urlParams.get('chatId');
    let newUrl = '?sortBy=' + encodeURIComponent(sortBy);
    if (chatId) {
        newUrl += '&chatId=' + encodeURIComponent(chatId);
    }

    window.location.href = newUrl; // Force reload with new sorting
});


// Pre-select the sort option based on the URL
window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const selectedSort = urlParams.get('sortBy') || 'sortRecent';
    document.getElementById('sort-by-btn').value = selectedSort;
});