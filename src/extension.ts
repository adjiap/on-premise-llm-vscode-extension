// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { ConfigManager } from './utils/configManager';
import { OpenWebUIService } from './utils/openwebuiService';
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

// Initialize globalQuickChatHistory for session memory of VSCode
let globalQuickChatHistory: ConversationMessage[] = [];

/**
 * Called when the extension is activated.
 * Registers commands and sets up the extension's functionality.
 * 
 * @param context - The extension context provided by VSCode
 */
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log("On-Premise LLM OpenWebUI Assistant activated!");

  const quickPromptDisposable = vscode.commands.registerCommand(
    "on-premise-llm-openwebui-assistant.openQuickPrompt",
    async () => {
      await openChatWindow("prompt", context);
    }
  );

  const quickChatDisposable = vscode.commands.registerCommand(
    "on-premise-llm-openwebui-assistant.openQuickChat",
    async () => {
      await openChatWindow("quick", context);
    }
  );

  const savedChatDisposable = vscode.commands.registerCommand(
    "on-premise-llm-openwebui-assistant.openSavedChat",
    async () => {
      await openChatWindow("saved", context);
    }
  );

  context.subscriptions.push(
    quickPromptDisposable,
    quickChatDisposable,
    savedChatDisposable
  );

  /**
   * Opens a chat window in the specified mode (Quick or Saved Chat).
   * Handles configuration validation, service initialization, webview creation,
   * and message handling for the chat interface.
   *
   * @param chatMode - Either 'quick' for stateless chat or 'saved' for persistent conversation
   * @param context - VSCode extension context for accessing global state and resources
   */
  async function openChatWindow(
    chatMode: "prompt" | "quick" | "saved",
    context: vscode.ExtensionContext
  ) {
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
    const persistenceManager = new PersistenceManager();

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

    const panelTitle =
      chatMode === "prompt" ? "Quick Prompt Assistant"
    : chatMode === "quick" ? "Quick Chat Assistant"
    : "Saved Chat Assistant";

    // Create and show webview panel
    const panel = vscode.window.createWebviewPanel(
      "onpremOpenwebuiChat",
      panelTitle,
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [context.extensionUri],
      }
    );

    // Initialize conversation history from saved state
    let savedChatHistory: ConversationMessage[] =
      await persistenceManager.loadConversationHistory();

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
    panel.webview.html = getWebViewContent(
      panel.webview,
      context.extensionUri,
      chatMode
    );

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
              } else if (message.chatType === "quick") {
                globalQuickChatHistory.push({ role: "user", content: message.text });
                
                response = await service.sendChat(
                  globalQuickChatHistory,
                  config.defaultModel,
                  "" // Don't pass systemPrompt separately since it's in history
                );

                globalQuickChatHistory.push({
                  role: "assistant",
                  content: response,
                });
              } else {  // chatType === "prompt"
                response = await service.sendChat(
                  [{ role: "user", content: message.text }],
                  config.defaultModel,
                  config.systemPrompt
                );
              }

              // Send response back to webview
              console.log(
                "Sending response with chatType:",
                message.chatType || "prompt" // Arbitrary default choice for defensive programming
              );

              panel.webview.postMessage({
                command: "receiveMessage",
                text: response,
                sender: "assistant",
                chatType: message.chatType || "prompt",  
              });
            } catch (error) {
              console.error("Chat error:", error);
              panel.webview.postMessage({
                command: "receiveMessage",
                text: `Error: ${error}`,
                sender: "assistant",
                chatType: message.chatType || "prompt",
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
            console.log("=== CLEAR DEBUG ===");
            console.log(
              "Full clear message object:",
              JSON.stringify(message, null, 2)
            );
            console.log("message.chatType:", message.chatType);
            console.log("typeof message.chatType:", typeof message.chatType);

            // This will clear the conversation memory for saved chat and quick chat
            console.log("Clearing chat memory...");
            if (message.chatType === "saved"){
              console.log("Clearing saved-chat memory...");
              savedChatHistory = [];
              // Re-add system prompt if it exists
              if (config.systemPrompt && config.systemPrompt.trim()) {
                savedChatHistory.push({
                  role: "user",
                  content: config.systemPrompt,
                });
              }
              console.log("Emptied saved chat history:", savedChatHistory);
              // Overwrites the emptied conversation.
              await persistenceManager.saveConversationHistory(
                savedChatHistory
              );
            } else if (message.chatType === "quick"){
              console.log("Clearing quick-chat memory...");
              globalQuickChatHistory = [];
              // Re-add system prompt if it exists
              if (config.systemPrompt && config.systemPrompt.trim()) {
                globalQuickChatHistory.push({
                  role: "user",
                  content: config.systemPrompt,
                });
              }
              console.log("Emptied quick chat history:", globalQuickChatHistory);
            };
            break;

          case "exportConversation":
            try {
              console.log("Exporting conversation...");

              // Determine which history to export, based on chat type
              let historyToExport: ConversationMessage[];

              if (message.chatType === "saved"){
                historyToExport = savedChatHistory;
              } else if (message.chatType === "quick"){
                historyToExport = globalQuickChatHistory;
              } else {
                throw new Error(
                  `unknown chat type for export: ${message.chatType}`
                );
              }

              const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
              const exportData =
                persistenceManager.serializeConversation(historyToExport);
              const fileName = `chat-export-${new Date().toISOString().split("T")[0]}.json`
              let defaultUri: vscode.Uri;

              if (workspaceFolder) {
                // Workspace exists - put file in workspace root
                defaultUri = vscode.Uri.joinPath(workspaceFolder.uri, fileName);
              } else {
                // No workspace - put file in system root (fallback)
                defaultUri = vscode.Uri.file(fileName);
              }
              console.log("workspace is:", defaultUri);
              
              const options: vscode.SaveDialogOptions = {             
                defaultUri,
                filters: {
                  "JSON files": ["json"],
                  "All files": ["*"],
                },
              };

              const fileUri = await vscode.window.showSaveDialog(options);
              if (fileUri) {
                await vscode.workspace.fs.writeFile(
                  fileUri,
                  Buffer.from(exportData, "utf8")
                );
                vscode.window.showInformationMessage(
                  `Conversation exported to ${fileUri.fsPath}`
                );
                console.log("File saved to:", fileUri.fsPath);
              } else {
                console.log("Export cancelled by user");
              }
            } catch (error) {
              console.error("Export error:", error);
              vscode.window.showErrorMessage(
                `Failed to export conversation: ${error}`
              );
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
  }
}

/**
 * Generates the HTML content for the chat webview.
 * Creates a complete chat interface with VSCode theming and UI toolkit integration.
 * 
 * @param webview - The webview instance for resource URI generation
 * @param extensionUri - The extension's base URI for resource loading
 * @param chatMode - The mode that the webview shows
 * @returns Complete HTML string for the chat interface
 */
function getWebViewContent(webview: vscode.Webview, extensionUri: vscode.Uri, chatMode: string): string {
	console.log("Open Chat Mode: ", chatMode);

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

  // Choose Icon for modes
  const chatModeIcon = 
    chatMode === "prompt" ? "codicon-eye-closed" 
  : chatMode === "quick" ? "codicon-comment" 
  : "codicon-database";
  
  const chatModeTitle =
    chatMode === "prompt" ? "Quick Prompt"
  : chatMode === "quick" ? "Quick Chat"
  : "Saved Chat";
  
  const chatModeTooltip =
    chatMode === "prompt"
      ? "AKA. Incognito Mode. Single prompts without any conversation memory. Each message is independent from any other."
  : chatMode === "quick"
      ? "Session chat with temporary memory. Messages will be automatically deleted when VSCode is closed."
  : "Continuous conversation with memory. Messages will be automatically saved into a JSON of your workspace.";
  
  const chatModePlaceholder =
    chatMode === "prompt" ? "Ask me anything. I'll forget afterwards..."
  : chatMode === "quick" ? "Chat with me..."
  : "Continue the conversation...";
  
  const extraButtonsTop =
    chatMode === "saved" ?
      `<vscode-button appearance="secondary" onclick="importConversation()">
        <span class="codicon codicon-folder-opened"></span> Import Chat
      </vscode-button>` : "";

  const extraButtonsBottom =
    (chatMode === "saved" || chatMode === "quick") ?
      `<vscode-button appearance="secondary" onclick="exportConversation()">
        <span class="codicon codicon-save"></span> Export
      </vscode-button>` : "";

  // Replace placeholders with actual URIs
  return htmlContent
    .replace("{{cssUri}}", cssUri.toString())
    .replace("{{jsUri}}", jsUri.toString())
    .replace(/{{chatMode}}/g, chatMode)
    .replace("{{chatModeIcon}}", chatModeIcon)
    .replace("{{chatModeTitle}}", chatModeTitle)
    .replace("{{chatModeTooltip}}", chatModeTooltip)
    .replace("{{chatModePlaceholder}}", chatModePlaceholder)
    .replace("{{extraButtonsTop}}", extraButtonsTop)
    .replace("{{extraButtonsBottom}}", extraButtonsBottom);
}

/**
 * Called when the extension is deactivated.
 * Performs cleanup operations before extension shutdown.
 */
export function deactivate() {}
