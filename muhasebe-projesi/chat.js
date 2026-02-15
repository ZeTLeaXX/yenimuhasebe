const CHAT_KEY = 'muhasebe_chat_messages';
const messagesArea = document.getElementById('messages');
const chatForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message-input');

// Auth Check
const currentUser = Auth.requireAuth();

// Get Messages
function getMessages() {
    return JSON.parse(localStorage.getItem(CHAT_KEY)) || [];
}

// Save Messages
function saveMessage(text) {
    const messages = getMessages();
    const newMessage = {
        id: Date.now(),
        userId: currentUser.id,
        username: currentUser.username,
        text: text,
        timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    };

    messages.push(newMessage);
    // Keep last 50 messages to prevent storage fill-up
    if (messages.length > 50) {
        messages.shift();
    }

    localStorage.setItem(CHAT_KEY, JSON.stringify(messages));
    return newMessage;
}

// Render Messages
function renderMessages() {
    const messages = getMessages();
    // Simple diff check: if count hasn't changed, maybe don't re-render everything? 
    // For simplicity in this localStorage implementation, we'll re-render if count changes or just re-render all to be safe for now.
    // Optimization: In a real app we'd append, but for vanilla JS + localStorage polling, clearing and re-rendering is robust enough for small chats.

    // Check if we are scrolled to bottom
    const isScrolledToBottom = messagesArea.scrollHeight - messagesArea.scrollTop <= messagesArea.clientHeight + 100;

    messagesArea.innerHTML = '';

    messages.forEach(msg => {
        const isMine = msg.userId === currentUser.id;
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${isMine ? 'mine' : 'others'}`;

        const header = isMine ?
            `<div class="message-header"><span>${msg.timestamp}</span><span>Ben</span></div>` :
            `<div class="message-header"><span>${msg.username}</span><span>${msg.timestamp}</span></div>`;

        msgDiv.innerHTML = `
            ${header}
            <div>${msg.text}</div>
        `;

        messagesArea.appendChild(msgDiv);
    });

    // Auto scroll to bottom only if user was already at bottom or it's initial load
    if (isScrolledToBottom) {
        messagesArea.scrollTop = messagesArea.scrollHeight;
    }
}

// Send Message
chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = messageInput.value.trim();
    if (text) {
        saveMessage(text);
        messageInput.value = '';
        renderMessages();
        // Force scroll to bottom on send
        messagesArea.scrollTop = messagesArea.scrollHeight;
    }
});

// Initial Render
renderMessages();
messagesArea.scrollTop = messagesArea.scrollHeight; // Initial scroll

// Polling for new messages (every 1 second)
setInterval(() => {
    // We could optimize this by storing a "lastUpdated" timestamp in localStorage
    // But for this size, simple re-render check is acceptable or just blindly re-render.
    // Let's at least compare length or last ID to avoid flickering if DOM manipulation is expensive.

    const currentMessages = getMessages();
    const domMessagesCount = messagesArea.childElementCount;

    if (currentMessages.length !== domMessagesCount ||
        (currentMessages.length > 0 && currentMessages[currentMessages.length - 1].text !== messagesArea.lastElementChild.querySelector('div:last-child').innerText)) {
        renderMessages();
    }
}, 1000);
