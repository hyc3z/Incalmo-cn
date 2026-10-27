import asyncio
import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from incalmo.scanner_results import parse_nuclei_findings
from incalmo.reporting import generate_report


def test_parser_keeps_non_cve_and_multiple_cves_and_ignores_malformed_records():
    items = [
        {"template-id": "exposed-panel", "matched-at": "https://192.0.2.5:443/admin",
         "info": {"name": "Admin panel", "severity": "medium", "remediation": "Restrict access"}},
        {"template-id": "cve-2024-12345", "info": {
            "severity": "high", "classification": {"cve-id": ["CVE-2024-12345", "CVE-2024-67890"]}}},
        [], None, {"template-id": 123},
    ]
    output = "not json\n" + "\n".join(json.dumps(item) for item in items + items[:1])
    matches = parse_nuclei_findings(output, "192.0.2.5", 443, "https")
    assert len(matches) == 2
    assert matches[0]["cves"] == []
    assert matches[0]["remediation"] == "Restrict access"
    assert matches[1]["cves"] == ["CVE-2024-12345", "CVE-2024-67890"]


def write_events(path, events, **extra):
    row = {"type": "LowLevelAction", "action_name": "NucleiScan", "events": events, **extra}
    with path.open("a") as handle:
        handle.write(json.dumps(row) + "\n")


def test_report_deduplicates_events_and_keeps_model_claims_separate(tmp_path):
    run = tmp_path / "run"
    run.mkdir()
    finding = {"class_name": "SecurityFinding", **parse_nuclei_findings(json.dumps({
        "template-id": "CVE-2024-12345", "info": {"name": "Match", "severity": "high"}
    }), "192.0.2.5", 443, "https")[0]}
    events = [finding, {"class_name": "VulnerableServiceFound", "host": "192.0.2.5",
                      "port": 443, "service": "https", "cve": "CVE-2024-12345"},
              {"class_name": "ServicesDiscoveredOnHost", "host_ip": "192.0.2.5",
               "services": {443: "https"}},
              {"class_name": "ScannerStatus", "scanner": "nuclei", "host": "192.0.2.5",
               "port": 443, "status": "completed", "detail": "1 match"}]
    write_events(run / "actions.json", events, stdout="password=do-not-copy")
    write_events(run / "actions.json", events, type="HighLevelAction")
    (run / "llm.log").write_text(
        "2026-10-27 10:00:00,123 INFO:deepseek-flash response: \n"
        "I suspect another issue.\n<query>print('never include generated code')</query>\n"
        "2026-10-27 10:00:01,123 INFO:Incalmo's response: \nInternal data\n"
        "2026-10-27 10:00:02,123 INFO:Query response: \nInternal data again\n"
    )
    (run / "token_usage.json").write_text(json.dumps({"input_tokens": 12, "output_tokens": 5}) + "\n")
    report = generate_report(run, status="interrupted")
    data = json.loads((run / "report.json").read_text())
    assert len(data["findings"]) == 1
    assert data["model_calls"] == 1
    assert data["input_tokens"] == 12
    assert data["model_notes"][0]["text"] == "I suspect another issue."
    assert len(data["model_notes"]) == 1
    assert "do-not-copy" not in report.read_text()
    assert "never include generated code" not in report.read_text()
    assert "interrupted" in report.read_text()
    assert "unverified" in report.read_text()
    # Regenerating must preserve known termination state.
    generate_report(run)
    assert json.loads((run / "report.json").read_text())["status"] == "interrupted"


def test_empty_or_failed_scan_is_not_a_clean_bill_of_health(tmp_path, monkeypatch):
    write_events(tmp_path / "actions.json", [{"class_name": "ScannerStatus", "scanner": "nuclei",
                 "host": "192.0.2.5", "port": 443, "status": "failed",
                 "detail": "nuclei: not found; password=secret-value"}])
    with (tmp_path / "actions.json").open("a") as handle:
        handle.write("{unfinished\n")
    from incalmo import reporting
    def unavailable(*args):
        raise RuntimeError("API unavailable password=another-secret")
    monkeypatch.setattr(reporting, "summarize_with_model", unavailable)
    report = generate_report(tmp_path, model_name="deepseek-flash")
    text = report.read_text()
    assert "not establish" in text
    assert "failed" in text
    assert "malformed record" in text
    assert "Optional model summary failed" in text
    assert "secret-value" not in text
    assert "another-secret" not in text
    json.loads((tmp_path / "report.json").read_text())


def test_report_escapes_target_controlled_content_and_reads_rotations(tmp_path):
    finding = {"class_name": "SecurityFinding", **parse_nuclei_findings(json.dumps({
        "template-id": "panel", "info": {"name": "<script>x</script> [click](https://evil.test) | row"}
    }), "192.0.2.5", 80, "http")[0]}
    write_events(tmp_path / "actions.json.1", [finding])
    (tmp_path / "actions.json").write_text("")
    text = generate_report(tmp_path).read_text()
    assert "<script>" not in text
    assert "[click](https://evil.test)" not in text
    assert "\\| row" in text
    assert "actions.json.1:1" in text


def test_optional_summary_is_labelled_and_does_not_become_finding(tmp_path, monkeypatch):
    from incalmo import reporting
    monkeypatch.setattr(reporting, "summarize_with_model", lambda *args: "Coverage is incomplete.")
    text = generate_report(tmp_path, model_name="deepseek-flash").read_text()
    data = json.loads((tmp_path / "report.json").read_text())
    assert data["findings"] == []
    assert data["summary_model"] == "deepseek-flash"
    assert "interpretation, not evidence" in text
    assert "Coverage is incomplete." in text


def test_nuclei_uses_https_and_retains_compatibility_events():
    from incalmo.core.actions.LowLevel.nuclei_scan import NucleiScan
    scan = NucleiScan(SimpleNamespace(), "192.0.2.5", 443, "http+ssl")
    assert "https://192.0.2.5:443" in scan.command
    assert "info,low,medium,high,critical" in scan.command
    assert "-ni" in scan.command
    result = SimpleNamespace(exit_code="0", stderr="", output=json.dumps({
        "template-id": "cve-2024-12345", "info": {"severity": "medium"}}))
    events = asyncio.run(scan.get_result(result))
    assert [type(e).__name__ for e in events] == ["SecurityFinding", "VulnerableServiceFound", "ScannerStatus"]
    assert events[-1].status == "completed"
    failed = asyncio.run(scan.get_result(SimpleNamespace(exit_code="127", stderr="not found", output="")))
    assert failed[-1].status == "failed"
    with pytest.raises(ValueError):
        NucleiScan(SimpleNamespace(), "192.0.2.5; touch /tmp/no", 80, "http")


def test_high_level_scan_checks_https_and_preserves_plain_http_lab_check():
    from incalmo.core.actions.HighLevel.scan import Scan
    from incalmo.core.models.events import HostsDiscovered, ServicesDiscoveredOnHost
    from incalmo.core.models.network import Subnet
    seen = []
    class Orchestrator:
        async def run_action(self, action, context):
            name = type(action).__name__
            seen.append(name)
            if name == "ScanNetwork":
                return [HostsDiscovered("192.0.2.0/24", ["192.0.2.5"])]
            if name == "ScanHost":
                return [ServicesDiscoveredOnHost("192.0.2.5", {80: "http", 443: "https", 22: "ssh"})]
            return []
    host = SimpleNamespace(get_agent=lambda: SimpleNamespace())
    graph = SimpleNamespace(record_action=lambda *args: None)
    scan = Scan(host, [Subnet(ip_mask="192.0.2.0/24")])
    asyncio.run(scan.run(Orchestrator(), None, graph, None))
    assert seen.count("NucleiScan") == 2
    assert seen.count("NiktoScan") == 1


@pytest.mark.parametrize("termination", ["ended", "interrupted", "failed", "timed_out"])
def test_runner_always_writes_partial_report(tmp_path, monkeypatch, termination):
    from incalmo import incalmo_runner
    class Strategy:
        logging_service = SimpleNamespace(logger_dir_path=tmp_path)
        async def initialize(self):
            pass
        async def main(self):
            if termination == "interrupted":
                raise asyncio.CancelledError()
            if termination == "failed":
                raise RuntimeError("test failure")
            return termination == "ended"
    monkeypatch.setattr(incalmo_runner.strategy_factory, "build_strategy", lambda *args: Strategy())
    if termination == "timed_out":
        monkeypatch.setattr(incalmo_runner, "TIMEOUT_SECONDS", -1)
    if termination in {"failed", "interrupted"}:
        expected = RuntimeError if termination == "failed" else asyncio.CancelledError
        with pytest.raises(expected):
            asyncio.run(incalmo_runner.run_incalmo_strategy(None, "test"))
    else:
        asyncio.run(incalmo_runner.run_incalmo_strategy(None, "test"))
    assert json.loads((tmp_path / "report.json").read_text())["status"] == termination
