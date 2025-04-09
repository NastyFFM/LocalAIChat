// DOM Elements
const statusIndicator = document.querySelector('.status-indicator');
const statusText = document.getElementById('status-text');
const downloadSection = document.getElementById('download-section');
const downloadButton = document.getElementById('download-button');
const localModelButton = document.getElementById('local-model-button');
const changeModelButton = document.getElementById('change-model-button');
const reloadModelButton = document.getElementById('reload-model-button');
const progressContainer = document.getElementById('progress-container');
const progressBar = document.getElementById('progress-bar');
const downloadStatus = document.getElementById('download-status');
const chatInterface = document.getElementById('chat-interface');
const chatContainer = document.getElementById('chat-container');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const testButton = document.getElementById('testButton');
const rawChatInput = document.getElementById('raw-chat-input');
const rawChatButton = document.getElementById('raw-chat-button');
const settingsButton = document.getElementById('settings-button');
const settingsModal = document.getElementById('settings-modal');
const closeModalButton = document.querySelector('.close-modal');

// Chat history elements
const newChatButton = document.getElementById('new-chat-button');
const chatList = document.getElementById('chat-list');
const deleteChatModal = document.getElementById('delete-chat-modal');
const cancelDeleteButton = document.getElementById('cancel-delete-button');
const confirmDeleteButton = document.getElementById('confirm-delete-button');
const closeDeleteModalButton = document.querySelector('.close-delete-modal');

// Sampling parameters
const temperatureSlider = document.getElementById('temperature');
const temperatureValue = document.getElementById('temperature-value');
const topPSlider = document.getElementById('top-p');
const topPValue = document.getElementById('top-p-value');
const maxLengthInput = document.getElementById('max-length');
const stopSequenceInput = document.getElementById('stop-sequence');
const applyParamsButton = document.getElementById('apply-params-button');

// Validate DOM elements
function validateDOMElements() {
  // Check that all required elements exist
  if (!rawChatInput || !rawChatButton) {
    console.error('Raw chat elements not found in the DOM. Using fallbacks.');
    // Use hidden elements as fallbacks if they exist
    if (document.getElementById('raw-chat-input-hidden')) {
      rawChatInput = document.getElementById('raw-chat-input-hidden');
    }
    if (document.getElementById('raw-chat-button-hidden')) {
      rawChatButton = document.getElementById('raw-chat-button-hidden');
    }
  }
  
  // Ensure all required DOM elements are available
  if (!settingsModal || !closeModalButton || !settingsButton) {
    console.error('Settings modal elements not found in the DOM');
  }
  
  if (!temperatureSlider || !topPSlider || !maxLengthInput || !stopSequenceInput || !applyParamsButton) {
    console.error('Sampling parameter elements not found in the DOM');
  }
}

// Call validation on page load
validateDOMElements();

// Default parameters
let modelParams = {
  temperature: 1.0,
  top_p: 0.95,
  max_length: 8192,
  stop_sequence: '<end_of_turn>'
};

// Update parameter display
temperatureSlider.addEventListener('input', () => {
  const value = parseFloat(temperatureSlider.value);
  temperatureValue.textContent = value.toFixed(2);
  modelParams.temperature = value;
});

topPSlider.addEventListener('input', () => {
  const value = parseFloat(topPSlider.value);
  topPValue.textContent = value.toFixed(2);
  modelParams.top_p = value;
});

// Apply parameters
applyParamsButton.addEventListener('click', () => {
  modelParams.max_length = parseInt(maxLengthInput.value, 10);
  modelParams.stop_sequence = stopSequenceInput.value || '<end_of_turn>';
  
  // Save to localStorage
  localStorage.setItem('modelParams', JSON.stringify(modelParams));
  
  // Notify user
  alert('Parameter wurden angewendet!');
});

// Load saved parameters from localStorage
function loadSavedParameters() {
  const savedParams = localStorage.getItem('modelParams');
  if (savedParams) {
    try {
      const params = JSON.parse(savedParams);
      modelParams = { ...modelParams, ...params };
      
      // Update UI
      temperatureSlider.value = modelParams.temperature;
      temperatureValue.textContent = modelParams.temperature.toFixed(2);
      
      topPSlider.value = modelParams.top_p;
      topPValue.textContent = modelParams.top_p.toFixed(2);
      
      maxLengthInput.value = modelParams.max_length;
      
      if (modelParams.stop_sequence && modelParams.stop_sequence !== '<end_of_turn>') {
        stopSequenceInput.value = modelParams.stop_sequence;
      }
    } catch (e) {
      console.error('Error loading saved parameters:', e);
    }
  }
}

// Initialize parameters
loadSavedParameters();

// Configure marked.js
marked.setOptions({
  breaks: true,          // Interpret line breaks as <br>
  gfm: true,             // Use GitHub Flavored Markdown
  headerIds: false,      // Don't add IDs to headers (for security)
  mangle: false,         // Don't mangle email addresses
  sanitize: false,       // We'll use DOMPurify for sanitization
  smartLists: true,      // Use smarter list behavior
  smartypants: true,     // Use "smart" typographic punctuation
  xhtml: false           // Don't close empty tags with a slash
});

// Process markdown and sanitize the result
function processMarkdown(text) {
  if (!text) return '';
  const rawHtml = marked.parse(text);
  return DOMPurify.sanitize(rawHtml);
}

// Setup event listeners for UI elements
function setupEventListeners() {
  // Chat interface
  if (sendButton) {
    sendButton.addEventListener('click', sendMessage);
  }
  
  if (messageInput) {
    messageInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
      }
    });
  }
  
  // Settings modal
  if (settingsButton && settingsModal) {
    settingsButton.addEventListener('click', openSettingsModal);
  }
  
  if (closeModalButton) {
    closeModalButton.addEventListener('click', closeSettingsModal);
  }
  
  if (settingsModal) {
    window.addEventListener('click', (event) => {
      if (event.target === settingsModal) {
        closeSettingsModal();
      }
    });
  }
  
  // Raw chat string
  if (rawChatButton) {
    rawChatButton.addEventListener('click', sendRawChatString);
  }
  
  if (rawChatInput) {
    rawChatInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && event.ctrlKey) {
        event.preventDefault();
        sendRawChatString();
      }
    });
  }
  
  // Parameter sliders
  if (temperatureSlider && temperatureValue) {
    temperatureSlider.addEventListener('input', () => {
      const value = parseFloat(temperatureSlider.value);
      temperatureValue.textContent = value.toFixed(2);
      modelParams.temperature = value;
    });
  }
  
  if (topPSlider && topPValue) {
    topPSlider.addEventListener('input', () => {
      const value = parseFloat(topPSlider.value);
      topPValue.textContent = value.toFixed(2);
      modelParams.top_p = value;
    });
  }
  
  if (applyParamsButton) {
    applyParamsButton.addEventListener('click', () => {
      if (maxLengthInput) {
        modelParams.max_length = parseInt(maxLengthInput.value, 10);
      }
      
      if (stopSequenceInput) {
        modelParams.stop_sequence = stopSequenceInput.value || '<end_of_turn>';
      }
      
      // Save to localStorage
      localStorage.setItem('modelParams', JSON.stringify(modelParams));
      
      // Notify user
      alert('Parameter wurden angewendet!');
    });
  }
  
  // Model-related buttons
  if (downloadButton) {
    downloadButton.addEventListener('click', downloadModel);
  }
  
  if (localModelButton) {
    localModelButton.addEventListener('click', selectLocalModel);
  }
  
  if (changeModelButton) {
    changeModelButton.addEventListener('click', changeModel);
  }
}

// Call setup function
setupEventListeners();

// Chat history
let chatHistory = [];

// Chat history management
let allChats = [];
let currentChatId = null;
let currentChatIndex = -1;

// Load all chats from localStorage
function loadAllChats() {
  try {
    const savedChats = localStorage.getItem('allChats');
    if (savedChats) {
      allChats = JSON.parse(savedChats);
    }
  } catch (error) {
    console.error('Error loading chats:', error);
    allChats = [];
  }
}

// Save all chats to localStorage
function saveAllChats() {
  try {
    localStorage.setItem('allChats', JSON.stringify(allChats));
  } catch (error) {
    console.error('Error saving chats:', error);
  }
}

// Create a new chat
function createNewChat() {
  // Generate a unique ID for the chat
  const chatId = Date.now().toString();
  const newChat = {
    id: chatId,
    title: `Chat ${allChats.length + 1}`,
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  allChats.push(newChat);
  saveAllChats();
  
  // Set the current chat and update UI
  setCurrentChat(chatId);
  renderChatList();
  
  // Clear chat container
  chatContainer.innerHTML = '';
  chatHistory = [];
}

// Set the current chat
function setCurrentChat(chatId) {
  currentChatId = chatId;
  currentChatIndex = allChats.findIndex(chat => chat.id === chatId);
  
  // Update chat list UI to show active chat
  renderChatList();
}

// Render the chat list in the sidebar
function renderChatList() {
  chatList.innerHTML = '';
  
  allChats.forEach(chat => {
    const chatItem = document.createElement('div');
    chatItem.className = `chat-item ${chat.id === currentChatId ? 'active' : ''}`;
    
    const chatTitle = document.createElement('div');
    chatTitle.className = 'chat-title';
    chatTitle.textContent = chat.title;
    
    const chatButtons = document.createElement('div');
    chatButtons.className = 'chat-item-buttons';
    
    const deleteButton = document.createElement('button');
    deleteButton.className = 'delete-chat-button';
    deleteButton.innerHTML = '🗑️';
    deleteButton.title = 'Delete Chat';
    deleteButton.onclick = (e) => {
      e.stopPropagation();
      openDeleteChatModal(chat.id);
    };
    
    chatButtons.appendChild(deleteButton);
    chatItem.appendChild(chatTitle);
    chatItem.appendChild(chatButtons);
    
    // Open chat when clicked
    chatItem.addEventListener('click', () => {
      if (chat.id !== currentChatId) {
        loadChat(chat.id);
      }
    });
    
    chatList.appendChild(chatItem);
  });
}

// Load a specific chat
function loadChat(chatId) {
  const chatIndex = allChats.findIndex(chat => chat.id === chatId);
  if (chatIndex === -1) return;
  
  const chat = allChats[chatIndex];
  
  // Set current chat
  currentChatId = chatId;
  currentChatIndex = chatIndex;
  
  // Clear chat container
  chatContainer.innerHTML = '';
  
  // Load messages into chat container
  chatHistory = chat.messages.map(msg => ({
    user: msg.content,
    assistant: msg.response
  }));
  
  // Display messages
  chat.messages.forEach(msg => {
    addMessageToChat(msg.content, 'user');
    if (msg.response) {
      addMessageToChat(msg.response, 'assistant');
    }
  });
  
  // Update UI
  renderChatList();
}

// Save current chat
function saveCurrentChat() {
  if (currentChatIndex === -1 || !currentChatId) return;
  
  allChats[currentChatIndex].messages = chatHistory.map(msg => ({
    content: msg.user,
    response: msg.assistant
  }));
  
  allChats[currentChatIndex].updatedAt = new Date().toISOString();
  
  // Update title to first message if available
  if (chatHistory.length > 0 && chatHistory[0].user) {
    const title = chatHistory[0].user.substring(0, 30) + (chatHistory[0].user.length > 30 ? '...' : '');
    allChats[currentChatIndex].title = title;
  }
  
  saveAllChats();
  renderChatList();
}

// Delete chat modal functions
function openDeleteChatModal(chatId) {
  // Store the chat ID to delete
  confirmDeleteButton.dataset.chatId = chatId;
  
  // Show the modal
  deleteChatModal.style.display = 'block';
  // Prevent scrolling
  document.body.style.overflow = 'hidden';
}

function closeDeleteChatModal() {
  deleteChatModal.style.display = 'none';
  // Re-enable scrolling
  document.body.style.overflow = 'auto';
  // Clear stored chat ID
  confirmDeleteButton.dataset.chatId = '';
}

// Delete a chat
function deleteChat(chatId) {
  const chatIndex = allChats.findIndex(chat => chat.id === chatId);
  if (chatIndex === -1) return;
  
  // Remove the chat
  allChats.splice(chatIndex, 1);
  saveAllChats();
  
  // If deleted the current chat, create a new one
  if (chatId === currentChatId) {
    // Clear current chat
    currentChatId = null;
    currentChatIndex = -1;
    chatContainer.innerHTML = '';
    chatHistory = [];
    
    // Create a new chat if there are no chats left
    if (allChats.length === 0) {
      createNewChat();
    } else {
      // Load the first available chat
      loadChat(allChats[0].id);
    }
  }
  
  // Update UI
  renderChatList();
}

// Setup additional event listeners for chat management
function setupChatManagementEventListeners() {
  // New chat button
  if (newChatButton) {
    newChatButton.addEventListener('click', createNewChat);
  }
  
  // Delete chat modal
  if (confirmDeleteButton) {
    confirmDeleteButton.addEventListener('click', () => {
      const chatId = confirmDeleteButton.dataset.chatId;
      if (chatId) {
        deleteChat(chatId);
        closeDeleteChatModal();
      }
    });
  }
  
  if (cancelDeleteButton) {
    cancelDeleteButton.addEventListener('click', closeDeleteChatModal);
  }
  
  if (closeDeleteModalButton) {
    closeDeleteModalButton.addEventListener('click', closeDeleteChatModal);
  }
  
  // Close delete modal when clicking outside
  window.addEventListener('click', (event) => {
    if (event.target === deleteChatModal) {
      closeDeleteChatModal();
    }
  });
}

// Call setup function for chat management
setupChatManagementEventListeners();

// Check model status on startup
async function checkModelStatus() {
  try {
    const modelExists = await window.electronAPI.checkModel();
    
    if (modelExists) {
      updateStatus('loading', 'Initializing model...');
      await window.electronAPI.initModel();
    } else {
      updateStatus('error', 'Model not found');
      showDownloadSection();
    }
  } catch (error) {
    console.error('Error checking model status:', error);
    updateStatus('error', 'Error checking model status');
    showDownloadSection();
  }
}

// Update status indicator
function updateStatus(status, message) {
  // Remove all status classes
  statusIndicator.classList.remove('status-ready', 'status-loading', 'status-error', 'status-downloading', 'status-exists', 'status-warning');
  
  // Add appropriate class
  statusIndicator.classList.add(`status-${status}`);
  
  // Update text
  statusText.textContent = message;
  
  // Show/hide change model button
  if (status === 'ready' || status === 'exists') {
    changeModelButton.classList.remove('hidden');
  } else {
    changeModelButton.classList.add('hidden');
  }
}

// Show download section
function showDownloadSection() {
  downloadSection.classList.remove('hidden');
  chatInterface.classList.add('hidden');
  
  // Reset progress
  progressBar.style.width = '0%';
  progressContainer.classList.add('hidden');
  downloadStatus.textContent = '';
  downloadButton.disabled = false;
  localModelButton.disabled = false;
}

// Show chat interface
function showChatInterface() {
  downloadSection.classList.add('hidden');
  chatInterface.classList.remove('hidden');
  sendButton.disabled = false;
  
  // Load chats or create a new one
  loadAllChats();
  
  if (allChats.length === 0) {
    createNewChat();
  } else {
    // Load the most recent chat
    loadChat(allChats[allChats.length - 1].id);
  }
  
  messageInput.focus();
}

// Add message to chat
function addMessageToChat(message, sender) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${sender}-message`;
  
  const messageContent = document.createElement('div');
  messageContent.className = 'message-content';
  
  // Handle message content differently based on sender
  if (sender === 'user') {
    // For user messages, just use text
    messageContent.textContent = message;
  } else {
    // For assistant messages, enable markdown with sanitization
    messageContent.innerHTML = processMarkdown(message);
    // Add markdown-content class for styling
    messageContent.classList.add('markdown-content');
  }
  
  messageDiv.appendChild(messageContent);
  chatContainer.appendChild(messageDiv);
  
  // Generate a unique ID for the message
  const messageId = `message-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  messageDiv.id = messageId;
  
  // Scroll to bottom
  chatContainer.scrollTop = chatContainer.scrollHeight;
  
  // Return the message ID for updating streaming content
  return messageId;
}

// Handle message sending
async function sendMessage() {
  const message = messageInput.value.trim();
  if (!message) return;
  
  // Disable input while processing
  messageInput.disabled = true;
  sendButton.disabled = true;
  
  // Add user message to chat
  addMessageToChat(message, 'user');
  
  // Clear input
  messageInput.value = '';
  
  try {
    // Create a placeholder for the assistant's response
    const assistantMessageId = addMessageToChat('', 'assistant');
    let responseText = '';
    
    // Set up streaming listener
    const removeStreamingListener = window.electronAPI.onStreamingToken((data) => {
      const assistantMessage = document.getElementById(assistantMessageId);
      if (assistantMessage) {
        if (data.isComplete) {
          // For complete messages, render the final markdown
          assistantMessage.querySelector('.message-content').innerHTML = processMarkdown(data.token);
          responseText = data.token;
        } else {
          // For streaming tokens, append to the text and convert to markdown
          responseText += data.token;
          assistantMessage.querySelector('.message-content').innerHTML = processMarkdown(responseText);
        }
      }
      
      // If the response is complete, update chat history
      if (data.isComplete) {
        removeStreamingListener();
        chatHistory.push({ user: message, assistant: data.token });
        
        // Save current chat
        saveCurrentChat();
        
        messageInput.disabled = false;
        sendButton.disabled = false;
        messageInput.focus();
      }
    });
    
    // Send message to main process with parameters
    await window.electronAPI.sendMessage(message, chatHistory, modelParams);
    
  } catch (error) {
    console.error('Error sending message:', error);
    updateStatus('error', 'Error sending message');
    messageInput.disabled = false;
    sendButton.disabled = false;
    messageInput.focus();
  }
}

// Download model
async function downloadModel() {
  downloadButton.disabled = true;
  localModelButton.disabled = true;
  progressContainer.classList.remove('hidden');
  downloadStatus.textContent = 'Starting download...';
  
  try {
    const result = await window.electronAPI.downloadModel();
    
    if (result.success) {
      downloadStatus.textContent = 'Download complete. Initializing model...';
      await window.electronAPI.initModel();
    } else {
      downloadButton.disabled = false;
      localModelButton.disabled = false;
      downloadStatus.textContent = `Download failed: ${result.error}`;
    }
  } catch (error) {
    console.error('Error downloading model:', error);
    downloadButton.disabled = false;
    localModelButton.disabled = false;
    downloadStatus.textContent = `Download failed: ${error.message}`;
  }
}

// Select local model
async function selectLocalModel() {
  localModelButton.disabled = true;
  downloadButton.disabled = true;
  downloadStatus.textContent = 'Selecting model...';
  
  try {
    const result = await window.electronAPI.selectLocalModel();
    
    if (result.success) {
      downloadStatus.textContent = `Model selected: ${result.path}`;
      // Initialize the model after selection
      updateStatus('loading', 'Initializing selected model...');
      const initResult = await window.electronAPI.initModel();
      
      if (initResult.success) {
        updateStatus('ready', 'Model initialized successfully');
        showChatInterface();
      } else {
        updateStatus('error', `Failed to initialize model: ${initResult.error}`);
        addModelSelectionGuide();
      }
    } else {
      if (result.error !== 'Model selection canceled') {
        downloadStatus.textContent = `Model selection failed: ${result.error}`;
        addModelSelectionGuide();
      } else {
        downloadStatus.textContent = '';
      }
      localModelButton.disabled = false;
      downloadButton.disabled = false;
    }
  } catch (error) {
    console.error('Error selecting model:', error);
    downloadStatus.textContent = `Model selection failed: ${error.message}`;
    addModelSelectionGuide();
    localModelButton.disabled = false;
    downloadButton.disabled = false;
  }
}

// Add helpful guide about model selection
function addModelSelectionGuide() {
  const guideElement = document.createElement('div');
  guideElement.style.marginTop = '20px';
  guideElement.style.fontSize = '14px';
  guideElement.style.color = '#666';
  guideElement.style.padding = '15px';
  guideElement.style.backgroundColor = '#f8f9fa';
  guideElement.style.borderRadius = '4px';
  guideElement.style.maxWidth = '600px';
  guideElement.style.margin = '20px auto';
  guideElement.innerHTML = `
    <h3 style="margin-top: 0;">GGUF Model Selection Tips</h3>
    <p>If you encounter an error loading a GGUF model, try the following:</p>
    <ul style="text-align: left;">
      <li>Try models with <strong>Q4_0</strong> or <strong>Q5_K_M</strong> quantization formats instead of Q2_K</li>
      <li>Larger models (>13B parameters) may require more RAM</li>
      <li>Make sure you're using a compatible GGUF version (v2 or v3)</li>
      <li>Popular sources for GGUF models include:
        <ul>
          <li><a href="#" onclick="window.open('https://huggingface.co/TheBloke'); return false;">TheBloke on Hugging Face</a></li>
          <li><a href="#" onclick="window.open('https://huggingface.co/models?sort=trending&search=gguf'); return false;">Hugging Face GGUF Models</a></li>
        </ul>
      </li>
    </ul>
  `;
  
  // Remove any existing guide first
  const existingGuide = document.querySelector('.model-guide');
  if (existingGuide) {
    existingGuide.remove();
  }
  
  // Add class for easier removal later
  guideElement.classList.add('model-guide');
  
  downloadSection.appendChild(guideElement);
}

// Change model
function changeModel() {
  // Reset chat history when changing the model
  chatHistory = [];
  chatContainer.innerHTML = '';
  
  // Show download section to select a new model
  showDownloadSection();
}

// Test prompt function
async function sendTestPrompt() {
    try {
        // Disable the test button while processing
        testButton.disabled = true;
        
        // Clear the message input
        messageInput.value = '';
        
        // Add user message to chat
        addMessageToChat('test', 'user');
        
        // Create assistant message container
        const assistantMessageDiv = document.createElement('div');
        assistantMessageDiv.className = 'message assistant';
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        assistantMessageDiv.appendChild(messageContent);
        chatContainer.appendChild(assistantMessageDiv);
        
        // Set up response chunk listener
        window.electronAPI.onStreamingToken(({ token, isComplete }) => {
            messageContent.textContent = token;
            if (isComplete) {
                testButton.disabled = false;
            }
        });
        
        // Send the test prompt to main process
        const result = await window.electronAPI.sendMessage('test', []);
        
        if (!result.success) {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Error sending test prompt:', error);
        alert('Error sending test prompt: ' + error.message);
        testButton.disabled = false;
    }
}

// Handle raw chat string
async function sendRawChatString() {
  const rawString = rawChatInput.value.trim();
  if (!rawString) return;
  
  // Disable input while processing
  rawChatInput.disabled = true;
  rawChatButton.disabled = true;
  
  try {
    // Create a placeholder for the assistant's response
    const assistantMessageId = addMessageToChat('', 'assistant');
    let responseText = '';
    
    // Set up streaming listener
    const removeStreamingListener = window.electronAPI.onStreamingToken((data) => {
      const assistantMessage = document.getElementById(assistantMessageId);
      if (assistantMessage) {
        if (data.isComplete) {
          // For complete messages, render the final markdown
          assistantMessage.querySelector('.message-content').innerHTML = processMarkdown(data.token);
          responseText = data.token;
        } else {
          // For streaming tokens, append to the text and convert to markdown
          responseText += data.token;
          assistantMessage.querySelector('.message-content').innerHTML = processMarkdown(responseText);
        }
      }
      
      // If the response is complete, update chat history
      if (data.isComplete) {
        removeStreamingListener();
        rawChatInput.disabled = false;
        rawChatButton.disabled = false;
        rawChatInput.focus();
      }
    });
    
    // Send raw string to main process with parameters
    await window.electronAPI.sendRawChatString(rawString, modelParams);
    
  } catch (error) {
    console.error('Error sending raw chat string:', error);
    updateStatus('error', 'Error sending raw chat string');
    rawChatInput.disabled = false;
    rawChatButton.disabled = false;
    rawChatInput.focus();
  }
}

// Reload model from a new location
async function reloadModel() {
  try {
    reloadModelButton.disabled = true;
    updateStatus('loading', 'Selecting new model path...');
    
    const result = await window.electronAPI.selectLocalModel();
    
    if (result.success) {
      updateStatus('ready', `Model loaded from new path: ${result.path}`);
      reloadModelButton.disabled = false;
    } else {
      if (result.error !== 'Model selection canceled') {
        updateStatus('error', `Failed to load model: ${result.error}`);
      } else {
        updateStatus('error', 'Model selection canceled');
      }
      reloadModelButton.disabled = false;
    }
  } catch (error) {
    console.error('Error reloading model:', error);
    updateStatus('error', `Error reloading model: ${error.message}`);
    reloadModelButton.disabled = false;
  }
}

// Settings Modal Functions
function openSettingsModal() {
  settingsModal.style.display = 'block';
  // Prevent scrolling on the body when modal is open
  document.body.style.overflow = 'hidden';
}

function closeSettingsModal() {
  settingsModal.style.display = 'none';
  // Re-enable scrolling
  document.body.style.overflow = 'auto';
}

// Listen for model status updates
const unlistenModelStatus = window.electronAPI.onModelStatus((data) => {
  updateStatus(data.status, data.message);
  
  if (data.status === 'ready') {
    showChatInterface();
  } else if (data.status === 'error') {
    showDownloadSection();
  } else if (data.status === 'warning') {
    // For warnings, we show the message but don't change the UI state
    console.warn('Model warning:', data.message);
  }
});

// Listen for download progress updates
const unlistenDownloadProgress = window.electronAPI.onDownloadProgress((progress) => {
  progressBar.style.width = `${progress}%`;
  downloadStatus.textContent = `Downloading... ${progress}%`;
});

// Add event listener for test button
testButton.addEventListener('click', sendTestPrompt);

// Initialize
checkModelStatus(); 