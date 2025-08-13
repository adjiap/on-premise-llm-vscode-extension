// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { ConfigManager } from './configManager';
import { OpenWebUIService } from './openwebuiService';

/**
 * Message interface for communication between webview and extension.
 * Used for type-safe message passing in both directions.
 */
interface WebviewMessage {
    command: string;
    text?: string;
    models?: string[];
    error?: string;
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
			vscode.window.showErrorMessage('OpenWebUI Chat configuration cancelled.');
			return;
		}

		// Initialize OpenWebUI service with validated configuration
		const service = new OpenWebUIService(config.openwebuiUrl, config.apiKey);
		console.log('On-Premise LLM OpenWebUI Chat is active!');
		vscode.window.showInformationMessage('Opening On-Prem Chat...');

		// Create and show webview panel
		const panel = vscode.window.createWebviewPanel(
			'onpremOpenwebuiChat',
			'On-Prem OpenWebUI Chat',
			vscode.ViewColumn.Two,
			{
				enableScripts: true,
				retainContextWhenHidden: true,
				localResourceRoots: [context.extensionUri]
			}
		)

		// Set HTML Content
		panel.webview.html = getWebViewContent(panel.webview, context.extensionUri)

		// Handling messages from webview
		panel.webview.onDidReceiveMessage(
			async (message: WebviewMessage) => {
				switch (message.command) {
					// Handles user chat message and get responses
					case 'sendMessage':
						try {
							// Validate message
							if (!message.text || message.text.trim() === '') {
								console.error('Empty message received');
								return;
							}

							console.log('Received message:', message.text);
							// Send to OpenWebUI
							const response = await service.sendChat(
								[
									{ role: 'user', content: message.text }
								],
								config.defaultModel,
								config.systemPrompt
							);
							
							// Send response back to webview
							panel.webview.postMessage({
									command: 'receiveMessage',
									text: response,
									sender: 'assistant'
							});
						} catch (error) {
								console.error('Chat error:', error);
								panel.webview.postMessage({
										command: 'receiveMessage',
										text: `Error: ${error}`,
										sender: 'assistant'
								});
						}
						break;
					// Fetches and updates available models list
					case 'refreshModels':
						try {
							console.log('Fetching available models...');
							const models = await service.getAvailableModels();

							// Send models back to webview
							panel.webview.postMessage({
									command: 'updateModels',
									models: models
							});
						} catch (error) {
							console.error('Error fetching models:', error);
							panel.webview.postMessage({
									command: 'updateModels',
									models: [], // Empty array on error
									error: 'Failed to load models'
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

	return `<!DOCTYPE html>
	<html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Ollama Chat</title>
        <script type="module" src="https://unpkg.com/@vscode/webview-ui-toolkit@1.2.2/dist/toolkit.js"></script>
        <link rel="stylesheet" href="${cssUri}">
    </head>
    <body>
        <div class="chat-container">
            <div class="model-selection">
                <label for="modelSelect">Model:</label>
                <vscode-dropdown id="modelSelect">
                    <vscode-option value="">Loading models...</vscode-option>
                </vscode-dropdown>
                <vscode-button appearance="secondary" onclick="refreshModels()">🔄</vscode-button>
            </div>

            <div class="messages" id="messages"></div>

            <div class="input-container">
                <input type="text" id="messageInput" placeholder="Type your message...">
                <button onclick="sendMessage()">Send</button>
                <vscode-button appearance="secondary" onclick="clearMessages()">Clear</vscode-button>
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
