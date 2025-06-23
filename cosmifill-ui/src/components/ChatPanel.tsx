import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User } from 'lucide-react';
import { clsx } from 'clsx';

interface Message {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface ChatPanelProps {
  sessionActive: boolean;
}

export function ChatPanel({ sessionActive }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (sessionActive) {
      // Listen for Claude output
      window.electronAPI.onClaudeOutput((data: string) => {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          type: 'assistant',
          content: data,
          timestamp: new Date(),
        }]);
      });
      
      // Initial message when session starts
      setMessages([{
        id: '1',
        type: 'system',
        content: 'Claude Code session started. Processing your files...',
        timestamp: new Date(),
      }]);
    }
    
    return () => {
      window.electronAPI.removeAllListeners('claude:output');
    };
  }, [sessionActive]);

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');

    // TODO: Send feedback to Claude session
  };

  return (
    <div className="h-full flex flex-col bg-gray-50/50 dark:bg-gray-900/50">
      {/* Chat Header */}
      <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-700/50 px-6 py-4">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center shadow-lg shadow-purple-500/25">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Claude Assistant</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Session {sessionActive ? 'active' : 'inactive'}</p>
          </div>
        </div>
      </div>
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm">
        {messages.map((message) => (
          <div
            key={message.id}
            className={clsx(
              'flex items-start space-x-3',
              message.type === 'user' && 'justify-end'
            )}
          >
            {message.type !== 'user' && (
              <div className="flex-shrink-0">
                {message.type === 'assistant' ? (
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 rounded-full flex items-center justify-center">
                    <Bot className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                ) : (
                  <div className="w-8 h-8 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">SYS</span>
                  </div>
                )}
              </div>
            )}
            
            <div
              className={clsx(
                'max-w-md px-4 py-3 rounded-2xl shadow-sm',
                message.type === 'user'
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/20'
                  : message.type === 'assistant'
                  ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700'
                  : 'bg-purple-50 dark:bg-purple-900/20 text-purple-900 dark:text-purple-300 border border-purple-200 dark:border-purple-700'
              )}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              <p
                className={clsx(
                  'text-xs mt-1',
                  message.type === 'user' ? 'text-purple-200' : 'text-gray-500 dark:text-gray-400'
                )}
              >
                {message.timestamp.toLocaleTimeString()}
              </p>
            </div>
            
            {message.type === 'user' && (
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-gradient-to-br from-purple-200 to-pink-200 dark:from-purple-800 dark:to-pink-800 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-purple-700 dark:text-purple-300" />
                </div>
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 p-4">
        <div className="flex space-x-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Provide guidance or corrections to Claude..."
            className="flex-1 px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent placeholder-gray-400 dark:placeholder-gray-500 text-gray-900 dark:text-white transition-all duration-200"
            disabled={!sessionActive}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || !sessionActive}
            className="px-5 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/30 disabled:shadow-none"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}