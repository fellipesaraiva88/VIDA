import { Injectable } from '@angular/core';
import { GoogleGenAI } from '@google/genai';

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  private ai: GoogleGenAI;
  private readonly MODEL_NAME = 'gemini-2.5-flash';

  // System instruction to define Persona and Tool-use protocol
  private readonly SYSTEM_INSTRUCTION = `
    You are Vida, a highly efficient, warm, and professional AI personal secretary. 
    Your goal is to help the user manage their life, tasks, and answer questions concisely.
    
    IMPORTANT - TASK MANAGEMENT PROTOCOL:
    If the user explicitly asks to ADD a task to their list, append this exact tag at the end of your response: [ADD_TASK: The Task Description]
    If the user explicitly asks to REMOVE a task, append: [REMOVE_TASK: The Task Description]
    
    Example:
    User: "Remind me to buy milk."
    Vida: "I've added that to your list. [ADD_TASK: Buy milk]"

    User: "I bought the milk."
    Vida: "Great, I'll check that off. [REMOVE_TASK: Buy milk]"

    Keep your spoken responses natural, conversational, and relatively brief (1-3 sentences) unless asked for a long explanation.
    Do not use markdown formatting like **bold** in your speech text, as it will be read aloud.
  `;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env['API_KEY'] });
  }

  async generateResponse(audioBase64: string | null, textInput: string | null, chatHistory: any[]): Promise<string> {
    try {
      // Build history for context
      // Note: For a true stateless REST call we send history manually or use ChatSession.
      // Here we will use a fresh chat session seeded with history for simplicity and robustness.
      
      const chat = this.ai.chats.create({
        model: this.MODEL_NAME,
        config: {
          systemInstruction: this.SYSTEM_INSTRUCTION,
          temperature: 0.7,
        },
        history: chatHistory
      });

      let response;
      
      if (audioBase64) {
        // Multimodal turn
        response = await chat.sendMessage({
          content: {
            parts: [
              { inlineData: { mimeType: 'audio/webm', data: audioBase64 } },
              ...(textInput ? [{ text: textInput }] : []) // Optional text with audio
            ]
          }
        });
      } else if (textInput) {
        // Text only turn
        response = await chat.sendMessage({
          content: {
            parts: [{ text: textInput }]
          }
        });
      } else {
        throw new Error('No input provided');
      }

      return response.text || "I'm sorry, I didn't catch that.";

    } catch (error) {
      console.error('Gemini API Error:', error);
      return "I'm having trouble connecting to my brain right now. Please try again.";
    }
  }
}