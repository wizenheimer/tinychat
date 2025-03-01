"use client"

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ModelControlsProps, ModelConfig } from "@/types";

export function ModelControls({
  onLoadModel,
  onUnloadModel,
  isModelLoaded,
  isModelLoading,
  isGenerating,
  streamingEnabled,
  onToggleStreaming
}: ModelControlsProps) {
  const [selectedModel, setSelectedModel] = useState<string>("onnx-community/DeepSeek-R1-Distill-Qwen-1.5B-ONNX");
  const [temperature, setTemperature] = useState<number>(0.7);
  const [maxTokens, setMaxTokens] = useState<number>(512);

  const handleLoadModel = () => {
    const config: ModelConfig = {
      model: selectedModel,
      temperature,
      maxTokens
    };
    onLoadModel(config);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Model Controls</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div className="space-y-2">
            <label htmlFor="model-select" className="text-sm font-medium">
              Model
            </label>
            <Select 
              value={selectedModel} 
              onValueChange={setSelectedModel}
              disabled={isModelLoaded || isModelLoading}
            >
              <SelectTrigger id="model-select">
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="onnx-community/DeepSeek-R1-Distill-Qwen-1.5B-ONNX">
                  DeepSeek-R1-Distill-Qwen (1.5B)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label htmlFor="temperature" className="text-sm font-medium">
              Temperature: {temperature}
            </label>
            <Slider
              id="temperature"
              min={0}
              max={1}
              step={0.1}
              value={[temperature]}
              onValueChange={(values) => setTemperature(values[0])}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="max-tokens" className="text-sm font-medium">
              Max Tokens
            </label>
            <Input
              id="max-tokens"
              type="number"
              min={1}
              max={2048}
              value={maxTokens}
              onChange={(e) => setMaxTokens(parseInt(e.target.value))}
            />
          </div>

          <div className="flex items-end space-x-2">
            <Button 
              onClick={handleLoadModel} 
              disabled={isModelLoaded || isModelLoading}
            >
              Load Model
            </Button>
            <Button 
              onClick={onUnloadModel} 
              disabled={!isModelLoaded || isGenerating}
              variant="outline"
            >
              Unload Model
            </Button>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Switch 
            id="stream-toggle" 
            checked={streamingEnabled}
            onCheckedChange={onToggleStreaming}
          />
          <label 
            htmlFor="stream-toggle" 
            className="text-sm font-medium cursor-pointer"
          >
            Streaming Mode
          </label>
        </div>
      </CardContent>
    </Card>
  );
}