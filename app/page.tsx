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

// Use type import for ProgressUpdate to avoid circular dependencies
import type { ProgressUpdate } from 'tinylm';

// Define simplified TinyLM instance interface
interface TinyLMInstance {
  models: {
    check: () => Promise<TinyLMCapabilities>;
    load: (options: { model: string }) => Promise<void>;
    offload: (options: { model: string }) => Promise<boolean>;
    interrupt: () => void;
  };
  chat: {
    completions: {
      create: (options: unknown) => unknown;
    };
  };
  init: (options: { lazyLoad: boolean }) => Promise<void>;
}

export default function Home() {
  // System status
  const [webGPUStatus, setWebGPUStatus] = useState<string>("unknown");
  const [fp16Status, setFp16Status] = useState<string>("unknown");
  const [modelStatus, setModelStatus] = useState<string>("not-loaded");
  const [backendValue, setBackendValue] = useState<string>("Unknown");

  // Model and generation state
  const [tiny, setTiny] = useState<TinyLMInstance | null>(null);
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

  // Handle detailed progress updates
  const handleProgress = useCallback((progressData: ProgressUpdate) => {
    const { status, type, percentComplete, message, files, overall } = progressData;

    // Log message
    const logMessage = `[${status || 'unknown'}] (${type || 'unknown'}) ${message || ''}`;
    addLogEntry(logMessage);

    // Update progress data for UI
    if (type === 'model') {
      setProgress({
        status: status || 'unknown',
        type,
        percentComplete: percentComplete || 0,
        message: message || 'Loading model...',
        files,
        overall: overall ? {
          bytesLoaded: overall.bytesLoaded,
          bytesTotal: overall.bytesTotal,
          speed: overall.speed || 0,
          timeRemaining: overall.timeRemaining || 0,
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

        setTiny(tinyInstance as unknown as TinyLMInstance);

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
      } catch (error: unknown) {
        const errorWithMessage = error as { message: string };
        addLogEntry(`Error initializing TinyLM: ${errorWithMessage.message}`);
      }
    };

    initTinyLM();
  }, [addLogEntry, handleProgress]);

  // Load model
  const handleLoadModel = async (modelConfig: ModelConfig) => {
    if (!tiny) return;

    try {
      const { model } = modelConfig;
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

    } catch (error: unknown) {
      const errorWithMessage = error as { message: string };
      // UI updates on error
      addLogEntry(`Error loading model: ${errorWithMessage.message}`);
      addSystemMessage(`Error loading model: ${errorWithMessage.message}`);
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

    } catch (error: unknown) {
      const errorWithMessage = error as { message: string };
      // UI updates on error
      addLogEntry(`Error unloading model: ${errorWithMessage.message}`);
      addSystemMessage(`Error unloading model: ${errorWithMessage.message}`);
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
        try {
          // Get the streaming response from TinyLM
          const response = await tiny.chat.completions.create(options);

          // Properly handle the response based on TinyLM's API
          // Check if the response has a non-null 'on' method (EventEmitter style API)
          if (response && typeof (response as any).on === 'function') {
            let fullResponse = "";
            const streamResponse = response as any;

            // Set up event handlers for the stream
            streamResponse.on('data', (chunk: any) => {
              // Extract content from the chunk based on TinyLM's response format
              const content = chunk?.choices?.[0]?.delta?.content || '';
              if (content) {
                fullResponse += content;
                updateLastAssistantMessage(fullResponse, true);
              }
            });

            // Handle stream completion
            streamResponse.on('end', () => {
              updateLastAssistantMessage(fullResponse, false);
              // Save assistant response to conversation
              setConversation((prev) => [...prev, { role: 'assistant', content: fullResponse }]);
            });

            // Handle errors in the stream
            streamResponse.on('error', (err: Error) => {
              const errorMessage = `Streaming error: ${err.message}`;
              addLogEntry(errorMessage);
              updateLastAssistantMessage(errorMessage, false);
              setConversation((prev) => [...prev, { role: 'assistant', content: errorMessage }]);
            });
          }
          // If it's a ReadableStream (Web Streams API)
          else if (response && (response as any).getReader) {
            const reader = (response as ReadableStream<any>).getReader();
            let fullResponse = "";

            // Process the stream chunks
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              // Extract content based on TinyLM's response format
              const content = value?.choices?.[0]?.delta?.content || '';
              if (content) {
                fullResponse += content;
                updateLastAssistantMessage(fullResponse, true);
              }
            }

            // Complete the response
            updateLastAssistantMessage(fullResponse, false);
            setConversation((prev) => [...prev, { role: 'assistant', content: fullResponse }]);
          }
          // If it's an async iterable - we keep this as a fallback
          else if (response && typeof (response as any)[Symbol.asyncIterator] === 'function') {
            const asyncIterableStream = response as AsyncIterable<any>;
            let fullResponse = "";

            for await (const chunk of asyncIterableStream) {
              const content = chunk?.choices?.[0]?.delta?.content ?? '';
              if (content) {
                fullResponse += content;
                updateLastAssistantMessage(fullResponse, true);
              }
            }

            // Complete the message
            updateLastAssistantMessage(fullResponse, false);
            setConversation((prev) => [...prev, { role: 'assistant', content: fullResponse }]);
          }
          // If it's none of the above, handle as an error
          else {
            throw new Error('Unsupported response format from TinyLM streaming API');
          }
        } catch (error: unknown) {
          const errorWithMessage = error as { message: string };
          const errorMessage = `Streaming error: ${errorWithMessage.message}`;
          addLogEntry(errorMessage);
          updateLastAssistantMessage(errorMessage, false);
          setConversation((prev) => [...prev, { role: 'assistant', content: errorMessage }]);
        }
      } else {
        // Handle regular response
        // Type assertion to handle the response format
        const response = await tiny.chat.completions.create(options) as {
          choices: Array<{ message: { content: string; role: string } }>;
        };

        const content = response.choices?.[0]?.message?.content || '';

        // Update the message
        updateLastAssistantMessage(content, false);

        // Save assistant response to conversation
        setConversation((prev) => [...prev, {
          role: 'assistant',
          content
        }]);

        const timeTaken = performance.now() - startTime;
        addLogEntry(`Response generated in ${Math.round(timeTaken)}ms`);
      }

    } catch (error: unknown) {
      const errorWithMessage = error as { message: string };
      addLogEntry(`Error generating response: ${errorWithMessage.message}`);
      updateLastAssistantMessage(`Error: ${errorWithMessage.message}`, false);

      // Add error to conversation
      setConversation((prev) => [...prev, { role: 'assistant', content: `Error: ${errorWithMessage.message}` }]);
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
          TinyChat
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