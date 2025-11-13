// In-memory storage for Telegram messages
// For production, replace with database (PostgreSQL, MongoDB, etc.)

export interface TelegramMessage {
  id: string;
  chatId: number;
  userId: number;
  userName: string;
  userUsername?: string;
  messageText: string;
  timestamp: Date;
  type: 'incoming' | 'command' | 'contact_form';
  category?: 'auto' | 'moto' | 'general';
  status: 'new' | 'read' | 'replied' | 'archived';
  metadata?: Record<string, any>; // Additional data (model, email, wishes, etc.)
  replies?: {
    text: string;
    timestamp: Date;
    sentBy: string;
  }[];
}

class MessageStore {
  private messages: Map<string, TelegramMessage> = new Map();
  private subscribers: Set<(messages: TelegramMessage[]) => void> = new Set();

  // Add new message
  addMessage(message: Omit<TelegramMessage, 'id' | 'timestamp' | 'status' | 'replies'>): TelegramMessage {
    const id = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newMessage: TelegramMessage = {
      ...message,
      id,
      timestamp: new Date(),
      status: 'new',
      replies: [],
    };
    
    this.messages.set(id, newMessage);
    this.notifySubscribers();
    
    return newMessage;
  }

  // Get all messages
  getAllMessages(): TelegramMessage[] {
    return Array.from(this.messages.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  // Get messages by status
  getMessagesByStatus(status: TelegramMessage['status']): TelegramMessage[] {
    return this.getAllMessages().filter(msg => msg.status === status);
  }

  // Get messages by category
  getMessagesByCategory(category: string): TelegramMessage[] {
    return this.getAllMessages().filter(msg => msg.category === category);
  }

  // Get message by ID
  getMessage(id: string): TelegramMessage | undefined {
    return this.messages.get(id);
  }

  // Update message status
  updateStatus(id: string, status: TelegramMessage['status']): boolean {
    const message = this.messages.get(id);
    if (message) {
      message.status = status;
      this.notifySubscribers();
      return true;
    }
    return false;
  }

  // Add reply to message
  addReply(id: string, text: string, sentBy: string = 'admin'): boolean {
    const message = this.messages.get(id);
    if (message) {
      if (!message.replies) {
        message.replies = [];
      }
      message.replies.push({
        text,
        timestamp: new Date(),
        sentBy,
      });
      this.notifySubscribers();
      return true;
    }
    return false;
  }

  // Delete message
  deleteMessage(id: string): boolean {
    const deleted = this.messages.delete(id);
    if (deleted) {
      this.notifySubscribers();
    }
    return deleted;
  }

  // Get statistics
  getStats() {
    const all = this.getAllMessages();
    return {
      total: all.length,
      new: all.filter(m => m.status === 'new').length,
      read: all.filter(m => m.status === 'read').length,
      replied: all.filter(m => m.status === 'replied').length,
      archived: all.filter(m => m.status === 'archived').length,
      auto: all.filter(m => m.category === 'auto').length,
      moto: all.filter(m => m.category === 'moto').length,
      general: all.filter(m => m.category === 'general').length,
      today: all.filter(m => {
        const today = new Date();
        const msgDate = new Date(m.timestamp);
        return msgDate.toDateString() === today.toDateString();
      }).length,
    };
  }

  // Subscribe to changes
  subscribe(callback: (messages: TelegramMessage[]) => void) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  // Notify all subscribers
  private notifySubscribers() {
    const messages = this.getAllMessages();
    this.subscribers.forEach(callback => callback(messages));
  }

  // Export to JSON (for backup)
  export(): string {
    return JSON.stringify(Array.from(this.messages.values()), null, 2);
  }

  // Import from JSON (for restore)
  import(json: string): void {
    try {
      const data = JSON.parse(json) as TelegramMessage[];
      this.messages.clear();
      data.forEach(msg => {
        this.messages.set(msg.id, {
          ...msg,
          timestamp: new Date(msg.timestamp),
          replies: msg.replies?.map(r => ({
            ...r,
            timestamp: new Date(r.timestamp),
          })),
        });
      });
      this.notifySubscribers();
    } catch (error) {
      console.error('Failed to import messages:', error);
    }
  }
}

// Singleton instance
export const messageStore = new MessageStore();
