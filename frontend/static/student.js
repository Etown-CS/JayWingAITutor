const FLASK_API = "http://localhost:5000";
const chatDiv = document.getElementById('chat-div');

window.onload = scrollToBottom();

function scrollToBottom() {
    const scrollable = document.getElementById('conversation');
    if (scrollable) {
        scrollable.scrollTop = scrollable.scrollHeight;
    }
}

function archiveCourse(userCoursesId) {
    // if (!confirm("Are you sure you want to archive this course?")) return; // Removed confirmation dialog for simplicity

    fetch('../backend/api/archive_courses.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'archive', userCoursesId: userCoursesId })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Remove the archived course from UI
            const chatItem = document.querySelector(`[onclick="archiveCourse(${userCoursesId})"]`).closest('.relative');
            if (chatItem) chatItem.remove();
        } else {
            alert("Error: " + data.message);
        }
    })
    .catch(error => {
        console.error("Error:", error);
        alert("An unexpected error occurred.");
    });
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

function addTypingIndicator() {
    const chatLocationDiv = document.getElementById('chat-locaction');

    const typingDiv = document.createElement('div');
    typingDiv.className = "flex py-2 justify-start";

    const bubble = document.createElement('div');
    bubble.className = "max-w-2xl bg-gray-100 text-gray-900 rounded-lg p-2";

    const from = document.createElement('div');
    from.className = "text-sm font-medium";
    from.textContent = "AI Tutor";

    const dotsContainer = document.createElement('div');
    dotsContainer.className = "typing-dots mt-1"; // Class for animation

    // Add 3 dots
    for (let i = 0; i < 3; i++) {
        const dot = document.createElement('span');
        dotsContainer.appendChild(dot);
    }

    bubble.appendChild(from);
    bubble.appendChild(dotsContainer);
    typingDiv.appendChild(bubble);

    chatLocationDiv.appendChild(typingDiv);

    scrollToBottom();
    return typingDiv; // Return the reference for removal
}

// Existing question submission functionality
let typingIndicatorElement = null;
function askQuestion(selectedCourseName) {
    const question = document.getElementById('student-question').value;
    updateConversationUser(question);

    typingIndicatorElement = addTypingIndicator();

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
                // Remove typing indicator
                if (typingIndicatorElement) {
                    typingIndicatorElement.remove();
                    typingIndicatorElement = null;
                }

                // Update conversation with AI response
                updateConversationAI(data.response, data.sourceName, selectedCourseName);
            } else {
                console.error("Error in response:", data.message);
                // Remove typing indicator
                if (typingIndicatorElement) {
                    typingIndicatorElement.remove();
                    typingIndicatorElement = null;
                }
            }
        })
        .catch(err => {
            console.error("Error:", err);
            // Remove typing indicator
            if (typingIndicatorElement) {
                typingIndicatorElement.remove();
                typingIndicatorElement = null;
            }
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
    newMessageText.innerHTML = text;
    newMessageText.className = "ai-message-content";

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
const archiveButton = document.getElementById('archive-button');


if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
        console.log("Toggle button clicked!");
        sidebar.classList.toggle('collapsed');
        content.classList.toggle('collapsed-sidebar');
        archiveButton.style.display = archiveButton.style.display === 'none' ? '' : 'none'; // For some reason this was more complicated that others
        console.log("Sidebar classes:", sidebar.classList);
        console.log("Content classes:", content.classList);
        console.log("Archive button classes:", archiveButton.classList);
    });
}

// Archive button logic
const archiveModal = document.getElementById('archive-modal');
const closeModalBtn = document.getElementById('close-archive-modal');
const coursesList = document.getElementById('archived-courses-list');

archiveButton.addEventListener('click', () => {
    fetch('../backend/api/archive_courses.php?action=get')
        .then(res => res.json())
        .then(data => {
            const list = document.getElementById('archived-courses-list');
            list.innerHTML = '';

            if (data.length === 0) {
                list.innerHTML = '<p class="text-gray-600">No archived courses.</p>';
            } else {
                data.forEach(course => {
                    const div = document.createElement('div');
                    div.className = 'p-2 border border-gray-200 rounded hover:bg-gray-50 flex justify-between items-center';
                    const courseName = document.createElement('span');
                    courseName.textContent = course.name;

                    // Restore button
                    const restoreButton = document.createElement('button');
                    restoreButton.textContent = 'Restore';
                    restoreButton.className = 'bg-blue-500 hover:bg-blue-600 text-white text-sm px-3 py-1 rounded';
                    restoreButton.onclick = () => {
                        fetch('../backend/api/archive_courses.php', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'restore', courseName: course.name})
                        })
                        .then(res => res.json())
                        .then(data => {
                            if (data.success) {
                                div.remove();

                                const sidebar = document.getElementById('chat-div');
                                const newCourse = document.createElement('div');
                                newCourse.className = 'relative group bg-gray-100 p-3 rounded w-full overflow-hidden hover:bg-gray-250';

                                // Get the current sortBy value from the URL, fallback to 'sortRecent'
                                const urlParams = new URLSearchParams(window.location.search);
                                const currentSort = urlParams.get('sortBy') || 'sortRecent';

                                const link = document.createElement('a');
                                link.className = 'block w-full';
                                link.href = `?chatId=${data.userCoursesId}&sortBy=${encodeURIComponent(currentSort)}`;

                                const courseTitle = document.createElement('div');
                                courseTitle.className = 'font-medium truncate';
                                courseTitle.textContent = data.courseName;

                                const courseDesc = document.createElement('div');
                                courseDesc.className = 'text-xs text-gray-500 truncate';
                                courseDesc.textContent = data.latestMessage || "No messages yet";

                                link.appendChild(courseTitle);
                                link.appendChild(courseDesc);

                                const archiveBtn = document.createElement('div');
                                archiveBtn.className = 'hover-child archive-icon-button absolute top-2 right-2 w-4 h-4 opacity-0 group-hover:opacity-100 cursor-pointer transition-all';
                                archiveBtn.setAttribute('onclick', `archiveCourse(${data.userCoursesId})`);

                                newCourse.appendChild(link);
                                newCourse.appendChild(archiveBtn);
                                sidebar.prepend(newCourse);
                            } else {
                                alert('Failed to restore course.');
                            }
                        })
                        .catch(err => {
                            console.error('Restore error:', err);
                            alert('An error occurred.');
                        });
                    };

                    div.appendChild(courseName);
                    div.appendChild(restoreButton);
                    list.appendChild(div);

                });
            }

            document.getElementById('archive-modal').classList.remove('hidden');
        })
        .catch(err => {
            console.error(err);
            document.getElementById('archived-courses-list').innerHTML =
                '<p class="text-red-600">Failed to load courses.</p>';
            document.getElementById('archive-modal').classList.remove('hidden');
        });
});
// Click 'X' to close
closeModalBtn.addEventListener('click', () => {
    archiveModal.classList.add('hidden');
});

// Click outside modal to close
archiveModal.addEventListener('click', (e) => {
    if (e.target === archiveModal) {
        archiveModal.classList.add('hidden');
    }
});


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
    
    // Check if the element is scrollable (scrollHeight > clientHeight)
    const hasScrollbar = conversation.scrollHeight > conversation.clientHeight;

    // Toggle a class or set style directly
    if (hasScrollbar) {
        conversation.classList.add('p-chat-scroll');
        conversation.classList.remove('p-chat-noshow');
    } else {
        conversation.classList.remove('p-chat-scroll');
        conversation.classList.add('p-chat-noshow');
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