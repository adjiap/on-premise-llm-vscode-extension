const vscode = acquireVsCodeApi();

function refreshModels() {
  vscode.postMessage({
    command: "refreshModels",
  });
}

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

function addMessage(text, sender) {
  const messages = document.getElementById("messages");
  const messageDiv = document.createElement("div");
  messageDiv.className = "message " + sender;
  messageDiv.textContent = text;
  messages.appendChild(messageDiv);
  messages.scrollTop = messages.scrollHeight;
}

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

function clearMessages() {
  const messages = document.getElementById("messages");
  messages.innerHTML = "";
}

// Event listeners
window.addEventListener("message", (event) => {
  const message = event.data;

  if (message.command === "receiveMessage") {
    addMessage(message.text, message.sender);
  }

  if (message.command === "updateModels") {
    updateModelDropdown(message.models, message.error);
  }
});

window.addEventListener("load", () => {
  refreshModels();
});

document
  .getElementById("messageInput")
  .addEventListener("keypress", function (e) {
    if (e.key === "Enter") {
      sendMessage();
    }
  });
