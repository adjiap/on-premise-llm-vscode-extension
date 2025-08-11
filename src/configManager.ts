import * as vscode from 'vscode';

export interface ChatConfig {
  openwebuiUrl: string;
  apiKey: string;
  defaultModel: string;
}

export class ConfigManager {
  private static readonly EXTENSION_ID = 'onPremiseLlmChat';

  static async getConfig(): Promise<ChatConfig | null> {
    const config = vscode.workspace.getConfiguration(this.EXTENSION_ID);
    
    const openwebuiUrl = config.get<string>('openwebuiUrl') || '';
    const apiKey = config.get<string>('apiKey') || '';
    const defaultModel = config.get<string>('defaultModel') || '';

    // Check if all required settings are present
    if (!openwebuiUrl || !apiKey || !defaultModel) {
      return null;
    }

    return {
      openwebuiUrl,
      apiKey,
      defaultModel
    };
  }

  static async promptForConfig(): Promise<ChatConfig | null> {
    // Prompt for OpenWebUI URL
    const openwebuiUrl = await vscode.window.showInputBox({
      prompt: 'Enter OpenWebUI base URL',
      placeHolder: 'http://localhost:3000',
      validateInput: (value) => {
          if (!value) return 'URL is required';
          if (!value.startsWith('http')) return 'URL must start with http:// or https://';
          return null;
      }
    });

    if (!openwebuiUrl) return null;

    // Prompt for API Key
    const apiKey = await vscode.window.showInputBox({
      prompt: 'Enter OpenWebUI API Key',
      placeHolder: 'sk-89jf98jfkasjdfaksd89jkfljalk',
      password: true,
      validateInput: (value) => {
        if (!value) return 'API key is required';
        return null;
      }
    });

    if (!apiKey) return null;

    // Prompt for default model
    const defaultModel = await vscode.window.showInputBox({
      prompt: 'Enter default model name',
      placeHolder: 'llama3.2:latest',
      validateInput: (value) => {
        if (!value) return 'Model name is required';
        return null;
      }
    });

    if (!defaultModel) return null;

    // Save to settings
    const config = vscode.workspace.getConfiguration(this.EXTENSION_ID);
    await config.update('openwebuiUrl', openwebuiUrl, vscode.ConfigurationTarget.Global);
    await config.update('apiKey', apiKey, vscode.ConfigurationTarget.Global);
    await config.update('defaultModel', defaultModel, vscode.ConfigurationTarget.Global);

    return {
      openwebuiUrl,
      apiKey,
      defaultModel
    };
  }

  static async ensureConfig(): Promise<ChatConfig | null> {
      let config = await this.getConfig();
      
      if (!config) {
          const shouldConfigure = await vscode.window.showInformationMessage(
              'OpenWebUI Chat is not configured. Would you like to configure it now?',
              'Configure',
              'Cancel'
          );

          if (shouldConfigure === 'Configure') {
              config = await this.promptForConfig();
          }
      }

      return config;
    }
}