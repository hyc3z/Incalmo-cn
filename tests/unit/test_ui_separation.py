from pathlib import Path
import yaml


def test_ui_starts_independently_without_lab_secrets_or_mounts():
    root = Path(__file__).resolve().parents[2]
    compose = yaml.safe_load((root / 'docker/docker-compose.yml').read_text())
    services = compose['services']
    ui = services['ui']
    assert not ui.get('profiles')
    assert not ui.get('depends_on')
    assert not ui.get('env_file')
    assert not ui.get('volumes')
    assert ui['networks'] == ['control_network']
    assert ui['build']['context'] == '../incalmo/frontend/incalmo-ui'
    for name in ['attacker', 'webserver', 'db']:
        assert services[name]['profiles'] == ['lab']
    assert 'control_network' in services['attacker']['networks']
    assert 'control_network' not in services['webserver']['networks']
    assert 'control_network' not in services['db']['networks']
