'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { X, Check, Cpu, RefreshCw, AlertCircle, CheckCircle2, Search, ChevronDown, ChevronUp, Loader2, Sparkles } from 'lucide-react';
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

  // Free OpenRouter model picker state
  const [freeModels, setFreeModels] = useState<{ id: string; name: string; context_length: number | null; description: string }[]>([]);
  const [freeModelsLoading, setFreeModelsLoading] = useState(false);
  const [freeModelsError, setFreeModelsError] = useState<string | null>(null);
  const [modelSearch, setModelSearch] = useState('');
  const [showFreePicker, setShowFreePicker] = useState(false);
  const [selectedFreeId, setSelectedFreeId] = useState('');

  const checkHealth = useCallback(
    async (customConfig?: { provider?: string; model?: string; apiKey?: string; baseUrl?: string }) => {
      setIsCheckingHealth(true);
      try {
        const activeKey =
          customConfig?.apiKey ??
          (apiKey && apiKey !== '********' ? apiKey : localStorage.getItem('synapse_api_key') || '');
        const activeProvider = customConfig?.provider ?? provider;
        const activeModel = customConfig?.model ?? model;
        const activeBaseUrl = customConfig?.baseUrl ?? baseUrl;

        const res = await fetch('/api/ai/health', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: activeProvider,
            model: activeModel,
            apiKey: activeKey,
            baseUrl: activeBaseUrl,
          }),
        });
        const data = await res.json();
        setHealthStatus(data);
      } catch (e: any) {
        setHealthStatus({ status: 'error', error: e.message });
      } finally {
        setIsCheckingHealth(false);
      }
    },
    [apiKey, provider, model, baseUrl]
  );

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      let p = 'openrouter';
      let m = 'openai/gpt-oss-20b:free';
      let b = 'https://openrouter.ai/api/v1';

      if (data.success && data.settings) {
        // localStorage is the source of truth on the client; server only fills gaps
        p = localStorage.getItem('synapse_provider') || data.settings.provider || 'openrouter';
        m = localStorage.getItem('synapse_model') || data.settings.model || 'openai/gpt-oss-20b:free';
        b = localStorage.getItem('synapse_base_url') || data.settings.baseUrl || 'https://openrouter.ai/api/v1';
      } else {
        p = localStorage.getItem('synapse_provider') || 'openrouter';
        m = localStorage.getItem('synapse_model') || 'openai/gpt-oss-20b:free';
        b = localStorage.getItem('synapse_base_url') || 'https://openrouter.ai/api/v1';
      }

      // Auto-correct any mismatched legacy opencodezen URL when OpenRouter is selected
      if (p === 'openrouter' && (b.includes('opencodezen') || m.includes('deepseek-v4-flash-max'))) {
        b = 'https://openrouter.ai/api/v1';
        m = 'openai/gpt-oss-20b:free';
        localStorage.setItem('synapse_base_url', b);
        localStorage.setItem('synapse_model', m);
      }

      setProvider(p);
      setModel(m);
      setBaseUrl(b);

      const localKey = localStorage.getItem('synapse_api_key');
      if (localKey) {
        setApiKey(localKey);
      }
    } catch (e) {
      console.error('Error loading settings:', e);
    }
  }, []);

  const fetchFreeModels = useCallback(async () => {
    setFreeModelsLoading(true);
    setFreeModelsError(null);
    try {
      const res = await fetch('/api/models/openrouter/free');
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load free models');
      setFreeModels(data.models || []);
    } catch (e: any) {
      setFreeModelsError(e.message || 'Failed to fetch models');
    } finally {
      setFreeModelsLoading(false);
    }
  }, []);

  const filteredFreeModels = useMemo(() => {
    const q = modelSearch.trim().toLowerCase();
    if (!q) return freeModels;
    return freeModels.filter((m) => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q));
  }, [freeModels, modelSearch]);

  // Keep selectedFreeId in sync with current model field when picker opens
  useEffect(() => {
    if (showFreePicker && model) setSelectedFreeId(model);
  }, [showFreePicker, model]);

  useEffect(() => {
    if (showFreePicker && freeModels.length === 0 && !freeModelsLoading && !freeModelsError) {
      fetchFreeModels();
    }
  }, [showFreePicker, freeModels.length, freeModelsLoading, freeModelsError, fetchFreeModels]);

  // Run the load+health sequence ONLY when the modal opens. checkHealth's
  // identity changes on every keystroke (it reads provider/model state), so
  // putting it in the effect deps re-ran loadSettings mid-edit and wiped
  // whatever the user was typing in the Model/URL/Key fields.
  const loadRef = useRef(loadSettings);
  const healthRef = useRef(checkHealth);
  loadRef.current = loadSettings;
  healthRef.current = checkHealth;

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      await loadRef.current();
      if (!cancelled) healthRef.current();
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (apiKey && apiKey !== '********') {
        localStorage.setItem('synapse_api_key', apiKey);
      }
      localStorage.setItem('synapse_provider', provider);
      localStorage.setItem('synapse_model', model);
      localStorage.setItem('synapse_base_url', baseUrl);

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
        checkHealth({ provider, model, apiKey, baseUrl });
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
                <span className="text-rose-400 flex items-center gap-1 font-mono text-[11px] max-w-xs truncate" title={healthStatus?.error || 'Connection Failed'}>
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{healthStatus?.error ? (healthStatus.error.includes('401') ? 'Invalid API Key (401)' : healthStatus.error.includes('429') ? 'Rate Limited (429) - Retry in a few sec' : healthStatus.error.slice(0, 45)) : 'Connection Failed'}</span>
                </span>
              )}
            </div>
            <div className="text-[10px] text-neutral-500 font-mono truncate max-w-sm">
              Model: {model} • {baseUrl}
            </div>
          </div>

          <button
            onClick={() => checkHealth()}
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
                { id: 'opencode_zen', name: 'OpenCode Zen', url: 'https://opencode.ai/zen/v1', defaultModel: 'deepseek-v4-flash-free' },
                { id: 'openai', name: 'OpenAI', url: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini' },
                { id: 'groq', name: 'Groq Cloud', url: 'https://api.groq.com/openai/v1', defaultModel: 'llama-3.3-70b-versatile' },
                { id: 'deepseek', name: 'DeepSeek', url: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-chat' },
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
                } else if (e.target.value === 'opencode_zen') {
                  setBaseUrl('https://opencode.ai/zen/v1');
                  setModel('deepseek-v4-flash-free');
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
              <option value="opencode_zen">OpenCode Zen (deepseek-v4-flash-free)</option>
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

          {/* Free OpenRouter Model Picker */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowFreePicker((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-neutral-900 transition-colors"
            >
              <span className="flex items-center gap-2 text-[11px] font-semibold text-neutral-200">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Free OpenRouter Models
                {freeModels.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-neutral-800 text-neutral-400 text-[10px] font-mono">{freeModels.length}</span>
                )}
              </span>
              <span className="flex items-center gap-1 text-neutral-500">
                <span className="text-[10px] hidden sm:inline">{showFreePicker ? 'Hide' : 'Browse'}</span>
                {showFreePicker ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </span>
            </button>

            {showFreePicker && (
              <div className="px-3 pb-3 space-y-2 border-t border-neutral-800 pt-2.5">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500" />
                  <input
                    type="text"
                    value={modelSearch}
                    onChange={(e) => setModelSearch(e.target.value)}
                    placeholder="Search by id or name..."
                    className="w-full pl-8 pr-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:border-neutral-600 text-xs"
                  />
                </div>

                {freeModelsLoading ? (
                  <div className="flex items-center justify-center gap-2 py-6 text-neutral-400 text-xs">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading free models...
                  </div>
                ) : freeModelsError ? (
                  <div className="py-3 text-center space-y-2">
                    <p className="text-rose-400 text-xs">{freeModelsError}</p>
                    <button type="button" onClick={fetchFreeModels} className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs">
                      Retry
                    </button>
                  </div>
                ) : filteredFreeModels.length === 0 ? (
                  <p className="py-6 text-center text-neutral-500 text-xs">{freeModels.length === 0 ? 'No free models found.' : 'No matches.'}</p>
                ) : (
                  <>
                    <div className="max-h-56 overflow-y-auto rounded-xl border border-neutral-800 divide-y divide-neutral-800 bg-neutral-900">
                      {filteredFreeModels.map((m) => {
                        const isSelected = selectedFreeId === m.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              setSelectedFreeId(m.id);
                              setModel(m.id);
                            }}
                            className={`w-full text-left px-3 py-2 hover:bg-neutral-800 transition-colors ${isSelected ? 'bg-neutral-800 border-l-2 border-amber-400' : ''}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-[11px] text-neutral-100 truncate">{m.id}</span>
                              {m.context_length ? (
                                <span className="shrink-0 text-[10px] font-mono text-neutral-500">{(m.context_length / 1000).toFixed(0)}k</span>
                              ) : null}
                            </div>
                            <div className="text-[11px] text-neutral-400 truncate">{m.name}</div>
                            {m.description ? <div className="text-[10px] text-neutral-500 line-clamp-1">{m.description.slice(0, 120)}</div> : null}
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-neutral-500 font-mono truncate flex-1">
                        {selectedFreeId ? `Selected: ${selectedFreeId}` : 'Pick a model above'}
                      </span>
                      <button
                        type="button"
                        disabled={!selectedFreeId}
                        onClick={() => {
                          if (!selectedFreeId) return;
                          setProvider('openrouter');
                          setBaseUrl('https://openrouter.ai/api/v1');
                          setModel(selectedFreeId);
                        }}
                        className="shrink-0 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-neutral-800 disabled:text-neutral-500 text-neutral-900 font-semibold text-xs transition-colors"
                      >
                        Use selected
                      </button>
                    </div>
                    <p className="text-[10px] text-neutral-500">Save Settings to persist. Survives reload via localStorage/server.</p>
                  </>
                )}
              </div>
            )}
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
