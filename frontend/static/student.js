// currentChatId is set in the HTML template - easy access here
const FLASK_API = "http://localhost:5000";
const chatDiv = document.getElementById('chat-div');
generating = false; // Flag to prevent multiple fetches at once

// Predetermined prompts
const simplifyPrompt = "Explain this in simpler terms so a beginner can understand. Avoid jargon and break it down step by step if needed: ";
const explainPrompt = "Explain this in more depth, going beyond the surface level details. Explore the reasoning behind this: ";
const examplesPrompt = "Give two or three clear, concise examples to illustrate this concept. Use simple language and varied scenarios if possible. Make the examples real-world relevant and related to my interests (if available): ";

window.onload = scrollToBottom();

function scrollToBottom() {
    const scrollable = document.getElementById('conversation');
    if (scrollable) {
        scrollable.scrollTop = scrollable.scrollHeight;
    }
}

// Home Button
document.getElementById('home').addEventListener('click', function () {
    const currentPath = window.location.pathname;
    const query = window.location.search;

    // Find everything after '/frontend/' in the pathname
    const match = currentPath.match(/\/frontend\/(.+)$/);
    if (match) {
        const relativePath = match[1] + query;
        window.location.href = '/jaywingaitutor/frontend/';
    }
});

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

            // If this was the currently selected chat, redirect to blank view
            if (typeof currentChatId !== 'undefined' && userCoursesId == currentChatId) {
                // Redirect to the same page without the chatId
                const urlParams = new URLSearchParams(window.location.search);
                if (urlParams.has('chatId')) {
                    // Remove chatId from URL
                    urlParams.delete('chatId');
                    window.location.href = `${window.location.pathname}?${urlParams.toString()}`;
                }
            }
        } else {
            alert("Error: " + data.message);
        }
    })
    .catch(error => {
        console.error("Error:", error);
        alert("An unexpected error occurred.");
    });
}

function levenshtein(a, b) {
    const matrix = Array.from({ length: a.length + 1 }, () =>
        Array(b.length + 1).fill(0)
    );

    for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,      // deletion
                matrix[i][j - 1] + 1,      // insertion
                matrix[i - 1][j - 1] + cost // substitution
            );
        }
    }

    return matrix[a.length][b.length];
}

function fuzzyIncludes(full, input) {
    full = full.toLowerCase();
    input = input.toLowerCase();

    // If exact substring match, return true immediately
    if (full.includes(input)) return true;

    // Slide input window across full text
    for (let i = 0; i <= full.length - input.length; i++) {
        const chunk = full.slice(i, i + input.length);
        const dist = levenshtein(chunk, input);
        if (dist <= 1) return true; // Controls amount of typos allowed
    }

    return false;
}


function filterChats() {
    const query = document.getElementById('searchBar').value.toLowerCase();
    const chatCards = document.querySelectorAll('#chat-div .group');
    let anyVisible = false;

    chatCards.forEach(card => {
        const text = card.querySelector('.font-medium')?.innerText.toLowerCase() || "";
        if (fuzzyIncludes(text, query)) {
            card.style.display = 'block';
            anyVisible = true;
        } else {
            card.style.display = 'none';
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
    const chatLocationDiv = document.getElementById('chat-location');

    const typingDiv = document.createElement('div');
    typingDiv.className = "flex py-2 justify-start";

    const bubble = document.createElement('div');
    bubble.className = "max-w-3xl bg-gray-100 text-gray-900 rounded-lg p-2";

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

let typingIndicatorElement = null;
function askQuestion(chatId) {
    if (generating) {
        alert("Please wait for the current response to finish.");
        return;
    }
    generating = true;
    const question = document.getElementById('student-question').value;
    updateConversationUser(question);

    const sendButton = document.getElementById('send-button');
    const sendCircle = document.getElementById('send-circle');
    const sendIcon = document.getElementById('send-icon');
    sendButton.disabled = true; // disable button
    sendCircle.classList.add('bg-blue-600', 'text-white'); 
    sendIcon.className = "fas fa-square"; // disable icon

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
            chatId: chatId,
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
                updateConversationAI(data.response, data.sourceName, currentCourseName, data.messageId);

                // Reset send button
                sendCircle.classList.remove('bg-blue-600', 'text-white');
                sendIcon.className = "fas fa-arrow-up"; // send icon
                sendButton.disabled = false; // disable button
            } else {
                console.error("Error in response:", data.message);
                // Remove typing indicator
                if (typingIndicatorElement) {
                    typingIndicatorElement.remove();
                    typingIndicatorElement = null;
                }

                // Reset send button
                sendCircle.classList.remove('bg-blue-600', 'text-white');
                sendIcon.className = "fas fa-arrow-up"; // send icon
                sendButton.disabled = false; // disable button
            }
        })
        .catch(err => {
            console.error("Error:", err);
            // Remove typing indicator
            if (typingIndicatorElement) {
                typingIndicatorElement.remove();
                typingIndicatorElement = null;
            }

            // Reset send button
            sendCircle.classList.remove('bg-blue-600', 'text-white');
            sendIcon.className = "fas fa-arrow-up"; // send icon
            sendButton.disabled = false; // disable button
        })
        .finally(() => {
            generating = false; // Reset generating flag after fetch completes
        });
};

// Ask a preset question
function askPresetQuestion(chatId, question, answer) {
    if (generating) {
        alert("Please wait for the current response to finish.");
        return;
    }
    generating = true;
    console.log("Asking preset question:", question);

    // TODO: Formatting the question - Make the second part italic
    // This is commented out because I was afraid of breaking more imporant functionality
    // Split question on the first ":"
    // const parts = question.split(/:(.+)/); // Regex to split on the first colon
    // // Trim whitespace from both parts
    // parts[0] = parts[0].trim();
    // parts[1] = parts[1] ? parts[1].trim() : ""; // Handle case where there's no second part
    // console.log("Part 1:", parts[0]);

    // // Make second part italic
    // if (parts[1]) {
    //     parts[1] = `<em>${parts[1]}</em>`;
    // }
    // console.log("Part 2:", parts[1]);
    // // Join parts back together
    // question = parts.join(": ");
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
            answer: answer,
            chatId: chatId
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
                updateConversationAI(data.response, data.sourceName, currentCourseName, data.messageId);
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
        })
        .finally(() => {
            generating = false; // Reset generating flag after fetch completes
        });
};


function updateConversationUser(text) {
    // Check for preset question

    const chatlocationDiv = document.getElementById('chat-location');

    const newMessageAlignment = document.createElement('div');
    newMessageAlignment.className = "flex py-2 justify-end";
    
    const newMessageBubble = document.createElement('div');
    newMessageBubble.className = "max-w-3xl bg-blue-500 text-white rounded-lg p-2";

    const newMessageFrom = document.createElement('div');
    newMessageFrom.className = "text-sm font-medium";
    newMessageFrom.textContent = "You";

    const newMessageText = document.createElement('div');
    newMessageText.textContent = text;

    newMessageBubble.appendChild(newMessageFrom);
    newMessageBubble.appendChild(newMessageText);

    newMessageAlignment.appendChild(newMessageBubble);

    chatlocationDiv.appendChild(newMessageAlignment);

    scrollToBottom();
}

function updateConversationAI(text, sourceName, currentCourseName, messageId) {
    const chatlocationDiv = document.getElementById('chat-location');

    const newMessageAlignment = document.createElement('div');
    newMessageAlignment.className = "flex py-2 justify-start";

    const newMessageBubble = document.createElement('div');
    newMessageBubble.className = "max-w-3xl bg-gray-100 text-gray-900 rounded-lg p-2";

    const newMessageFrom = document.createElement('div');
    newMessageFrom.className = "text-sm font-medium";
    newMessageFrom.textContent = "AI Tutor";

    const newMessageText = document.createElement('div');
    newMessageText.innerHTML = text;
    newMessageText.className = "ai-message-content";

    // Append basic message content
    newMessageBubble.appendChild(newMessageFrom);
    newMessageBubble.appendChild(newMessageText);

    // Optional source links
    if (sourceName !== "") {
        const newMessageSource = document.createElement('div');
        newMessageSource.className = "text-xs mt-1";
        newMessageSource.textContent = "Source: ";

        const sources = sourceName.split(', ').map(s => s.trim()).filter(Boolean);
        sources.forEach((fileName, index) => {
            const link = document.createElement('a');
            link.href = `${FLASK_API}/download?file=${encodeURIComponent(fileName)}&chatId=${encodeURIComponent(currentChatId)}`;
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

    // Button row
    const buttonRow = document.createElement('div');
    buttonRow.className = "flex flex-wrap gap-2 mt-2 text-xs text-gray-600";
    
    const thumbsUpBtn = document.createElement('button');
    thumbsUpBtn.textContent = "👍";
    thumbsUpBtn.title = "This response was helpful";
    thumbsUpBtn.className = "px-2 py-1 text-xs rounded hover:bg-green-100 transition-colors duration-150";

    const thumbsDownBtn = document.createElement('button');
    thumbsDownBtn.textContent = "👎";
    thumbsDownBtn.title = "This response was not helpful";
    thumbsDownBtn.className = "px-2 py-1 text-xs rounded hover:bg-red-100 transition-colors duration-150";

    const buttonSubRow = document.createElement('div');
    buttonSubRow.className = "flex gap-2 w-full md:w-auto";

    const simplifyBtn = document.createElement('button');
    simplifyBtn.textContent = "Simplify";
    simplifyBtn.title = "Simplify this response";
    simplifyBtn.className = "simplify px-2 py-1 text-xs text-gray-600 rounded hover:text-blue-600 hover:bg-blue-100 transition-colors duration-150";

    const examplesBtn = document.createElement('button');
    examplesBtn.textContent = "Examples";
    examplesBtn.title = "Get more examples";
    examplesBtn.className = "examples px-2 py-1 text-xs text-gray-600 rounded hover:text-blue-600 hover:bg-blue-100 transition-colors duration-150";

    const explainBtn = document.createElement('button');
    explainBtn.textContent = "Explain";
    explainBtn.title = "Get a deeper explanation";
    explainBtn.className = "explain px-2 py-1 text-xs text-gray-600 rounded hover:text-blue-600 hover:bg-blue-100 transition-colors duration-150";

    // Button event listeners
    thumbsUpBtn.onclick = () => {
        const isSelected = thumbsUpBtn.classList.contains('bg-green-600');

        // Reset both buttons
        thumbsUpBtn.classList.remove('bg-green-600', 'hover:bg-green-700', 'rounded-full');
        thumbsDownBtn.classList.remove('bg-red-600', 'hover:bg-red-700', 'rounded-full');
        thumbsDownBtn.classList.add('hover:bg-red-100');

        if (!isSelected) {
            // Activate thumbs up
            thumbsUpBtn.classList.add('bg-green-600', 'hover:bg-green-700', 'rounded-full');
            thumbsUpBtn.classList.remove('hover:bg-green-100');

            // Store feedback
            storeFeedback(messageId, 'up');
        } else {
            // Reset hover if unselected
            thumbsUpBtn.classList.add('hover:bg-green-100');

            // Store feedback
            storeFeedback(messageId, null);

            // Set feedback banner to hidden
            const banner = document.getElementById('feedback-banner');
            if (banner) {
                banner.classList.add('hidden');
            }
        }
    };

    thumbsDownBtn.onclick = () => {
        const isSelected = thumbsDownBtn.classList.contains('bg-red-600');

        // Reset both buttons
        thumbsDownBtn.classList.remove('bg-red-600', 'hover:bg-red-700', 'rounded-full');
        thumbsUpBtn.classList.remove('bg-green-600', 'hover:bg-green-700', 'rounded-full');
        thumbsUpBtn.classList.add('hover:bg-green-100');

        if (!isSelected) {
            // Activate thumbs down
            thumbsDownBtn.classList.add('bg-red-600', 'hover:bg-red-700', 'rounded-full');
            thumbsDownBtn.classList.remove('hover:bg-red-100');

            // Store feedback
            storeFeedback(messageId, 'down');
        } else {
            // Reset hover if unselected
            thumbsDownBtn.classList.add('hover:bg-red-100');

            // Store feedback
            storeFeedback(messageId, null);

            // Set feedback banner to hidden
            const banner = document.getElementById('feedback-banner');
            if (banner) {
                banner.classList.add('hidden');
            }
        }
    };

    simplifyBtn.onclick = async () => {
        try {
            const messageData = await getMessageContent(messageId);
            [, , question, answer] = messageData;
            // Check if this question is the result of a previous simplify request
            if (question.startsWith(simplifyPrompt)) {
                // If it is, extract the original question
                const originalQuestion = question.slice(simplifyPrompt.length);
                question = originalQuestion; // Use the original question for the simplify request
            } else if (question.startsWith(examplesPrompt)) {
                // If it is, extract the original question
                const originalQuestion = question.slice(examplesPrompt.length);
                question = originalQuestion; // Use the original question for the simplify request
            } else if (question.startsWith(explainPrompt)) {
                // If it is, extract the original question
                const originalQuestion = question.slice(explainPrompt.length);
                question = originalQuestion; // Use the original question for the simplify request
            }
            const simplifyQuestion = simplifyPrompt + question;
            askPresetQuestion(currentChatId, simplifyQuestion, answer);
        } catch (error) {
            console.error("Error handling simplify click:", error);
        }
    };

    examplesBtn.onclick = async () => {
        try {
            const messageData = await getMessageContent(messageId);
            [, , question, answer] = messageData;
            // Check if this question is the result of a previous predetermined prompt request
            if (question.startsWith(examplesPrompt)) {
                // If it is, extract the original question
                const originalQuestion = question.slice(examplesPrompt.length);
                question = originalQuestion; // Use the original question for the examples request
            } else if (question.startsWith(explainPrompt)) {
                // If it is, extract the original question
                const originalQuestion = question.slice(explainPrompt.length);
                question = originalQuestion; // Use the original question for the examples request
            } else if (question.startsWith(simplifyPrompt)) {
                // If it is, extract the original question
                const originalQuestion = question.slice(simplifyPrompt.length);
                question = originalQuestion; // Use the original question for the examples request
            }
            const examplesQuestion = examplesPrompt + question;
            askPresetQuestion(currentChatId, examplesQuestion, answer);
        } catch (error) {
            console.error("Error handling examples click:", error);
        }
    };

    explainBtn.onclick = async () => {
        try {
            const messageData = await getMessageContent(messageId);
            [, , question, answer] = messageData;
            
            // Check if this question is the result of a previous explain request
            if (question.startsWith(explainPrompt)) {
                // If it is, extract the original question
                const originalQuestion = question.slice(explainPrompt.length);
                question = originalQuestion; // Use the original question for the explain request
            } else if (question.startsWith(examplesPrompt)) {
                // If it is, extract the original question
                const originalQuestion = question.slice(examplesPrompt.length);
                question = originalQuestion; // Use the original question for the explain request
            } else if (question.startsWith(simplifyPrompt)) {
                // If it is, extract the original question
                const originalQuestion = question.slice(simplifyPrompt.length);
                question = originalQuestion; // Use the original question for the explain request
            }
            const explainQuestion = explainPrompt + question;
            askPresetQuestion(currentChatId, explainQuestion, answer);
        } catch (error) {
            console.error("Error handling explain click:", error);
        }
    };


    // Append buttons
    buttonRow.appendChild(thumbsUpBtn);
    buttonRow.appendChild(thumbsDownBtn);
    buttonSubRow.appendChild(simplifyBtn);
    buttonSubRow.appendChild(examplesBtn);
    buttonSubRow.appendChild(explainBtn);
    buttonRow.appendChild(buttonSubRow);
    newMessageBubble.appendChild(buttonRow);

    // Finalize and attach to DOM
    newMessageAlignment.appendChild(newMessageBubble);
    chatlocationDiv.appendChild(newMessageAlignment);

    scrollToBottom();
}

function storeFeedback(messageId, feedback=null) {
    // Ask the user if they'd like to add a comment
    if (feedback) {
        showFeedbackBanner(messageId);
        fetch('../backend/api/feedback.php', {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messageId: messageId,
                feedbackRating: feedback,
                feedbackExplanation: null // Initially set to null, will be updated if user adds a comment
            })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                console.log("Feedback stored successfully!");
            } else {
                console.error("Error storing feedback:", data.message);
            }
        })
        .catch(err => {
            console.error("Error storing feedback:", err);
        });
    } else {
        // Delete feedback
        console.log("Removing feedback for messageId:", messageId);
        fetch('../backend/api/feedback.php', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messageId: messageId
            })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                console.log("Feedback removed successfully!");
            } else {
                console.error("Error removing feedback:", data.message);
            }
        })
        .catch(err => {
            console.error("Error removing feedback:", err);
        });
    }
}

function showFeedbackBanner(messageId) {
    const banner = document.getElementById('feedback-banner');
    const commentBtn = document.getElementById('add-comment-btn');

    if (!banner || !commentBtn) return;

    banner.classList.remove('hidden');

    const timeout = setTimeout(() => {
        banner.classList.add('hidden');
    }, 10000); // 10 seconds

    commentBtn.onclick = () => {
        clearTimeout(timeout); // prevent auto-hide if clicked
        const explanation = prompt("Enter your comment (optional):");
        banner.classList.add('hidden');

        if (explanation) {
            fetch('../backend/api/feedback.php', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    messageId: messageId,
                    feedbackRating: null, // Do not change rating
                    feedbackExplanation: explanation
                })
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    console.log("Comment saved!");
                }
            })
            .catch(err => console.error("Error saving comment:", err));
        }
    };
}

function showErrorBanner(message) {
    const banner = document.getElementById('error-banner');
    if (!banner) return;

    banner.textContent = message;
    banner.classList.remove('hidden');

    errorTimeoutId = setTimeout(() => {
        banner.classList.add('hidden');
        errorTimeoutId = null;
    }, 10000); // 10 seconds
}



document.addEventListener('DOMContentLoaded', () => {
    const textarea = document.getElementById('student-question');
    const form = document.forms.messageForm; // Or document.querySelector('form[name="messageForm"]');
    const sendButton = document.getElementById('send-button');


    // Prevent page refresh on form submission
    messageInput = document.getElementById('message-input')
    if (messageInput) {
        messageInput.addEventListener('submit', (e) => {
            e.preventDefault();
        });
    }

    // Text area expands with text when typed
    if (textarea) {
        function autoResizeTextarea() {
            const textarea = document.getElementById('student-question'); // Get the textarea element

            // Get the computed max-height of the textarea in pixels
            const computedStyle = getComputedStyle(textarea);
            const maxHeight = parseFloat(computedStyle.maxHeight); // Convert to number

            textarea.style.height = 'auto';
            textarea.style.height = textarea.scrollHeight + 'px';

            if (textarea.scrollHeight >= maxHeight) {
                textarea.classList.add('overflow-y-auto');
                // If content is still growing beyond maxHeight, cap the height
                textarea.style.height = maxHeight + 'px';
            } else {
                textarea.classList.remove('overflow-y-auto');
            }
        }

        // Attach the function to the input event of the textarea
        document.addEventListener('DOMContentLoaded', () => {
            const textarea = document.getElementById('student-question');
            if (textarea) {
                textarea.addEventListener('input', autoResizeTextarea);
                // Call it once on load in case there's pre-filled content
                autoResizeTextarea();
            }
        });

        // Adjust height on input (typing, pasting, cutting)
        textarea.addEventListener('input', autoResizeTextarea);

        // Initial resize in case there's pre-filled content
        autoResizeTextarea();

        // Enter to send, Shift+Enter for new line
        textarea.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                if (textarea.value.trim() === '') {
                    showErrorBanner('Please enter a question to ask the chatbot');
                    return;
                } else {
                    if (generating) {
                        alert("Please wait for the current response to finish.");
                        return;
                    }

                    const urlParams = new URLSearchParams(window.location.search);
                    askQuestion(urlParams.get('chatId'));
                    textarea.value = '';
                    autoResizeTextarea();
                }
            }
        });        
    }

    if (sendButton) {
        sendButton.addEventListener('click', (event) => {
            if (!textarea || textarea.value.trim() === '') {
                showErrorBanner('Please enter a question to ask the chatbot');
                return;
            }

            event.preventDefault();

            if (generating) {
                alert("Please wait for the current response to finish.");
                return;
            }

            const urlParams = new URLSearchParams(window.location.search);
            askQuestion(urlParams.get('chatId'));
            textarea.value = '';
            autoResizeTextarea();
        });
    }
    // Response Buttons Row Logic
    // Thumbs up/down button logic for each AI response
    const thumbsUpButtons = document.querySelectorAll('.thumbs-up');
    const thumbsDownButtons = document.querySelectorAll('.thumbs-down');
    const chatId = new URLSearchParams(window.location.search).get('chatId');

    thumbsUpButtons.forEach((thumbsUpBtn, index) => {
        const thumbsDownBtn = thumbsDownButtons[index];
        const messageId = thumbsUpBtn.dataset.messageId;

        thumbsUpBtn.addEventListener('click', () => {
            const isSelected = thumbsUpBtn.classList.contains('bg-green-600');

            // Reset both
            thumbsUpBtn.classList.remove('bg-green-600', 'hover:bg-green-700', 'rounded-full');
            thumbsDownBtn.classList.remove('bg-red-600', 'hover:bg-red-700', 'rounded-full');
            thumbsDownBtn.classList.add('hover:bg-red-100');

            if (!isSelected) {
                thumbsUpBtn.classList.add('bg-green-600', 'hover:bg-green-700', 'rounded-full');
                thumbsUpBtn.classList.remove('hover:bg-green-100');

                // Store feedback
                storeFeedback(messageId, 'up');
            } else {
                thumbsUpBtn.classList.add('hover:bg-green-100');

                // Store feedback
                storeFeedback(messageId, null);

                // Set feedback banner to hidden
                const banner = document.getElementById('feedback-banner');
                if (banner) {
                    banner.classList.add('hidden');
                }
            }
        });

        thumbsDownBtn.addEventListener('click', () => {
            const isSelected = thumbsDownBtn.classList.contains('bg-red-600');

            // Reset both
            thumbsDownBtn.classList.remove('bg-red-600', 'hover:bg-red-700', 'rounded-full');
            thumbsUpBtn.classList.remove('bg-green-600', 'hover:bg-green-700', 'rounded-full');
            thumbsUpBtn.classList.add('hover:bg-green-100');

            if (!isSelected) {
                thumbsDownBtn.classList.add('bg-red-600', 'hover:bg-red-700', 'rounded-full');
                thumbsDownBtn.classList.remove('hover:bg-red-100');

                // Store feedback
                storeFeedback(messageId, 'down');
            } else {
                thumbsDownBtn.classList.add('hover:bg-red-100');

                // Store feedback
                storeFeedback(messageId, null);

                // Set feedback banner to hidden
                const banner = document.getElementById('feedback-banner');
                if (banner) {
                    banner.classList.add('hidden');
                }
            }
        });
    });

    // Simplify button logic
    const simplifyButtons = document.querySelectorAll('.simplify');
    simplifyButtons.forEach(button => {
        button.addEventListener('click', async () => {
            const messageId = button.dataset.messageId;
            try {
                const messageData = await getMessageContent(messageId);
                [, , question, answer] = messageData;
                // Check if this question is the result of a previous simplify request
                if (question.startsWith(simplifyPrompt)) {
                    // If it is, extract the original question
                    const originalQuestion = question.slice(simplifyPrompt.length);
                    question = originalQuestion; // Use the original question for the simplify request
                } else if (question.startsWith(examplesPrompt)) {
                    // If it is, extract the original question
                    const originalQuestion = question.slice(examplesPrompt.length);
                    question = originalQuestion; // Use the original question for the simplify request
                } else if (question.startsWith(explainPrompt)) {
                    // If it is, extract the original question
                    const originalQuestion = question.slice(explainPrompt.length);
                    question = originalQuestion; // Use the original question for the simplify request
                }
                const simplifyQuestion = simplifyPrompt + question;
                askPresetQuestion(currentChatId, simplifyQuestion, answer);
            } catch (error) {
                console.error("Error handling simplify click:", error);
            }
        });
    });

    // Examples button logic
    const examplesButtons = document.querySelectorAll('.examples');
    examplesButtons.forEach(button => {
        button.addEventListener('click', async () => {
            const messageId = button.dataset.messageId;

            try {
                const messageData = await getMessageContent(messageId);
                [, , question, answer] = messageData;

                // Check if this question is the result of a previous examples request
                if (question.startsWith(examplesPrompt)) {
                    // If it is, extract the original question
                    const originalQuestion = question.slice(examplesPrompt.length);
                    question = originalQuestion; // Use the original question for the examples request
                } else if (question.startsWith(explainPrompt)) {
                    // If it is, extract the original question
                    const originalQuestion = question.slice(explainPrompt.length);
                    question = originalQuestion; // Use the original question for the examples request
                } else if (question.startsWith(simplifyPrompt)) {
                    // If it is, extract the original question
                    const originalQuestion = question.slice(simplifyPrompt.length);
                    question = originalQuestion; // Use the original question for the examples request
                }

                const examplesQuestion = examplesPrompt + question;
                askPresetQuestion(currentChatId, examplesQuestion, answer);
            } catch (error) {
                console.error("Error handling examples click:", error);
            }
        });
    });

    // Explain button logic
    const explainButtons = document.querySelectorAll('.explain');
    explainButtons.forEach(button => {
        button.addEventListener('click', async () => {
            const messageId = button.dataset.messageId;

            try {
                const messageData = await getMessageContent(messageId);
                [, , question, answer] = messageData;
                
                // Check if this question is the result of a previous predetermined prompt request
                if (question.startsWith(explainPrompt)) {
                    // If it is, extract the original question
                    const originalQuestion = question.slice(explainPrompt.length);
                    question = originalQuestion; // Use the original question for the explain request
                } else if (question.startsWith(examplesPrompt)) {
                    // If it is, extract the original question
                    const originalQuestion = question.slice(examplesPrompt.length);
                    question = originalQuestion; // Use the original question for the explain request
                } else if (question.startsWith(simplifyPrompt)) {
                    // If it is, extract the original question
                    const originalQuestion = question.slice(simplifyPrompt.length);
                    question = originalQuestion; // Use the original question for the explain request
                }

                const explainQuestion = explainPrompt + question;
                askPresetQuestion(currentChatId, explainQuestion, answer);
            } catch (error) {
                console.error("Error handling explain click:", error);
            }
        });
    });

});

async function getMessageContent(messageId) {
    try {
        const response = await fetch(`../backend/api/messages.php?messageId=${encodeURIComponent(messageId)}`, {
            method: 'getMessages',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        const data = await response.json();

        if (data.success) {
            const { userCoursesId, question, answer, timestamp, sourceName, feedbackRating, feedbackExplanation, feedbackTimestamp } = data.message;
            return [messageId, userCoursesId, question, answer, timestamp, sourceName, feedbackRating, feedbackExplanation, feedbackTimestamp];
        } else {
            throw new Error(data.message || "Message fetch unsuccessful");
        }
    } catch (err) {
        console.error("Error fetching message content:", err);
        throw err;
    }
}




// --------------------- Left Sidebar JavaScript ------------------------


const sidebar = document.getElementById('left-sidebar');
const toggleBtn = document.getElementById('toggle-left-sidebar');
const showBtnMobile = document.getElementById('show-left-sidebar-mobile');
const hideBtnMobile = document.getElementById('hide-left-sidebar-mobile');
const content = document.getElementById('my-content');
const chatContainer = document.getElementById('chat-container');
const archiveButton = document.getElementById('archive-button');

// Left Sidebar Button Toggle
if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
        console.log("Toggle button clicked!");
        sidebar.classList.toggle('collapsed');
        content.classList.toggle('left-collapsed');
        console.log("Left sidebar classes:", sidebar.classList);
        console.log("Content classes:", content.classList);
        console.log("Archive button classes:", archiveButton.classList);
    });
}

// Left Sidebar Button Show Mobile
if (showBtnMobile) {
    showBtnMobile.addEventListener('click', () => {
        console.log("Toggle button clicked!");
        sidebar.classList.toggle('collapsed');
        chatContainer.classList.toggle('hidden');
        sidebar.classList.toggle('hidden');
        if (hideLeftSidebar.classList.contains('hidden')) { hideLeftSidebar.classList.remove('hidden'); }
        console.log("Left sidebar classes:", sidebar.classList);
        console.log("Content classes:", content.classList);
        console.log("Archive button classes:", archiveButton.classList);
    });
}

// Left Sidebar Button Hide Mobile
if (hideBtnMobile) {
    hideBtnMobile.addEventListener('click', () => {
        console.log("Toggle button clicked!");
        sidebar.classList.toggle('collapsed');
        chatContainer.classList.toggle('hidden');
        sidebar.classList.toggle('hidden');
        console.log("Left sidebar classes:", sidebar.classList);
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


// --------------------- Right Sidebar JavaScript ------------------------


const rightSidebar = document.getElementById('right-sidebar');
const toggleRightBtn = document.getElementById('toggle-right-sidebar');
const showRightBtnMobile = document.getElementById('show-right-sidebar-mobile');
const hideRightBtnMobile = document.getElementById('hide-right-sidebar-mobile');

// Right Sidebar Button Toggle
if (toggleRightBtn) {
    toggleRightBtn.addEventListener('click', () => {
        console.log("Toggle button clicked!");
        rightSidebar.classList.toggle('collapsed');
        content.classList.toggle('right-collapsed');
        console.log("Right sidebar classes:", rightSidebar.classList);
        console.log("Content classes:", content.classList);
    });
}

// Right Sidebar Button Show Mobile
if (showRightBtnMobile) {
    showRightBtnMobile.addEventListener('click', () => {
        console.log("Toggle button clicked!");
        rightSidebar.classList.toggle('collapsed');
        chatContainer.classList.toggle('hidden');
        rightSidebar.classList.toggle('hidden');
        console.log("Right sidebar classes:", rightSidebar.classList);
        console.log("Content classes:", content.classList);
    });
}

// Right Sidebar Button Hide Mobile
if (hideRightBtnMobile) {
    hideRightBtnMobile.addEventListener('click', () => {
        console.log("Toggle button clicked!");
        rightSidebar.classList.toggle('collapsed');
        chatContainer.classList.toggle('hidden');
        rightSidebar.classList.toggle('hidden');
        console.log("Right sidebar classes:", rightSidebar.classList);
        console.log("Content classes:", content.classList);
    });
}

// Right sidebar save button logic
saveBtn = document.getElementById('save-changes-button');
responseLength = document.getElementById('response-length');
interestInput = document.getElementById('interest-input');

if (saveBtn) {
    saveBtn.addEventListener('click', () => {
        console.log("Save button clicked!");
        console.log("Response Length:", responseLength.value);
        console.log("Interest Input:", interestInput.value);
        urlParams = new URLSearchParams(window.location.search);
        fetch('../backend/api/settings.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'saveSettings',
                responseLength: responseLength.value,
                interestInput: interestInput.value,
                chatId: urlParams.get('chatId') // Get chatId from URL
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert("Settings saved successfully!");
            } else {
                alert("Error saving settings: " + data.message);
            }
        })
        .catch(error => {
            console.error("Error:", error);
            alert("An unexpected error occurred while saving settings.");
        });
    });
}


// --------------------- Window Screen Size JavaScript ------------------------


function handleResize() {
    const leftSidebar = document.getElementById('left-sidebar');
    const rightSidebar = document.getElementById('right-sidebar');
    const header = document.getElementById('chat-header');
    const content = document.getElementById('my-content');
    const chatContainer = document.getElementById('chat-container');
    const chatLocation = document.getElementById('chat-location');
    const inputContainer = document.getElementById('input-container');
    const toggleLeftSidebar = document.getElementById('toggle-left-sidebar');
    const hideLeftSidebar = document.getElementById('hide-left-sidebar-mobile');
    const toggleRightSidebar = document.getElementById('toggle-right-sidebar');
    const hideRightSidebar = document.getElementById('hide-right-sidebar-mobile');

    if (normalSize()) {
        // Large screen or larger
        // Left and Right sidebars are visible
        leftSidebar.classList.remove('hidden', 'mobile');
        leftSidebar.classList.add('max-w-sm');
        rightSidebar.classList.remove('hidden', 'mobile');
        rightSidebar.classList.add('max-w-sm');
        // Un-collapse left sidebar and collapse right sidebar
        if (content.classList.contains('left-collapsed')) { content.classList.remove('left-collapsed'); }
        leftSidebar.classList.remove('collapsed');
        // Sets the correct sidebar button to be visible
        if (toggleLeftSidebar.classList.contains('hidden')) { toggleLeftSidebar.classList.remove('hidden'); }
        if (!hideLeftSidebar.classList.contains('hidden')) { hideLeftSidebar.classList.add('hidden'); }
        if (toggleRightSidebar.classList.contains('hidden')) { toggleRightSidebar.classList.remove('hidden'); }
        if (!hideRightSidebar.classList.contains('hidden')) { hideRightSidebar.classList.add('hidden'); }
        // Always Shows chat container
        if (chatContainer.classList.contains('hidden')) { chatContainer.classList.remove('hidden'); }
        // Changes the header styling
        if (header) header.className = "flex items-center justify-between p-3 w-full border-b-4 border-gray-50";
        // Removes one column layout
        content.classList.remove('mobile');
        // Removes mobile padding
        if (chatLocation) chatLocation.classList.remove('px-2');
        if (inputContainer) inputContainer.classList.remove('px-2');
    }
    else {
        // Small screen
        // Left and Right sidebars are not visible, seperate buttons for these sidebars are visible
        leftSidebar.classList.add('hidden', 'mobile');
        leftSidebar.classList.remove('max-w-sm');
        rightSidebar.classList.add('hidden', 'mobile');
        rightSidebar.classList.remove('max-w-sm');
        // Sets the correct sidebar button to be visible
        if (!toggleLeftSidebar.classList.contains('hidden')) { toggleLeftSidebar.classList.add('hidden'); }
        if (hideLeftSidebar.classList.contains('hidden')) { hideLeftSidebar.classList.remove('hidden'); }
        if (!toggleRightSidebar.classList.contains('hidden')) { toggleRightSidebar.classList.add('hidden'); }
        if (hideRightSidebar.classList.contains('hidden')) { hideRightSidebar.classList.remove('hidden'); }
        // Auto collapses sidebars
        if (!leftSidebar.classList.contains('collapsed')) { leftSidebar.classList.add('collapsed'); }
        if (!rightSidebar.classList.contains('collapsed')) { rightSidebar.classList.add('collapsed'); }
        if (!content.classList.contains('right-collapsed')) { content.classList.add('right-collapsed'); }
        // Always Shows chat container
        if (chatContainer.classList.contains('hidden')) { chatContainer.classList.remove('hidden'); }
        // Changes the header styling
        if (header) header.className = "flex items-center justify-between p-3 w-full bg-gray-100 border-b-4 border-gray-200";
        // Sets to one column layout
        content.classList.add('mobile');
        // Adds extra padding for readability
        if (window.innerWidth < 576) {
            if (chatLocation) chatLocation.classList.add('px-2');
            if (inputContainer) inputContainer.classList.add('px-2');
        } else {
            if (chatLocation) chatLocation.classList.remove('px-2');
            if (inputContainer) inputContainer.classList.remove('px-2');
        }
        if (!header) {
            console.log("Page opened on Mobile");
            leftSidebar.classList.toggle('collapsed');
            chatContainer.classList.toggle('hidden');
            leftSidebar.classList.toggle('hidden');
            if (!hideLeftSidebar.classList.contains('hidden')) { hideLeftSidebar.classList.add('hidden'); }
            console.log("Left sidebar classes:", leftSidebar.classList);
            console.log("Content classes:", content.classList);
            console.log("Archive button classes:", archiveButton.classList);
        }
    }
}

function normalSize() {
    return window.innerWidth >= 1024;
}

// Run on resize
window.addEventListener('resize', handleResize);

// Run once on initial load
handleResize();


// Change the way different courses are sorted
document.getElementById('sort-by-btn').addEventListener('change', function () {
    const sortBy = this.value;
    const urlParams = new URLSearchParams(window.location.search);

    const chatId = urlParams.get('chatId');
    const filterBy = urlParams.get('filterBy');

    let newUrl = '?sortBy=' + encodeURIComponent(sortBy);

    if (filterBy) {
        newUrl += '&filterBy=' + encodeURIComponent(filterBy);
    }
    if (chatId) {
        newUrl += '&chatId=' + encodeURIComponent(chatId);
    }

    const leftSidebar = document.getElementById('left-sidebar');
    // Only set the flag if the sidebar is currently NOT hidden on mobile
    if (!normalSize() && !leftSidebar.classList.contains('hidden')) {
        localStorage.setItem('sidebarShouldReopen', 'true');
    }

    window.location.href = newUrl;
});


// Filter by discipline
filterByButton = document.getElementById('filter-by-button');
if (filterByButton) {
    filterByButton.addEventListener('change', function () {
        console.log("Filter by discipline changed to:", this.value);
        const filterBy = this.value;
        const urlParams = new URLSearchParams(window.location.search);

        // Preserve existing query params
        const chatId = urlParams.get('chatId');
        const sortBy = urlParams.get('sortBy');

        let newUrl = '?filterBy=' + encodeURIComponent(filterBy);

        if (sortBy) {
            newUrl += '&sortBy=' + encodeURIComponent(sortBy);
        }
        if (chatId) {
            newUrl += '&chatId=' + encodeURIComponent(chatId);
        }

        const leftSidebar = document.getElementById('left-sidebar');
        // Only set the flag if the sidebar is currently NOT hidden on mobile
        if (!normalSize() && !leftSidebar.classList.contains('hidden')) {
            localStorage.setItem('sidebarShouldReopen', 'true');
        }


        window.location.href = newUrl; // Reload page with new filter
    });
} else {
    console.warn("Filter by button not found. Ensure the element with ID 'filter-by-button' exists in your HTML.");
}



// Pre-select the sort option based on the URL
window.addEventListener('DOMContentLoaded', () => {
    // Get the current URL parameters and update the sort and filter buttons accordingly
    const urlParams = new URLSearchParams(window.location.search);
    const selectedSort = urlParams.get('sortBy') || 'sortRecent';
    const selectedFilter = urlParams.get('filterBy') || 'allCourses';
    document.getElementById('sort-by-btn').value = selectedSort;
    document.getElementById('filter-by-button').value = selectedFilter;

    const chatId = new URLSearchParams(window.location.search).get('chatId');
    if (!chatId) return;

    fetch('../backend/api/settings.php?action=getSettings&chatId=' + encodeURIComponent(chatId), {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success && data.settings) {
            const { responseLength, interest } = data.settings;

            const responseSelect = document.getElementById('response-length');
            const interestField = document.getElementById('interest-input');

            if (responseSelect && responseLength) {
                responseSelect.value = responseLength;
            } else if (responseSelect) {
                responseSelect.value = 'Average'; // Default value if not set
            }

            if (interestField && interest !== null) {
                interestField.value = interest;
            }
        }
    })
    .catch(err => {
        console.error("Failed to load settings:", err);
    });
});

function adjustConversationPadding() {
    const conversation = document.getElementById('conversation');
    
    // Check if the element is scrollable (scrollHeight > clientHeight)
    if (!conversation) {
        console.warn("Conversation element not found. No chat selected.");
        return;
    }
    // Check if the conversation has a scrollbar
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

document.addEventListener('DOMContentLoaded', function () {
    const shouldReopen = localStorage.getItem('sidebarShouldReopen');

    if (shouldReopen === 'true') {
        // Simulate a click to open sidebar
        const showBtnMobile = document.getElementById('show-left-sidebar-mobile');
        if (showBtnMobile) showBtnMobile.click();

        // Clear the flag
        localStorage.removeItem('sidebarShouldReopen');
    }
});