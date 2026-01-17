import { Component, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AudioService } from './services/audio.service';
import { GeminiService } from './services/gemini.service';
import { OrbComponent } from './components/orb.component';

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

interface LifeTask {
  id: string;
  text: string;
  completed: boolean;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, OrbComponent],
  templateUrl: './app.component.html'
})
export class AppComponent {
  private audioService = inject(AudioService);
  private geminiService = inject(GeminiService);
  
  // State
  messages = signal<ChatMessage[]>([]);
  tasks = signal<LifeTask[]>([]);
  
  orbMode = signal<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
  frequencyData = this.audioService.frequencyData;
  
  // Computed
  hasTasks = computed(() => this.tasks().length > 0);
  
  // Internal
  private speechParams: SpeechSynthesisUtterance | null = null;
  private voices: SpeechSynthesisVoice[] = [];

  constructor() {
    this.loadVoices();
    // Try to load voices again when changed (browser quirk)
    if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = () => this.loadVoices();
    }
    
    // Initial greeting
    this.addMessage('model', "Hello! I'm Vida, your personal secretary. How can I help you organize your life today?");
  }

  async toggleRecording() {
    if (this.orbMode() === 'listening') {
      await this.stopRecording();
    } else if (this.orbMode() === 'idle' || this.orbMode() === 'speaking') {
      await this.startRecording();
    }
  }

  async startRecording() {
    // Stop speaking if currently speaking
    window.speechSynthesis.cancel();
    
    try {
      await this.audioService.startRecording();
      this.orbMode.set('listening');
    } catch (err) {
      alert('Microphone access denied or error.');
      this.orbMode.set('idle');
    }
  }

  async stopRecording() {
    this.orbMode.set('processing');
    try {
      const audioBase64 = await this.audioService.stopRecording();
      
      // Add a placeholder user message (since we don't know text yet, we visualize audio sent)
      // Actually, let's just wait for response. 
      // Ideally we would transcribe first, but Gemini Multimodal handles raw audio.
      
      const history = this.messages().map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      const responseText = await this.geminiService.generateResponse(audioBase64, null, history);
      
      // Process response for tags
      const { cleanText, actions } = this.parseResponse(responseText);
      
      // Update UI
      this.addMessage('user', '(Voice Message)');
      this.addMessage('model', cleanText);
      
      this.executeActions(actions);
      
      // Speak
      this.speak(cleanText);
      
    } catch (err) {
      console.error(err);
      this.orbMode.set('idle');
      this.addMessage('model', 'Sorry, something went wrong processing your request.');
    }
  }

  // Text chat fallback
  textInput = '';
  async sendText() {
    if (!this.textInput.trim()) return;
    
    const userText = this.textInput;
    this.textInput = '';
    this.addMessage('user', userText);
    this.orbMode.set('processing');
    
    const history = this.messages().map(m => ({
      role: m.role,
      parts: [{ text: m.text }]
    }));

    const responseText = await this.geminiService.generateResponse(null, userText, history);
    const { cleanText, actions } = this.parseResponse(responseText);
    
    this.addMessage('model', cleanText);
    this.executeActions(actions);
    this.speak(cleanText);
  }

  // --- Helpers ---

  addMessage(role: 'user' | 'model', text: string) {
    this.messages.update(msgs => [...msgs, { role, text }]);
  }

  parseResponse(text: string): { cleanText: string, actions: string[] } {
    const actions: string[] = [];
    let cleanText = text;

    // Regex to find tags like [ADD_TASK: ...]
    // Note: We avoid regex in HTML, but logic in TS is fine.
    const addRegex = /\[ADD_TASK:\s*(.*?)\]/g;
    const removeRegex = /\[REMOVE_TASK:\s*(.*?)\]/g;

    let match;
    while ((match = addRegex.exec(text)) !== null) {
      actions.push(`ADD:${match[1]}`);
      cleanText = cleanText.replace(match[0], '');
    }
    
    while ((match = removeRegex.exec(text)) !== null) {
      actions.push(`REMOVE:${match[1]}`);
      cleanText = cleanText.replace(match[0], '');
    }

    return { cleanText: cleanText.trim(), actions };
  }

  executeActions(actions: string[]) {
    actions.forEach(action => {
      if (action.startsWith('ADD:')) {
        const taskText = action.substring(4).trim();
        this.tasks.update(t => [...t, { id: Date.now().toString(), text: taskText, completed: false }]);
      } else if (action.startsWith('REMOVE:')) {
        const taskText = action.substring(7).trim().toLowerCase();
        // Fuzzy remove: remove if task contains text
        this.tasks.update(t => t.filter(task => !task.text.toLowerCase().includes(taskText)));
      }
    });
  }

  toggleTask(id: string) {
    this.tasks.update(t => t.map(task => 
      task.id === id ? { ...task, completed: !task.completed } : task
    ));
  }

  deleteTask(id: string) {
     this.tasks.update(t => t.filter(task => task.id !== id));
  }

  // --- TTS ---

  loadVoices() {
    this.voices = window.speechSynthesis.getVoices();
  }

  speak(text: string) {
    if (!window.speechSynthesis) return;
    
    this.orbMode.set('speaking');
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Select a nice female voice if available (Google US English, or default)
    const preferredVoice = this.voices.find(v => v.name.includes('Google US English')) || 
                           this.voices.find(v => v.name.includes('Female')) ||
                           this.voices[0];
                           
    if (preferredVoice) utterance.voice = preferredVoice;
    
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    
    utterance.onend = () => {
      this.orbMode.set('idle');
    };
    
    utterance.onerror = () => {
      this.orbMode.set('idle');
    };

    window.speechSynthesis.speak(utterance);
  }
}