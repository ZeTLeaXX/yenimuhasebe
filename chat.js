const messagesArea = document.getElementById('messages');
const chatForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message-input');

let currentUser = null;
let unsubscribe = null;

// Auth Check
Auth.initAuthListener((user) => {
    if (!user) {
        window.location.href = 'login.html';
    } else {
        currentUser = user;
        initChat();
    }
});

function initChat() {
    // Listen to last 100 messages
    unsubscribe = db.collection('messages')
        .orderBy('timestamp', 'asc')
        .limitToLast(100)
        .onSnapshot(snapshot => {
            messagesArea.innerHTML = '';

            snapshot.forEach(doc => {
                renderMessage(doc.data());
            });

            messagesArea.scrollTop = messagesArea.scrollHeight;
        });
}

function renderMessage(msg) {
    const isMine = msg.userId === currentUser.uid;
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${isMine ? 'mine' : 'others'}`;

    // Format timestamp
    let timeStr = '...';
    if (msg.timestamp) {
        timeStr = msg.timestamp.toDate().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    }

    const header = isMine ?
        `<div class="message-header"><span>${timeStr}</span><span>Ben</span></div>` :
        `<div class="message-header"><span>${msg.username}</span><span>${timeStr}</span></div>`;

    msgDiv.innerHTML = `
        ${header}
        <div>${msg.text}</div>
    `;

    messagesArea.appendChild(msgDiv);
}

// Send Message
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = messageInput.value.trim();

    if (text) {
        try {
            await db.collection('messages').add({
                text: text,
                userId: currentUser.uid,
                username: currentUser.username,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            messageInput.value = '';
        } catch (error) {
            console.error('Error sending message:', error);
            alert('Mesaj gönderilemedi.');
        }
    }
});
