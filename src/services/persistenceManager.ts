import * as vscode from "vscode";
import { ExtensionLogger } from "./logger";


/**
 * Represents a conversation by whom and its content.
 */
export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}


/**
 * Represents a history of conversation, and the last time it's updated.
 */
export interface SavedConversation {
  history: ConversationMessage[];
  lastUpdated: string;
}

/**
 * Manages conversation history persistence using VSCode global state.
 */
export class PersistenceManager {
  private static readonly CHAT_FILE_NAME = ".vscode-chat-history.json";

  /**
   * Gets the workspace chat file path
   * @returns Chat history's file path
   */
  private getChatFilePath(): vscode.Uri | null {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder){
      return null; // currently no workspace open
    }
    return vscode.Uri.joinPath(workspaceFolder.uri, PersistenceManager.CHAT_FILE_NAME)
  }

  /**
   * Saves conversation history to workspace file.
   * @param convHistory - Conversation history to save
   */
  async saveConversationHistory(convHistory: ConversationMessage[]): Promise<void> {
    const filePath = this.getChatFilePath();
    if (!filePath){
      ExtensionLogger.warn('No workspace open - cannot save chat history');
      return;
    }
    
    const saveData: SavedConversation ={
      history: convHistory,
      lastUpdated: new Date().toISOString(),
    };
    
    try {
      const jsonData = JSON.stringify(saveData, null, 2);
      await vscode.workspace.fs.writeFile(filePath, Buffer.from(jsonData, 'utf8'));
      ExtensionLogger.info (`Chat history saved to ${filePath.fsPath}`);
    } catch (error){
      ExtensionLogger.error('Failed, to save chat history:', error);
    }
  }
  
  /**
   * Loads conversation history from workspace file.
   * @returns Saved conversation history or empty array
  */
 async loadConversationHistory(): Promise<ConversationMessage[]> {
    const filePath = this.getChatFilePath();
    if (!filePath) {
      ExtensionLogger.warn("No workspace open - cannot save chat history");
      return [];
    }
    
     try {
       const fileData = await vscode.workspace.fs.readFile(filePath);
       const jsonData = Buffer.from(fileData).toString("utf8");
       const saved: SavedConversation = JSON.parse(jsonData);
       ExtensionLogger.info(`Chat history loaded from ${filePath.fsPath}`);
       return saved.history || [];
     } catch (error) {
       ExtensionLogger.error(
         "No existing chat history file found or error reading:",
         error
       );
       return [];
     }
  }

  /**
   * Exports conversation history as JSON string.
   * @param history - Conversation history to export
   * @returns JSON string of the conversation
   */
  serializeConversation(convHistory: ConversationMessage[]): string {
    const exportData = {
      version: "1.0", // Arbitrary number to future-proof exported data types
      exportDate: new Date().toISOString(),
      extensionName: "On-Premise LLM Chat",
      conversation: convHistory,
    };
    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Imports conversation history from JSON string.
   * @param jsonData - JSON string containing conversation data
   * @returns Imported conversation history
   */
  deserializeConversation(jsonData: string): ConversationMessage[] {
    try {
      const data = JSON.parse(jsonData);
      if (data.conversation && Array.isArray(data.conversation)) {
        return data.conversation;
      }
      throw new Error("Invalid conversation format");
    } catch (error) {
      throw new Error(`Failed to import conversation: ${error}`);
    }
  }
}
