'use client';

import React, { useState, useEffect } from 'react';
import { X, Check, Server, Shield, Cpu, RefreshCw, Key, Globe, AlertCircle, CheckCircle2 } from 'lucide-react';
import { SynapseLogo } from '@/components/brand/SynapseLogo';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [provider, setProvider] = useState('openrouter');
  const [model, setModel] = useState('openai/gpt-oss-20b:free');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('https://openrouter.ai/api/v1');

  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
      checkHealth();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.success && data.settings) {
        setProvider(data.settings.provider || 'openrouter');
        setModel(data.settings.model || 'openai/gpt-oss-20b:free');
        setBaseUrl(data.settings.baseUrl || 'https://openrouter.ai/api/v1');
      }
    } catch (e) {
      console.error('Error loading settings:', e);
    }
  };

  const checkHealth = async () => {
    setIsCheckingHealth(true);
    try {
      const res = await fetch('/api/ai/health');
      const data = await res.json();
      setHealthStatus(data);
    } catch (e: any) {
      setHealthStatus({ status: 'error', error: e.message });
    } finally {
      setIsCheckingHealth(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          model,
          apiKey,
          baseUrl,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
        checkHealth();
      }
    } catch (e) {
      console.error('Error saving settings:', e);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in select-none">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 w-full max-w-lg shadow-3d-lg space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <SynapseLogo size="xs" />
            <div>
              <h3 className="font-bold text-neutral-100 text-sm">SYNAPSE AI Configuration</h3>
              <p className="text-[11px] text-neutral-500">Configure OpenRouter, model IDs, endpoints &amp; theme</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-neutral-500 hover:text-neutral-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live Provider Health Status Indicator */}
        <div className="p-3.5 bg-neutral-950 border border-neutral-800 rounded-2xl flex items-center justify-between shadow-3d-sm">
          <div className="space-y-0.5">
            <div className="text-xs font-semibold text-neutral-200 flex items-center gap-2">
              <span>Status:</span>
              {healthStatus?.connected ? (
                <span className="text-emerald-400 flex items-center gap-1 font-mono text-[11px]">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Connected ({healthStatus.provider})
                </span>
              ) : healthStatus?.status === 'local_mode' ? (
                <span className="text-neutral-400 flex items-center gap-1 font-mono text-[11px]">
                  <Cpu className="w-3.5 h-3.5" />
                  Local Engine (Offline)
                </span>
              ) : (
                <span className="text-rose-400 flex items-center gap-1 font-mono text-[11px]">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {healthStatus?.error ? 'Error / Rate Limited' : 'Connection Failed'}
                </span>
              )}
            </div>
            <div className="text-[10px] text-neutral-500 font-mono">
              Model: {model} • {baseUrl}
            </div>
          </div>

          <button
            onClick={checkHealth}
            disabled={isCheckingHealth}
            className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 text-xs transition-colors shadow-3d-sm"
            title="Refresh Health"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isCheckingHealth ? 'animate-spin text-neutral-200' : ''}`} />
          </button>
        </div>

        {/* Interface Theme Section */}
        <div>
          <label className="block text-neutral-300 font-medium mb-1.5 text-xs">Interface Theme Mode</label>
          <ThemeToggle variant="segmented" />
        </div>

        {/* Configuration Form */}
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          {/* Quick Preset Selector Buttons */}
          <div>
            <label className="block text-neutral-300 font-medium mb-1.5">Provider Presets</label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'openrouter', name: 'OpenRouter', url: 'https://openrouter.ai/api/v1', defaultModel: 'openai/gpt-oss-20b:free' },
                { id: 'openai', name: 'OpenAI', url: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini' },
                { id: 'groq', name: 'Groq Cloud', url: 'https://api.groq.com/openai/v1', defaultModel: 'llama-3.3-70b-versatile' },
                { id: 'deepseek', name: 'DeepSeek', url: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-chat' },
                { id: 'together', name: 'Together AI', url: 'https://api.together.xyz/v1', defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo' },
                { id: 'ollama', name: 'Ollama (Local)', url: 'http://localhost:11434/v1', defaultModel: 'llama3.2' },
              ].map((p) => {
                const isSelected = provider === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setProvider(p.id);
                      setBaseUrl(p.url);
                      setModel(p.defaultModel);
                    }}
                    className={`py-1.5 px-2 rounded-xl text-center font-medium border transition-colors ${
                      isSelected
                        ? 'bg-neutral-800 text-white border-neutral-600 shadow-3d-sm'
                        : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:bg-neutral-900'
                    }`}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-neutral-300 font-medium mb-1">AI Provider Mode</label>
            <select
              value={provider}
              onChange={(e) => {
                setProvider(e.target.value);
                if (e.target.value === 'openrouter') {
                  setBaseUrl('https://openrouter.ai/api/v1');
                  setModel('openai/gpt-oss-20b:free');
                } else if (e.target.value === 'openai') {
                  setBaseUrl('https://api.openai.com/v1');
                  setModel('gpt-4o-mini');
                } else if (e.target.value === 'groq') {
                  setBaseUrl('https://api.groq.com/openai/v1');
                  setModel('llama-3.3-70b-versatile');
                } else if (e.target.value === 'deepseek') {
                  setBaseUrl('https://api.deepseek.com/v1');
                  setModel('deepseek-chat');
                } else if (e.target.value === 'together') {
                  setBaseUrl('https://api.together.xyz/v1');
                  setModel('meta-llama/Llama-3.3-70B-Instruct-Turbo');
                } else if (e.target.value === 'ollama') {
                  setBaseUrl('http://localhost:11434/v1');
                  setModel('llama3.2');
                }
              }}
              className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-200 focus:outline-none focus:border-neutral-600"
            >
              <option value="openrouter">OpenRouter (Any open model)</option>
              <option value="openai">OpenAI (GPT-4o, GPT-4o-mini, etc.)</option>
              <option value="groq">Groq Cloud (Fast Llama 3.3, Mixtral)</option>
              <option value="deepseek">DeepSeek API (deepseek-chat, deepseek-reasoner)</option>
              <option value="together">Together AI (Open source models)</option>
              <option value="ollama">Ollama / Local Server (Free &amp; Offline)</option>
              <option value="custom">Custom OpenAI-Compatible Endpoint</option>
              <option value="local">Local Knowledge Engine (Offline Fallback)</option>
            </select>
          </div>

          <div>
            <label className="block text-neutral-300 font-medium mb-1">API Base URL</label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://your-custom-endpoint/v1"
              className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-200 font-mono focus:outline-none focus:border-neutral-600"
            />
            <p className="text-[10px] text-neutral-500 mt-1">
              Supports any OpenAI-compatible API base URL (OpenRouter, Groq, Ollama, vLLM, LM Studio, etc.)
            </p>
          </div>

          <div>
            <label className="block text-neutral-300 font-medium mb-1">Model Identifier</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Model name or ID (e.g. gpt-4o, deepseek-chat, llama-3.3-70b)"
              className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-200 font-mono focus:outline-none focus:border-neutral-600"
            />
          </div>

          <div>
            <label className="block text-neutral-300 font-medium mb-1">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your API Key (Leave blank for Ollama / Local)"
              className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-200 font-mono focus:outline-none focus:border-neutral-600"
            />
          </div>

          {/* Submit */}
          <div className="flex items-center justify-between pt-2 border-t border-neutral-800">
            {saveSuccess ? (
              <span className="text-emerald-400 font-medium flex items-center gap-1 text-xs">
                <Check className="w-3.5 h-3.5" /> Saved &amp; Tested
              </span>
            ) : (
              <span />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-neutral-400 hover:text-neutral-200 rounded-xl"
              >
                Close
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-neutral-700 hover:bg-neutral-600 text-white font-semibold rounded-xl transition-all shadow-3d-sm active:scale-95"
              >
                Save Settings
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
