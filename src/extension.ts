// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { ConfigManager } from './utils/configManager';
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
	console.log('On-Premise LLM OpenWebUI Assistant activated!');

	/**
	 * Registers the main chat command that opens the chat interface.
	 * Handles configuration validation, service initialization, and webview setup.
	 */
	const disposable = vscode.commands.registerCommand('on-premise-llm-openwebui-assistant.openChat', async () => {
    // Ensure valid configuration exists, prompt user if needed
    const config = await ConfigManager.ensureConfig();
    if (!config) {
      vscode.window.showErrorMessage("OpenWebUI Chat configuration cancelled.");
      return;
    }

    // Initialize OpenWebUI service with validated configuration
    const service = new OpenWebUIService(config.openwebuiUrl, config.apiKey);
    console.log("On-Premise LLM OpenWebUI Assistant is active!");

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

          case "exportConversation":
            try {
              console.log("Exporting conversation...");
              const exportData =
                persistenceManager.serializeConversation(savedChatHistory);

              const options: vscode.SaveDialogOptions = {
                  defaultUri: vscode.Uri.file(`chat-export-${new Date().toISOString().split('T')[0]}.json`),
                  filters: {
                      'JSON files': ['json'],
                      'All files': ['*']
                  }
              };
              
              const fileUri = await vscode.window.showSaveDialog(options);
              if (fileUri) {
                  await vscode.workspace.fs.writeFile(fileUri, Buffer.from(exportData, 'utf8'));
                  vscode.window.showInformationMessage(`Conversation exported to ${fileUri.fsPath}`);
                  console.log("File saved to:", fileUri.fsPath);
              } else {
                  console.log("Export cancelled by user");
              }
            } catch (error) {
                console.error("Export error:", error);
                vscode.window.showErrorMessage(`Failed to export conversation: ${error}`);
            }
            break;

          case "importConversation":
            try {
              console.log("Importing conversation...");

              if (!message.jsonData) {
                throw new Error("No data provided for import");
              }

              const importedHistory =
                persistenceManager.deserializeConversation(message.jsonData);

              // Replace current saved chat history
              savedChatHistory = importedHistory;

              persistenceManager.saveConversationHistory(savedChatHistory);

              // Send success response with messages for display
              panel.webview.postMessage({
                command: "importSuccess",
                messages: savedChatHistory,
              });

              console.log(
                "Conversation imported successfully, history length:",
                savedChatHistory.length
              );
            } catch (error) {
              console.error("Import error:", error);
              panel.webview.postMessage({
                command: "importError",
                error: `Failed to import conversation: ${error}`,
              });
            }
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
  const htmlUri = vscode.Uri.joinPath(
    extensionUri,
    "src",
    "webview",
    "chatAssistant.html"
  );

  // Read and process HTML template
  const htmlContent = require("fs").readFileSync(htmlUri.fsPath, "utf8");

  // Replace placeholders with actual URIs
  return htmlContent
    .replace("{{cssUri}}", cssUri.toString())
    .replace("{{jsUri}}", jsUri.toString());
}

/**
 * Called when the extension is deactivated.
 * Performs cleanup operations before extension shutdown.
 */
export function deactivate() {}
