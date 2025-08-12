import * as vscode from 'vscode';

/**
 * Configuration interface for the On-Premise LLM Chat extension.
 * Defines all settings required for OpenWebUI integration
 */
export interface ChatConfig {
  /** Base URL for the OpenWebUI Service */
  openwebuiUrl: string;
  /** API key for accessing OpenWebUI */
  apiKey: string;
  /** Default model name to be used for chat */
  defaultModel: string;
  /** Optional system prompt for conversations */
  systemPrompt?: string;    // optional
}

/**
 * Manages configuration settings for the OpenWebUI chat extension.
 * Handles reading from VSCode settings, prompting users for missing config,
 * and persisting configuration changes.
 */
export class ConfigManager {
  private static readonly EXTENSION_ID = 'onPremiseLlmChat';

  /**
   * Prompts the user to enter configuration values through input dialogs.
   * Validates inputs and saves them to VSCode global settings.
   * @returns The configured settings, or null if user cancelled
   */
  static async getConfig(): Promise<ChatConfig | null> {
    const config = vscode.workspace.getConfiguration(this.EXTENSION_ID);
    
    const openwebuiUrl = config.get<string>('openwebuiUrl') || '';
    const apiKey = config.get<string>('apiKey') || '';
    const defaultModel = config.get<string>('defaultModel') || '';
    const systemPrompt = config.get<string>('systemPrompt') || '';

    // Check if all required settings are present
    if (!openwebuiUrl || !apiKey || !defaultModel) {
      return null;
    }

    return {
      openwebuiUrl,
      apiKey,
      defaultModel,
      systemPrompt
    };
  }

   /**
   * Prompts the user to enter configuration values through input dialogs.
   * Validates inputs and saves them to VSCode global settings.
   * @returns The configured settings, or null if user cancelled
   */
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
      defaultModel,
      systemPrompt: '' // Setting empty string as default
    };
  }

   /**
   * Ensures configuration is available, prompting user if needed.
   * This is the main entry point for getting valid configuration.
   * @returns Valid configuration object, or null if user declined to configure
   */
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