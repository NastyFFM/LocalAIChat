// DOM Elements
const statusIndicator = document.querySelector('.status-indicator');
const statusText = document.getElementById('status-text');
const downloadSection = document.getElementById('download-section');
const downloadButton = document.getElementById('download-button');
const localModelButton = document.getElementById('local-model-button');
const changeModelButton = document.getElementById('change-model-button');
const progressContainer = document.getElementById('progress-container');
const progressBar = document.getElementById('progress-bar');
const downloadStatus = document.getElementById('download-status');
const chatInterface = document.getElementById('chat-interface');
const chatContainer = document.getElementById('chat-container');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const testButton = document.getElementById('testButton');

// Chat history
let chatHistory = [];

// Add an entry to chat history
function addToChatHistory(role, message) {
  chatHistory.push({
    role: role,
    content: [{
      type: "text",
      text: message
    }]
  });
}

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
  messageInput.focus();
}

// Handle message sending
function sendMessage() {
  const message = messageInput.value.trim();
  
  if (message) {
    try {
      // Display user message in the chat
      addMessageToChat('user', message);
      messageInput.value = '';
      
      // Add user message to history
      addToChatHistory('user', message);
      
      // Disable the send button during AI response
      sendButton.disabled = true;
      
      // Create a new unique container for this response
      const responseId = 'response-' + Date.now();
      const assistantMessageDiv = document.createElement('div');
      assistantMessageDiv.className = 'message assistant-message';
      assistantMessageDiv.id = responseId;
      const messageContent = document.createElement('div');
      messageContent.className = 'message-content';
      messageContent.textContent = '...'; // Initial content
      assistantMessageDiv.appendChild(messageContent);
      chatContainer.appendChild(assistantMessageDiv);
      chatContainer.scrollTop = chatContainer.scrollHeight;
      
      // Will hold the aggregated message text
      let messageText = '';
      
      // Clear any previous token listeners
      const previousListener = window.electronAPI.onStreamingToken(() => {});
      if (previousListener) previousListener();
      
      // Create a custom streaming handler for this specific message
      const streamingHandler = ({ token, isComplete }) => {
        // Save this token as the latest response
        messageText = token;
        
        // Update only this message element
        const thisElement = document.getElementById(responseId);
        if (thisElement) {
          const thisContent = thisElement.querySelector('.message-content');
          if (thisContent) {
            thisContent.textContent = messageText;
          }
        }
        
        // If complete, re-enable send button and add to history
        if (isComplete) {
          sendButton.disabled = false;
          
          // Add assistant response to history
          addToChatHistory('assistant', messageText);
        }
        
        // Always scroll to the latest message
        chatContainer.scrollTop = chatContainer.scrollHeight;
      };
      
      // Register listener for this message
      const removeListener = window.electronAPI.onStreamingToken(streamingHandler);
      
      // Send the message to main process along with the entire chat history
      window.electronAPI.sendMessage(message, chatHistory)
        .then(result => {
          if (!result.success) {
            console.error('Error sending message:', result.error);
            messageContent.textContent = 'Error: ' + result.error;
            sendButton.disabled = false;
            
            // Remove listener
            if (removeListener) removeListener();
          }
        })
        .catch(error => {
          console.error('Exception sending message:', error);
          messageContent.textContent = 'Error: Failed to send message';
          sendButton.disabled = false;
          
          // Remove listener
          if (removeListener) removeListener();
        });
    } catch (error) {
      console.error('Error in sendMessage:', error);
      sendButton.disabled = false;
    }
  }
}

// Helper functions to manage chat messages
function addPlaceholderToChat(sender, id) {
  // Create a message element with the given ID
  const messageElement = document.createElement('div');
  messageElement.className = `message ${sender}-message`;
  messageElement.id = id;
  messageElement.innerHTML = '<div class="typing-indicator">...</div>';
  chatContainer.appendChild(messageElement);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function updateResponseInChat(id, text) {
  const messageElement = document.getElementById(id);
  if (messageElement) {
    messageElement.innerHTML = `<p>${text}</p>`;
    messageElement.scrollIntoView({ behavior: 'smooth' });
  }
}

function completeResponseInChat(id, text) {
  const messageElement = document.getElementById(id);
  if (messageElement) {
    messageElement.innerHTML = `<p>${text}</p>`;
    messageElement.scrollIntoView({ behavior: 'smooth' });
  }
}

function addMessageToChat(sender, message) {
  const messageElement = document.createElement('div');
  messageElement.className = `message ${sender}-message`;
  messageElement.innerHTML = `<p>${message}</p>`;
  chatContainer.appendChild(messageElement);
  chatContainer.scrollTop = chatContainer.scrollHeight;
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
        
        // Add user message to chat and history
        const testMessage = 'test';
        addMessageToChat('test', 'user');
        addToChatHistory('user', testMessage);
        
        // Create a new unique container for this test response
        const responseId = 'test-response-' + Date.now();
        const assistantMessageDiv = document.createElement('div');
        assistantMessageDiv.className = 'message assistant';
        assistantMessageDiv.id = responseId;
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        messageContent.textContent = '...'; // Initial content
        assistantMessageDiv.appendChild(messageContent);
        chatContainer.appendChild(assistantMessageDiv);
        
        // Will hold the aggregated message text
        let messageText = '';
        
        // Clear any previous token listeners
        const previousListener = window.electronAPI.onStreamingToken(() => {});
        if (previousListener) previousListener();
        
        // Create a custom streaming handler for this specific message
        const streamingHandler = ({ token, isComplete }) => {
            // Save this token as the latest response
            messageText = token;
            
            // Update only this message element
            const thisElement = document.getElementById(responseId);
            if (thisElement) {
                const thisContent = thisElement.querySelector('.message-content');
                if (thisContent) {
                    thisContent.textContent = messageText;
                }
            }
            
            // If complete, re-enable test button and add to history
            if (isComplete) {
                testButton.disabled = false;
                
                // Add the assistant's response to chat history
                addToChatHistory('assistant', messageText);
            }
            
            // Always scroll to the latest message
            chatContainer.scrollTop = chatContainer.scrollHeight;
        };
        
        // Register listener for this message
        const removeListener = window.electronAPI.onStreamingToken(streamingHandler);
        
        // Send the test prompt to main process with current history
        const result = await window.electronAPI.sendMessage(testMessage, chatHistory);
        
        if (!result.success) {
            // Remove listener in case of error
            if (removeListener) removeListener();
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Error sending test prompt:', error);
        alert('Error sending test prompt: ' + error.message);
        testButton.disabled = false;
    }
}

// Event Listeners
downloadButton.addEventListener('click', downloadModel);
localModelButton.addEventListener('click', selectLocalModel);
changeModelButton.addEventListener('click', changeModel);

sendButton.addEventListener('click', sendMessage);

messageInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});

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