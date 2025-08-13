import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';

/**
 * Represents a chat message in the conversation.
 */
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Represents an API request in the conversation.
 */
interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
}

/**
 * Represents a chat answer from assistant in the conversation.
 */
interface ChatResponse {
  message: {
    role: string;
    content: string;
  };
  done: boolean;
}

/**
 * Service class for interacting with OpenWebUI API.
 * Handles authentication, chat requests, and model management.
 */
export class OpenWebUIService {
  private baseUrl: string;
  private apiKey: string;

  /**
   * Creates a new OpenWebUIService instance.
   * @param baseUrl - The base URL of the OpenWebUI service
   * @param apiKey - The API key for authentication
   * @throws {Error} When baseUrl or apiKey are missing
   */
  constructor(baseUrl: string, apiKey: string) {
    if (!baseUrl) {
      throw new Error('OpenWebUI base URL is required');
    }
    if (!apiKey) {
      throw new Error('OpenWebUI API key is required');
    }

    this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    this.apiKey = apiKey;
  }

  /**
   * Makes an HTTP request to the OpenWebUI API.
   * @param endpoint - The API endpoint path
   * @param method - HTTP method (defaults to 'GET')
   * @param data - Request body data for POST requests
   * @returns Promise resolving to the parsed JSON response
   * @private
   */
  private async makeRequest(endpoint: string, method: string = 'GET', data?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const url = new URL(`${this.baseUrl}${endpoint}`);
      const isHttps = url.protocol === 'https:';
      const client = isHttps ? https : http;

      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname,
        method: method,
        headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
        }
      };

      const req = client.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          try {
            const parsed = JSON.parse(responseData);
            resolve(parsed);
          } catch (error) {
            reject(new Error(`Invalid JSON response: ${responseData}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      if (data) {
        req.write(JSON.stringify(data));
      }

      req.end();
    });
  }

  /**
   * Sends a chat message to the LLM and returns the response.
   * @param messages - Array of chat messages in the conversation
   * @param model - The model name to use for generation
   * @param systemPrompt - Optional system prompt to prepend to conversation
   * @returns Promise resolving to the assistant's response text
   * @throws {Error} When model is missing or API request fails
   */
  async sendChat(messages: ChatMessage[], model: string, systemPrompt?: string): Promise<string> {
    if (!model) {
      throw new Error('Model name is required')
    }

    try {
      // Prepare messages array - add system prompt if provided
      const chatMessages: ChatMessage[] = [];

      if (systemPrompt && systemPrompt.trim()){
        chatMessages.push(
          {
            role: 'user',
            content: systemPrompt
          }
        );
      }

      chatMessages.push(...messages);

      const request: ChatRequest = {
        model: model,
        messages: chatMessages,
        stream: false
      };

      const response: ChatResponse = await this.makeRequest(
        '/ollama/api/chat',
        'POST',
        request
      );

      return response.message.content;
    } catch (error) {
      console.error('OpenWebUI API Error:', error);
      throw new Error(`Failed to get response from Ollama: ${error}`);
    }
  }

  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await this.makeRequest('/ollama/api/tags');
      return response.models?.map((model: any) => model.name) || [];
    } catch (error) {
      console.error('Error fetching models:', error);
      return [];
    }
  }
}