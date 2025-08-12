// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { ConfigManager } from './configManager';
import { OpenWebUIService } from './openwebuiService';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('On-Premise LLM OpenWebUI Chat activated!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('on-premise-llm-openwebui-chat.openChat', async () => {
		// The code you place here will be executed every time your command is executed
		const config = await ConfigManager.ensureConfig();
		if (!config) {
			vscode.window.showErrorMessage('OpenWebUI Chat coniguration cancelled.');
			return;
		}

		const service = new OpenWebUIService(config.openwebuiUrl, config.apiKey);

		console.log('On-Premise LLM OpenWebUI Chat is active!')

		// Display a message box to the user
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
			async message => {
				switch (message.command) {
					case 'sendMessage':
						try {
							console.log('Received message:', message.text);
							// Send to OpenWebUI
							const response = await service.sendChat(
								[
									{ role: 'user', content: message.text }
								],
								config.defaultModel
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
				}
			},
			undefined,
			context.subscriptions
		);
	});

	context.subscriptions.push(disposable);
}

function getWebViewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
	return `<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<title>Ollama Chat</title>
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
			button {
				padding: 10px 20px;
				background: var(--vscode-button-background);
				color: var(--vscode-button-foreground);
				border: none;
				cursor: pointer;
				border-radius: 4px;
			}
			button:hover {
				background: var(--vscode-button-hoverBackground);
			}
		</style>
	</head>
	<body>
		<div class="chat-container">
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
			
			// Listen for messages from extension
			window.addEventListener('message', event => {
				const message = event.data;
				if (message.command === 'receiveMessage') {
					addMessage(message.text, message.sender);
				}
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

// This method is called when your extension is deactivated
export function deactivate() {}
