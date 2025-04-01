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
let isGenerating = false; // Add this flag to track generation state
let shouldStopGeneration = false; // Add this flag for stopping generation
const MODEL_URL = 'https://creativetechnologies.s3.eu-west-2.amazonaws.com/LLM/Meta/llama-2-7b-chat.Q2_K.gguf';
const MODEL_FILENAME = 'llama-2-7b-chat.Q2_K.gguf';

function createWindow() {
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

  // Open DevTools if in dev mode
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
  
  // Add a new handler for stopping response generation
  ipcMain.on('stop-response', () => {
    if (isGenerating) {
      shouldStopGeneration = true;
      console.log('Response generation stopping requested by user');
    }
  });
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
  return store.has('customModelPath') && fs.existsSync(store.get('customModelPath'));
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

// Initialize the model
async function initializeModel(customModelPath = null) {
    try {
        if (model) {
            // If we already have a model loaded but want to switch to a different one
            if (customModelPath) {
                // Unload current model
                model = null;
            } else {
                // Keep using current model
                return;
            }
        }
        
        let modelPath;
        
        if (customModelPath) {
            modelPath = customModelPath;
        } else if (hasCustomModel()) {
            modelPath = getCustomModelPath();
        } else {
            modelPath = await ensureModelExists();
        }

        // Verify model file exists and is readable
        if (!fs.existsSync(modelPath)) {
            throw new Error(`Model file not found at path: ${modelPath}`);
        }

        try {
            fs.accessSync(modelPath, fs.constants.R_OK);
        } catch (err) {
            throw new Error(`Cannot read model file at path: ${modelPath}`);
        }
        
        mainWindow.webContents.send('model-status', { 
            status: 'loading', 
            message: `Loading model: ${path.basename(modelPath)}...` 
        });
        
        console.log(`Loading model from path: ${modelPath}`);
        console.log(`File size: ${fs.statSync(modelPath).size} bytes`);
        
        // Use dynamic import for the node-llama-cpp module
        console.log("Importing node-llama-cpp module...");
        const nodeIlama = await Function('return import("node-llama-cpp")')();
        const { getLlama } = nodeIlama;
        console.log("Import successful, node-llama-cpp module loaded");
        
        console.log("Getting llama interface with debug enabled");
        const llama = await getLlama({
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
            mainWindow.webContents.send('model-status', { 
                status: 'ready', 
                message: `Model loaded and ready: ${path.basename(modelPath)}` 
            });
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
            } catch (basicLoadError) {
                console.error("Error loading with basic configuration:", basicLoadError);
                throw new Error(`Failed to load model: ${basicLoadError.message}`);
            }
        }
    } catch (error) {
        console.error('Error initializing model:', error);
        console.error('Error stack:', error.stack);
        
        // Check for specific error types
        if (error.message && error.message.includes('number of elements') && error.message.includes('block size')) {
            mainWindow.webContents.send('model-status', { 
                status: 'error', 
                message: `Error loading model: This GGUF model appears to have incompatible quantization. Try using a different quantization format (like Q4_0 or Q5_K_M).` 
            });
        } else if (error.message && error.message.includes('is not a function')) {
            mainWindow.webContents.send('model-status', { 
                status: 'error', 
                message: `API compatibility error: The node-llama-cpp version may not be compatible with this application. Try reinstalling node-llama-cpp with 'npm uninstall node-llama-cpp && npm install node-llama-cpp'.` 
            });
        } else if (error.message && error.message.includes('model is corrupted or incomplete')) {
            mainWindow.webContents.send('model-status', { 
                status: 'error', 
                message: `Error loading model: The model file appears to be corrupted or incomplete. Try downloading the model again or using a different model.` 
            });
        } else if (error.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED') {
            mainWindow.webContents.send('model-status', { 
                status: 'error', 
                message: `Module compatibility error: There's an issue with the node-llama-cpp module structure. Try reinstalling with 'npm uninstall node-llama-cpp && npm install node-llama-cpp'.` 
            });
        } else if (error.name === 'InsufficientMemoryError') {
            mainWindow.webContents.send('model-status', { 
                status: 'error', 
                message: `Insufficient memory: Not enough memory to load the model. Try using a smaller model or reducing context size.` 
            });
        } else {
            mainWindow.webContents.send('model-status', { 
                status: 'error', 
                message: `Error initializing model: ${error.message}` 
            });
        }
        throw error;
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

// Process chat message
async function processChatMessage(message, history) {
  if (!model) {
    console.log("No model loaded, initializing model first");
    await initializeModel();
  }
  
  try {
    // Get the model path to determine the model type
    let modelPath = "";
    if (hasCustomModel()) {
      modelPath = getCustomModelPath();
    } else if (modelExists()) {
      modelPath = path.join(getModelsPath(), MODEL_FILENAME);
    }
    
    const modelName = path.basename(modelPath).toLowerCase();
    
    // Format messages using the exact required structure for Gemma 3
    // Note: history now comes in the correct format directly from the frontend
    const messages = Array.isArray(history) ? [...history] : [];

    // If no history provided, set up empty array
    if (!Array.isArray(history) || history.length === 0) {
      // Add current message if not already part of history
      messages.push({
        role: "user",
        content: [{
          type: "text",
          text: message
        }]
      });
    } else {
      // Check if the current message is already the last entry in history
      // This handles cases where the frontend has already added the message to history
      const lastMessage = history[history.length - 1];
      if (lastMessage.role !== "user" || lastMessage.content[0].text !== message) {
        // Add current message if it's not the last message in history
        messages.push({
          role: "user",
          content: [{
            type: "text",
            text: message
          }]
        });
      }
    }

    console.log("Generating response with Gemma 3 chat template format");
    console.log("Messages:", JSON.stringify(messages, null, 2));
    
    // Using the raw sequence-based approach from the documentation
    try {
      console.log("Creating context");
      const context = await model.createContext();
      console.log("Context created successfully");
      
      console.log("Getting sequence");
      const sequence = context.getSequence();
      console.log("Sequence obtained");
      
      // Format the prompt using Gemma 3's chat template format
      let prompt = "";
      
      // Add basic BOS token
      prompt += `<bos>`;
      
      // Add a pre-defined conversation starter to help the model understand its role
      prompt += `<start_of_turn>user
Wer bist du?<end_of_turn>
<start_of_turn>model
Ich bin ein hilfreicher KI-Assistent, gebildet, höflich und immer bereit dich zu unterstützen. Was kann ich für dich tun?<end_of_turn>
`;
      
      // Process each message according to the template
      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        const isLast = i === messages.length - 1;
        
        if (msg.role === "user") {
          prompt += `<start_of_turn>user\n${msg.content[0].text}<end_of_turn>`;
          if (!isLast && messages[i+1].role === "user") {
            // Add a newline between consecutive user messages
            prompt += '\n';
          }
        } else if (msg.role === "assistant") {
          prompt += `<start_of_turn>model\n${msg.content[0].text}`;
          // Always add end_of_turn for assistant messages in chat history
          prompt += `<end_of_turn>`;
          if (!isLast) {
            prompt += '\n';
          }
        }
      }
      
      // If no additional messages were added, remove trailing newline
      if (messages.length === 1 && messages[0].role === "user") {
        // Remove trailing newline after <end_of_turn>
        prompt = prompt.trim();
      }
      
      // If this is a test message, add the second part of the test prompt
      if (message === "test" && messages.length === 1) {
        // Replace the entire prompt with a pre-defined test conversation
        prompt = `<bos><start_of_turn>user
Hallo!<end_of_turn>
<start_of_turn>model
Hallo! Wie kann ich dir helfen?<end_of_turn>
<start_of_turn>user
wie gehts dir<end_of_turn>`;
      }
      
      // Make sure there's no <start_of_turn>model at the end
      if (prompt.endsWith('<start_of_turn>model') || prompt.match(/<start_of_turn>model\s*$/)) {
        console.log("Detected <start_of_turn>model at the end of prompt, removing it");
        prompt = prompt.replace(/<start_of_turn>model\s*$/, '');
      }
      
      // Log the complete prompt
      console.log("Complete prompt structure:");
      console.log(JSON.stringify(messages, null, 2));
      console.log("\nComplete formatted prompt:");
      console.log(prompt);
      
      // Tokenize the prompt
      console.log("Tokenizing prompt");
      const tokens = model.tokenize(prompt);
      console.log(`Tokenized prompt into ${tokens.length} tokens`);
      
      // Add additional detailed logging of the final prompt
      console.log("=== FINAL PROMPT BEFORE SUBMISSION TO MODEL ===");
      console.log(prompt);
      console.log("=== END OF FINAL PROMPT ===");
      
      // Array to collect generated tokens
      const responseTokens = [];
      console.log("Starting token generation");
      
      // Define a stopCondition function
      const stopCondition = (text) => {
        // Stop on end_of_turn token
        if (text.includes("<end_of_turn>")) {
          return true;
        }
        
        // Common stop condition
        if (responseTokens.length > 800) {
          return true;
        }
        
        return false;
      };
      
      try {
        // Use the evaluate generator to process tokens one by one
        for await (const generatedToken of sequence.evaluate(tokens)) {
          responseTokens.push(generatedToken);
          
          // Send the current token to the frontend
          const currentText = model.detokenize(responseTokens);
          mainWindow.webContents.send('streaming-token', {
            token: currentText,
            isComplete: false
          });
          
          // Check if we should stop generation
          if (stopCondition(currentText)) {
            console.log("Stop condition met, halting generation");
            break;
          }
        }
        
        // Send final complete response
        let responseText = model.detokenize(responseTokens);
        console.log("Response generation completed");
        
        // Clean up the response
        responseText = responseText
          .replace(/<end_of_turn>/g, '')
          .replace(/<start_of_turn>model\n/g, '')
          .replace(/<start_of_turn>model /g, '')
          .replace(/<start_of_turn>model/g, '')
          .replace(/<start_of_turn>user\n/g, '')
          .replace(/<start_of_turn>user /g, '')
          .replace(/<start_of_turn>user/g, '')
          .replace(/<bos>.*?<start_of_turn>/gs, '') // Remove bos token and its content
          .trim();
        
        // Send the final response
        mainWindow.webContents.send('streaming-token', {
          token: responseText,
          isComplete: true
        });
        
        return responseText;
      } catch (evaluateError) {
        console.error("Error during token generation:", evaluateError);
        throw evaluateError;
      }
    } catch (error) {
      console.error("Error processing chat message:", error);
      mainWindow.webContents.send('streaming-token', {
        token: `Error: ${error.message}`,
        isComplete: true
      });
      throw error;
    }
  } catch (error) {
    console.error("Error processing chat message:", error);
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

// IPC handlers
ipcMain.handle('check-model', async () => {
  return hasCustomModel() || modelExists();
});

ipcMain.handle('download-model', async () => {
  try {
    await downloadModel();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('select-local-model', async () => {
  try {
    const modelPath = await selectLocalModel();
    if (modelPath) {
      await initializeModel(modelPath);
      return { success: true, path: modelPath };
    } else {
      return { success: false, error: 'Model selection canceled' };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('init-model', async () => {
  try {
    await initializeModel();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('chat-message', async (event, { message, history }) => {
  try {
    const response = await processChatMessage(message, history);
    return { success: true, response };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Modify your existing message handler in main.js
ipcMain.on('send-message', async (event, message) => {
  if (!llamaInterface) {
    mainWindow.webContents.send('receive-message', 'Error: Model not loaded.');
    return;
  }
  
  try {
    isGenerating = true;
    shouldStopGeneration = false;
    
    // Start the AI response generation
    const response = await llamaInterface.prompt(message);
    
    // If your response is streaming (returns an iterator or can be processed in chunks)
    let responseText = '';
    
    // This part will depend on how exactly your llamaInterface works
    // Example for streaming response:
    for await (const chunk of response) {
      if (shouldStopGeneration) {
        // Send notification that generation was stopped
        mainWindow.webContents.send('response-stopped');
        break;
      }
      
      responseText += chunk;
      // Send partial responses to show progress
      mainWindow.webContents.send('response-chunk', chunk);
    }
    
    // If we didn't stop, send the complete response
    if (!shouldStopGeneration) {
      mainWindow.webContents.send('response-complete', responseText);
    }
  } catch (error) {
    console.error('Error generating response:', error);
    mainWindow.webContents.send('receive-message', 'Error: Failed to generate response.');
  } finally {
    isGenerating = false;
    shouldStopGeneration = false;
  }
});