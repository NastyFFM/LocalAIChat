const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const Store = require('electron-store');

// Initialize settings store
const store = new Store();

let mainWindow;
let model = null;
let llamaInterface = null;
const MODEL_URL = 'https://creativetechnologies.s3.eu-west-2.amazonaws.com/LLM/Meta/llama-2-7b-chat.Q2_K.gguf';
const MODEL_FILENAME = 'llama-2-7b-chat.Q2_K.gguf';

function createWindow() {
  console.log("Creating main window");
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');
  
  // Set up IPC handlers
  setupIPCHandlers();

  // Open the DevTools in development mode
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
    console.log("DevTools opened in development mode");
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  
  console.log("Main window created");
}

// Get the models directory path
function getModelsPath() {
  let modelsPath;
  // Always use the local models directory for consistency
  modelsPath = path.join(__dirname, 'models');

  // Create directory if it doesn't exist
  if (!fs.existsSync(modelsPath)) {
    fs.mkdirSync(modelsPath, { recursive: true });
  }

  return modelsPath;
}

// Check if model exists
function modelExists() {
  const modelPath = path.join(getModelsPath(), MODEL_FILENAME);
  return fs.existsSync(modelPath);
}

// Check if a custom model is saved in settings
function hasCustomModel() {
  const customPath = store.get('customModelPath');
  const exists = customPath && fs.existsSync(customPath);
  
  // If path is stored but file doesn't exist, log a warning but don't show error to user
  if (customPath && !exists) {
    console.warn(`Saved model path exists but file not found: ${customPath}`);
    // Returning false will trigger the download view to be shown
  }
  
  return exists;
}

// Get the custom model path from settings
function getCustomModelPath() {
  return store.get('customModelPath');
}

// Save custom model path to settings
function saveCustomModelPath(modelPath) {
  store.set('customModelPath', modelPath);
}

// Download model from S3
async function downloadModel() {
  const modelsPath = getModelsPath();
  const modelPath = path.join(modelsPath, MODEL_FILENAME);
  
  // If model already exists, don't download again
  if (modelExists()) {
    mainWindow.webContents.send('model-status', { status: 'exists', message: 'Model already downloaded' });
    return modelPath;
  }

  mainWindow.webContents.send('model-status', { status: 'downloading', message: 'Downloading model...' });
  
  try {
    const writer = fs.createWriteStream(modelPath);
    const response = await axios({
      url: MODEL_URL,
      method: 'GET',
      responseType: 'stream',
      onDownloadProgress: (progressEvent) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        mainWindow.webContents.send('download-progress', percentCompleted);
      }
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        mainWindow.webContents.send('model-status', { status: 'ready', message: 'Model downloaded successfully' });
        resolve(modelPath);
      });
      writer.on('error', (err) => {
        mainWindow.webContents.send('model-status', { status: 'error', message: `Error downloading model: ${err.message}` });
        reject(err);
      });
    });
  } catch (error) {
    mainWindow.webContents.send('model-status', { status: 'error', message: `Error downloading model: ${error.message}` });
    throw error;
  }
}

// Check if a file is a valid GGUF model
async function isValidGGUFModel(filePath) {
  try {
    // Check file extension
    if (!filePath.toLowerCase().endsWith('.gguf')) {
      return {
        valid: false,
        reason: 'File does not have a .gguf extension'
      };
    }
    
    // Read the first 128 bytes of the file to check for GGUF magic header
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(128);
    fs.readSync(fd, buffer, 0, 128, 0);
    fs.closeSync(fd);
    
    // GGUF magic is "GGUF" in ASCII (0x47475546)
    if (buffer.toString('ascii', 0, 4) !== 'GGUF') {
      return {
        valid: false,
        reason: 'Not a valid GGUF format file (missing GGUF header)'
      };
    }
    
    // Check quantization format (rough heuristic based on filename)
    const filename = path.basename(filePath).toLowerCase();
    const preferredFormats = ['q4_0', 'q4_1', 'q5_0', 'q5_k_m', 'q6_k', 'q8_0'];
    const hasPreferredFormat = preferredFormats.some(format => filename.includes(format));
    
    if (!hasPreferredFormat) {
      return {
        valid: true,
        warning: 'This model quantization may not be fully compatible. Models with Q4_0, Q5_K_M or Q8_0 quantization are recommended.'
      };
    }
    
    return {
      valid: true
    };
  } catch (error) {
    console.error('Error checking GGUF file:', error);
    return {
      valid: false,
      reason: `Error checking file: ${error.message}`
    };
  }
}

// Select a local GGUF model file
async function selectLocalModel() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select GGUF Model File',
    properties: ['openFile'],
    filters: [
      { name: 'GGUF Models', extensions: ['gguf'] }
    ]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const modelPath = result.filePaths[0];
  
  // Check if the selected model is valid
  const validationResult = await isValidGGUFModel(modelPath);
  
  if (!validationResult.valid) {
    mainWindow.webContents.send('model-status', { 
      status: 'error', 
      message: `Invalid model: ${validationResult.reason}` 
    });
    return null;
  }
  
  if (validationResult.warning) {
    mainWindow.webContents.send('model-status', { 
      status: 'warning', 
      message: validationResult.warning 
    });
  }
  
  // Save the valid model path
  saveCustomModelPath(modelPath);
  
  mainWindow.webContents.send('model-status', { 
    status: 'exists', 
    message: `Custom model selected: ${path.basename(modelPath)}` 
  });
  
  return modelPath;
}

// Explicitly send model status update
function updateModelStatus(status, message) {
  console.log(`Updating model status: ${status} - ${message}`);
  if (mainWindow) {
    mainWindow.webContents.send('model-status', { 
      status: status, 
      message: message 
    });
  } else {
    console.error("Cannot update model status: mainWindow is not defined");
  }
}

// Initialize the model
async function initializeModel(customModelPath = null) {
    console.log("==================== MODEL INITIALIZATION STARTED ====================");
    try {
        if (model) {
            console.log("Model already loaded, checking if we need to reload");
            // If we already have a model loaded but want to switch to a different one
            if (customModelPath) {
                console.log("Switching to new model path, unloading current model");
                // Unload current model
                model = null;
            } else {
                // Keep using current model
                console.log("Using already loaded model");
                // Send ready status to ensure UI is updated
                updateModelStatus('ready', `Model already loaded and ready`);
                return { success: true };
            }
        }
        
        let modelPath;
        
        if (customModelPath) {
            modelPath = customModelPath;
            console.log(`Using custom model path: ${modelPath}`);
        } else if (hasCustomModel()) {
            modelPath = getCustomModelPath();
            console.log(`Using saved custom model path: ${modelPath}`);
        } else {
            modelPath = await ensureModelExists();
            console.log(`Using default model path: ${modelPath}`);
        }

        // Verify model file exists and is readable
        if (!fs.existsSync(modelPath)) {
            const errorMessage = `Model file not found at path: ${modelPath}`;
            console.error(errorMessage);
            updateModelStatus('error', `Model nicht gefunden`);
            throw new Error(errorMessage);
        }

        try {
            fs.accessSync(modelPath, fs.constants.R_OK);
            console.log("Model file is readable");
        } catch (err) {
            console.error(`Cannot read model file: ${err}`);
            updateModelStatus('error', `Cannot read model file at path: ${modelPath}`);
            throw new Error(`Cannot read model file at path: ${modelPath}`);
        }
        
        updateModelStatus('loading', `Loading model: ${path.basename(modelPath)}...`);
        
        console.log(`Loading model from path: ${modelPath}`);
        console.log(`File size: ${fs.statSync(modelPath).size} bytes`);
        
        // Use dynamic import for the node-llama-cpp module
        console.log("Importing node-llama-cpp module...");
        const nodeIlama = await Function('return import("node-llama-cpp")')();
        const { getLlama } = nodeIlama;
        console.log("Import successful, node-llama-cpp module loaded");
        
        console.log("Getting llama interface with debug enabled");
        const llama = await getLlama("lastBuild", {
            debug: true,
            logLevel: 'debug'
        });
        console.log("Llama interface loaded successfully");
        
        console.log("Attempting to load model with the following configuration:");
        const modelConfig = {
            modelPath: modelPath,
            contextSize: 2048,
            batchSize: 512,
            gpuLayers: 0,
            seed: 42,
            f16Kv: true,
            logitsAll: false,
            vocabOnly: false,
            useMlock: false,
            embedding: false,
            useMmap: true
        };
        console.log(JSON.stringify(modelConfig, null, 2));
        
        // Load the model using the new API
        console.log("Loading model now...");
        try {
            model = await llama.loadModel(modelConfig);
            console.log("Model loaded successfully");
            
            // Model loaded successfully, send ready status
            updateModelStatus('ready', `Model loaded and ready: ${path.basename(modelPath)}`);
            
            console.log("==================== MODEL INITIALIZATION COMPLETED SUCCESSFULLY ====================");
            
            // Force a short delay to ensure the status update is received
            await new Promise(resolve => setTimeout(resolve, 100));
            
            return { success: true };
        } catch (loadError) {
            console.error("Error during model loading:", loadError);
            console.error("Error details:", JSON.stringify(loadError, null, 2));
            console.error("Error stack:", loadError.stack);
            
            // Try loading without advanced settings
            console.log("Attempting to load model with basic configuration...");
            const basicConfig = {
                modelPath: modelPath,
                contextSize: 2048,
                batchSize: 512
            };
            console.log("Basic config:", JSON.stringify(basicConfig, null, 2));
            
            try {
                model = await llama.loadModel(basicConfig);
                console.log("Model loaded successfully with basic configuration");
                
                // Model loaded successfully with basic configuration, send ready status
                updateModelStatus('ready', `Model loaded and ready: ${path.basename(modelPath)}`);
                
                console.log("==================== MODEL INITIALIZATION COMPLETED SUCCESSFULLY (BASIC CONFIG) ====================");
                
                // Force a short delay to ensure the status update is received
                await new Promise(resolve => setTimeout(resolve, 100));
                
                return { success: true };
            } catch (basicLoadError) {
                console.error("Error loading with basic configuration:", basicLoadError);
                updateModelStatus('error', `Failed to load model: ${basicLoadError.message}`);
                console.log("==================== MODEL INITIALIZATION FAILED ====================");
                return { success: false, error: basicLoadError.message };
            }
        }
    } catch (error) {
        console.error('Error initializing model:', error);
        console.error('Error stack:', error.stack);
        
        // Check for specific error types
        if (error.message && error.message.includes('number of elements') && error.message.includes('block size')) {
            updateModelStatus('error', `Error loading model: This GGUF model appears to have incompatible quantization. Try using a different quantization format (like Q4_0 or Q5_K_M).`);
        } else if (error.message && error.message.includes('is not a function')) {
            updateModelStatus('error', `API compatibility error: The node-llama-cpp version may not be compatible with this application. Try reinstalling node-llama-cpp with 'npm uninstall node-llama-cpp && npm install node-llama-cpp'.`);
        } else if (error.message && error.message.includes('model is corrupted or incomplete')) {
            updateModelStatus('error', `Error loading model: The model file appears to be corrupted or incomplete. Try downloading the model again or using a different model.`);
        } else if (error.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED') {
            updateModelStatus('error', `Module compatibility error: There's an issue with the node-llama-cpp module structure. Try reinstalling with 'npm uninstall node-llama-cpp && npm install node-llama-cpp'.`);
        } else if (error.name === 'InsufficientMemoryError') {
            updateModelStatus('error', `Insufficient memory: Not enough memory to load the model. Try using a smaller model or reducing context size.`);
        } else {
            updateModelStatus('error', `Error initializing model: ${error.message}`);
        }
        console.log("==================== MODEL INITIALIZATION FAILED ====================");
        return { success: false, error: error.message };
    }
}

// Ensure model exists, download if needed
async function ensureModelExists() {
  if (modelExists()) {
    return path.join(getModelsPath(), MODEL_FILENAME);
  } else {
    return await downloadModel();
  }
}

// Add this function to load the system prompt
function loadSystemPrompt() {
  const customPrompt = store.get('systemPrompt');
  if (customPrompt) {
    return customPrompt;
  }
  return `I am a helpful AI assistant focused on providing accurate, clear, and concise information. I aim to be direct while remaining friendly. I explain complex topics simply and acknowledge when I'm unsure. I follow best practices in coding and provide practical solutions with proper error handling. I maintain objectivity and respect in all interactions.`;
}

// Update the processChatMessage function
async function processChatMessage(message, params = {}) {
  if (!model) {
    console.error('Model not initialized');
    return;
  }

  // Merge default parameters with provided ones
  const modelParams = {
    temperature: 0.7,
    top_p: 0.9,
    max_length: 2048,
    stop_sequence: ['<end_of_turn>'],
    repeat_penalty: 1.5,
    frequency_penalty: 0.2,
    ...params
  };

  // Get the current chat history
  const history = currentChat ? currentChat.messages : [];
  
  // Get the selected prompt from the chat history
  const selectedPrompt = history.length > 0 ? history[0].prompt : null;
  
  // Format the prompt
  let prompt = '';
  if (history.length === 0) {
    // First message - use the selected prompt or default
    prompt = selectedPrompt || defaultSystemPrompt;
    prompt = prompt.replace('{message}', message);
  } else {
    // Subsequent messages - use chat history
    prompt = formatChatHistory(history, message);
  }

  console.log('Complete prompt before tokenization:', prompt);

  // Log the complete prompt before tokenization
  console.log('\n=== PROMPT SENT TO AI ===');
  console.log(prompt);
  console.log('=== END PROMPT ===\n');

  // Create context and get sequence
  const context = await model.createContext({
    temperature: modelParams.temperature,
    top_p: modelParams.top_p
  });
  const sequence = context.getSequence();

  // Tokenize the prompt
  const tokens = model.tokenize(prompt);
  console.log('Tokenized prompt length:', tokens.length);

  // Generate response
  let response = '';
  const stopCondition = (text) => {
    // Stop on end_of_turn token
    if (text.includes('<end_of_turn>')) {
      return true;
    }
    // Stop on custom stop sequence
    if (modelParams.stop_sequence && text.includes(modelParams.stop_sequence)) {
      return true;
    }
    return false;
  };

  for await (const token of sequence.evaluate(tokens)) {
    // Make sure model is still available (in case of model switching)
    if (!model) {
      throw new Error('Model was unloaded during processing');
    }
    
    const tokenText = model.detokenize([token]);
    response += tokenText;
    
    // Send individual token to renderer
    mainWindow.webContents.send('streaming-token', {
      token: tokenText,
      isComplete: false
    });

    if (stopCondition(response)) {
      break;
    }
  }

  // Clean up response by removing the end_of_turn token
  response = response.replace(/<end_of_turn>.*$/, '').trim();
  
  // Remove repeated user input patterns from the response
  if (message && response.includes(message)) {
    const escapedMessage = message.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(\\*\\*Date:\\*\\*)?${escapedMessage}`, 'g');
    response = response.replace(pattern, '');
  }

  // Clean up any patterns like "🗓️ **Date:**" that might be duplicated
  response = response.replace(/(🗓️\s*\*\*Date:\*\*)\s*🗓️\s*\*\*Date:\*\*/g, '$1');
  
  // Final cleanup of any remaining artifacts
  response = response.replace(/🗓️\s*\*\*schreibe mir eine Einladung zum[^*]*\*\*/g, '🗓️ **Date:**');
  
  // Trim any excessive whitespace
  response = response.trim();

  // Log the AI's response
  console.log('AI Response:', response);

  // Send final complete response
  mainWindow.webContents.send('streaming-token', {
    token: response,
    isComplete: true
  });

  return response;
}

// Process raw chat string
async function processRawChatString(rawString, params = null) {
    if (!model) {
        throw new Error('Model not initialized');
    }

    if (!mainWindow) {
        throw new Error('Main window not initialized');
    }

    // Default parameters
    const defaultParams = {
        temperature: 0.1,           // Lower temperature for more deterministic output
        top_p: 0.95,               // Nucleus sampling threshold
        top_k: 64,                 // Limit to top 64 most likely tokens
        repeat_penalty: 1.0,       // Penalty for repeated tokens
        min_p: 0.01,               // Minimum probability for tokens
        max_length: 8192,          // Maximum output length
        stop_sequence: '<end_of_turn>'
    };

    // Merge with provided parameters
    const modelParams = { ...defaultParams, ...(params || {}) };
    console.log('Using model parameters:', modelParams);

    try {
        // Create context and get sequence
        const context = await model.createContext({
            temperature: modelParams.temperature,
            top_p: modelParams.top_p
        });
        const sequence = context.getSequence();

        // Tokenize the prompt
        const tokens = model.tokenize(rawString);
        console.log('Tokenized prompt length:', tokens.length);

        // Generate response
        let response = '';
        const stopCondition = (text) => {
            // Stop on end_of_turn token
            if (text.includes('<end_of_turn>')) {
                return true;
            }
            // Stop on custom stop sequence
            if (modelParams.stop_sequence && 
                modelParams.stop_sequence !== '<end_of_turn>' && 
                text.includes(modelParams.stop_sequence)) {
                return true;
            }
            // Stop on max length
            if (response.length > modelParams.max_length) {
                return true;
            }
            return false;
        };

        for await (const token of sequence.evaluate(tokens)) {
            // Make sure model is still available (in case of model switching)
            if (!model) {
                throw new Error('Model was unloaded during processing');
            }
            
            const tokenText = model.detokenize([token]);
            response += tokenText;
            
            // Send individual token to renderer
            mainWindow.webContents.send('streaming-token', {
                token: tokenText,
                isComplete: false
            });

            if (stopCondition(response)) {
                break;
            }
        }

        // Clean up response by removing the end_of_turn token
        response = response.replace(/<end_of_turn>.*$/, '').trim();
        
        // Remove repeated user input patterns from the response
        if (rawString && response.includes(rawString)) {
            const escapedMessage = rawString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const pattern = new RegExp(`(\\*\\*Date:\\*\\*)?${escapedMessage}`, 'g');
            response = response.replace(pattern, '');
        }

        // Clean up any patterns like "🗓️ **Date:**" that might be duplicated
        response = response.replace(/(🗓️\s*\*\*Date:\*\*)\s*🗓️\s*\*\*Date:\*\*/g, '$1');
        
        // Final cleanup of any remaining artifacts
        response = response.replace(/🗓️\s*\*\*schreibe mir eine Einladung zum[^*]*\*\*/g, '🗓️ **Date:**');
        
        // Trim any excessive whitespace
        response = response.trim();

        // Log the AI's response
        console.log('AI Response:', response);

        // Send final complete response
        mainWindow.webContents.send('streaming-token', {
            token: response,
            isComplete: true
        });

        return response;
    } catch (error) {
        console.error('Error processing raw chat string:', error);
        mainWindow.webContents.send('streaming-token', {
            token: `Error: ${error.message}`,
            isComplete: true
        });
        throw error;
    }
}

// App ready event
app.whenReady().then(() => {
  createWindow();
  
  // Check for model on startup
  if (hasCustomModel() || modelExists()) {
    // Initialize model in background if it already exists
    initializeModel();
  }
  
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Define IPC handlers
function setupIPCHandlers() {
  console.log("Setting up IPC handlers");
  
  // Handle sending messages to the model
  ipcMain.handle('chat-message', async (event, params) => {
    console.log("IPC: chat-message received", params);
    try {
      const { message, history, params: modelParams } = params;
      console.log(`Processing message: "${message}" with history length: ${history.length}`);
      const result = await processChatMessage(message, history, modelParams);
      console.log("IPC: chat-message processed");
      return result;
    } catch (error) {
      console.error("IPC: chat-message error:", error);
      return { success: false, error: error.message };
    }
  });
  
  // Handle model checking
  ipcMain.handle('check-model', async () => {
    console.log("IPC: check-model received");
    return hasCustomModel() || modelExists();
  });
  
  // Handle model initialization
  ipcMain.handle('init-model', async () => {
    console.log("IPC: init-model received");
    try {
      const result = await initializeModel();
      console.log("IPC: init-model completed");
      return result;
    } catch (error) {
      console.error("IPC: init-model error:", error);
      return { success: false, error: error.message };
    }
  });
  
  // Handle model download
  ipcMain.handle('download-model', async () => {
    console.log("IPC: download-model received");
    try {
      await downloadModel();
      console.log("IPC: download-model completed");
      return { success: true };
    } catch (error) {
      console.error("IPC: download-model error:", error);
      return { success: false, error: error.message };
    }
  });
  
  // Handle local model selection
  ipcMain.handle('select-local-model', async () => {
    console.log("IPC: select-local-model received");
    try {
      const modelPath = await selectLocalModel();
      if (modelPath) {
        await initializeModel(modelPath);
        console.log("IPC: select-local-model completed");
        return { success: true, path: modelPath };
      } else {
        console.log("IPC: select-local-model canceled");
        return { success: false, error: 'Model selection canceled' };
      }
    } catch (error) {
      console.error("IPC: select-local-model error:", error);
      return { success: false, error: error.message };
    }
  });
  
  // Handle raw chat string
  ipcMain.handle('raw-chat-string', async (event, params) => {
    console.log("IPC: raw-chat-string received");
    try {
      const { rawString, params: modelParams } = params;
      const result = await processRawChatString(rawString, modelParams);
      console.log("IPC: raw-chat-string processed");
      return result;
    } catch (error) {
      console.error("IPC: raw-chat-string error:", error);
      return { success: false, error: error.message };
    }
  });
  
  // Add handler for system prompt updates
  ipcMain.handle('update-system-prompt', (event, newPrompt) => {
    try {
      store.set('systemPrompt', newPrompt);
      return { success: true };
    } catch (error) {
      console.error('Error saving system prompt:', error);
      return { success: false, error: error.message };
    }
  });

  // Add handler for getting current system prompt
  ipcMain.handle('get-system-prompt', () => {
    return loadSystemPrompt();
  });
  
  console.log("IPC handlers setup complete");
}
