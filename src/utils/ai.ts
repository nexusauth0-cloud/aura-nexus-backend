interface AIMemory {
  userId: string;
  preferences: Record<string, any>;
  conversationHistory: { role: string; content: string }[];
}

const responses: Record<string, string> = {
  greeting: "Hello! I'm Aura, your personal AI assistant. How can I help you today?",
  productivity: "I can help you organize your tasks, plan your day, and stay focused. Would you like me to create a daily plan?",
  learning: "I'm here to help you learn! You can upload study materials, and I'll generate summaries, quizzes, and flashcards.",
  memory: "I remember things about you to provide better assistance. You can view and manage your memories in the Memory dashboard.",
  default: "I understand. Let me process that and help you out. Could you tell me more about what you need?"
};

const taskKeywords = ['task', 'todo', 'to-do', 'remind', 'reminder', 'schedule'];
const learningKeywords = ['study', 'learn', 'quiz', 'flashcard', 'explain', 'summary', 'understand'];
const memoryKeywords = ['remember', 'forget', 'memory', 'recall', 'store', 'save'];

export function classifyIntent(message: string): string {
  const lower = message.toLowerCase();
  if (taskKeywords.some(k => lower.includes(k))) return 'task';
  if (learningKeywords.some(k => lower.includes(k))) return 'learning';
  if (memoryKeywords.some(k => lower.includes(k))) return 'memory';
  if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) return 'greeting';
  return 'general';
}

export function generateResponse(message: string, context: AIMemory): string {
  const intent = classifyIntent(message);

  if (intent === 'greeting') {
    const name = context.preferences?.name;
    return name
      ? `Hello ${name}! I'm Aura, your personal AI assistant. How can I help you today?`
      : responses.greeting;
  }

  if (intent === 'task') {
    return "I'll help you manage your tasks. I've noted that down. You can also use the Productivity Hub to organize everything.";
  }

  if (intent === 'learning') {
    return responses.learning;
  }

  if (intent === 'memory') {
    return responses.memory;
  }

  return generateGeneralResponse(message, context);
}

function generateGeneralResponse(message: string, context: AIMemory): string {
  const name = context.preferences?.name;
  const greeting = name ? `${name}, ` : '';

  const responses = [
    `${greeting}that's an interesting question. Let me think about it... Based on what I know, I'd suggest exploring this further. Would you like me to help you break this down?`,
    `${greeting}I understand what you're looking for. Let me help you with that. Could you provide a bit more detail so I can give you the best assistance?`,
    `${greeting}great question! Here's what I think... This is a complex topic, but I can help you understand it better. Would you like me to explain it in simpler terms?`,
  ];

  return responses[Math.floor(Math.random() * responses.length)];
}

export function extractEntities(message: string): { tasks?: string[]; notes?: string[]; memories?: { action: string; content: string }[] } {
  const lower = message.toLowerCase();
  const entities: any = {};

  if (lower.includes('remember') || lower.includes('save')) {
    const content = message.replace(/remember|save|that|this|please/gi, '').trim();
    if (content.length > 3) {
      entities.memories = [{ action: 'save', content }];
    }
  }

  return entities;
}
