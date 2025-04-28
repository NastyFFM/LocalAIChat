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

// Chat sidebar
const chatSidebar = document.getElementById('chat-sidebar');
const settingsPanel = document.getElementById('settings-panel');
const closeSettingsButton = document.getElementById('close-settings-button');
const chatSearch = document.getElementById('chat-search');
const clearSearchButton = document.getElementById('clear-search');

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

// Default system prompt
const defaultSystemPrompt = `I am a helpful AI assistant focused on providing accurate, clear, and concise information. I aim to be direct while remaining friendly. I explain complex topics simply and acknowledge when I'm unsure. I follow best practices in coding and provide practical solutions with proper error handling. I maintain objectivity and respect in all interactions.

Here are some example conversations to demonstrate my style:

User: What is JavaScript?
Assistant: JavaScript is a programming language used primarily for web development. It allows you to add interactivity to websites, create web applications, and build server-side applications using Node.js. It's one of the core technologies of the web alongside HTML and CSS.

User: How do I create a function in JavaScript?
Assistant: In JavaScript, you can create a function using the 'function' keyword or arrow syntax. Here's an example:
\`\`\`javascript
// Traditional function
function greet(name) {
    return \`Hello, \${name}!\`;
}

// Arrow function
const greet = (name) => \`Hello, \${name}!\`;
\`\`\`

User: What's the difference between let and const?
Assistant: 'let' and 'const' are both used to declare variables in JavaScript. The key differences are:
- 'let' allows reassignment: \`let x = 1; x = 2;\` is valid
- 'const' prevents reassignment: \`const x = 1; x = 2;\` will throw an error
- Both are block-scoped, unlike 'var' which is function-scoped

Please answer all questions in a concise and informative manner. Do not repeat yourself or include unnecessary text. Focus on providing clear, direct answers.`;

// Update the system prompt functions
async function saveSystemPrompt(prompt) {
  try {
    const result = await window.electron.ipcRenderer.invoke('update-system-prompt', prompt);
    if (result.success) {
      localStorage.setItem('systemPrompt', prompt);
      return true;
    }
    throw new Error(result.error);
  } catch (error) {
    console.error('Error saving system prompt:', error);
    return false;
  }
}

async function loadSystemPrompt() {
  try {
    // First try to get from localStorage
    const localPrompt = localStorage.getItem('systemPrompt');
    if (localPrompt) return localPrompt;

    // If not in localStorage, get from main process
    const mainPrompt = await window.electron.ipcRenderer.invoke('get-system-prompt');
    if (mainPrompt) {
      localStorage.setItem('systemPrompt', mainPrompt);
      return mainPrompt;
    }

    // If all else fails, return default
    return defaultSystemPrompt;
  } catch (error) {
    console.error('Error loading system prompt:', error);
    return defaultSystemPrompt;
  }
}

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
let currentChat = null;
let currentChatIndex = -1;

// Load all chats from localStorage
function loadAllChats() {
  try {
    const savedChats = localStorage.getItem('allChats');
    if (savedChats) {
      allChats = JSON.parse(savedChats);
      // Set current chat to the most recent one if available
      if (allChats.length > 0) {
        currentChat = allChats[0];
        currentChatIndex = 0;
      }
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
  
  // Add new chat to the beginning of the array
  allChats.unshift(newChat);
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
  currentChatIndex = allChats.findIndex(chat => chat.id === chatId);
  
  // Update chat list UI to show active chat
  renderChatList();
}

// Render the chat list in the sidebar
function renderChatList() {
  chatList.innerHTML = '';
  
  // No need to sort, as we're now adding new chats to the beginning of the array
  allChats.forEach(chat => {
    const chatItem = document.createElement('div');
    chatItem.className = `chat-item ${chat.id === currentChat.id ? 'active' : ''}`;
    
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
      if (chat.id !== currentChat.id) {
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
  currentChat = chat;
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
  if (currentChatIndex === -1 || !currentChat.id) return;
  
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
  if (chatId === currentChat.id) {
    // Clear current chat
    currentChat = null;
    currentChatIndex = -1;
    chatContainer.innerHTML = '';
    chatHistory = [];
    
    // Create a new chat if there are no chats left
    if (allChats.length === 0) {
      createNewChat();
    } else {
      // Load the most recent chat (now at index 0)
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
    // Load the most recent chat (now at index 0)
    loadChat(allChats[0].id);
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

// Function to create prompt from chat bubbles
function createPromptFromChatBubbles(message) {
  const chatBubbles = document.querySelectorAll('.message');
  let prompt = '<bos>';
  
  // If this is the first message, include system prompt
  if (chatBubbles.length === 0) {
    prompt += loadSystemPrompt();
  }

  // Add existing messages to prompt
  chatBubbles.forEach((bubble, index) => {
    const isUser = bubble.classList.contains('user-message');
    const content = bubble.querySelector('.message-content').textContent;
    
    if (index === 0 && chatBubbles.length === 0) {
      // First message includes system prompt
      prompt += `\n${content}<end_of_turn>`;
    } else {
      prompt += `<start_of_turn>${isUser ? 'user' : 'assistant'}\n${content}<end_of_turn>`;
    }
  });

  // Add current message
  if (chatBubbles.length === 0) {
    prompt += `\n${message}<end_of_turn>`;
  } else {
    prompt += `<start_of_turn>user\n${message}<end_of_turn>`;
  }

  return prompt;
}

// Handle message sending
async function sendMessage() {
  const messageInput = document.getElementById('messageInput');
  const message = messageInput.value.trim();
  
  if (!message) return;
  
  // Get the current chat history
  const history = currentChat ? currentChat.messages : [];
  
  // Get the selected prompt and its parameters
  const promptSelect = document.getElementById('promptSelect');
  const selectedPrompt = promptSelect.value;
  const prompts = loadSavedPrompts();
  const prompt = prompts.find(p => p.name === selectedPrompt);
  
  // Add user message to chat
  addMessageToChat('user', message);
  
  // Prepare assistant's response
  const assistantMessageDiv = document.createElement('div');
  assistantMessageDiv.className = 'message assistant-message';
  assistantMessageDiv.innerHTML = '<div class="message-content">Thinking...</div>';
  chatContainer.appendChild(assistantMessageDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;
  
  // Clear input
  messageInput.value = '';
  
  try {
    // Use prompt parameters if available, otherwise use current modelParams
    const parameters = prompt && prompt.parameters ? prompt.parameters : modelParams;
    
    // Send message to main process with current parameters and prompt
    const response = await window.electron.sendMessage(message, {
      ...parameters,
      history: history,
      prompt: prompt ? prompt.content : null
    });
    
    // Update assistant's message with the response
    assistantMessageDiv.innerHTML = `<div class="message-content">${response}</div>`;
    
    // Save the chat with the selected prompt
    if (currentChat) {
      currentChat.messages.push(
        { role: 'user', content: message },
        { role: 'assistant', content: response }
      );
      saveCurrentChat();
    }
  } catch (error) {
    console.error('Error sending message:', error);
    assistantMessageDiv.innerHTML = `<div class="message-content error">Error: ${error.message}</div>`;
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

// Initialize search functionality
function initializeSearch() {
  if (!chatSearch || !clearSearchButton) return;
  
  chatSearch.addEventListener('input', function() {
    filterChats(this.value.toLowerCase().trim());
  });
  
  clearSearchButton.addEventListener('click', function() {
    chatSearch.value = '';
    filterChats('');
  });
}

// Filter chats based on search query
function filterChats(query) {
  const chatItems = document.querySelectorAll('.chat-item');
  
  chatItems.forEach(item => {
    const title = item.querySelector('.chat-title').textContent.toLowerCase();
    if (query === '' || title.includes(query)) {
      item.style.display = 'flex';
    } else {
      item.style.display = 'none';
    }
  });
}

// Add initializeSearch to existing event listeners
document.addEventListener('DOMContentLoaded', function() {
  validateDOMElements();
  loadSavedParameters();
  
  // Initialize the chat interface and search functionality
  showChatInterface();
  initializeSearch();
});

// Load system prompt when settings modal is opened
document.getElementById('settings-modal').addEventListener('show', () => {
  const systemPromptTextarea = document.getElementById('system-prompt');
  systemPromptTextarea.value = loadSystemPrompt();
});

// Save system prompt when save button is clicked
document.getElementById('save-system-prompt').addEventListener('click', () => {
  const systemPromptTextarea = document.getElementById('system-prompt');
  const newPrompt = systemPromptTextarea.value.trim();
  
  if (newPrompt) {
    saveSystemPrompt(newPrompt);
    showNotification('System prompt saved successfully!');
  } else {
    showNotification('Please enter a valid system prompt', 'error');
  }
});

// Reset system prompt to default
document.getElementById('reset-system-prompt').addEventListener('click', () => {
  const systemPromptTextarea = document.getElementById('system-prompt');
  systemPromptTextarea.value = defaultSystemPrompt;
  saveSystemPrompt(defaultSystemPrompt);
  showNotification('System prompt reset to default');
});

// System Prompt Template Management
const defaultPromptTemplate = `<bos><start_of_turn>user
I am a helpful AI assistant focused on providing accurate, clear, and concise information. I aim to be direct while remaining friendly. I explain complex topics simply and acknowledge when I'm unsure. I follow best practices in coding and provide practical solutions with proper error handling. I maintain objectivity and respect in all interactions.

${msg.content}<end_of_turn>`;

let currentPromptTemplate = defaultPromptTemplate;

// Load saved prompt templates
function loadSavedPromptTemplates() {
    const savedTemplates = JSON.parse(localStorage.getItem('savedPromptTemplates') || '[]');
    const list = document.getElementById('saved-prompts-list');
    list.innerHTML = '';
    
    savedTemplates.forEach((template, index) => {
        const item = document.createElement('div');
        item.className = 'prompt-template-item';
        item.innerHTML = `
            <span>${template.name || `Template ${index + 1}`}</span>
            <div class="prompt-template-actions">
                <button class="btn" onclick="loadPromptTemplate(${index})">Load</button>
                <button class="btn" onclick="deletePromptTemplate(${index})">Delete</button>
            </div>
        `;
        list.appendChild(item);
    });
}

// Save prompt template
function savePromptTemplate() {
    const template = document.getElementById('system-prompt-template').value.trim();
    if (!template) {
        showNotification('Please enter a valid prompt template', 'error');
        return;
    }

    const name = prompt('Enter a name for this template:');
    if (!name) return;

    const savedTemplates = JSON.parse(localStorage.getItem('savedPromptTemplates') || '[]');
    savedTemplates.push({
        name,
        template,
        parameters: { ...modelParams }
    });

    localStorage.setItem('savedPromptTemplates', JSON.stringify(savedTemplates));
    loadSavedPromptTemplates();
    showNotification('Prompt template saved successfully!');
}

// Load prompt template
function loadPromptTemplate(index) {
    const savedTemplates = JSON.parse(localStorage.getItem('savedPromptTemplates') || '[]');
    if (index >= 0 && index < savedTemplates.length) {
        const template = savedTemplates[index];
        document.getElementById('system-prompt-template').value = template.template;
        currentPromptTemplate = template.template;
        
        // Update model parameters if they exist
        if (template.parameters) {
            Object.keys(template.parameters).forEach(key => {
                const slider = document.getElementById(`${key}-slider`);
                const value = document.getElementById(`${key}-value`);
                if (slider && value) {
                    slider.value = template.parameters[key];
                    value.textContent = template.parameters[key];
                    modelParams[key] = template.parameters[key];
                }
            });
        }
        
        updatePromptPreview();
        showNotification('Prompt template loaded successfully!');
    }
}

// Delete prompt template
function deletePromptTemplate(index) {
    if (confirm('Are you sure you want to delete this template?')) {
        const savedTemplates = JSON.parse(localStorage.getItem('savedPromptTemplates') || '[]');
        savedTemplates.splice(index, 1);
        localStorage.setItem('savedPromptTemplates', JSON.stringify(savedTemplates));
        loadSavedPromptTemplates();
        showNotification('Prompt template deleted');
    }
}

// Update prompt preview
function updatePromptPreview() {
    const template = document.getElementById('system-prompt-template').value;
    const preview = document.getElementById('prompt-preview-content');
    const exampleMessage = 'Hello, how can you help me?';
    const previewText = template.replace('${msg.content}', exampleMessage);
    preview.textContent = previewText;
}

// Event listeners for prompt editor
document.getElementById('system-prompt-template').addEventListener('input', updatePromptPreview);
document.getElementById('save-prompt-template').addEventListener('click', savePromptTemplate);
document.getElementById('load-default-template').addEventListener('click', () => {
    document.getElementById('system-prompt-template').value = defaultPromptTemplate;
    currentPromptTemplate = defaultPromptTemplate;
    updatePromptPreview();
});

// Initialize prompt editor
document.addEventListener('DOMContentLoaded', () => {
    loadSavedPromptTemplates();
    updatePromptPreview();
});

// Function to load saved prompts
function loadSavedPrompts() {
    const savedPrompts = localStorage.getItem('savedPrompts');
    console.log('Loading saved prompts from localStorage:', savedPrompts); // Debug log
    if (savedPrompts) {
        try {
            const prompts = JSON.parse(savedPrompts);
            console.log('Parsed prompts:', prompts); // Debug log
            return prompts;
        } catch (e) {
            console.error('Error parsing saved prompts:', e);
            return [];
        }
    }
    return [];
}

// Save prompts to localStorage
function savePrompts(prompts) {
    console.log('Saving prompts:', prompts); // Debug log
    localStorage.setItem('savedPrompts', JSON.stringify(prompts));
}

// Add a new prompt with parameters
function addPrompt(name, content, parameters) {
    const prompts = loadSavedPrompts();
    prompts.push({ 
        name, 
        content, 
        parameters: {
            temperature: parameters.temperature,
            top_p: parameters.top_p,
            max_length: parameters.max_length,
            repeat_penalty: parameters.repeat_penalty,
            frequency_penalty: parameters.frequency_penalty
        }
    });
    savePrompts(prompts);
    return prompts;
}

// Function to save a prompt
function savePrompt() {
    const promptName = document.getElementById('promptName').value.trim();
    const promptContent = document.getElementById('systemPrompt').value.trim();
    
    if (!promptName) {
        showToast('Please enter a name for the prompt', 'error');
        return;
    }
    
    if (!promptContent) {
        showToast('Please enter a prompt', 'error');
        return;
    }
    
    const prompts = loadSavedPrompts();
    console.log('Current saved prompts:', prompts); // Debug log
    
    const existingPrompt = prompts.find(p => p.name === promptName);
    
    if (existingPrompt) {
        if (confirm(`A prompt with the name "${promptName}" already exists. Do you want to update it?`)) {
            // Update existing prompt
            existingPrompt.content = promptContent;
            existingPrompt.parameters = {
                temperature: modelParams.temperature,
                top_p: modelParams.top_p,
                max_length: modelParams.max_length,
                repeat_penalty: modelParams.repeat_penalty,
                frequency_penalty: modelParams.frequency_penalty
            };
            savePrompts(prompts);
            showToast('Prompt updated successfully', 'success');
        }
    } else {
        // Add new prompt
        const newPrompt = {
            name: promptName,
            content: promptContent,
            parameters: {
                temperature: modelParams.temperature,
                top_p: modelParams.top_p,
                max_length: modelParams.max_length,
                repeat_penalty: modelParams.repeat_penalty,
                frequency_penalty: modelParams.frequency_penalty
            }
        };
        prompts.push(newPrompt);
        savePrompts(prompts);
        showToast('Prompt saved successfully', 'success');
    }
    
    // Force update the prompt list
    updatePromptList(prompts);
}

// Function to handle prompt selection from dropdown
function handlePromptSelection() {
    const promptSelect = document.getElementById('promptSelect');
    const selectedPrompt = promptSelect.value;
    const prompts = loadSavedPrompts();
    const prompt = prompts.find(p => p.name === selectedPrompt);
    
    if (prompt) {
        // Set the form values
        document.getElementById('promptName').value = prompt.name;
        document.getElementById('systemPrompt').value = prompt.content;
        
        // Update model parameters
        if (prompt.parameters) {
            modelParams = {
                ...modelParams,
                ...prompt.parameters
            };
            
            // Update UI sliders
            document.getElementById('temperatureValue').textContent = prompt.parameters.temperature;
            document.getElementById('temperatureSlider').value = prompt.parameters.temperature;
            
            document.getElementById('topPValue').textContent = prompt.parameters.top_p;
            document.getElementById('topPSlider').value = prompt.parameters.top_p;
            
            document.getElementById('maxLengthValue').textContent = prompt.parameters.max_length;
            document.getElementById('maxLengthSlider').value = prompt.parameters.max_length;
            
            document.getElementById('repeatPenaltyValue').textContent = prompt.parameters.repeat_penalty;
            document.getElementById('repeatPenaltySlider').value = prompt.parameters.repeat_penalty;
            
            document.getElementById('frequencyPenaltyValue').textContent = prompt.parameters.frequency_penalty;
            document.getElementById('frequencyPenaltySlider').value = prompt.parameters.frequency_penalty;
        }
        
        showToast('Prompt loaded successfully', 'success');
    }
}

// Update the prompt list display
function updatePromptList(prompts) {
    console.log('Updating prompt list with:', prompts); // Debug log
    
    const promptSelect = document.getElementById('promptSelect');
    if (!promptSelect) {
        console.error('promptSelect element not found!');
        return;
    }
    
    promptSelect.innerHTML = '<option value="">Select a prompt</option>';
    
    if (prompts && prompts.length > 0) {
        console.log('Adding prompts to dropdown:', prompts); // Debug log
        prompts.forEach(prompt => {
            const option = document.createElement('option');
            option.value = prompt.name;
            option.textContent = `${prompt.name} (temp: ${prompt.parameters.temperature}, top_p: ${prompt.parameters.top_p})`;
            promptSelect.appendChild(option);
        });
    }
}

// Add event listener for prompt selection
document.getElementById('promptSelect').addEventListener('change', handlePromptSelection);

// Initialize prompt list on load
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded - Initializing prompts'); // Debug log
    const prompts = loadSavedPrompts();
    console.log('Loaded prompts on DOM Content Loaded:', prompts); // Debug log
    updatePromptList(prompts);
});

// Function to edit a prompt
function editPrompt(promptName) {
    const prompts = loadSavedPrompts();
    const prompt = prompts.find(p => p.name === promptName);
    
    if (prompt) {
        // Set the form values
        document.getElementById('promptName').value = prompt.name;
        document.getElementById('systemPrompt').value = prompt.content;
        
        // Update model parameters
        if (prompt.parameters) {
            modelParams = {
                ...modelParams,
                ...prompt.parameters
            };
            
            // Update UI sliders
            document.getElementById('temperatureValue').textContent = prompt.parameters.temperature;
            document.getElementById('temperatureSlider').value = prompt.parameters.temperature;
            
            document.getElementById('topPValue').textContent = prompt.parameters.top_p;
            document.getElementById('topPSlider').value = prompt.parameters.top_p;
            
            document.getElementById('maxLengthValue').textContent = prompt.parameters.max_length;
            document.getElementById('maxLengthSlider').value = prompt.parameters.max_length;
            
            document.getElementById('repeatPenaltyValue').textContent = prompt.parameters.repeat_penalty;
            document.getElementById('repeatPenaltySlider').value = prompt.parameters.repeat_penalty;
            
            document.getElementById('frequencyPenaltyValue').textContent = prompt.parameters.frequency_penalty;
            document.getElementById('frequencyPenaltySlider').value = prompt.parameters.frequency_penalty;
        }
        
        showToast('Prompt loaded for editing', 'success');
    }
}

// Function to delete a prompt
function deletePrompt(promptName) {
    if (confirm(`Are you sure you want to delete the prompt "${promptName}"?`)) {
        const prompts = loadSavedPrompts();
        const updatedPrompts = prompts.filter(p => p.name !== promptName);
        savePrompts(updatedPrompts);
        updatePromptList(updatedPrompts);
        showToast('Prompt deleted successfully', 'success');
        
        // Clear the form if the deleted prompt was being edited
        if (document.getElementById('promptName').value === promptName) {
            resetPrompt();
        }
    }
}

// Reset prompt and parameters to default values
function resetPrompt() {
    // Reset prompt content and name
    document.getElementById('systemPrompt').value = defaultSystemPrompt;
    document.getElementById('promptName').value = '';
    
    // Reset model parameters to default values
    modelParams = {
        temperature: 0.7,
        top_p: 0.9,
        max_length: 2048,
        repeat_penalty: 1.5,
        frequency_penalty: 0.2
    };
    
    // Update UI sliders to default values
    document.getElementById('temperatureValue').textContent = modelParams.temperature;
    document.getElementById('temperatureSlider').value = modelParams.temperature;
    
    document.getElementById('topPValue').textContent = modelParams.top_p;
    document.getElementById('topPSlider').value = modelParams.top_p;
    
    document.getElementById('maxLengthValue').textContent = modelParams.max_length;
    document.getElementById('maxLengthSlider').value = modelParams.max_length;
    
    document.getElementById('repeatPenaltyValue').textContent = modelParams.repeat_penalty;
    document.getElementById('repeatPenaltySlider').value = modelParams.repeat_penalty;
    
    document.getElementById('frequencyPenaltyValue').textContent = modelParams.frequency_penalty;
    document.getElementById('frequencyPenaltySlider').value = modelParams.frequency_penalty;
    
    // Reset prompt selection
    document.getElementById('promptSelect').value = '';
    
    showToast('Prompt and parameters reset to default', 'success');
} 