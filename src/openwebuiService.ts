import axios, { AxiosResponse } from 'axios';

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

  async sendChat(messages: ChatMessage[], model: string): Promise<string> {
    if (!model) {
      throw new Error('Model name is required')
    }

    try {
      const request: ChatRequest = {
        model: model,
        messages: messages,
        stream: false
      };

      const response: AxiosResponse<ChatResponse> = await axios.post(
        `${this.baseUrl}/ollama/api/chat`,
        request,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000 // 30 seconds
        }
      );

      return response.data.message.content;
    } catch (error) {
      console.error('OpenWebUI API Error:', error);
      throw new Error('Failed to get response from Ollama: ${error}');
    }
  }

  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/ollama/api/tags`,
        {
          headers: {
            'Authorization': 'Bearer ${this.apiKey}',
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.models?.map((model: any) => model.name) || [];
    } catch (error) {
      console.error('Error fetching models:', error);
      return [];
    }
  }
}