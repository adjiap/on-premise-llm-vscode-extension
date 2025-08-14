/**
 * Chat Webview JavaScript
 *
 * Client-side functionality for the On-Premise LLM VSCode Extension.
 * Handles user interactions, message display, and communication with the extension host.
 *
 * @author adjia
 * @since 2025-08-13
 *
 * Handles tabbed interface with Quick Chat and Saved Chat modes.
 * - Quick-Chat: Single message/response (no memory)
 * - Saved-Chat: Conversation with memory
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
 * Switches between Quick Chat and Saved Chat tabs.
 * @param {string} tabName - Either 'quick' or 'saved'
 */
function switchTab(tabName) {
  // Remove active class from all tabs and content
  document
    .querySelectorAll(".tab")
    .forEach((tab) => tab.classList.remove("active"));
  document
    .querySelectorAll(".tab-content")
    .forEach((content) => content.classList.remove("active"));

  // Add active class to selected tab and content
  const tabs = document.querySelectorAll(".tab");
  const tabIndex = tabName === "quick" ? 0 : 1;
  tabs[tabIndex].classList.add("active");
  document.getElementById(`${tabName}-tab`).classList.add("active");
}

/**
 * Requests available models from the OpenWebUI service.
 * Sends 'refreshModels' command to extension host.
 */
function refreshModels() {
  console.log("refreshModels function called");
  const button = document.getElementById("refreshButton");
  const icon = document.getElementById("refreshIcon");

  console.log("Starting refresh models...");

  // Add spinning animation
  icon.classList.add("spinning");
  button.disabled = true;

  console.log("Sending refreshModels message to extension...");
  vscode.postMessage({
    command: "refreshModels",
  });
}

/**
 * Sends user message to the LLM service.
 * @param {string} chatType - Either 'quick' or 'saved' to determine chat mode
 */
function sendMessage(chatType) {
  console.log("=== SENDMESSAGE JS DEBUG ===");
  console.log("chatType parameter:", chatType);

  const input = document.getElementById(`${chatType}-messageInput`);
  const text = input.value.trim();

  if (text) {
    // Display user message immediately
    addMessage(text, "user", chatType);
    const messageToSend = {
      command: "sendMessage",
      text: text,
      chatType: chatType, // Add this to distinguish between quick/saved
    };

    // Send to extension with chat type information
    console.log("Sending message:", JSON.stringify(messageToSend, null, 2));
    vscode.postMessage(messageToSend);

    // Clear input field
    input.value = "";
  }
}

/**
 * Adds a message to the specified chat display.
 * @param {string} text - The message content to display
 * @param {string} sender - Message sender type ('user' or 'assistant')
 * @param {string} chatType - Either 'quick' or 'saved'
 */
function addMessage(text, sender, chatType) {
  const messages = document.getElementById(`${chatType}-messages`);
  const messageDiv = document.createElement("div");
  messageDiv.className = "message " + sender;
  messageDiv.textContent = text;
  messages.appendChild(messageDiv);

  // Auto-scroll to show latest message
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
 * Clears all messages from the specified chat display.
 * @param {string} chatType - Either 'quick' or 'saved'
 */
function clearMessages(chatType) {
  const messages = document.getElementById(`${chatType}-messages`);
  messages.innerHTML = "";

  // For saved chat, also send clear command to extension to reset memory
  if (chatType === "saved") {
    vscode.postMessage({
      command: "clearSavedChat",
    });
  }
}

/**
 * Exports the current saved chat conversation to a JSON file.
 * Only available in Saved Chat tab.
 */
function exportConversation() {
  console.log('Exporting conversation...');
  
  // Send command to extension to get conversation data
  vscode.postMessage({
    command: 'exportConversation'
  });
}

/**
 * Imports a conversation from a JSON file.
 * Only available in Saved Chat tab.
 */
function importConversation() {
  console.log('Importing conversation...');
  
  // Create file input element
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.json';
  
  fileInput.onchange = function(event) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const jsonData = e.target.result;
          console.log('File read, sending to extension...');
          
          // Send the JSON data to extension for processing
          vscode.postMessage({
              command: 'importConversation',
              jsonData: jsonData
          });
        } catch (error) {
          console.error('Error reading file:', error);
          // Could add user notification here
        }
      };
      reader.readAsText(file);
    }
  };
  
  // Trigger file dialog
  fileInput.click();
}

/**
 * Displays imported messages in the saved chat.
 * @param {Array} messages - Array of conversation messages
 */
function displayImportedMessages(messages) {
  const savedMessages = document.getElementById('saved-messages');
  savedMessages.innerHTML = ''; // Clear existing messages
  
  messages.forEach(message => {
    if (message.role === 'user' || message.role === 'assistant') {
      addMessage(message.content, message.role === 'user' ? 'user' : 'assistant', 'saved');
    }
  });
}

/**
 * Triggers download of conversation export file.
 * @param {string} jsonData - JSON string of conversation data
 */
function downloadConversationFile(jsonData) {
  const blob = new Blob([jsonData], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `chat-export-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  
  URL.revokeObjectURL(url);
  console.log('Conversation exported successfully');
}

// Event Listeners

/**
 * Handles messages from the extension host.
 * Routes commands to appropriate handler functions.
 */
window.addEventListener("message", (event) => {
  const message = event.data;

  if (message.command === "receiveMessage") {
    // Add message to the appropriate chat based on response
    const chatType = message.chatType || "quick"; // Default to quick if not specified
    addMessage(message.text, message.sender, chatType);
  }

  if (message.command === "updateModels") {
    console.log("Received updateModels, stopping spinner...");
    updateModelDropdown(message.models, message.error);

    // Stops spinning animation
    const icon = document.getElementById("refreshIcon");
    const button = document.getElementById("refreshButton");

    console.log("Icon found:", !!icon, "Button found:", !!button);
    if (icon) {
      icon.classList.remove("spinning");
      console.log("Removed spinning class");
    }
    if (button) {
      button.disabled = false;
    }
  }

  // Add new handlers for import/export
  if (message.command === "exportData") {
    downloadConversationFile(message.jsonData);
  }

  if (message.command === "importSuccess") {
    displayImportedMessages(message.messages);
    console.log("Conversation imported successfully");
  }

  if (message.command === "importError") {
    console.error("Import failed:", message.error);
    // You could add a user notification here
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
 * Handle Enter key in message inputs for better UX.
 */
document.addEventListener("DOMContentLoaded", () => {
  // Add Enter key listeners for both input fields
  ["quick", "saved"].forEach((chatType) => {
    const input = document.getElementById(`${chatType}-messageInput`);
    if (input) {
      input.addEventListener("keypress", function (e) {
        if (e.key === "Enter") {
          sendMessage(chatType);
        }
      });
    }
  });
});
