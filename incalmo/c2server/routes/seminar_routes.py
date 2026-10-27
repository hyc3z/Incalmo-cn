"""Read-only seminar data; these routes never launch scans or call a model."""

import os
from pathlib import Path
from flask import Blueprint, jsonify, abort

from incalmo.seminar import list_runs, run_directory, build_snapshot

seminar_bp = Blueprint("seminar", __name__, url_prefix="/seminar")


def output_root():
    return Path(os.environ.get("INCALMO_OUTPUT_ROOT", "output"))


@seminar_bp.get("/runs")
def runs():
    return jsonify({"runs": list_runs(output_root())})


@seminar_bp.get("/runs/<run_id>")
def snapshot(run_id):
    try:
        return jsonify(build_snapshot(run_directory(output_root(), run_id)))
    except FileNotFoundError:
        abort(404)


@seminar_bp.get("/config")
def configuration():
    from incalmo.core.services.config_service import ConfigService
    # AttackerConfig contains run settings, never the .env API credentials.
    return jsonify(ConfigService().get_config().model_dump())

