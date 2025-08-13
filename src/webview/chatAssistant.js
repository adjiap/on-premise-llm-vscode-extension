/**
 * Chat Webview JavaScript
 *
 * Client-side functionality for the On-Premise LLM VSCode Extension.
 * Handles user interactions, message display, and communication with the extension host.
 *
 * @author adjia
 * @since 2025-08-13
 *
 * Communication Protocol:
 * - refreshModels: Request available models from OpenWebUI
 * - sendMessage: Send user chat message to extension
 * - receiveMessage: Display assistant response in chat
 * - updateModels: Update model dropdown options
 */

// VSCode API reference for webview communication
const vscode = acquireVsCodeApi();

/**
 * Requests available models from the OpenWebUI service.
 * Sends 'refreshModels' command to extension host.
 */
function refreshModels() {
  vscode.postMessage({
    command: "refreshModels",
  });
}

/**
 * Sends user message to the LLM service.
 * Validates input, displays message locally, and forwards to extension.
 */
function sendMessage() {
  const input = document.getElementById("messageInput");
  const text = input.value.trim();

  if (text) {
    addMessage(text, "user");
    vscode.postMessage({
      command: "sendMessage",
      text: text,
    });
    input.value = "";
  }
}

/**
 * Adds a message to the chat display.
 * @param {string} text - The message content to display
 * @param {string} sender - Message sender type ('user' or 'assistant')
 */
function addMessage(text, sender) {
  const messages = document.getElementById("messages");
  const messageDiv = document.createElement("div");
  messageDiv.className = "message " + sender;
  messageDiv.textContent = text;
  messages.appendChild(messageDiv);
  messages.scrollTop = messages.scrollHeight;
}

/**
 * Updates the model selection dropdown with available options.
 * @param {string[]} models - Array of available model names
 * @param {string} error - Error message if model loading failed
 */
function updateModelDropdown(models, error) {
  const dropdown = document.getElementById("modelSelect");
  dropdown.innerHTML = "";

  if (error) {
    const option = document.createElement("vscode-option");
    option.value = "";
    option.textContent = "Error loading models";
    dropdown.appendChild(option);
    return;
  }

  if (models.length === 0) {
    const option = document.createElement("vscode-option");
    option.value = "";
    option.textContent = "No models found";
    dropdown.appendChild(option);
    return;
  }

  models.forEach((model) => {
    const option = document.createElement("vscode-option");
    option.value = model;
    option.textContent = model;
    dropdown.appendChild(option);
  });
}

/**
 * Clears all messages from the chat display.
 * Provides immediate UI feedback for conversation reset.
 */
function clearMessages() {
  const messages = document.getElementById("messages");
  messages.innerHTML = "";
}

// Event Listeners

/**
 * Handles messages from the extension host.
 * Routes commands to appropriate handler functions.
 */
window.addEventListener("message", (event) => {
  const message = event.data;

  if (message.command === "receiveMessage") {
    addMessage(message.text, message.sender);
  }

  if (message.command === "updateModels") {
    updateModelDropdown(message.models, message.error);
  }
});

/**
 * Initialize the webview when DOM is loaded.
 * Automatically fetches available models on startup.
 */
window.addEventListener("load", () => {
  refreshModels();
});

/**
 * Handle Enter key in message input for better UX.
 * Allows sending messages without clicking the Send button.
 */
document
  .getElementById("messageInput")
  .addEventListener("keypress", function (e) {
    if (e.key === "Enter") {
      sendMessage();
    }
  });
