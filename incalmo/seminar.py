"""Read-only, redacted seminar snapshots from existing operation logs."""

from pathlib import Path
import re

from incalmo.reporting import collect_evidence, _records, _redact_data, render_report


def run_directory(root, run_id):
    root = Path(root).resolve()
    path = (root / run_id).resolve()
    if path.parent != root or not path.is_dir() or not any(
        (path / name).is_file() for name in ("actions.json", "llm.log")
    ):
        raise FileNotFoundError("Run not found")
    return path


def list_runs(root):
    root = Path(root)
    if not root.is_dir():
        return []
    runs = []
    for path in root.iterdir():
        try:
            path = run_directory(root, path.name)
        except (FileNotFoundError, ValueError):
            continue
        timestamps = [p.stat().st_mtime for p in path.iterdir() if p.name in {
            "actions.json", "llm.log", "report.json", "token_usage.json",
        }]
        runs.append({"id": path.name, "modified": max(timestamps, default=path.stat().st_mtime)})
    return sorted(runs, key=lambda row: row["modified"], reverse=True)[:50]


def _phase(name):
    name = name.lower()
    if "scan" in name:
        return "discovery"
    if any(word in name for word in ("lateral", "exploit", "spawn")):
        return "access"
    if "exfil" in name:
        return "collection"
    if any(word in name for word in ("find", "read", "credential")):
        return "information"
    return "assessment"


def build_snapshot(path):
    path = Path(path)
    status = "unknown"
    for report in (path / "report.json", path.parent / "reports" / path.name / "report.json"):
        if report.exists():
            import json
            try:
                status = json.loads(report.read_text()).get("status", "unknown")
            except (ValueError, AttributeError):
                pass
            break
    evidence = _redact_data(collect_evidence(path, status))
    rows = list(_records(path, "actions.json", []))
    high = [(row, source) for row, source in rows if row.get("type") == "HighLevelAction"]
    selected = high or [(row, source) for row, source in rows if row.get("type") == "LowLevelAction"]
    selected = selected[-200:]
    nodes = {}
    edges = []
    timeline = []
    finding_stages = {}
    aliases = {}

    def add_node(ip, index, role="host", accessed=False):
        if not isinstance(ip, str) or not ip:
            return None
        ip = aliases.get(ip, ip)
        node = nodes.setdefault(ip, {
            "id": ip, "ip": ip, "name": "Host", "role": role,
            "zone": ".".join(ip.split(".")[:3]) + ".0/24" if "." in ip else "Recorded host",
            "services": evidence["hosts"].get(ip, {}), "discoveredAt": index,
        })
        if role == "attacker" or node["role"] == "attacker":
            node.update(role="attacker", name="Attacker")
        elif any("http" in service.lower() for service in node["services"].values()):
            node.update(role="web", name="Web server")
        if accessed:
            node["accessedAt"] = min(node.get("accessedAt", index), index)
        return node

    # The first executing agent is the observed starting point, not an inferred target.
    for row, _ in rows:
        params = row.get("action_params") or {}
        agent = params.get("agent", {}) if isinstance(params, dict) else {}
        if isinstance(agent, dict) and agent.get("host_ip_addrs"):
            primary = agent["host_ip_addrs"][0]
            for ip in agent["host_ip_addrs"]:
                aliases[ip] = primary
            add_node(primary, 0, "attacker", accessed=True)
            break
    for index, (row, source) in enumerate(selected):
        params = row.get("action_params") or {}
        agent = params.get("agent", {}) if isinstance(params, dict) else {}
        if isinstance(agent, dict):
            for ip in agent.get("host_ip_addrs", []):
                add_node(ip, index, accessed=True)
        events = row.get("events", [])
        events = events if isinstance(events, list) else []
        details = []
        failed = False
        for event in events:
            if not isinstance(event, dict):
                continue
            kind = event.get("class_name", "")
            if kind == "HostsDiscovered":
                for ip in event.get("host_ips", []):
                    add_node(ip, index)
                details.append(f"{len(event.get('host_ips', []))} host(s) discovered.")
            elif kind == "ServicesDiscoveredOnHost":
                add_node(event.get("host_ip"), index)
                details.append(f"Services recorded on {event.get('host_ip')}.")
            elif kind == "SecurityFinding":
                add_node(event.get("host"), index)
                finding_stages[(event.get("host"), str(event.get("port")), event.get("template_id"))] = index
                details.append(f"Scanner match: {event.get('title', 'unnamed')} (requires verification).")
            elif kind == "ScannerStatus":
                failed = failed or event.get("status") == "failed"
                details.append(f"{event.get('scanner')}: {event.get('status')}.")
            elif kind == "InfectedNewHost":
                origin, target = event.get("source_agent", {}), event.get("new_agent", {})
                source_ips = origin.get("host_ip_addrs", []) if isinstance(origin, dict) else []
                target_ips = target.get("host_ip_addrs", []) if isinstance(target, dict) else []
                if target_ips:
                    for ip in target_ips:
                        aliases[ip] = target_ips[0]
                    add_node(target_ips[0], index, accessed=True)
                if source_ips and target_ips:
                    add_node(source_ips[0], index)
                    edges.append({"source": aliases.get(source_ips[0], source_ips[0]),
                                  "target": target_ips[0], "at": index})
                details.append("A new agent connection was recorded.")
        title = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", str(row.get("action_name", "Action")))
        timeline.append({
            "id": f"event-{index}", "title": title, "phase": _phase(title),
            "detail": " ".join(details) or "Action execution recorded. Inspect the evidence before inferring success.",
            "timestamp": row.get("ts_start") or row.get("timestamp") or "",
            "status": "failed" if failed else "recorded", "evidence": source,
        })
    if not timeline:
        timeline = [{
            "id": f"model-{index}", "title": "Model observation", "phase": "assessment",
            "detail": note["text"], "timestamp": "", "status": "unverified", "evidence": "llm.log",
        } for index, note in enumerate(evidence["model_notes"])]
    # Inventory alone does not establish when a host became reachable.
    for ip in evidence["hosts"]:
        add_node(ip, max(len(timeline) - 1, 0))
    models = {row.get("model") for row, _ in _records(path, "token_usage.json", []) if row.get("model")}
    for finding in evidence["findings"]:
        finding["at"] = finding_stages.get(
            (finding["host"], str(finding["port"]), finding["template_id"]), max(len(timeline) - 1, 0),
        )
    return _redact_data({
        "id": path.name, "title": path.name.split("_202")[0].replace("_", " "),
        "origin": "recorded", "model": ", ".join(sorted(models)) or "Not recorded",
        "status": status, "nodes": list(nodes.values()), "edges": edges,
        "timeline": timeline, "findings": evidence["findings"],
        "modelCalls": evidence["model_calls"],
        "tokens": evidence["input_tokens"] + evidence["output_tokens"],
        "limitations": evidence["limitations"] + evidence["errors"],
        "reportText": render_report(evidence), "reportData": evidence,
    })
