import * as vscode from "vscode";

/**
 * Configuration interface for the ExtensionLogger.
 * Allows customization of logging behavior and output destinations.
 */
export interface LoggerConfig {
  level: "debug" | "info" | "warn" | "error";
  showTimestamps: boolean;
  outputToConsole: boolean;
  outputToChannel: boolean;  //Whether to output logs to the VSCode output channel
}

/**
 * Centralized logging service for the On-Premise LLM OpenWebUI Assistant extension.
 * Provides structured logging with timestamps, log levels, and multiple output destinations.
 * 
 * Features:
 * - Timestamps for all log entries
 * - Multiple log levels (debug, info, warn, error)
 * - Output to both console and VSCode Output Channel
 * - JSON serialization for complex objects
 * - Automatic error formatting with stack traces
 * - Configurable logging behavior
 * 
 * @example
 * ```typescript
 * // Initialize in extension activation
 * ExtensionLogger.initialize(context);
 * 
 * // Use throughout the extension
 * ExtensionLogger.info("User sent message", { chatType: "saved", modelUsed: "llama3.2" });
 * ExtensionLogger.error("API request failed", error);
 * ```
 */
class ExtensionLogger {
  private static outputChannel: vscode.OutputChannel | null = null;

  /** Default logger configuration */
  private static config: LoggerConfig = {
    level: "debug",
    showTimestamps: true,
    outputToConsole: true,
    outputToChannel: true,
  };

  /** Log level priority mapping for filtering */
  private static readonly LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  /**
   * Updates the logger configuration with new settings.
   * Allows runtime modification of logging behavior.
   *
   * @param newConfig - Partial configuration object to merge with existing settings
   * @example
   * ```typescript
   * // Disable console output and change log level
   * ExtensionLogger.configure({
   *   outputToConsole: false,
   *   level: 'info'
   * });
   * ```
   */
  static configure(config: Partial<LoggerConfig>) {
    this.config = { ...this.config, ...config };
  }

  /**
   * Initializes the logger service with a VSCode output channel.
   * Must be called during extension activation to enable output channel logging.
   *
   * @param context - VSCode extension context for resource management
   * @example
   * ```typescript
   * export function activate(context: vscode.ExtensionContext) {
   *   ExtensionLogger.initialize(context);
   *   ExtensionLogger.info("Extension activated successfully");
   * }
   * ```
   */
  static initialize(context: vscode.ExtensionContext) {
    this.outputChannel = vscode.window.createOutputChannel(
      "On-Premise LLM Assistant"
    );
    context.subscriptions.push(this.outputChannel);
  }

  /**
   * Formats a timestamp for log entries.
   * Creates ISO timestamp without timezone suffix for readability.
   *
   * @returns Formatted timestamp string (YYYY-MM-DD HH:mm:ss.SSS)
   * @private
   */
  private static formatTimestamp(): string {
    return new Date().toISOString().replace("T", " ").substring(0, 23);
  }

  /**
   * Checks if a log level should be output based on current configuration.
   * @private
   */
  private static shouldLog(
    level: keyof typeof ExtensionLogger.LOG_LEVELS
  ): boolean {
    return (
      ExtensionLogger.LOG_LEVELS[level] >=
      ExtensionLogger.LOG_LEVELS[this.config.level]
    );
  }

  static debug(message: string, data?: any) {
    if (!this.shouldLog("debug")) {
      return;
    };

    const timestamp = this.formatTimestamp();
    const logMessage = data
      ? `[${timestamp}] [DEBUG] ${message}\n${JSON.stringify(data, null, 2)}`
      : `[${timestamp}] [DEBUG] ${message}`;

    if (this.config.outputToConsole) {
      console.log(logMessage);
    }
    if (this.config.outputToChannel) {
      this.outputChannel?.appendLine(logMessage);
    }
  }

  static info(message: string, data?: any) {
    if (!this.shouldLog("info")) {
      return;
    }

    const timestamp = this.formatTimestamp();
    const logMessage = data
      ? `[${timestamp}] [INFO] ${message}\n${JSON.stringify(data, null, 2)}`
      : `[${timestamp}] [INFO] ${message}`;

    if (this.config.outputToConsole) {
      console.log(logMessage);
    }
    if (this.config.outputToChannel) {
      this.outputChannel?.appendLine(logMessage);
    }
  }

  static warn(message: string, data?: any) {
    if (!this.shouldLog("warn")) {
      return;
    }

    const timestamp = this.formatTimestamp();
    const logMessage = data
      ? `[${timestamp}] [WARNING] ${message}\n${JSON.stringify(data, null, 2)}`
      : `[${timestamp}] [WARNING] ${message}`;

    if (this.config.outputToConsole) {
      console.warn(logMessage);
    }
    if (this.config.outputToChannel) {
      this.outputChannel?.appendLine(logMessage);
    }
  }

  static error(message: string, error?: any) {
    if (!this.shouldLog("error")) {
      return;
    }

    const timestamp = this.formatTimestamp();
    const logMessage = error
      ? `[${timestamp}] [ERROR] ${message}\n${error.stack || error.toString()}`
      : `[${timestamp}] [ERROR] ${message}`;

    if (this.config.outputToConsole) {
      console.error(logMessage);
    }
    if (this.config.outputToChannel) {
      this.outputChannel?.appendLine(logMessage);
      this.outputChannel?.show(); // Auto-show on errors
    }
  }
}

export { ExtensionLogger };
