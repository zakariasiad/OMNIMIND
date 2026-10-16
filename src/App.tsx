import { useMemo, useState } from "react";
import {
  Activity, ArrowDown, ArrowUpRight, Check, CheckCircle2, ChevronDown, CircleHelp,
  Command, Cpu, Eye, EyeOff, Gauge, KeyRound, LayoutDashboard, LoaderCircle,
  MessageSquareText, MoreHorizontal, Plus, RefreshCw, Send, Settings2, ShieldCheck,
  Sparkles, Trash2, Workflow, X,
} from "lucide-react";
import {
  getInitialProviderStates, isProviderId, PROVIDERS,
  type ProviderId, type ProviderState,
} from "./lib/providers";
import { chatCompletion, removeProviderKey, saveProviderKey, testProvider, type ChatMessage } from "./lib/desktop";

type View = "workspace" | "models" | "runs" | "settings";
type Notice = { kind: "success" | "error" | "info"; text: string };

export default function App() {
  const [view, setView] = useState<View>("workspace");
  const [states, setStates] = useState<Record<ProviderId, ProviderState>>(getInitialProviderStates);
  const [selectedProvider, setSelectedProvider] = useState<ProviderId>("groq");
  const [selectedModel, setSelectedModel] = useState("");
  const [keyDraft, setKeyDraft] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [addingProvider, setAddingProvider] = useState<ProviderId | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  const [runStatus, setRunStatus] = useState("Ready for your first task");
  const [history, setHistory] = useState<{ prompt: string; provider: string; model: string; time: string }[]>([]);

  const configured = useMemo(
    () => Object.values(states).filter((state) => state.status === "connected" || state.status === "disabled").length,
    [states],
  );
  const activeModels = useMemo(
    () => Object.values(states).filter((state) => state.status === "connected")
      .flatMap((state) => state.models.filter((model) => state.enabledModels.includes(model.id))
        .map((model) => ({ ...model, providerId: state.id, providerName: PROVIDERS.find((p) => p.id === state.id)?.name ?? state.id }))),
    [states],
  );

  function updateState(providerId: ProviderId, update: Partial<ProviderState>) {
    setStates((current) => ({ ...current, [providerId]: { ...current[providerId], ...update } }));
  }

  async function connectProvider() {
    if (!addingProvider || keyDraft.trim().length < 8) {
      setNotice({ kind: "error", text: "Enter a valid API key before saving." });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      await saveProviderKey(addingProvider, keyDraft.trim());
      updateState(addingProvider, { status: "connecting", error: undefined });
      const result = await testProvider(addingProvider);
      updateState(addingProvider, {
        status: "connected",
        models: result.models,
        enabledModels: result.models.slice(0, 3).map((model) => model.id),
        lastChecked: new Date().toISOString(),
      });
      setSelectedProvider(addingProvider);
      setSelectedModel(result.models[0]?.id ?? "");
      setKeyDraft("");
      setAddingProvider(null);
      setShowKey(false);
      setNotice({ kind: "success", text: result.message || "Provider connected and tested." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Connection failed.";
      updateState(addingProvider, { status: "error", error: message });
      setNotice({ kind: "error", text: message });
    } finally {
      setBusy(false);
    }
  }

  async function refreshProvider(providerId: ProviderId) {
    setBusy(true);
    setNotice(null);
    updateState(providerId, { status: "connecting", error: undefined });
    try {
      const result = await testProvider(providerId);
      const previous = states[providerId].enabledModels;
      const enabledModels = result.models.filter((model) => previous.includes(model.id)).map((model) => model.id);
      updateState(providerId, { status: "connected", models: result.models, enabledModels, lastChecked: new Date().toISOString() });
      setNotice({ kind: "success", text: result.message || "Provider refreshed." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Provider test failed.";
      updateState(providerId, { status: "error", error: message });
      setNotice({ kind: "error", text: message });
    } finally {
      setBusy(false);
    }
  }

  async function toggleProvider(providerId: ProviderId) {
    const current = states[providerId];
    if (current.status === "disabled") {
      await refreshProvider(providerId);
    } else if (current.status === "connected") {
      updateState(providerId, { status: "disabled" });
      setNotice({ kind: "info", text: "Provider disabled. Its credential remains in secure storage." });
    }
  }

  async function deleteProvider(providerId: ProviderId) {
    if (!window.confirm("Remove this provider and delete its saved credential from the secure vault?")) return;
    setBusy(true);
    try {
      await removeProviderKey(providerId);
      updateState(providerId, { status: "not_configured", models: [], enabledModels: [], lastChecked: undefined, error: undefined });
      if (selectedProvider === providerId) {
        const next = PROVIDERS.find((provider) => provider.id !== providerId && states[provider.id].status === "connected");
        if (next) setSelectedProvider(next.id);
        setSelectedModel("");
      }
      setNotice({ kind: "success", text: "Provider connection removed." });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Could not remove provider." });
    } finally {
      setBusy(false);
    }
  }

  async function runPrompt() {
    const text = prompt.trim();
    if (!text || busy) return;
    const provider = states[selectedProvider];
    const model = selectedModel || provider.enabledModels[0] || provider.models[0]?.id;
    if (provider.status !== "connected" || !model) {
      setNotice({ kind: "error", text: "Connect a provider and select a model in Model Hub before running a task." });
      setView("models");
      return;
    }
    setBusy(true);
    setAnswer("");
    setRunStatus("Sending request to the selected model…");
    setNotice(null);
    const messages: ChatMessage[] = [
      { role: "system", content: "You are an assistant in OMNIMIND AI. Give accurate, structured answers. State uncertainty instead of inventing facts." },
      { role: "user", content: text },
    ];
    try {
      const result = await chatCompletion(selectedProvider, model, messages);
      setAnswer(result.content);
      setRunStatus("Completed · single-model request");
      setHistory((items) => [{ prompt: text, provider: PROVIDERS.find((p) => p.id === selectedProvider)?.name ?? selectedProvider, model: result.model, time: new Date().toLocaleTimeString() }, ...items]);
      setPrompt("");
    } catch (error) {
      setRunStatus("Run failed");
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "The model request failed." });
    } finally {
      setBusy(false);
    }
  }

  function toggleModel(providerId: ProviderId, modelId: string) {
    const current = states[providerId];
    const enabledModels = current.enabledModels.includes(modelId)
      ? current.enabledModels.filter((id) => id !== modelId)
      : [...current.enabledModels, modelId];
    updateState(providerId, { enabledModels });
  }

  const navItems: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
    { id: "workspace", label: "Workspace", icon: LayoutDashboard },
    { id: "models", label: "Model Hub", icon: Cpu },
    { id: "runs", label: "Run history", icon: Workflow },
    { id: "settings", label: "Settings", icon: Settings2 },
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Sparkles size={21} /></div>
          <div><div className="brand-name">OMNIMIND<span> AI</span></div><div className="brand-caption">INTELLIGENCE, ORCHESTRATED</div></div>
        </div>
        <button className="new-task" onClick={() => { setView("workspace"); setPrompt(""); }}><Plus size={17} /> New task <span>⌘ N</span></button>
        <div className="nav-label">WORKSPACE</div>
        <nav className="nav-list">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-item ${view === id ? "active" : ""}`} onClick={() => setView(id)}>
              <Icon size={17} strokeWidth={1.8} /> <span>{label}</span>
              {id === "models" && configured > 0 && <span className="nav-count">{configured}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-note"><ShieldCheck size={17} /><div><strong>Your keys stay yours</strong><span>Stored in the OS credential vault.</span></div></div>
          <div className="profile-row"><div className="avatar">O</div><div className="profile-name">Local workspace<span>Desktop preview</span></div><MoreHorizontal size={18} className="muted-icon" /></div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">OMNIMIND <span>/</span> {navItems.find((item) => item.id === view)?.label}</div>
          <div className="top-actions"><span className="status-dot" /> Local workspace <span className="top-divider" /><button className="icon-button" title="Help"><CircleHelp size={17} /></button></div>
        </header>

        {notice && <div className={`notice ${notice.kind}`} role="status"><span>{notice.text}</span><button onClick={() => setNotice(null)} aria-label="Dismiss"><X size={15} /></button></div>}

        {view === "workspace" && (
          <section className="workspace-page">
            <div className="welcome-line"><span className="eyebrow"><Sparkles size={13} /> YOUR AI WORKSPACE</span><span className="beta-chip">EARLY ACCESS</span></div>
            <h1>One request.<br /><span>Collective intelligence.</span></h1>
            <p className="hero-copy">Bring your AI models together. OMNIMIND is being built to plan, delegate, review, and turn their work into one clear result.</p>
            <div className="mode-row">
              <div className="mode-card selected"><Gauge size={17} /><div><strong>Balanced</strong><span>Quality + speed</span></div><Check size={15} /></div>
              <div className="mode-card disabled-mode" title="Planned for a future orchestration release"><Workflow size={17} /><div><strong>Deep research</strong><span>Multi-step review</span></div><span className="soon-tag">SOON</span></div>
            </div>
            <div className="composer">
              <div className="composer-top"><span><MessageSquareText size={15} /> New task</span><span className="context-pill"><Command size={12} /> Local-first</span></div>
              <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="What would you like to accomplish today?" rows={4} onKeyDown={(event) => { if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) void runPrompt(); }} />
              <div className="composer-footer">
                <button className="subtle-action" onClick={() => setView("models")}><Cpu size={15} /> {activeModels.length ? `${activeModels.length} enabled model${activeModels.length === 1 ? "" : "s"}` : "Connect a model"} <ChevronDown size={14} /></button>
                <div className="send-row">
                  {activeModels.length > 0 && <select value={selectedProvider} onChange={(event) => { if (isProviderId(event.target.value)) { setSelectedProvider(event.target.value); setSelectedModel(states[event.target.value].enabledModels[0] ?? ""); } }} aria-label="Provider">
                    {PROVIDERS.filter((provider) => states[provider.id].status === "connected" && states[provider.id].enabledModels.length > 0).map((provider) => <option value={provider.id} key={provider.id}>{provider.name}</option>)}
                  </select>}
                  {activeModels.length > 0 && <select value={selectedModel} onChange={(event) => setSelectedModel(event.target.value)} aria-label="Model">
                    {(states[selectedProvider]?.models ?? []).filter((model) => states[selectedProvider].enabledModels.includes(model.id)).map((model) => <option value={model.id} key={model.id}>{model.name}</option>)}
                  </select>}
                  <button className="send-button" onClick={() => void runPrompt()} disabled={busy || !prompt.trim()}>{busy ? <LoaderCircle className="spin" size={16} /> : <Send size={15} />} Run task</button>
                </div>
              </div>
              <div className="keyboard-hint">Press <kbd>Ctrl</kbd> + <kbd>Enter</kbd> to run</div>
            </div>
            {(busy || answer || runStatus !== "Ready for your first task") && <div className="result-card">
              <div className="result-head"><div><span className="result-icon"><Activity size={16} /></span><strong>Run output</strong></div><span className={`run-state ${busy ? "running" : answer ? "done" : "failed"}`}>{busy && <LoaderCircle size={12} className="spin" />}{runStatus}</span></div>
              {busy ? <div className="loading-line"><span /><span /><span /></div> : answer ? <pre className="answer-text">{answer}</pre> : <p className="error-copy">No result was produced. Review the error message and try again.</p>}
              <div className="result-foot"><ShieldCheck size={14} /> {answer ? "Single-model response · not yet independently reviewed" : "Execution status is shown transparently"}</div>
            </div>}
            <div className="value-strip"><div><span className="value-icon"><Workflow size={16} /></span><strong>Plan intelligently</strong><span>Break complex requests into useful steps.</span></div><div><span className="value-icon"><Eye size={16} /></span><strong>Review the work</strong><span>Check outputs instead of trusting consensus.</span></div><div><span className="value-icon"><ArrowUpRight size={16} /></span><strong>One clear result</strong><span>Get a coherent deliverable, not scattered chats.</span></div></div>
            <div className="bottom-disclaimer">The current build is an early desktop foundation. Multi-agent orchestration is not implemented yet.</div>
          </section>
        )}

        {view === "models" && (
          <section className="content-page">
            <div className="page-heading"><div><span className="eyebrow">CONNECTIONS & CAPABILITIES</span><h1>Model Hub</h1><p>Connect your providers, choose available models, and control which ones OMNIMIND may use.</p></div><button className="primary-button" onClick={() => { setAddingProvider("groq"); setKeyDraft(""); }}><Plus size={16} /> Add provider</button></div>
            <div className="hub-summary"><div><span>PROVIDERS</span><strong>{configured} <small>/ {PROVIDERS.length}</small></strong></div><div><span>AVAILABLE MODELS</span><strong>{Object.values(states).reduce((sum, state) => sum + state.models.length, 0)}</strong></div><div><span>ENABLED FOR ROUTING</span><strong>{activeModels.length}</strong></div></div>
            <div className="provider-list">
              {PROVIDERS.map((provider) => {
                const state = states[provider.id];
                const connected = state.status === "connected";
                return <article className="provider-card" key={provider.id}>
                  <div className={`provider-logo ${provider.id}`}>{provider.id === "groq" ? <ZapIcon /> : provider.id === "openrouter" ? <Workflow size={22} /> : <Sparkles size={22} />}</div>
                  <div className="provider-main"><div className="provider-title-row"><h3>{provider.name}</h3><span className={`status-pill ${state.status}`}><span />{state.status.replaceAll("_", " ")}</span></div><p>{provider.description}</p><div className="provider-meta"><span>{provider.badge}</span><span>·</span><span>{connected ? `${state.models.length} models discovered` : state.status === "disabled" ? "Connection disabled" : "API key connection"}</span>{state.lastChecked && <><span>·</span><span>Checked {new Date(state.lastChecked).toLocaleTimeString()}</span></>}</div>
                    {state.error && <div className="inline-error">{state.error}</div>}
                    {state.models.length > 0 && <div className="model-list">{state.models.slice(0, 6).map((model) => <label className="model-row" key={model.id}><input type="checkbox" checked={state.enabledModels.includes(model.id)} onChange={() => toggleModel(provider.id, model.id)} disabled={!connected} /><span className="model-name">{model.name}</span><span className="model-id">{model.id}</span></label>)}{state.models.length > 6 && <span className="more-models">+ {state.models.length - 6} more models</span>}</div>}
                    <div className="provider-actions">{!connected && state.status !== "disabled" && <button className="primary-small" onClick={() => { setAddingProvider(provider.id); setKeyDraft(""); setNotice(null); }}>Connect</button>}{connected && <button className="secondary-small" onClick={() => void refreshProvider(provider.id)} disabled={busy}><RefreshCw size={13} /> Test / refresh</button>}{(connected || state.status === "disabled") && <button className="secondary-small" onClick={() => void toggleProvider(provider.id)}>{connected ? "Disable" : "Reconnect"}</button>}{state.status !== "not_configured" && <button className="danger-small" onClick={() => void deleteProvider(provider.id)} disabled={busy}><Trash2 size={13} /> Remove</button>}</div>
                  </div>
                </article>;
              })}
            </div>
            <div className="security-callout"><ShieldCheck size={20} /><div><strong>Credentials are handled by the desktop layer</strong><p>In the installed app, API keys are passed to a native command and stored in the operating system credential vault. They are never written to ordinary app settings. Browser preview does not save credentials or make provider calls.</p></div></div>
          </section>
        )}

        {view === "runs" && (
          <section className="content-page"><div className="page-heading"><div><span className="eyebrow">YOUR WORK</span><h1>Run history</h1><p>Review recent requests and the models used to complete them.</p></div></div>
            {history.length ? <div className="history-list">{history.map((item, index) => <article className="history-item" key={`${item.time}-${index}`}><div className="history-icon"><CheckCircle2 size={18} /></div><div className="history-main"><strong>{item.prompt}</strong><span>{item.provider} · {item.model}</span></div><time>{item.time}</time></article>)}</div> : <div className="empty-state"><div className="empty-icon"><Workflow size={24} /></div><h3>No runs yet</h3><p>Your completed tasks will appear here. Connect a model and run your first request.</p><button className="secondary-button" onClick={() => setView("workspace")}>Go to workspace <ArrowDown size={15} /></button></div>}
          </section>
        )}

        {view === "settings" && (
          <section className="content-page"><div className="page-heading"><div><span className="eyebrow">PREFERENCES</span><h1>Settings</h1><p>Control how OMNIMIND runs and stores your work.</p></div></div>
            <div className="settings-group"><div className="settings-title"><ShieldCheck size={18} /><div><strong>Privacy & storage</strong><span>Desktop-first, local workspace</span></div></div><div className="setting-row"><div><strong>Provider credentials</strong><span>Stored in the operating system credential vault in the installed app.</span></div><span className="setting-value">OS vault</span></div><div className="setting-row"><div><strong>Cloud synchronization</strong><span>No OMNIMIND cloud sync is enabled in this build.</span></div><span className="setting-value muted">Off</span></div><div className="setting-row"><div><strong>Local run history</strong><span>History currently exists for this application session; durable SQLite persistence is planned.</span></div><span className="setting-value muted">Planned</span></div></div>
            <div className="settings-group"><div className="settings-title"><Gauge size={18} /><div><strong>Execution policy</strong><span>Limits planned for orchestration runs</span></div></div><div className="setting-row"><div><strong>Maximum concurrent tasks</strong><span>Controls parallel model work.</span></div><span className="setting-value">Planned</span></div><div className="setting-row"><div><strong>Automatic fallback</strong><span>Only compatible, enabled providers should be used as fallback.</span></div><span className="setting-value muted">Not active</span></div></div>
            <div className="settings-group"><div className="settings-title"><Settings2 size={18} /><div><strong>Application</strong><span>Build and diagnostics</span></div></div><div className="setting-row"><div><strong>Version</strong><span>OMNIMIND AI desktop foundation</span></div><span className="setting-value">0.1.0</span></div><div className="setting-row"><div><strong>Diagnostics</strong><span>Diagnostic export with credential redaction will be added before beta.</span></div><button className="secondary-small" onClick={() => setNotice({ kind: "info", text: "Diagnostics export is planned and not available in this build." })}>Details</button></div></div>
          </section>
        )}
      </main>

      {addingProvider && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setAddingProvider(null); }}>
        <section className="connect-modal" role="dialog" aria-modal="true" aria-labelledby="connect-title">
          <div className="modal-top"><div className="modal-icon"><KeyRound size={21} /></div><button className="icon-button" onClick={() => setAddingProvider(null)} disabled={busy} aria-label="Close"><X size={18} /></button></div>
          <span className="eyebrow">ADD A CONNECTION</span><h2 id="connect-title">Connect {PROVIDERS.find((p) => p.id === addingProvider)?.name}</h2><p className="modal-copy">Add an API key to connect your account. OMNIMIND does not need your provider website password.</p>
          <label className="field-label" htmlFor="api-key">API key</label><div className="secret-input"><input id="api-key" autoFocus type={showKey ? "text" : "password"} value={keyDraft} onChange={(event) => setKeyDraft(event.target.value)} placeholder="Paste your API key" autoComplete="off" spellCheck={false} /><button className="icon-button" onClick={() => setShowKey(!showKey)} type="button" aria-label={showKey ? "Hide key" : "Show key"}>{showKey ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
          <div className="secret-hint"><ShieldCheck size={14} /> In the installed app, the key is stored in the OS credential vault and never displayed again.</div>
          <div className="modal-actions"><button className="secondary-button" onClick={() => setAddingProvider(null)} disabled={busy}>Cancel</button><button className="primary-button" onClick={() => void connectProvider()} disabled={busy || keyDraft.trim().length < 8}>{busy ? <><LoaderCircle size={15} className="spin" /> Connecting…</> : <><Check size={15} /> Save & test</>}</button></div>
          <p className="modal-legal">Use only an API key you are authorized to use. Provider pricing, free tiers, and rate limits are controlled by the provider.</p>
        </section>
      </div>}
      <div className="bottom-bar"><span><span className="status-dot" /> SYSTEM READY</span><span>{configured} provider connection{configured === 1 ? "" : "s"} · {activeModels.length} enabled models</span><span>OMNIMIND AI · 0.1.0</span></div>
    </div>
  );
}

function ZapIcon() {
  return <span className="groq-zap">G</span>;
}
