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

// Sampling parameters
const temperatureSlider = document.getElementById('temperature');
const temperatureValue = document.getElementById('temperature-value');
const topPSlider = document.getElementById('top-p');
const topPValue = document.getElementById('top-p-value');
const maxLengthInput = document.getElementById('max-length');
const stopSequenceInput = document.getElementById('stop-sequence');
const applyParamsButton = document.getElementById('apply-params-button');

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

// Chat history
let chatHistory = [];

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
          // For complete messages, just set the final text
          assistantMessage.querySelector('.message-content').textContent = data.token;
          responseText = data.token;
        } else {
          // For streaming tokens, append to the existing text
          responseText += data.token;
          assistantMessage.querySelector('.message-content').textContent = responseText;
        }
      }
      
      // If the response is complete, update chat history
      if (data.isComplete) {
        removeStreamingListener();
        chatHistory.push({ user: message, assistant: data.token });
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

// Add message to chat
function addMessageToChat(message, sender) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${sender}-message`;
  
  const messageContent = document.createElement('div');
  messageContent.className = 'message-content';
  messageContent.textContent = message;
  
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
          // For complete messages, just set the final text
          assistantMessage.querySelector('.message-content').textContent = data.token;
          responseText = data.token;
        } else {
          // For streaming tokens, append to the existing text
          responseText += data.token;
          assistantMessage.querySelector('.message-content').textContent = responseText;
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

// Event Listeners
downloadButton.addEventListener('click', downloadModel);
localModelButton.addEventListener('click', selectLocalModel);
changeModelButton.addEventListener('click', changeModel);
reloadModelButton.addEventListener('click', reloadModel);

sendButton.addEventListener('click', sendMessage);
rawChatButton.addEventListener('click', sendRawChatString);

messageInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});

rawChatInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && event.ctrlKey) {
        event.preventDefault();
        sendRawChatString();
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