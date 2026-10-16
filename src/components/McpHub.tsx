import { useEffect, useState } from "react";
import { Activity, CheckCircle2, ExternalLink, LoaderCircle, Plus, RefreshCw, ShieldAlert, Trash2, X } from "lucide-react";
import { inspectMcpServer, type McpServerInspection } from "../lib/mcp";

type SavedServer = {
  id: string;
  endpoint: string;
  name: string;
  version: string;
  protocolVersion: string;
  toolNames: string[];
  checkedAt: string;
};

const STORAGE_KEY = "omnimind.mcpServers.v1";

function loadServers(): SavedServer[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is SavedServer =>
      item !== null && typeof item === "object" &&
      typeof item.id === "string" && typeof item.endpoint === "string" &&
      typeof item.name === "string" && typeof item.version === "string" &&
      typeof item.protocolVersion === "string" && Array.isArray(item.toolNames) &&
      item.toolNames.every((name: unknown) => typeof name === "string") &&
      typeof item.checkedAt === "string" && item.endpoint.length <= 2048 &&
      item.name.length <= 200 && item.toolNames.length <= 200
    ).slice(0, 20);
  } catch {
    return [];
  }
}

function safeError(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 500) : "The MCP connection could not be verified.";
}

export default function McpHub() {
  const [servers, setServers] = useState<SavedServer[]>(loadServers);
  const [endpoint, setEndpoint] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error" | "info"; text: string } | null>(null);
  const [inspection, setInspection] = useState<McpServerInspection | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(servers.slice(0, 20)));
    } catch {
      setNotice({ kind: "error", text: "Could not save the MCP server list locally. Check app storage permissions." });
    }
  }, [servers]);

  async function connectServer(url = endpoint) {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    setInspection(null);
    try {
      const result = await inspectMcpServer(url);
      setInspection(result);
      setServers((current) => {
        const existing = current.find((item) => item.endpoint === result.endpoint);
        const saved: SavedServer = {
          id: existing?.id ?? crypto.randomUUID(),
          endpoint: result.endpoint,
          name: result.serverName,
          version: result.serverVersion,
          protocolVersion: result.protocolVersion,
          toolNames: result.tools.map((tool) => tool.name),
          checkedAt: new Date().toISOString(),
        };
        return [saved, ...current.filter((item) => item.endpoint !== result.endpoint)].slice(0, 20);
      });
      setEndpoint(result.endpoint);
      setNotice({ kind: "success", text: `Inspected ${result.serverName}. Discovered ${result.tools.length} tool(s); no tools were executed.` });
    } catch (error) {
      setNotice({ kind: "error", text: safeError(error) });
    } finally {
      setBusy(false);
    }
  }

  function removeServer(id: string) {
    setServers((current) => current.filter((item) => item.id !== id));
    if (inspection && servers.find((item) => item.id === id)?.endpoint === inspection.endpoint) setInspection(null);
    setNotice({ kind: "info", text: "Removed the saved server entry from this device. No credentials were stored." });
  }

  return (
    <section className="content-page">
      <div className="page-heading">
        <div><span className="eyebrow">TOOLS & EXTENSIONS</span><h1>MCP Hub</h1><p>Inspect a remote Model Context Protocol endpoint and its declared tools. Each check is a short-lived session; persistent sessions and tool execution are not enabled.</p></div>
      </div>
      <div className="settings-group">
        <div className="settings-title"><Activity size={18} /><div><strong>Inspect an MCP server</strong><span>Remote Streamable HTTP-compatible endpoints only in this initial implementation</span></div></div>
        <div style={{ padding: 16 }}>
          <label className="field-label" htmlFor="mcp-endpoint">MCP endpoint URL</label>
          <div className="secret-input">
            <input id="mcp-endpoint" type="url" value={endpoint} onChange={(event) => setEndpoint(event.target.value)} placeholder="https://your-server.example/mcp" autoComplete="off" spellCheck={false} />
            {endpoint && <button className="icon-button" onClick={() => setEndpoint("")} type="button" aria-label="Clear endpoint"><X size={15} /></button>}
          </div>
          <div className="modal-actions">
            <button className="primary-button" onClick={() => void connectServer()} disabled={busy || !endpoint.trim()}>
              {busy ? <><LoaderCircle size={15} className="spin" /> Connecting…</> : <><Plus size={15} /> Connect & discover</>}
            </button>
          </div>
          <div className="secret-hint"><ShieldAlert size={14} /> HTTPS only. The desktop layer rejects private/local network destinations, disables redirects, limits response size, and does not store authentication tokens. Servers requiring authentication are not supported yet.</div>
        </div>
      </div>

      {notice && <div className={`notice ${notice.kind}`} role="status"><span>{notice.text}</span><button onClick={() => setNotice(null)} aria-label="Dismiss"><X size={15} /></button></div>}

      {inspection && <div className="settings-group">
        <div className="settings-title"><CheckCircle2 size={18} /><div><strong>{inspection.serverName}</strong><span>Version {inspection.serverVersion} · Protocol {inspection.protocolVersion}</span></div></div>
        <div className="history-toolbar"><span>{inspection.tools.length} discovered tools · metadata only</span><span className="setting-value muted">Execution disabled</span></div>
        {inspection.tools.length ? <div className="model-list">{inspection.tools.map((tool) => <article className="model-row" key={tool.name} style={{ alignItems: "flex-start" }}><div style={{ minWidth: 0, flex: 1 }}><div className="model-name">{tool.name}</div><div style={{ color: "#8d96aa", fontSize: 10, lineHeight: 1.6, marginTop: 5, overflowWrap: "anywhere" }}>{tool.description || "No description provided by server."}</div></div><span className="setting-value muted">Not enabled</span></article>)}</div> : <p className="modal-copy" style={{ padding: 16 }}>This server did not declare any tools.</p>}
        <p className="modal-legal" style={{ padding: "0 16px 14px" }}>Tool names and descriptions are untrusted server-provided metadata. OMNIMIND has not executed any tool or sent your task prompt to this server.</p>
      </div>}

      <div className="settings-group">
        <div className="settings-title"><ExternalLink size={18} /><div><strong>Saved MCP servers</strong><span>Endpoint metadata is stored locally; no server credentials are stored.</span></div></div>
        {servers.length ? servers.map((server) => <div className="setting-row" key={server.id}>
          <div style={{ minWidth: 0, flex: 1 }}><strong>{server.name}</strong><span style={{ overflowWrap: "anywhere" }}>{server.endpoint}</span><span>{server.toolNames.length} tools · Last checked {new Date(server.checkedAt).toLocaleString()}</span></div>
          <div style={{ display: "flex", gap: 7, flexShrink: 0 }}><button className="secondary-small" onClick={() => void connectServer(server.endpoint)} disabled={busy}><RefreshCw size={13} /> Test</button><button className="danger-small" onClick={() => removeServer(server.id)} disabled={busy}><Trash2 size={13} /> Remove</button></div>
        </div>) : <div className="empty-state" style={{ margin: 16 }}><div className="empty-icon"><Activity size={22} /></div><h3>No MCP servers saved</h3><p>Inspect a compatible HTTPS endpoint to discover its declared tools. No tool will run without a later permission and approval layer.</p></div>}
      </div>

      <div className="security-callout"><ShieldAlert size={20} /><div><strong>Safe-by-default preview</strong><p>This first slice supports connection inspection and tool discovery only. Tool execution, OAuth, local stdio processes, per-tool permissions, and approval prompts are deliberately not enabled until their host-side enforcement and tests are complete.</p></div></div>
    </section>
  );
}
