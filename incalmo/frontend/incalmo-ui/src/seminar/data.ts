export type Phase = 'discovery' | 'access' | 'information' | 'collection' | 'assessment';
export interface Scene { id: string; title: string; phase: Phase; detail: string; timestamp: string; status: string; evidence: string; }
export interface NetworkNode { id: string; name: string; ip: string; role: string; zone: string; services: Record<string, string>; discoveredAt: number; accessedAt?: number; }
export interface Finding { host: string; port: number; title: string; severity: string; cves: string[]; scanner: string; template_id: string; matched_at: string; description: string; remediation: string; evidence: string; at?: number; }
export interface Session { id: string; title: string; origin: 'illustrative' | 'recorded'; model: string; status: string; nodes: NetworkNode[]; edges: {source: string; target: string; at: number}[]; timeline: Scene[]; findings: Finding[]; modelCalls: number; tokens: number; limitations: string[]; reportText?: string; reportData?: any; }
export const DEMO: Session = {
  id: 'illustrative-equifax', title: 'Equifax · a multi-stage journey', origin: 'illustrative', model: 'Illustrative AI planner', status: 'illustrative', modelCalls: 11, tokens: 12450,
  nodes: [
    {id: 'attacker', name: 'Attacker', ip: '192.168.200.10', role: 'attacker', zone: 'CONTROL NETWORK', services: {'8888': 'Control server'}, discoveredAt: 0, accessedAt: 0},
    {id: 'web', name: 'Web server', ip: '192.168.200.20', role: 'web', zone: 'WEB NETWORK', services: {'8080': 'HTTP / Apache Struts'}, discoveredAt: 1, accessedAt: 3},
    {id: 'db', name: 'Database server', ip: '192.168.201.100', role: 'database', zone: 'PRIVATE NETWORK', services: {'22': 'SSH'}, discoveredAt: 4, accessedAt: 6},
  ],
  edges: [{source: 'attacker', target: 'web', at: 3}, {source: 'web', target: 'db', at: 6}],
  timeline: [
    {id: 's0', title: 'Establish the foothold', phase: 'assessment', detail: 'An agent connects from the attacker container. The planner starts with a foothold, not a complete map of the network.', timestamp: '00:00', status: 'illustrative', evidence: 'Authored seminar scenario'},
    {id: 's1', title: 'Discover the web tier', phase: 'discovery', detail: 'Host and service discovery reveals a web server on the reachable subnet. A reachable service is an observation, not proof of a vulnerability.', timestamp: '00:18', status: 'illustrative', evidence: 'Authored seminar scenario'},
    {id: 's2', title: 'Assess the exposed service', phase: 'discovery', detail: 'A simulated scanner match flags Apache Struts for review. The planner uses the result to choose its next step. A match alone does not confirm exploitation.', timestamp: '00:42', status: 'illustrative', evidence: 'Synthetic scanner result'},
    {id: 's3', title: 'Gain a new foothold', phase: 'access', detail: 'The scenario demonstrates a new agent connection on the web server. That expands the network the planner can observe from this host.', timestamp: '01:06', status: 'illustrative', evidence: 'Synthetic agent connection'},
    {id: 's4', title: 'Find the next connection', phase: 'information', detail: 'Configuration on the web server reveals a route toward the private database tier. The planner connects previously separate observations into a possible path.', timestamp: '01:31', status: 'illustrative', evidence: 'Authored seminar scenario'},
    {id: 's5', title: 'Review access exposure', phase: 'information', detail: 'A second illustrative finding highlights a credential exposure. It is presented separately from the Struts match so the audience can distinguish the two risks.', timestamp: '01:52', status: 'illustrative', evidence: 'Synthetic configuration finding'},
    {id: 's6', title: 'Reach the database tier', phase: 'access', detail: 'The replay illustrates lateral movement from the web server to the private database. This is the multi-host coordination that Incalmo is designed to study.', timestamp: '02:14', status: 'illustrative', evidence: 'Synthetic agent connection'},
    {id: 's7', title: 'Collect evidence & conclude', phase: 'collection', detail: 'The illustrative exercise ends with designated lab data collected and a brief report. In a real assessment, scope, evidence, and coverage gaps must accompany the findings.', timestamp: '02:38', status: 'illustrative', evidence: 'Authored seminar conclusion'},
  ],
  findings: [
    {host: '192.168.200.20', port: 8080, title: 'Apache Struts service exposure', severity: 'high', cves: ['CVE-2017-5638'], scanner: 'Illustrative Nuclei match', template_id: 'CVE-2017-5638', matched_at: 'http://192.168.200.20:8080', description: 'Synthetic finding for the seminar replay, not a result from a scanned device.', remediation: 'Verify the installed Struts version against the vendor advisory; update affected software and restrict service exposure.', evidence: 'Synthetic seminar fixture · not observed evidence', at: 2},
    {host: '192.168.200.20', port: 22, title: 'Credentials available to the web tier', severity: 'medium', cves: [], scanner: 'Illustrative configuration review', template_id: 'credential-exposure-demo', matched_at: 'Web-tier configuration', description: 'The authored scenario demonstrates how accessible credentials can connect two otherwise separated network tiers.', remediation: 'Review credential permissions, rotate exposed credentials, and limit the database account to necessary privileges.', evidence: 'Synthetic seminar fixture · not observed evidence', at: 5},
  ],
  limitations: ['This entire scenario is illustrative, not a recording of a completed attack.', 'Playback executes no commands, makes no model calls, and does not contact target devices.'],
};
export const phaseLabel: Record<string, string> = {assessment: 'Orientation', discovery: 'Discovery', access: 'Access', information: 'Information', collection: 'Collection'};
export function brief(session: Session) {
  if (session.reportText) return session.reportText;
  return `# Incalmo seminar brief\n\n${session.title}\n\nILLUSTRATIVE SCENARIO — NOT SCANNER EVIDENCE\n\nNo live attack or model call was executed by this replay.\n\n## Scenario findings\n\n` + session.findings.map((f, i) => `### ${i + 1}. ${f.title}\n\nSeverity: ${f.severity} (illustrative)\nTarget: ${f.host}:${f.port}\n${f.description}\n\nSuggested remediation: ${f.remediation}\n`).join('\n') + '\n## Limitations\n\n' + session.limitations.map(x => `- ${x}`).join('\n');
}
export function download(name: string, text: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], {type: mime}));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const API = (process.env.REACT_APP_API_BASE_URL || '/api').replace(/\/$/, '');
