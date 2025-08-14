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
}
