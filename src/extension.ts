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
			vscode.window.showErrorMessage('OpenWebUI Chat coniguration cancelled.');
			return;
		}

		// Initialize OpenWebUI service with validated configuration
		const service = new OpenWebUIService(config.openwebuiUrl, config.apiKey);
		console.log('On-Premise LLM OpenWebUI Chat is active!')
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
	return `<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<title>Ollama Chat</title>
		<script type="module" src="https://unpkg.com/@vscode/webview-ui-toolkit@1.2.2/dist/toolkit.js"></script>
		<style>
			body { 
				font-family: var(--vscode-font-family);
				color: var(--vscode-foreground);
				background-color: var(--vscode-editor-background);
				margin: 0;
				padding: 20px;
			}
			.chat-container {
				height: 90vh;
				display: flex;
				flex-direction: column;
				max-width: 800px;
			}
			.model-selection {
				display: flex;
				align-items: center;
				gap: 10px;
				margin-bottom: 15px;
			}
			.messages {
				flex: 1;
				overflow-y: auto;
				border: 1px solid var(--vscode-panel-border);
				padding: 15px;
				margin-bottom: 15px;
				border-radius: 4px;
			}
			.message {
				margin-bottom: 12px;
				padding: 8px;
				border-radius: 4px;
			}
			.message.user {
				background-color: var(--vscode-button-background);
				color: var(--vscode-button-foreground);
				margin-left: 20%;
			}
			.message.assistant {
				background-color: var(--vscode-input-background);
				border: 1px solid var(--vscode-input-border);
				margin-right: 20%;
			}
			.input-container {
				display: flex;
				gap: 10px;
			}
			#messageInput {
				flex: 1;
				padding: 10px;
				background: var(--vscode-input-background);
				border: 1px solid var(--vscode-input-border);
				color: var(--vscode-input-foreground);
				border-radius: 4px;
			}
		</style>
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

			<div class="messages" id="messages">
				<div class="message assistant">Welcome to Ollama Chat! Type a message below to get started.</div>
			</div>

			<div class="input-container">
				<input type="text" id="messageInput" placeholder="Type your message...">
				<button onclick="sendMessage()">Send</button>
			</div>
		</div>
		
		<script>
			const vscode = acquireVsCodeApi();

			function refreshModels() {
				vscode.postMessage({
					command: 'refreshModels'
				});
			}

			function sendMessage() {
				const input = document.getElementById('messageInput');
				const text = input.value.trim();
				
				if (text) {
					// Display user message
					addMessage(text, 'user');
					
					// Send to extension
					vscode.postMessage({
						command: 'sendMessage',
						text: text
					});
					
					input.value = '';
				}
			}
			
			function addMessage(text, sender) {
				const messages = document.getElementById('messages');
				const messageDiv = document.createElement('div');
				messageDiv.className = 'message ' + sender;
				messageDiv.textContent = text;
				messages.appendChild(messageDiv);
				messages.scrollTop = messages.scrollHeight;
			}
			
			function updateModelDropdown(models, error) {
				const dropdown = document.getElementById('modelSelect');
				dropdown.innerHTML = ''; // Clear existing options
	
				if (error) {
					const option = document.createElement('vscode-option');
					option.value = '';
					option.textContent = 'Error loading models';
					dropdown.appendChild(option);
					return;
				}

				if (models.length === 0) {
					const option = document.createElement('vscode-option');
					option.value = '';
					option.textContent = 'No models found';
					dropdown.appendChild(option);
					return;
				}

				// Add each model as an option
				models.forEach(model => {
					const option = document.createElement('vscode-option');
					option.value = model;
					option.textContent = model;
					dropdown.appendChild(option);
				});
		}
			
			// Listen for messages from extension
			window.addEventListener('message', event => {
				const message = event.data;

				if (message.command === 'receiveMessage') {
					addMessage(message.text, message.sender);
				}

				if (message.command === 'updateModels') {
        	updateModelDropdown(message.models, message.error);
    		}
			});

			// Automatically fetch models on startup
			window.addEventListener('load', () => {
				refreshModels();
			});

			// Handle Enter key
			document.getElementById('messageInput').addEventListener('keypress', function(e) {
				if (e.key === 'Enter') {
					sendMessage();
				}
			});
		</script>
	</body>
	</html>`;
}

/**
 * Called when the extension is deactivated.
 * Performs cleanup operations before extension shutdown.
 */
export function deactivate() {}
