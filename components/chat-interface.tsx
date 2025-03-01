"use client"

import React, { useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChatInterfaceProps } from "@/types";

export function ChatInterface({
  messages,
  userInput,
  setUserInput,
  onSendMessage,
  onStopGeneration,
  isGenerating,
  isModelLoaded
}: ChatInterfaceProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUserInput(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSendMessage();
    }
  };

  return (
    <Card className="flex flex-col h-[600px]">
      <CardContent className="flex flex-col h-full p-0">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`max-w-[80%] p-3 rounded-lg ${
                message.role === "user"
                  ? "bg-primary text-primary-foreground ml-auto"
                  : message.role === "assistant"
                  ? "bg-muted"
                  : "bg-amber-100 mx-auto text-center text-sm max-w-[60%]"
              }`}
            >
              {message.content}
              {message.role === "assistant" && message.isTyping && (
                <span className="inline-block w-1 h-4 ml-1 bg-current animate-pulse" />
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        <div className="border-t p-4 flex items-center space-x-2">
          <Input
            placeholder={isModelLoaded ? "Type your message here..." : "Load a model to start chatting..."}
            value={userInput}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={!isModelLoaded || isGenerating}
            className="flex-1"
          />
          <Button 
            onClick={onSendMessage} 
            disabled={!isModelLoaded || isGenerating || !userInput.trim()}
          >
            Send
          </Button>
          <Button 
            onClick={onStopGeneration} 
            disabled={!isGenerating}
            variant="outline"
          >
            Stop
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}