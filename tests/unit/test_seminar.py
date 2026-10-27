import json
from pathlib import Path

import pytest

from incalmo.seminar import list_runs, run_directory, build_snapshot


def make_run(root, name="run"):
    path = root / name
    path.mkdir()
    (path / "actions.json").write_text("")
    return path


def test_run_lookup_rejects_traversal_and_escaping_symlinks(tmp_path):
    root = tmp_path / "output"
    root.mkdir()
    actual = make_run(root)
    outside = make_run(tmp_path, "outside")
    (root / "escape").symlink_to(outside, target_is_directory=True)
    assert run_directory(root, "run") == actual
    for name in ("../outside", "escape", "missing"):
        with pytest.raises(FileNotFoundError):
            run_directory(root, name)
    assert [row["id"] for row in list_runs(root)] == ["run"]


def test_snapshot_never_invents_topology_for_model_only_run(tmp_path):
    run = make_run(tmp_path)
    (run / "llm.log").write_text("2026-10-27 10:00:00,123 INFO:deepseek-flash response: \nI should inspect the network.\n<query>private code</query>\n")
    (run / "token_usage.json").write_text(json.dumps({"model": "deepseek-flash", "input_tokens": 12, "output_tokens": 3}) + "\n")
    data = build_snapshot(run)
    assert data["origin"] == "recorded"
    assert data["nodes"] == []
    assert data["findings"] == []
    assert data["timeline"][0]["status"] == "unverified"
    assert data["tokens"] == 15
    assert "private code" not in json.dumps(data)


def test_snapshot_preserves_finding_evidence_and_omits_raw_command_output(tmp_path):
    run = make_run(tmp_path)
    finding = {"class_name": "SecurityFinding", "host": "192.0.2.5", "port": 443,
               "service": "https", "scanner": "nuclei", "template_id": "panel",
               "title": "Exposed panel", "severity": "medium", "cves": [],
               "matched_at": "https://192.0.2.5", "description": "A match", "remediation": "Restrict access", "references": []}
    rows = [{"type": "LowLevelAction", "action_name": "NucleiScan", "stdout": "secret-output",
             "action_params": {"command": "private command", "agent": {"host_ip_addrs": ["192.0.2.10", "192.0.3.10"]}},
             "events": [finding]},
            {"type": "HighLevelAction", "action_name": "Scan", "events": [finding]}]
    (run / "actions.json").write_text("\n".join(json.dumps(row) for row in rows))
    data = build_snapshot(run)
    assert len(data["timeline"]) == 1
    assert data["findings"][0]["at"] == 0
    assert data["findings"][0]["evidence"] == "actions.json:1"
    assert data["nodes"][0]["role"] == "attacker"
    assert len([n for n in data["nodes"] if n["role"] == "attacker"]) == 1
    assert "secret-output" not in json.dumps(data)
    assert "private command" not in json.dumps(data)


def test_seminar_api_is_read_only_and_handles_missing_runs(tmp_path, monkeypatch):
    from flask import Flask
    from incalmo.c2server.routes.seminar_routes import seminar_bp
    monkeypatch.setenv("INCALMO_OUTPUT_ROOT", str(tmp_path))
    make_run(tmp_path)
    app = Flask(__name__)
    app.register_blueprint(seminar_bp)
    client = app.test_client()
    assert client.get("/seminar/runs").json["runs"][0]["id"] == "run"
    assert client.get("/seminar/runs/run").status_code == 200
    assert client.get("/seminar/runs/missing").status_code == 404
    assert client.post("/seminar/runs/run").status_code == 405
    assert client.post("/seminar/runs").status_code == 405


def test_main_app_keeps_api_only_and_lists_models_without_legacy_registry(tmp_path, monkeypatch):
    from incalmo.c2server.c2server import app
    monkeypatch.setenv("INCALMO_OUTPUT_ROOT", str(tmp_path))
    client = app.test_client()
    assert client.get("/seminar/runs").status_code == 200
    assert client.get("/studio/").status_code == 404
    response = client.get("/available_strategies")
    assert response.status_code == 200
    assert "deepseek-flash" in [row["name"] for row in response.json["strategies"]]
