'use client';

import { useState, useEffect, useRef } from 'react';
import chatbotData from '../lib/chatbot_data.json';

interface Message {
  sender: 'user' | 'bot';
  text: string;
}

interface ChatbotRule {
  keywords: string[];
  answer: string;
}

export default function Chatbot() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<null | HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Initial bot message
    setMessages([{ sender: 'bot', text: 'Hello! How can I help you with your wheelchair questions today?' }]);
  }, []);

  const findAnswer = (userInput: string): string => {
    const lowerInput = userInput.toLowerCase();
    for (const rule of chatbotData as ChatbotRule[]) {
      for (const keyword of rule.keywords) {
        if (lowerInput.includes(keyword.toLowerCase())) {
          return rule.answer;
        }
      }
    }
    return "I'm sorry, I don't have information on that specific topic right now. Could you please rephrase your question?";
  };

  const handleSend = () => {
    if (input.trim() === '') return;

    const userMessage: Message = { sender: 'user', text: input };
    const botResponse = findAnswer(input);
    const botMessage: Message = { sender: 'bot', text: botResponse };

    setMessages([...messages, userMessage, botMessage]);
    setInput('');
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleSend();
    }
  };

  return (
    <div className="border rounded-lg shadow-md flex flex-col h-[60vh] bg-white">
      <div className="flex-grow p-4 overflow-y-auto space-y-4">
        {messages.map((msg, index) => (
          <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${msg.sender === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800'}`}>
              {msg.text.split('\n').map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="border-t p-4 bg-gray-50 flex">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask a question..."
          className="flex-grow border rounded-l-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleSend}
          className="bg-blue-500 text-white px-4 py-2 rounded-r-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Send
        </button>
      </div>
    </div>
  );
}

