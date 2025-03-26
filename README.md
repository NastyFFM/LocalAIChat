# LocalAI Chat

A cross-platform desktop application (Windows/macOS) that allows you to chat with AI models locally on your computer. This application downloads a specified AI model from a public source and provides a chat interface to interact with it.

## Features

- Downloads AI models from a specified source (only once)
- Provides a chat interface for interacting with the AI model
- Works completely offline after the initial model download
- Runs on both Windows and macOS

## Requirements

- Node.js 18.x or later
- npm or yarn
- At least 4GB of RAM for running the model
- At least 2GB of free disk space for the model

## Installation

1. Clone this repository:
   ```
   git clone https://github.com/yourusername/localai-chat.git
   cd localai-chat
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the application:
   ```
   npm start
   ```

The application will prompt you to download the AI model on first run. Once downloaded, the model is stored locally and won't be downloaded again on subsequent runs.

## Development

- Run in development mode:
  ```
  npm run dev
  ```

- Build for your platform:
  ```
  npm run build
  ```

- Build for specific platforms:
  ```
  npm run build:mac
  npm run build:win
  ```

## How It Works

The application uses:
- Electron for the desktop application framework
- node-llama-cpp for interfacing with the AI model
- Axios for downloading the model

The model is downloaded from a public AWS S3 bucket and stored in the `models` directory. Once downloaded, the application uses node-llama-cpp to load the model and generate responses locally on your machine.

## Customization

To use a different model, modify the `MODEL_URL` and `MODEL_FILENAME` constants in `main.js`.

## License

MIT

## Acknowledgments

This project uses the Gemma 3 1B Instruct model, which is made available under its respective license. 