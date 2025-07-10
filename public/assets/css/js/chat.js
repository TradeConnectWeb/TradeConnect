import { auth, db } from './firebase.js';

// DOM Elements
const messageInput = document.getElementById('messageInput');
const sendMessageBtn = document.getElementById('sendMessage');
const chatMessages = document.getElementById('chatMessages');
const conversationsList = document.getElementById('conversationsList');

// Chat State
let currentChatId = null;

// Initialize Chat
function initChat() {
  if (!auth.currentUser) return;
  
  // Load conversations
  loadConversations();
  
  // Set up message listener for current chat
  if (currentChatId) {
    setupMessageListener(currentChatId);
  }
  
  // Enable message input if chat is selected
  messageInput.disabled = !currentChatId;
  sendMessageBtn.disabled = !currentChatId;
}

// Load Conversations
async function loadConversations() {
  if (!auth.currentUser) return;
  
  try {
    const snapshot = await db.collection('conversations')
      .where('participants', 'array-contains', auth.currentUser.uid)
      .orderBy('lastUpdated', 'desc')
      .get();
    
    conversationsList.innerHTML = '';
    
    if (snapshot.empty) {
      conversationsList.innerHTML = '<div class="empty-state">No conversations yet</div>';
      return;
    }
    
    snapshot.forEach(doc => {
      const conversation = doc.data();
      const otherUserId = conversation.participants.find(id => id !== auth.currentUser.uid);
      
      // In a real app, you would fetch user data here
      const conversationElement = document.createElement('div');
      conversationElement.className = 'conversation-item';
      conversationElement.innerHTML = `
        <img src="/assets/images/placeholder.png" alt="User">
        <div class="conversation-info">
          <h4>User ${otherUserId.substring(0, 6)}</h4>
          <p>${conversation.lastMessage || 'No messages yet'}</p>
        </div>
        <span class="conversation-time">
          ${conversation.lastUpdated.toDate().toLocaleTimeString()}
        </span>
      `;
      
      conversationElement.addEventListener('click', () => {
        openConversation(doc.id, otherUserId);
      });
      
      conversationsList.appendChild(conversationElement);
    });
  } catch (error) {
    console.error('Error loading conversations:', error);
    showToast('Failed to load conversations', 'error');
  }
}

// Open Conversation
function openConversation(chatId, otherUserId) {
  currentChatId = chatId;
  document.getElementById('chatPartnerName').textContent = `User ${otherUserId.substring(0, 6)}`;
  document.getElementById('chatPartnerStatus').textContent = 'Online';
  
  // Enable message input
  messageInput.disabled = false;
  sendMessageBtn.disabled = false;
  
  // Load messages
  loadMessages(chatId);
}

// Load Messages
async function loadMessages(chatId) {
  try {
    const snapshot = await db.collection('conversations')
      .doc(chatId)
      .collection('messages')
      .orderBy('timestamp', 'asc')
      .get();
    
    chatMessages.innerHTML = '';
    
    if (snapshot.empty) {
      chatMessages.innerHTML = `
        <div class="no-messages">
          <i class="fas fa-comment-slash"></i>
          <p>No messages yet. Start a conversation!</p>
        </div>
      `;
      return;
    }
    
    snapshot.forEach(doc => {
      const message = doc.data();
      addMessageToChat(message);
    });
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
  } catch (error) {
    console.error('Error loading messages:', error);
    showToast('Failed to load messages', 'error');
  }
}

// Setup Message Listener
function setupMessageListener(chatId) {
  return db.collection('conversations')
    .doc(chatId)
    .collection('messages')
    .orderBy('timestamp', 'asc')
    .onSnapshot((snapshot) => {
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added') {
          const message = change.doc.data();
          addMessageToChat(message);
          
          // Scroll to bottom
          chatMessages.scrollTop = chatMessages.scrollHeight;
        }
      });
    });
}

// Add Message to Chat
function addMessageToChat(message) {
  // Remove "no messages" placeholder if it exists
  const noMessages = chatMessages.querySelector('.no-messages');
  if (noMessages) noMessages.remove();
  
  const messageElement = document.createElement('div');
  messageElement.className = `message ${message.senderId === auth.currentUser.uid ? 'sent' : 'received'}`;
  
  messageElement.innerHTML = `
    <div class="message-content">
      ${message.text}
      <span class="message-time">
        ${message.timestamp.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
      </span>
    </div>
  `;
  
  chatMessages.appendChild(messageElement);
}

// Send Message
async function sendMessage() {
  if (!currentChatId || !messageInput.value.trim()) return;
  
  const messageText = messageInput.value.trim();
  
  try {
    // Add message to Firestore
    await db.collection('conversations')
      .doc(currentChatId)
      .collection('messages')
      .add({
        text: messageText,
        senderId: auth.currentUser.uid,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
    
    // Update conversation last message
    await db.collection('conversations')
      .doc(currentChatId)
      .update({
        lastMessage: messageText,
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
      });
    
    // Clear input
    messageInput.value = '';
  } catch (error) {
    console.error('Error sending message:', error);
    showToast('Failed to send message', 'error');
  }
}

// Event Listeners
if (sendMessageBtn) {
  sendMessageBtn.addEventListener('click', sendMessage);
}

if (messageInput) {
  messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  });
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', initChat);