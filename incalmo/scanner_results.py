"""Normalize Nuclei JSONL without executing or trusting template text."""

import json
import re


def _strings(value):
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        return [item for item in value if isinstance(item, str)]
    return []


def parse_nuclei_findings(output, host, port, service):
    findings = []
    seen = set()
    for line in (output or "").splitlines():
        try:
            data = json.loads(line)
        except (ValueError, TypeError):
            continue
        if not isinstance(data, dict) or not isinstance(data.get("template-id"), str):
            continue
        info = data.get("info")
        info = info if isinstance(info, dict) else {}
        classification = info.get("classification")
        classification = classification if isinstance(classification, dict) else {}
        template_id = data["template-id"]
        candidates = _strings(classification.get("cve-id")) + [template_id]
        cves = sorted({cve.upper() for cve in re.findall(
            r"CVE-\d{4}-\d{4,}", " ".join(candidates), re.I,
        )})
        endpoint = str(data.get("matched-at") or data.get("host") or f"{host}:{port}")
        key = (template_id, endpoint)
        if key in seen:
            continue
        seen.add(key)
        severity = str(info.get("severity", "unknown")).lower()
        if severity not in {"info", "low", "medium", "high", "critical"}:
            severity = "unknown"
        findings.append({
            "scanner": "nuclei", "host": host, "port": port, "service": service,
            "template_id": template_id, "title": str(info.get("name") or template_id),
            "severity": severity, "cves": cves, "matched_at": endpoint,
            "description": str(info.get("description") or "")[:2000],
            "remediation": str(info.get("remediation") or "")[:2000],
            "references": _strings(info.get("reference"))[:10],
        })
    return findings
