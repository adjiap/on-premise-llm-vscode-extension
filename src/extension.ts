// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { ensureValidConfig, EXTENSION_ID } from './config/config';
import { OpenWebUIService } from './services/openwebuiService';
import {
  PersistenceManager,
  ConversationMessage,
} from "./services/persistenceManager";
import { ExtensionLogger } from './services/logger';

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
  selectedModel?: string;
  // Model validation fields
  defaultModel?: string;
  isDefaultModelValid?: boolean;
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
  // Initialize logger first
  ExtensionLogger.initialize(context);
  ExtensionLogger.info("On-Premise LLM OpenWebUI Assistant activated!");

  // For production
  ExtensionLogger.configure({
    level: 'info',
    outputToConsole: false
  });

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
    const config = await ensureValidConfig();
    if (!config) {
      vscode.window.showErrorMessage("OpenWebUI Chat configuration cancelled.");
      return;
    }

    // Initialize OpenWebUI service with validated configuration
    const service = new OpenWebUIService(config.openwebuiUrl, config.apiKey);
    ExtensionLogger.info("Chat Assistant mode:", chatMode);

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
              ExtensionLogger.debug("=== SENDMESSAGE DEBUG ===");
              ExtensionLogger.debug(
                "Full message object:",
                JSON.stringify(message, null, 2)
              );
              ExtensionLogger.info("Message chatType:", message.chatType);
              ExtensionLogger.info("Message text:", message.text);
              ExtensionLogger.info("System prompt:", config.systemPrompt);

              // Validate message
              if (!message.text || message.text.trim() === "") {
                ExtensionLogger.error("Empty message received");
                return;
              }

              const modelToUse = message.selectedModel || config.defaultModel;
              if (!modelToUse) {
                throw new Error(
                  "No model selected and no default model configured"
                );
              }

              ExtensionLogger.info("Using model:", {
                selected: message.selectedModel,
                default: config.defaultModel,
                final: modelToUse,
              });

              // Log system prompt being used
              if (config.systemPrompt && config.systemPrompt.trim()) {
                ExtensionLogger.debug("System prompt active", {
                  systemPrompt: config.systemPrompt,
                  promptLength: config.systemPrompt.length,
                  chatType: message.chatType,
                });
              } else {
                ExtensionLogger.debug("No system prompt configured", {
                  chatType: message.chatType,
                });
              }

              let response: string;

              if (message.chatType === "saved") {
                savedChatHistory.push({ role: "user", content: message.text });

                response = await service.sendChat(
                  savedChatHistory, // Send full conversation history
                  modelToUse,
                  "" // Don't pass systemPrompt separately since it's in history
                );

                savedChatHistory.push({ role: "assistant", content: response });

                // Auto-save after each message
                persistenceManager.saveConversationHistory(savedChatHistory);
              } else if (message.chatType === "quick") {
                globalQuickChatHistory.push({
                  role: "user",
                  content: message.text,
                });

                response = await service.sendChat(
                  globalQuickChatHistory,
                  modelToUse,
                  "" // Don't pass systemPrompt separately since it's in history
                );

                globalQuickChatHistory.push({
                  role: "assistant",
                  content: response,
                });
              } else {
                // chatType === "prompt"
                response = await service.sendChat(
                  [{ role: "user", content: message.text }],
                  modelToUse,
                  config.systemPrompt
                );
              }

              // Send response back to webview
              ExtensionLogger.debug(
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
              ExtensionLogger.error("Chat error:", error);
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
              ExtensionLogger.debug("Fetching available models...");
              const models = await service.getAvailableModels();
              ExtensionLogger.info("Models retrieved:", {
                modelCount: models.length,
                models: models,
              });

              // Validate default model against available models
              const defaultModel = config.defaultModel;
              const isDefaultModelAvailable = models.includes(defaultModel);

              if (!isDefaultModelAvailable && models.length > 0) {
                ExtensionLogger.warn(
                  "Default model not found in available models",
                  {
                    defaultModel: defaultModel,
                    availableModels: models,
                    recommendation:
                      "Update default model in settings or ensure model is installed in Ollama",
                  }
                );

                // Show error message to user
                vscode.window
                  .showWarningMessage(
                    `Default model "${defaultModel}" is not available. Available models: ${models.join(
                      ", "
                    )}`,
                    "Update Settings",
                    "Ignore"
                  )
                  .then((selection) => {
                    if (selection === "Update Settings") {
                      vscode.commands.executeCommand(
                        "workbench.action.openSettings",
                        "onPremiseLlmChat.defaultModel"
                      );
                    }
                  });
              } else if (models.length === 0) {
                ExtensionLogger.error("No models available from OpenWebUI", {
                  defaultModel: defaultModel,
                  suggestion:
                    "Install models using 'ollama pull <model-name>' or check OpenWebUI connection",
                });

                vscode.window
                  .showErrorMessage(
                    "No models available from OpenWebUI. Please install models using Ollama or check your connection.",
                    "Open Settings"
                  )
                  .then((selection) => {
                    if (selection === "Open Settings") {
                      vscode.commands.executeCommand(
                        "workbench.action.openSettings",
                        EXTENSION_ID,
                      );
                    }
                  });
              } else {
                ExtensionLogger.debug("Default model validation passed", {
                  defaultModel: defaultModel,
                  isAvailable: true,
                });
              }

              // Send models back to webview
              panel.webview.postMessage({
                command: "updateModels",
                models: models,
                defaultModel: defaultModel,
                isDefaultModelValid: isDefaultModelAvailable,
              });
            } catch (error) {
              ExtensionLogger.error("Error fetching models:", error);

              vscode.window
                .showErrorMessage(
                  `Failed to load models: ${error}. Check OpenWebUI connection and API key.`,
                  "Check Settings"
                )
                .then((selection) => {
                  if (selection === "Check Settings") {
                    vscode.commands.executeCommand(
                      "workbench.action.openSettings",
                      EXTENSION_ID,
                    );
                  }
                });
              
              panel.webview.postMessage({
                command: "updateModels",
                models: [], // Empty array on error
                error: "Failed to load models",
                defaultModel: config.defaultModel,
                isDefaultModelValid: false,
              });
            }
            break;

          // Clears all saved chat
          case "clearSavedChat":
            ExtensionLogger.debug("=== CLEAR DEBUG ===");
            ExtensionLogger.debug(
              "Full clear message object:",
              JSON.stringify(message, null, 2)
            );
            ExtensionLogger.info("message.chatType:", message.chatType);
            ExtensionLogger.info("typeof message.chatType:", typeof message.chatType);

            // This will clear the conversation memory for saved chat and quick chat
            ExtensionLogger.info("Clearing chat memory...");
            if (message.chatType === "saved") {
              ExtensionLogger.info("Clearing saved-chat memory...");
              savedChatHistory = [];
              // Re-add system prompt if it exists
              if (config.systemPrompt && config.systemPrompt.trim()) {
                savedChatHistory.push({
                  role: "user",
                  content: config.systemPrompt,
                });
              }
              ExtensionLogger.debug("Emptied saved chat history:", savedChatHistory);
              // Overwrites the emptied conversation.
              await persistenceManager.saveConversationHistory(
                savedChatHistory
              );
            } else if (message.chatType === "quick") {
              ExtensionLogger.info("Clearing quick-chat memory...");
              globalQuickChatHistory = [];
              // Re-add system prompt if it exists
              if (config.systemPrompt && config.systemPrompt.trim()) {
                globalQuickChatHistory.push({
                  role: "user",
                  content: config.systemPrompt,
                });
              }
              ExtensionLogger.debug(
                "Emptied quick chat history:",
                globalQuickChatHistory
              );
            }
            break;

          case "exportConversation":
            try {
              ExtensionLogger.info("Exporting conversation...");

              // Determine which history to export, based on chat type
              let historyToExport: ConversationMessage[];

              if (message.chatType === "saved") {
                historyToExport = savedChatHistory;
              } else if (message.chatType === "quick") {
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
              ExtensionLogger.debug("workspace is:", defaultUri);

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
                ExtensionLogger.info("File saved to:", fileUri.fsPath);
              } else {
                ExtensionLogger.info("Export cancelled by user");
              }
            } catch (error) {
              ExtensionLogger.error("Export error:", error);
              vscode.window.showErrorMessage(
                `Failed to export conversation: ${error}`
              );
            }
            break;

          case "importConversation":
            try {
              ExtensionLogger.info("Importing conversation...");

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

              ExtensionLogger.info(
                "Conversation imported successfully, history length:",
                savedChatHistory.length
              );
            } catch (error) {
              ExtensionLogger.error("Import error:", error);
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
	ExtensionLogger.info("Open Chat Mode: ", chatMode);

  const getWebViewUri = (filename: string) =>
		webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'out', 'webview', filename));

	// Instantiate URI for WebView elements
	const cssUri = getWebViewUri("chatAssistant.css");
	const jsUri = getWebViewUri("chatAssistant.js");
  const htmlUri = vscode.Uri.joinPath(
    extensionUri,
    "out",
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
      `<vscode-button appearance="secondary" onclick="exportConversation('${chatMode}')">
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
