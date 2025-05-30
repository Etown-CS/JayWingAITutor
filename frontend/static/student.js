const FLASK_API = "http://localhost:5000";
const chatDiv = document.getElementById('chat-div');

window.onload = scrollToBottom();

function scrollToBottom() {
    const scrollable = document.getElementById('conversation');
    if (scrollable) {
        scrollable.scrollTop = scrollable.scrollHeight;
    }
}

function filterChats() {
    const query = document.getElementById('searchBar').value.toLowerCase();
    const chatLinks = document.querySelectorAll('#chat-div a');
    let anyVisible = false;

    chatLinks.forEach(link => {
        const text = link.querySelector('.font-medium')?.innerText.toLowerCase() || "";
        if (text.includes(query)) {
            link.style.display = 'block';
            anyVisible = true;
        } else {
            link.style.display = 'none';
        }
    });

    const noResultsMsg = document.getElementById('noResultsMsg');
    if (!noResultsMsg && !anyVisible) {
        const msg = document.createElement('div');
        msg.id = 'noResultsMsg';
        msg.className = 'text-center text-muted mt-3';
        msg.innerText = 'No chats found.';
        document.getElementById('chat-div').appendChild(msg);
    } else if (noResultsMsg && anyVisible) {
        noResultsMsg.remove();
    }
}

// Existing question submission functionality
// TODO: find a way to get the course from the database to fix
function askQuestion(selectedCourseName) {
    const question = document.getElementById('student-question').value;
    updateConversationUser(question);

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
                updateConversationAI(data.response, data.sourceName, selectedCourseName);
            } else {
                console.error("Error in response:", data.message);
            }
        })
        .catch(err => {
            console.error("Error:", err);
        });
};

function updateConversationUser(text) {
    const chatLocactionDiv = document.getElementById('chat-locaction');

    const newMessageAlignment = document.createElement('div');
    newMessageAlignment.className = "flex py-2 justify-end";
    
    const newMessageBubble = document.createElement('div');
    newMessageBubble.className = "max-w-2xl bg-blue-500 text-white rounded-lg p-2";

    const newMessageFrom = document.createElement('div');
    newMessageFrom.className = "text-sm font-medium";
    newMessageFrom.textContent = "You";

    const newMessageText = document.createElement('div');
    newMessageText.textContent = text;

    newMessageBubble.appendChild(newMessageFrom);
    newMessageBubble.appendChild(newMessageText);

    newMessageAlignment.appendChild(newMessageBubble);

    chatLocactionDiv.appendChild(newMessageAlignment);

    scrollToBottom();
}

function updateConversationAI(text, sourceName, selectedCourseName) {
    const chatLocactionDiv = document.getElementById('chat-locaction');

    const newMessageAlignment = document.createElement('div');
    newMessageAlignment.className = "flex py-2 justify-start";

    const newMessageBubble = document.createElement('div');
    newMessageBubble.className = "max-w-2xl bg-gray-100 text-gray-900 rounded-lg p-2";

    const newMessageFrom = document.createElement('div');
    newMessageFrom.className = "text-sm font-medium";
    newMessageFrom.textContent = "AI Tutor";

    const newMessageText = document.createElement('div');
    const lines = text.split('\n');
    lines.forEach((line, i) => {
    newMessageText.appendChild(document.createTextNode(line));
    if (i < lines.length - 1) {
        newMessageText.appendChild(document.createElement('br'));
    }
    });

    newMessageBubble.appendChild(newMessageFrom);
    newMessageBubble.appendChild(newMessageText);

    if (sourceName !== "No sources found") {
        const newMessageSource = document.createElement('div');
        newMessageSource.className = "text-xs mt-1";
        newMessageSource.textContent = "Source: ";
        
        const sources = sourceName.split(', ').map(s => s.trim()).filter(Boolean);
        sources.forEach((fileName, index) => {
            const link = document.createElement('a');
            link.href = `${FLASK_API}/download?file=${encodeURIComponent(fileName)}&course=${encodeURIComponent(selectedCourseName)}`;
            link.title = "Download file";
            link.setAttribute('download', fileName);
            link.textContent = fileName;
            link.className = "underline text-blue-600 hover:text-blue-800";

            newMessageSource.appendChild(link);

            // Add comma and space if not the last link
            if (index < sources.length - 1) {
                newMessageSource.appendChild(document.createTextNode(", "));
            }
        });
        newMessageBubble.appendChild(newMessageSource);
    }

    newMessageAlignment.appendChild(newMessageBubble);

    chatLocactionDiv.appendChild(newMessageAlignment);

    scrollToBottom();
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


// Change the way different courses are sorted
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

function adjustConversationPadding() {
    const conversation = document.getElementById('conversation');
    const messageInput = document.getElementById('message-input');
    
    // Check if the element is scrollable (scrollHeight > clientHeight)
    const hasScrollbar = conversation.scrollHeight > conversation.clientHeight;

    // Toggle a class or set style directly
    if (hasScrollbar) {
        messageInput.classList.add('p-chat-scroll');
        messageInput.classList.remove('p-chat-noshow');
    } else {
        messageInput.classList.remove('p-chat-scroll');
        messageInput.classList.add('p-chat-noshow');
    }
}

// Run on page load
window.addEventListener('load', adjustConversationPadding);
// Run on resize
window.addEventListener('resize', adjustConversationPadding);

function adjustSidebarCoursesPadding() {
    const sidebarCourses = document.getElementById('sidebar-courses');
    
    // Check if the element is scrollable (scrollHeight > clientHeight)
    const hasScrollbar = sidebarCourses.scrollHeight > sidebarCourses.clientHeight;

    // Toggle a class or set style directly
    if (hasScrollbar) {
        sidebarCourses.classList.add('p-sidebar-scroll');
        sidebarCourses.classList.remove('p-sidebar-noshow');
    } else {
        sidebarCourses.classList.remove('p-sidebar-scroll');
        sidebarCourses.classList.add('p-sidebar-noshow');
    }
}

// Run on page load
window.addEventListener('load', adjustSidebarCoursesPadding);
// Run on resize
window.addEventListener('resize', adjustSidebarCoursesPadding);