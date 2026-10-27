import React, {lazy, Suspense, useCallback, useEffect, useRef, useState} from 'react';
import Icon from './seminar/Icon';
import {API, DEMO, Session, Finding, brief, download, phaseLabel} from './seminar/data';
import './App.css';
const OperatorConsole = lazy(() => import('./OperatorConsole'));
type View = 'overview' | 'timeline' | 'findings' | 'reports' | 'sessions';
const nav: {id: View; icon: string; label: string}[] = [
  {id: 'overview', icon: 'grid', label: 'Overview'}, {id: 'timeline', icon: 'timeline', label: 'Event timeline'},
  {id: 'findings', icon: 'shield', label: 'Findings'}, {id: 'reports', icon: 'report', label: 'Reports'},
  {id: 'sessions', icon: 'folder', label: 'Sessions'},
];
const titles: Record<View, string> = {overview: 'The network, in motion.', timeline: 'Follow every decision.', findings: 'From signal to evidence.', reports: 'A clear picture. A useful brief.', sessions: 'Your seminar library.'};

export default function App() {
  const [view, setView] = useState<View>('overview');
  const [session, setSession] = useState<Session>(DEMO);
  const [cursor, setCursor] = useState(4);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [selectedNode, setSelectedNode] = useState('web');
  const [sourceOpen, setSourceOpen] = useState(false);
  const [runs, setRuns] = useState<{id: string; modified: number}[]>([]);
  const [connected, setConnected] = useState(false);
  const [source, setSource] = useState('illustrative');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [severity, setSeverity] = useState('all');
  const [finding, setFinding] = useState<Finding | null>(null);
  const [presentation, setPresentation] = useState(false);
  const [operator, setOperator] = useState(false);
  const requestSequence = useRef(0);
  const sourceMenu = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<'topology' | 'inventory'>('topology');

  const refreshRuns = useCallback(async () => {
    try {
      const response = await fetch(`${API}/seminar/runs`, {signal: AbortSignal.timeout(5000)});
      if (!response.ok) throw new Error('Backend unavailable');
      const data = await response.json(); setRuns(data.runs || []); setConnected(true);
    } catch { setConnected(false); }
  }, []);
  useEffect(() => { refreshRuns(); const timer = setInterval(refreshRuns, 10000); return () => clearInterval(timer); }, [refreshRuns]);
  const loadSession = useCallback(async (id: string, follow = false) => {
    const sequence = ++requestSequence.current; setLoading(true); setError('');
    try {
      const response = await fetch(`${API}/seminar/runs/${encodeURIComponent(id)}`, {signal: AbortSignal.timeout(8000)});
      if (!response.ok) throw new Error('Could not read this run. Check the backend and refresh the session list.');
      const data: Session = await response.json();
      if (sequence !== requestSequence.current) return;
      setSession(data); setCursor(follow ? Math.max(data.timeline.length - 1, 0) : 0);
      setSource(follow ? 'live' : id); setSelectedNode(data.nodes[0]?.id || ''); setPlaying(false); setConnected(true);
    } catch (e: any) { if (sequence === requestSequence.current) setError(e.message || 'Could not load run.'); }
    finally { if (sequence === requestSequence.current) setLoading(false); }
  }, []);
  useEffect(() => {
    if (source !== 'live') return;
    let stopped = false;
    const timer = setInterval(async () => {
      try {
        const list = await fetch(`${API}/seminar/runs`, {signal: AbortSignal.timeout(5000)}).then(r => {if (!r.ok) throw new Error(); return r.json();});
        const latest = list.runs?.[0];
        if (!latest) return;
        const data = await fetch(`${API}/seminar/runs/${encodeURIComponent(latest.id)}`, {signal: AbortSignal.timeout(5000)}).then(r => {if (!r.ok) throw new Error(); return r.json();});
        if (stopped) return;
        setSession(data); setCursor(Math.max(data.timeline.length - 1, 0)); setConnected(true); setError('');
      } catch { if (!stopped) {setConnected(false); setError('Live observation disconnected. Displaying the last received snapshot.');} }
    }, 4000);
    return () => {stopped = true; clearInterval(timer);};
  }, [source]);
  useEffect(() => {
    if (!playing || source === 'live') return;
    const timer = setInterval(() => setCursor(previous => {
      if (previous >= session.timeline.length - 1) {setPlaying(false); return previous;}
      return previous + 1;
    }), 2800 / speed);
    return () => clearInterval(timer);
  }, [playing, speed, session.timeline.length, source]);
  const togglePlayback = useCallback(() => {
    if (!session.timeline.length || source === 'live') return;
    if (cursor >= session.timeline.length - 1) setCursor(0);
    setPlaying(p => !p);
  }, [cursor, session.timeline.length, source]);
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {setPresentation(false); setSourceOpen(false); return;}
      const target = event.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(target.tagName) || target.isContentEditable || finding || operator) return;
      if (event.code === 'Space') {event.preventDefault(); togglePlayback();}
      if (event.key === 'ArrowRight' && source !== 'live') {setPlaying(false); setCursor(c => Math.min(c + 1, Math.max(session.timeline.length - 1, 0)));}
      if (event.key === 'ArrowLeft' && source !== 'live') {setPlaying(false); setCursor(c => Math.max(c - 1, 0));}
      if (event.key === 'Escape') {setPresentation(false); setSourceOpen(false);}
      if (event.key.toLowerCase() === 'f') setPresentation(p => !p);
    };
    window.addEventListener('keydown', listener); return () => window.removeEventListener('keydown', listener);
  }, [togglePlayback, session.timeline.length, source, finding, operator]);
  useEffect(() => {
    if (!sourceOpen) return;
    const close = (e: MouseEvent) => {if (!sourceMenu.current?.contains(e.target as Node)) setSourceOpen(false);};
    document.addEventListener('mousedown', close); return () => document.removeEventListener('mousedown', close);
  }, [sourceOpen]);
  function resetDemo() {requestSequence.current++; setSession(DEMO); setSource('illustrative'); setCursor(0); setSelectedNode('attacker'); setPlaying(false); setError(''); setLoading(false); setSourceOpen(false);}
  const scene = session.timeline[cursor];
  const illustrative = session.origin === 'illustrative';
  const visibleNodes = session.nodes.filter(n => n.discoveredAt <= cursor);
  const visibleFindings = session.findings.filter(f => (f.at ?? session.timeline.length - 1) <= cursor);
  const selected = session.nodes.find(n => n.id === selectedNode && n.discoveredAt <= cursor);
  const filteredFindings = visibleFindings.filter(f => (severity === 'all' || f.severity === severity) && `${f.title} ${f.host} ${f.cves.join(' ')}`.toLowerCase().includes(query.toLowerCase()));
  const label = source === 'live' ? 'Live observation' : illustrative ? 'Illustrative replay' : 'Recorded replay';
  const position = (index: number) => session.nodes.length <= 3 ? {x: 155 + index * 285, y: 178} : {x: 145 + (index % 3) * 285, y: 90 + Math.floor(index / 3) * 145};
  const graphHeight = Math.max(350, Math.ceil(session.nodes.length / 3) * 145 + 45);

  if (operator) return <div className="operator-shell"><div className="operator-bar"><button onClick={() => setOperator(false)}><Icon name="back"/> Back to seminar view</button><span>OPERATOR CONSOLE · Live controls can execute actions and incur API charges</span></div><Suspense fallback={<p>Loading operator console…</p>}><OperatorConsole/></Suspense></div>;
  return <div className={`seminar-app ${presentation ? 'presentation' : ''}`}>
    <aside className="rail" aria-label="Main navigation">
      <a className="brand-mark" href="#overview" aria-label="Incalmo overview" onClick={e => {e.preventDefault(); setView('overview');}}>i<span/></a>
      <div className="rail-links">{nav.map(item => <button key={item.id} className={view === item.id ? 'active' : ''} aria-label={item.label} title={item.label} aria-current={view === item.id ? 'page' : undefined} onClick={() => {setView(item.id); setQuery('');}}><Icon name={item.icon}/><span>{item.label}</span></button>)}</div>
      <button className="operator-link" aria-label="Open live operator console" title="Live operator console" onClick={() => {setPlaying(false); setOperator(true);}}><Icon name="terminal"/><span>Operator</span></button>
      <span className="rail-version">v0.1</span>
    </aside>
    <div className="workspace">
      <header className="topbar"><div className="wordmark">incalmo<span>/</span><small>Seminar studio</small></div><div className="topbar-right"><span className={`connection ${connected ? 'online' : ''}`}><i/>{connected ? 'Backend connected' : 'Standalone replay'}</span><span className="avatar">IC</span></div></header>
      <main>
        <div className="heading-row"><div><div className="eyebrow"><span/> AUTONOMOUS SECURITY, EXPLAINED</div><h1>{titles[view]}</h1><p className="heading-description">Turn complex operations into a story your audience can follow.</p></div><div className="heading-actions"><button className="secondary" onClick={() => setPresentation(p => !p)} aria-pressed={presentation}><Icon name="expand"/>{presentation ? 'Exit presentation' : 'Present'}<kbd>F</kbd></button><button className="primary" onClick={() => download(`${session.id}-brief.md`, brief(session), 'text/markdown')}><Icon name="download"/>Export brief</button></div></div>
        <section className="session-bar" aria-label="Selected session"><div className="session-source" ref={sourceMenu}><button className="source-trigger" onClick={() => setSourceOpen(p => !p)} aria-expanded={sourceOpen}><span className="source-icon"><Icon name="folder" size={18}/></span><div><small>SESSION</small><strong>{session.title}</strong></div><Icon name="chevron" size={16}/></button>{sourceOpen && <div className="source-menu"><span className="menu-label">CHOOSE A SOURCE</span><button onClick={resetDemo}><Icon name="play"/><div>Illustrative lab replay<small>Built in · no backend required</small></div></button><button disabled={!runs.length || loading} onClick={() => {loadSession(runs[0].id, true); setSourceOpen(false);}}><Icon name="refresh"/><div>Watch latest run<small>Read-only · refreshes every 4 seconds</small></div></button><div className="menu-divider"/>{runs.map(run => <button key={run.id} disabled={loading} onClick={() => {loadSession(run.id); setSourceOpen(false);}}><Icon name="clock"/><div className="run-name">{run.id}<small>Recorded session</small></div></button>)}{!runs.length && <p>Start the backend to browse your recorded runs.</p>}</div>}</div><div className={`mode-badge ${source === 'live' ? 'watching' : ''}`}><i/>{label}</div><div className="session-model"><Icon name="spark" size={16}/>{session.model}</div><span className="session-scope">{illustrative ? 'Local Docker scenario' : `Run status: ${session.status}`}</span></section>
        <div className="source-note">{illustrative ? <><Icon name="shield" size={14}/><span>Illustrative scenario. All events and findings are authored examples. Playback executes no attacks.</span></> : <><Icon name="clock" size={14}/><span>{source === 'live' ? 'Watching recorded output as it changes; this view does not launch a run.' : 'Replaying recorded evidence. Model observations remain unverified.'}</span></>}</div>
        {error && <div className="error-banner" role="alert">{error}<button onClick={() => setError('')} aria-label="Dismiss error"><Icon name="close" size={16}/></button></div>}
        {loading && <p className="loading-note" role="status">Loading recorded session…</p>}
        <section className="metrics" aria-label="Session metrics">
          {[{icon: 'network', label: 'Known hosts', value: String(visibleNodes.length).padStart(2, '0'), detail: 'in this replay frame'}, {icon: 'timeline', label: 'Stages observed', value: `${session.timeline.length ? cursor + 1 : 0}`, detail: `of ${session.timeline.length} recorded stages`}, {icon: 'shield', label: 'Scanner matches', value: String(visibleFindings.length).padStart(2, '0'), detail: illustrative ? 'illustrative findings' : 'verification required'}, {icon: 'spark', label: 'Session tokens', value: session.tokens >= 1000 ? `${(session.tokens / 1000).toFixed(1)}k` : String(session.tokens), detail: `${session.modelCalls} ${illustrative ? 'illustrative' : 'recorded'} model calls`}].map((m, i) => <div className="metric" key={m.label}><div className={`metric-icon metric-${i}`}><Icon name={m.icon}/></div><div><span className="metric-label">{m.label}</span><div className="metric-bottom"><strong>{m.value}</strong><small>{m.detail}</small></div></div></div>)}
        </section>
        {view === 'overview' && <div className="overview-grid"><div className="main-column"><section className="panel topology-panel"><div className="panel-header"><div className="panel-title"><Icon name="network" size={18}/><h2>Network topology</h2><span className="tiny-tag">{visibleNodes.length} hosts</span></div><div className="segmented" aria-label="Network view"><button className={tab === 'topology' ? 'selected' : ''} onClick={() => setTab('topology')}>Map</button><button className={tab === 'inventory' ? 'selected' : ''} onClick={() => setTab('inventory')}>Inventory</button></div></div>
          {tab === 'topology' ? <div className="network-canvas" style={{height: graphHeight}}><div className="canvas-caption"><span className="canvas-dot"/> {illustrative ? 'EQUIFAX LAB / ILLUSTRATIVE TOPOLOGY' : 'RECORDED HOSTS / OBSERVED CONNECTIONS'}</div>{!session.nodes.length ? <div className="empty-state"><Icon name="network" size={32}/><h3>No network discovery recorded</h3><p>This run contains model observations, but no scanner-derived topology yet.</p></div> : <><svg className="network-edges" viewBox={`0 0 900 ${graphHeight}`} preserveAspectRatio="none" aria-hidden="true"><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" fill="#74d6b5"/></marker></defs>{session.edges.map((edge, i) => {const a = session.nodes.findIndex(n => n.id === edge.source); const b = session.nodes.findIndex(n => n.id === edge.target); if (a < 0 || b < 0) return null; const from = position(a), to = position(b); const active = edge.at <= cursor; return <g key={i} className={active ? 'edge active' : 'edge'}><path d={`M${from.x + 105},${from.y} C${from.x + 160},${from.y} ${to.x - 160},${to.y} ${to.x - 105},${to.y}`} markerEnd={active ? 'url(#arrow)' : undefined}/>{active && <text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 14} textAnchor="middle">{illustrative ? 'LAB ACCESS' : 'AGENT TRANSITION'}</text>}</g>;})}</svg>{session.nodes.map((node, index) => {const p = position(index); const known = node.discoveredAt <= cursor; const accessed = node.accessedAt !== undefined && node.accessedAt <= cursor; return <button key={node.id} className={`host-card ${known ? 'known' : 'unknown'} ${accessed ? 'accessed' : ''} ${selectedNode === node.id && known ? 'host-selected' : ''}`} style={{left: `${p.x / 9}%`, top: `${p.y / graphHeight * 100}%`}} disabled={!known} onClick={() => setSelectedNode(node.id)} aria-label={known ? `Inspect ${node.name} ${node.ip}` : 'Host not yet discovered'}><div className="host-card-top"><span className="host-icon"><Icon name={node.role === 'attacker' ? 'terminal' : node.role === 'database' ? 'database' : 'server'} size={23}/></span><span className={`host-status ${accessed ? 'access' : ''}`}><i/>{!known ? 'Unknown' : accessed ? 'Agent connected' : 'Discovered'}</span></div><strong>{known ? node.name : 'Unobserved host'}</strong><span className="host-ip">{known ? node.ip : '— . — . — . —'}</span><div className="host-service">{known ? Object.entries(node.services).map(([port, service]) => `${port} / ${service}`).join(' · ') || 'Services not recorded' : 'Waiting for discovery'}</div><span className="host-zone">{known ? node.zone : 'UNKNOWN NETWORK'}</span></button>;})}</>}<div className="map-legend"><span><i className="legend-access"/>Agent connected</span><span><i className="legend-discovered"/>Discovered</span><span><i/>Unobserved</span><small>Click a host to inspect</small></div></div> : <div className="inventory"><table><thead><tr><th>Host</th><th>Address</th><th>Services</th><th>State</th></tr></thead><tbody>{visibleNodes.map(n => <tr key={n.id} onClick={() => setSelectedNode(n.id)}><td>{n.name}</td><td className="mono">{n.ip}</td><td>{Object.entries(n.services).map(([p, s]) => `${p}/${s}`).join(', ') || 'Not recorded'}</td><td>{n.accessedAt !== undefined && n.accessedAt <= cursor ? 'Agent connected' : 'Discovered'}</td></tr>)}</tbody></table>{!visibleNodes.length && <p>No discovered hosts in this frame.</p>}</div>}
          <div className="host-inspector"><span className="inspector-icon"><Icon name="server" size={18}/></span><div><strong>{selected ? selected.name : 'Select a discovered host'}</strong><span>{selected ? `${selected.ip} · ${Object.keys(selected.services).length} recorded service(s)` : 'Discoveries and connections appear as the story progresses.'}</span></div>{selected && <span className="tiny-tag">{selected.role}</span>}</div></section>
          <section className="panel journey-panel"><div className="panel-header"><div className="panel-title"><Icon name="timeline" size={18}/><h2>Attack journey</h2></div><button className="text-button" onClick={() => setView('timeline')}>Explore timeline <Icon name="arrow" size={16}/></button></div><div className="journey-steps">{session.timeline.map((event, index) => <button key={event.id} className={`${index <= cursor ? 'reached' : ''} ${index === cursor ? 'current' : ''}`} onClick={() => {setCursor(index); setPlaying(false); if (source === 'live') setSource(session.id);}}><span>{index < cursor ? <Icon name="check" size={15}/> : String(index + 1).padStart(2, '0')}</span><small>{phaseLabel[event.phase] || event.phase}</small><time>{event.timestamp ? event.timestamp.slice(0, 19) : 'Recorded'}</time></button>)}</div>{!session.timeline.length && <p className="muted empty-inline">No action or model events have been recorded.</p>}</section></div>
          <aside className="insights-column"><section className="panel spotlight"><div className="spotlight-label"><Icon name="spark" size={17}/>{illustrative ? 'SCENARIO SPOTLIGHT' : 'EVENT SPOTLIGHT'}<span>{String(cursor + 1).padStart(2, '0')}</span></div><span className="phase-pill">{phaseLabel[scene?.phase] || 'Awaiting evidence'}</span><h2>{scene?.title || 'The story hasn’t started yet.'}</h2><p>{scene?.detail || 'Select a recorded run or play the illustrative lab scenario to explore the decision loop.'}</p><div className="evidence-caption"><Icon name="report" size={14}/>{scene?.evidence || 'No evidence available'}</div><div className="decision-loop"><span>Observe</span><Icon name="arrow" size={12}/><span>Decide</span><Icon name="arrow" size={12}/><span>Act</span><Icon name="refresh" size={13}/></div></section>
          <section className="panel findings-preview"><div className="panel-header"><div className="panel-title"><h2>Findings</h2><span className="tiny-tag">{visibleFindings.length}</span></div><Icon name="shield" size={17}/></div>{visibleFindings.slice(0, 2).map((f, i) => <button className="finding-preview" key={i} onClick={() => setFinding(f)}><span className={`severity-dot ${f.severity}`}/><div><strong>{f.title}</strong><small>{f.host} · {f.severity}</small></div><Icon name="arrow" size={15}/></button>)}{!visibleFindings.length && <p className="muted empty-inline">No matches in this frame. This does not establish that targets are secure.</p>}<button className="text-button preview-link" onClick={() => setView('findings')}>Review findings <Icon name="arrow" size={16}/></button></section>
          <div className="presenter-tip"><span className="tip-icon"><Icon name="expand" size={19}/></span><div><strong>Built for the room.</strong><p>Press <kbd>F</kbd> for presentation mode.<br/><kbd>Space</kbd> to play · <kbd>←</kbd> <kbd>→</kbd> to step.</p></div></div></aside></div>}
        {view === 'timeline' && <section className="panel timeline-view"><div className="panel-header"><div className="panel-title"><Icon name="timeline"/><h2>Operation timeline</h2></div><span className="muted">Select a stage to replay that moment</span></div>{session.timeline.map((event, index) => <button className={`event-row ${index === cursor ? 'selected' : ''}`} key={event.id} onClick={() => {setCursor(index); setPlaying(false); if (source === 'live') setSource(session.id);}}><span className="event-number">{String(index + 1).padStart(2, '0')}</span><div><span className="phase-pill">{phaseLabel[event.phase]}</span><h3>{event.title}</h3><p>{event.detail}</p><small>{event.evidence}</small></div><time>{event.timestamp ? event.timestamp.slice(0, 19) : 'Timestamp not recorded'}</time><Icon name={index === cursor ? 'pause' : 'play'} size={17}/></button>)}{!session.timeline.length && <div className="empty-state"><Icon name="timeline" size={32}/><h3>No events recorded yet</h3><p>The timeline will reflect actions and model observations when available.</p></div>}</section>}
        {view === 'findings' && <section className="panel findings-view"><div className="panel-header"><div className="panel-title"><Icon name="shield"/><h2>Evidence register</h2></div><label className="search-box"><Icon name="search" size={16}/><input aria-label="Search findings" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search target, finding, or CVE…"/></label></div><div className="filter-row">{['all', 'critical', 'high', 'medium', 'low', 'info'].map(s => <button key={s} className={severity === s ? 'selected' : ''} onClick={() => setSeverity(s)}>{s === 'all' ? 'All severities' : s}</button>)}<span>{filteredFindings.length} match(es) in this frame</span></div>{filteredFindings.map((f, i) => <button className="finding-row" key={i} onClick={() => setFinding(f)}><span className={`severity-badge ${f.severity}`}>{f.severity}</span><div><h3>{f.title}</h3><span>{f.host}:{f.port} · {f.cves.join(', ') || 'No CVE identifier'}</span></div><span className="finding-source">{illustrative ? 'Illustrative' : 'Scanner match'}</span><Icon name="arrow" size={18}/></button>)}{!filteredFindings.length && <div className="empty-state"><Icon name="shield" size={32}/><h3>No findings match this view</h3><p>Adjust the filter or advance the replay. Absence of findings does not establish security.</p></div>}</section>}
        {view === 'reports' && <div className="report-layout"><section className="panel"><div className="panel-header"><div className="panel-title"><Icon name="report"/><h2>Session brief</h2></div><span className="tiny-tag">MARKDOWN</span></div><pre className="report-content">{brief(session)}</pre></section><aside className="panel report-tools"><span className="eyebrow">TAKE THE EVIDENCE WITH YOU</span><h2>A brief worth sharing.</h2><p>Observations, scanner matches, and coverage gaps. Kept separate from model interpretation.</p><button className="primary" onClick={() => download(`${session.id}-brief.md`, brief(session), 'text/markdown')}><Icon name="download"/>Download Markdown</button><button className="secondary" onClick={() => download(`${session.id}-evidence.json`, JSON.stringify(session.reportData || session, null, 2), 'application/json')}><Icon name="report"/>Download JSON</button><div className="report-note"><Icon name="shield"/><p>{illustrative ? 'This export contains authored demonstration data, not a completed assessment.' : 'Exports contain recorded data. Review sensitive details before sharing.'}</p></div></aside></div>}
        {view === 'sessions' && <section className="panel sessions-view"><div className="panel-header"><div className="panel-title"><Icon name="folder"/><h2>Session library</h2></div><button className="secondary" onClick={refreshRuns}><Icon name="refresh" size={16}/>Refresh</button></div><button className="session-library-row" onClick={() => {resetDemo(); setView('overview');}}><span className="library-icon"><Icon name="play"/></span><div><h3>Equifax · a multi-stage journey</h3><p>Illustrative replay · 8 stages · works offline</p></div><span className="tiny-tag">BUILT IN</span><Icon name="arrow"/></button>{runs.map(run => <button className="session-library-row" key={run.id} disabled={loading} onClick={async () => {await loadSession(run.id); setView('overview');}}><span className="library-icon"><Icon name="clock"/></span><div><h3>{run.id}</h3><p>Recorded run · {new Date(run.modified * 1000).toLocaleString()}</p></div><span className="tiny-tag">RECORDED</span><Icon name="arrow"/></button>)}{!runs.length && <div className="empty-state"><Icon name="folder" size={32}/><h3>{connected ? 'No recorded runs yet' : 'Connect your lab to browse real runs'}</h3><p>The illustrative replay is always available. Start the Incalmo backend to browse logs from your own sessions.</p></div>}</section>}
        <footer className="workspace-footer"><span><Icon name="shield" size={13}/> {illustrative ? 'Illustrative data · no target connections' : 'Read-only seminar view · no actions launched here'}</span><span>INCALMO / SEMINAR STUDIO</span></footer>
      </main>
      <div className="playback-bar"><div className="playback-controls"><button className="icon-button" aria-label="Previous stage" disabled={!cursor || source === 'live'} onClick={() => {setPlaying(false); setCursor(c => c - 1);}}><Icon name="back" size={17}/></button><button className="play-button" aria-label={playing ? 'Pause replay' : 'Play replay'} disabled={!session.timeline.length || source === 'live'} onClick={togglePlayback}><Icon name={playing ? 'pause' : 'play'} size={17}/>{source === 'live' ? 'Observing' : playing ? 'Pause replay' : 'Play replay'}</button><button className="icon-button" aria-label="Next stage" disabled={cursor >= session.timeline.length - 1 || source === 'live'} onClick={() => {setPlaying(false); setCursor(c => c + 1);}}><Icon name="next" size={17}/></button></div><div className="scrubber"><div><strong>{scene?.title || 'Awaiting events'}</strong><span>{session.timeline.length ? cursor + 1 : 0} / {session.timeline.length} stages</span></div><input aria-label="Replay stage" type="range" min="0" max={Math.max(session.timeline.length - 1, 0)} value={cursor} disabled={!session.timeline.length || source === 'live'} onChange={e => {setPlaying(false); setCursor(Number(e.target.value));}} style={{'--progress': `${session.timeline.length > 1 ? cursor / (session.timeline.length - 1) * 100 : 0}%`} as React.CSSProperties}/></div><label className="speed-label">Speed<select aria-label="Playback speed" value={speed} onChange={e => setSpeed(Number(e.target.value))} disabled={source === 'live'}><option value="1">1×</option><option value="2">2×</option><option value="4">4×</option></select></label><button className="icon-button" title="Toggle presentation mode" aria-label="Toggle presentation mode" onClick={() => setPresentation(p => !p)}><Icon name="expand" size={18}/></button></div>
    </div>
    {finding && <FindingDialog finding={finding} illustrative={illustrative} onClose={() => setFinding(null)}/>}
  </div>;
}
function FindingDialog({finding, illustrative, onClose}: {finding: Finding; illustrative: boolean; onClose: () => void}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {const element = dialog.current; element?.showModal(); return () => element?.close();}, []);
  return <dialog className="finding-dialog" ref={dialog} onCancel={onClose} onClick={event => {if (event.target === event.currentTarget) onClose();}} aria-labelledby="finding-title"><div className="dialog-header"><span className={`severity-badge ${finding.severity}`}>{finding.severity}</span><button className="icon-button" onClick={onClose} aria-label="Close finding"><Icon name="close"/></button></div><span className="eyebrow">{illustrative ? 'ILLUSTRATIVE FINDING' : 'SCANNER MATCH · VERIFICATION REQUIRED'}</span><h2 id="finding-title">{finding.title}</h2><p className="dialog-target">{finding.host}:{finding.port}</p><h3>What was recorded</h3><p>{finding.description || 'The scanner returned a template match. Additional verification is required.'}</p><dl><dt>Scanner</dt><dd>{finding.scanner}</dd><dt>Template</dt><dd>{finding.template_id}</dd><dt>CVE</dt><dd>{finding.cves.join(', ') || 'None recorded'}</dd><dt>Evidence</dt><dd>{finding.evidence}</dd><dt>Endpoint</dt><dd>{finding.matched_at || 'Not recorded'}</dd></dl><div className="remediation"><Icon name="shield"/><div><h3>Suggested remediation</h3><p>{finding.remediation || 'Verify the finding, review the vendor advisory, and apply supported updates.'}</p></div></div><button className="secondary" onClick={onClose}>Back to the session</button></dialog>;
}
