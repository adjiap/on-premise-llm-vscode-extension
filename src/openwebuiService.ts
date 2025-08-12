import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
}

interface ChatResponse {
  message: {
    role: string;
    content: string;
  };
  done: boolean;
}

export class OpenWebUIService {
  private baseUrl: string;
  private apiKey: string;

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