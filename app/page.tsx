"use client"

import React, { useState, useEffect, useCallback } from "react";
import { SystemStatus } from "@/components/system-status";
import { ModelControls } from "@/components/model-controls";
import { ChatInterface } from "@/components/chat-interface";
import { SystemLog } from "@/components/system-log";
import { formatBytes, formatTime } from "@/lib/utils";
import type { 
  Message, 
  Log, 
  ModelConfig, 
  Progress,
  TinyLMCapabilities
} from "@/types";
import { TinyLM } from 'tinylm';

export default function Home() {
  // System status
  const [webGPUStatus, setWebGPUStatus] = useState<string>("unknown");
  const [fp16Status, setFp16Status] = useState<string>("unknown");
  const [modelStatus, setModelStatus] = useState<string>("not-loaded");
  const [backendValue, setBackendValue] = useState<string>("Unknown");
  
  // Model and generation state
  const [tiny, setTiny] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [streamingEnabled, setStreamingEnabled] = useState<boolean>(true);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [loadedModelName, setLoadedModelName] = useState<string | null>(null);
  
  // Chat state
  const [userInput, setUserInput] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "system",
      content: "Welcome to TinyLM Chat! Load a model to get started."
    }
  ]);
  const [conversation, setConversation] = useState<Message[]>([]);
  
  // Logs
  const [logs, setLogs] = useState<Log[]>([]);

  // Add a log entry
  const addLogEntry = useCallback((message: string) => {
    setLogs((prevLogs) => [
      ...prevLogs,
      {
        timestamp: new Date().toLocaleTimeString(),
        message
      }
    ]);
  }, []);

  // Initialize TinyLM in useEffect to avoid SSR issues
  useEffect(() => {
    const initTinyLM = async () => {
      if (typeof window === "undefined" || !TinyLM) return;
      
      try {
        addLogEntry("Initializing TinyLM...");
        
        // Create TinyLM instance with progress tracking
        const tinyInstance = new TinyLM({
          progressCallback: handleProgress,
          progressThrottleTime: 50
        });
        
        setTiny(tinyInstance);
        
        // Check hardware capabilities
        addLogEntry("Checking hardware capabilities...");
        const capabilities: TinyLMCapabilities = await tinyInstance.models.check();
        
        // Update UI with capabilities
        setWebGPUStatus(capabilities.isWebGPUSupported ? "available" : "not-available");
        setFp16Status(capabilities.fp16Supported ? "supported" : "not-supported");
        
        if (capabilities.environment && capabilities.environment.backend) {
          setBackendValue(capabilities.environment.backend);
        }
        
        addLogEntry(`Hardware check: WebGPU ${capabilities.isWebGPUSupported ? 'available' : 'not available'}, FP16 ${capabilities.fp16Supported ? 'supported' : 'not supported'}`);
        
        // Initialize TinyLM (without loading model yet)
        await tinyInstance.init({ lazyLoad: true });
        
        addLogEntry("Initialization complete. Ready to load model.");
      } catch (error: any) {
        addLogEntry(`Error initializing TinyLM: ${error.message}`);
      }
    };
    
    initTinyLM();
  }, [TinyLM, addLogEntry]);

  // Handle detailed progress updates
  const handleProgress = useCallback((progressData: any) => {
    const { status, type, percentComplete, message, files, overall } = progressData;
    
    // Log message
    let logMessage = `[${status}] (${type || 'unknown'}) ${message || ''}`;
    addLogEntry(logMessage);
    
    // Update progress data for UI
    if (type === 'model') {
      setProgress({
        status,
        type,
        percentComplete,
        message: message || 'Loading model...',
        files,
        overall: overall ? {
          ...overall,
          formattedLoaded: formatBytes(overall.bytesLoaded),
          formattedTotal: formatBytes(overall.bytesTotal),
          formattedSpeed: overall.speed ? `${formatBytes(overall.speed)}/s` : '0 B/s',
          formattedRemaining: overall.timeRemaining ? formatTime(overall.timeRemaining) : '--'
        } : undefined
      });
      
      // Update model status
      if (status === 'loading' || status === 'initiate' || status === 'progress') {
        setModelStatus('loading');
      } else if (status === 'ready' || status === 'done') {
        setModelStatus('loaded');
        // Clear progress after a delay
        setTimeout(() => setProgress(null), 1500);
      } else if (status === 'error') {
        setModelStatus('error');
        setTimeout(() => setProgress(null), 1500);
      } else if (status === 'offloaded') {
        setModelStatus('not-loaded');
        setProgress(null);
      }
    }
    
    // Update generation status
    if (type === 'generation') {
      if (status === 'generating') {
        setIsGenerating(true);
      } else if (status === 'complete' || status === 'error' || status === 'interrupted') {
        setIsGenerating(false);
      }
    }
  }, [addLogEntry]);

  // Load model
  const handleLoadModel = async (modelConfig: ModelConfig) => {
    if (!tiny) return;
    
    try {
      const { model, temperature, maxTokens } = modelConfig;
      addLogEntry(`Loading model: ${model}`);
      
      // Clear any existing progress
      setProgress(null);
      
      // Update UI state
      setModelStatus('loading');
      setLoadedModelName(model);
      
      // Add system message
      addSystemMessage(`Loading model: ${model}...`);
      
      // Reset conversation
      setConversation([]);
      
      // Load the model
      await tiny.models.load({ model });
      
      // UI updates on success
      addSystemMessage(`Model ${model} loaded successfully! You can start chatting now.`);
      setModelStatus('loaded');
      
    } catch (error: any) {
      // UI updates on error
      addLogEntry(`Error loading model: ${error.message}`);
      addSystemMessage(`Error loading model: ${error.message}`);
      setModelStatus('error');
    }
  };

  // Unload model
  const handleUnloadModel = async () => {
    if (!tiny || !loadedModelName) return;
    
    try {
      addLogEntry(`Unloading model: ${loadedModelName}`);
      
      // Update UI state
      setModelStatus('not-loaded');
      
      // Add system message
      addSystemMessage(`Unloading model: ${loadedModelName}...`);
      
      // Unload the model
      await tiny.models.offload({ model: loadedModelName });
      
      // UI updates on success
      addSystemMessage(`Model ${loadedModelName} unloaded successfully.`);
      setLoadedModelName(null);
      
      // Reset conversation
      setConversation([]);
      
    } catch (error: any) {
      // UI updates on error
      addLogEntry(`Error unloading model: ${error.message}`);
      addSystemMessage(`Error unloading model: ${error.message}`);
      setModelStatus('loaded');
    }
  };

  // Send message
  const handleSendMessage = async () => {
    if (!userInput.trim() || !tiny || modelStatus !== 'loaded' || isGenerating) return;
    
    // Add user message to chat
    addUserMessage(userInput);
    
    // Clear input field
    setUserInput("");
    
    // Add message to conversation
    const updatedConversation = [...conversation, { role: 'user' as const, content: userInput }];
    setConversation(updatedConversation);
    
    // Construct messages array with context
    const messages = [
      {
        role: 'system',
        content: 'You are a helpful AI assistant powered by TinyLM.'
      },
      ...updatedConversation
    ];
    
    // Start assistant message with typing indicator
    addAssistantTypingMessage();
    
    try {
      // Set generation options
      const options = {
        model: loadedModelName,
        messages,
        temperature: 0.7, // Use the actual temperature value from UI
        max_tokens: 512, // Use the actual max tokens value from UI
        stream: streamingEnabled
      };
      
      addLogEntry(`Generating response with temperature ${options.temperature} and max_tokens ${options.max_tokens}`);
      
      // Start generation
      const startTime = performance.now();
      
      if (options.stream) {
        // Handle streaming response
        const stream = await tiny.chat.completions.create(options);
        
        let fullResponse = "";
        for await (const chunk of stream) {
          // Safely extract content from the chunk
          const content = chunk?.choices?.[0]?.delta?.content ?? '';
          if (content) {
            updateLastAssistantMessage(fullResponse + content, true);
            fullResponse += content;
          }
        }
        
        // Complete the message
        updateLastAssistantMessage(fullResponse, false);
        
        // Save assistant response to conversation
        setConversation((prev) => [...prev, { role: 'assistant', content: fullResponse }]);
      } else {
        // Handle regular response
        const response = await tiny.chat.completions.create(options);
        const content = response.choices[0]?.message?.content || '';
        
        // Update the message
        updateLastAssistantMessage(content, false);
        
        // Save assistant response to conversation
        setConversation((prev) => [...prev, response.choices[0].message]);
        
        const timeTaken = performance.now() - startTime;
        addLogEntry(`Response generated in ${Math.round(timeTaken)}ms`);
      }
      
    } catch (error: any) {
      addLogEntry(`Error generating response: ${error.message}`);
      updateLastAssistantMessage(`Error: ${error.message}`, false);
      
      // Add error to conversation
      setConversation((prev) => [...prev, { role: 'assistant', content: `Error: ${error.message}` }]);
    }
  };

  // Stop generation
  const handleStopGeneration = () => {
    if (isGenerating && tiny) {
      addLogEntry('Interrupting generation...');
      tiny.models.interrupt();
    }
  };

  // Toggle streaming
  const handleToggleStreaming = (enabled: boolean) => {
    setStreamingEnabled(enabled);
    addLogEntry(`Streaming mode ${enabled ? 'enabled' : 'disabled'}`);
  };

  // Helper functions for chat messages
  const addUserMessage = (content: string) => {
    setMessages((prev) => [...prev, { role: "user", content }]);
  };

  const addSystemMessage = (content: string) => {
    setMessages((prev) => [...prev, { role: "system", content }]);
  };

  const addAssistantTypingMessage = () => {
    setMessages((prev) => [...prev, { role: "assistant", content: "", isTyping: true }]);
  };

  const updateLastAssistantMessage = (content: string, isTyping: boolean) => {
    setMessages((prev) => {
      const newMessages = [...prev];
      const lastIndex = newMessages.length - 1;
      
      if (lastIndex >= 0 && newMessages[lastIndex].role === "assistant") {
        newMessages[lastIndex] = {
          ...newMessages[lastIndex],
          content,
          isTyping
        };
      }
      
      return newMessages;
    });
  };

  return (
    <main className="container mx-auto py-6 space-y-6">
      <header className="pb-6 mb-6 border-b">
        <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl">
          TinyLM Text Generation
        </h1>
        <p className="leading-7 text-muted-foreground">
          Chat with LLMs directly in your browser using TinyLM
        </p>
      </header>

      <SystemStatus 
        webGPUStatus={webGPUStatus}
        fp16Status={fp16Status}
        modelStatus={modelStatus}
        backendValue={backendValue}
        progress={progress}
        loadedModelName={loadedModelName}
      />

      <ModelControls 
        onLoadModel={handleLoadModel}
        onUnloadModel={handleUnloadModel}
        isModelLoaded={modelStatus === 'loaded'}
        isModelLoading={modelStatus === 'loading'}
        isGenerating={isGenerating}
        streamingEnabled={streamingEnabled}
        onToggleStreaming={handleToggleStreaming}
      />

      <ChatInterface 
        messages={messages}
        userInput={userInput}
        setUserInput={setUserInput}
        onSendMessage={handleSendMessage}
        onStopGeneration={handleStopGeneration}
        isGenerating={isGenerating}
        isModelLoaded={modelStatus === 'loaded'}
      />

      <SystemLog logs={logs} />
    </main>
  );
}