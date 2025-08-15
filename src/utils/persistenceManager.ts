import * as vscode from "vscode";


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
  private static readonly SAVED_CHAT_KEY = "savedChatHistory";

  constructor(private context: vscode.ExtensionContext) {}

  /**
   * Saves conversation history to VSCode global state.
   * FYI: the global state for persistenceManager is located in:
   *      Windows: %APPDATA%\Code\User\globalStorage\<extension-id>\
   *      Linux: ~/.config/Code/User/globalStorage/<extension-id>/
   * @param convHistory - Conversation history to save
   */
  saveConversationHistory(convHistory: ConversationMessage[]): void {
    const historyWithTimestamp: SavedConversation = {
      history: convHistory,
      lastUpdated: new Date().toISOString(),
    };
    this.context.globalState.update(
      PersistenceManager.SAVED_CHAT_KEY,
      historyWithTimestamp
    );
  }

  /**
   * Loads conversation history from VSCode global state.
   * @returns Saved conversation history or empty array
   */
  loadConversationHistory(): ConversationMessage[] {
    const saved = this.context.globalState.get<SavedConversation>(
      PersistenceManager.SAVED_CHAT_KEY
    );
    return saved?.history || [];
  }

  /**
   * Clears saved conversation history.
   */
  clearConversationHistory(): void {
    this.context.globalState.update(
      PersistenceManager.SAVED_CHAT_KEY,
      undefined
    );
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
