// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { ConfigManager } from './configManager';
import { OpenWebUIService } from './openwebuiService';
import {
  PersistenceManager,
  ConversationMessage,
} from "./utils/persistenceManager";

/**
 * Message interface for communication between webview and extension.
 * Used for type-safe message passing in both directions.
 */
interface WebviewMessage {
  command: string;
  text?: string;
  models?: string[]; // Only for populating dropdown of models available
  error?: string;
  chatType?: string;
  jsonData?: string;
}

/**
 * Called when the extension is activated.
 * Registers commands and sets up the extension's functionality.
 * 
 * @param context - The extension context provided by VSCode
 */
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('On-Premise LLM OpenWebUI Chat activated!');

	/**
	 * Registers the main chat command that opens the chat interface.
	 * Handles configuration validation, service initialization, and webview setup.
	 */
	const disposable = vscode.commands.registerCommand('on-premise-llm-openwebui-chat.openChat', async () => {
    // Ensure valid configuration exists, prompt user if needed
    const config = await ConfigManager.ensureConfig();
    if (!config) {
      vscode.window.showErrorMessage("OpenWebUI Chat configuration cancelled.");
      return;
    }

    // Initialize OpenWebUI service with validated configuration
    const service = new OpenWebUIService(config.openwebuiUrl, config.apiKey);
    console.log("On-Premise LLM OpenWebUI Chat is active!");

    // Create persistence manager
    const persistenceManager = new PersistenceManager(context);

    // Create status bar for user
    const statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    statusBarItem.text = "$(loading~spin) Opening Chat...";
    statusBarItem.show();
    setTimeout(() => {
      statusBarItem.dispose();
    }, 2000);

    // Create and show webview panel
    const panel = vscode.window.createWebviewPanel(
      "onpremOpenwebuiChat",
      "On-Prem OpenWebUI Chat",
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [context.extensionUri],
      }
    );

    // Initialize conversation history from saved state
    let savedChatHistory: ConversationMessage[] =
      persistenceManager.loadConversationHistory();

    // Add system prompt if not already in history and config exists
    if (config.systemPrompt && config.systemPrompt.trim()) {
      const hasSystemPrompt =
        savedChatHistory.length > 0 &&
        savedChatHistory[0].role === "user" &&
        savedChatHistory[0].content === config.systemPrompt;

      if (!hasSystemPrompt) {
        savedChatHistory.unshift({
          role: "user",
          content: config.systemPrompt,
        });
      }
    }

    // Set HTML Content
    panel.webview.html = getWebViewContent(panel.webview, context.extensionUri);

    // Handling messages from webview
    panel.webview.onDidReceiveMessage(
      async (message: WebviewMessage) => {
        switch (message.command) {
          // Handles user chat message and get responses
          case "sendMessage":
            try {
              console.log("=== SENDMESSAGE DEBUG ===");
              console.log(
                "Full message object:",
                JSON.stringify(message, null, 2)
              );
              console.log("Message chatType:", message.chatType);
              console.log("Message text:", message.text);

              // Validate message
              if (!message.text || message.text.trim() === "") {
                console.error("Empty message received");
                return;
              }

              console.log(
                "Received message:",
                message.text,
                "Chat type:",
                message.chatType
              );

              let response: string;

              if (message.chatType === "saved") {
                savedChatHistory.push({ role: "user", content: message.text });

                response = await service.sendChat(
                  savedChatHistory, // Send full conversation history
                  config.defaultModel,
                  "" // Don't pass systemPrompt separately since it's in history
                );

                savedChatHistory.push({ role: "assistant", content: response });

                // Auto-save after each message
                persistenceManager.saveConversationHistory(savedChatHistory);
              } else {
                // QUICK CHAT: Single message (no memory)
                response = await service.sendChat(
                  [{ role: "user", content: message.text }],
                  config.defaultModel,
                  config.systemPrompt
                );
              }

              // Send response back to webview
              console.log(
                "Sending response with chatType:",
                message.chatType || "quick"
              );

              panel.webview.postMessage({
                command: "receiveMessage",
                text: response,
                sender: "assistant",
                chatType: message.chatType || "quick",
              });
            } catch (error) {
              console.error("Chat error:", error);
              panel.webview.postMessage({
                command: "receiveMessage",
                text: `Error: ${error}`,
                sender: "assistant",
                chatType: message.chatType || "quick",
              });
            }
            break;

          // Fetches and updates available models list
          case "refreshModels":
            try {
              console.log("Fetching available models...");
              const models = await service.getAvailableModels();
              console.log("Found models:", models);

              // Send models back to webview
              panel.webview.postMessage({
                command: "updateModels",
                models: models,
              });
            } catch (error) {
              console.error("Error fetching models:", error);
              panel.webview.postMessage({
                command: "updateModels",
                models: [], // Empty array on error
                error: "Failed to load models",
              });
            }
            break;

          // Clears all saved chat
          case "clearSavedChat":
            // This will clear the conversation memory for saved chat
            console.log("Clearing saved chat memory...");
            savedChatHistory = [];

            // Re-add system prompt if it exists
            if (config.systemPrompt && config.systemPrompt.trim()) {
              savedChatHistory.push({
                role: "user",
                content: config.systemPrompt,
              });
            }

            // Clear saved state
            persistenceManager.saveConversationHistory(savedChatHistory);
            break;
        }
      },
      undefined,
      context.subscriptions
    );
  });

	context.subscriptions.push(disposable);
}

/**
 * Generates the HTML content for the chat webview.
 * Creates a complete chat interface with VSCode theming and UI toolkit integration.
 * 
 * @param webview - The webview instance for resource URI generation
 * @param extensionUri - The extension's base URI for resource loading
 * @returns Complete HTML string for the chat interface
 */
function getWebViewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
	const getWebViewUri = (filename: string) =>
		webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'src', 'webview', filename));

	// Instantiate URI for WebView elements
	const cssUri = getWebViewUri("chatAssistant.css");
	const jsUri = getWebViewUri("chatAssistant.js");

	return `<!DOCTYPE html>
	<html lang="en">
    <head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>Ollama Chat</title>
			<script type="module" src="https://unpkg.com/@vscode/webview-ui-toolkit@1.2.2/dist/toolkit.js"></script>
			<link rel="stylesheet" href="https://unpkg.com/@vscode/codicons@0.0.35/dist/codicon.css">
			<link rel="stylesheet" href="${cssUri}">
    </head>
    <body>
        <div class="chat-container">
          <div class="tab-container">
            <div class="tab active" onclick="switchTab('quick')">
              Quick-Chat
              <span class="tooltip-icon codicon codicon-question" title="Single prompts without conversation memory. Each message is independent from another."></span>
            </div>
            <div class="tab" onclick="switchTab('saved')">
              Saved-Chat
              <span class="tooltip-icon codicon codicon-question" title="Continuous conversation with memory. The AI remembers previous messages in the chat."></span>
            </div>
          </div>

          <div class="model-selection">
              <label for="modelSelect">Model:</label>
              <vscode-dropdown id="modelSelect">
                  <vscode-option value="">Loading models...</vscode-option>
              </vscode-dropdown>
              <vscode-button appearance="secondary" onclick="refreshModels()" id="refreshButton">
                <span class="codicon codicon-repo-sync" id="refreshIcon"></span>
              </vscode-button>
          </div>

          <div id="quick-tab" class="tab-content active">
            <div class="messages" id="quick-messages"></div>
            <div class="input-container">
              <input type="text" id="quick-messageInput" placeholder="Ask a quick question...">
              <button onclick="sendMessage('quick')">Send</button>
              <vscode-button appearance="secondary" onclick="clearMessages('quick')">Clear</vscode-button>
            </div>
          </div>

          <div id="saved-tab" class="tab-content">
            <div class="import-export-container">
              <vscode-button appearance="secondary" onclick="importConversation()">
                <span class="codicon codicon-folder-opened"></span> Import Chat
              </vscode-button>
            </div>
            
            <div class="messages" id="saved-messages"></div>
            
            <div class="input-container">
              <input type="text" id="saved-messageInput" placeholder="Continue the conversation...">
              <button onclick="sendMessage('saved')">Send</button>
              <vscode-button appearance="secondary" onclick="clearMessages('saved')">Clear</vscode-button>
            </div>
            
            <div class="import-export-container">
              <vscode-button appearance="secondary" onclick="exportConversation()">
                <span class="codicon codicon-save"></span> Export Chat
              </vscode-button>
            </div>
          </div>
        </div>
        
        <script src="${jsUri}"></script>
    </body>
    </html>`;
}

/**
 * Called when the extension is deactivated.
 * Performs cleanup operations before extension shutdown.
 */
export function deactivate() {}
