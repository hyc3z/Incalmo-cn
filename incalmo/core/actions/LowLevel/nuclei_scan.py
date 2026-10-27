from ..low_level_action import LowLevelAction
from incalmo.models.agent import Agent
from incalmo.models.command_result import CommandResult

from incalmo.core.models.events import (
    Event, VulnerableServiceFound, SecurityFinding, ScannerStatus,
)
from incalmo.scanner_results import parse_nuclei_findings
import ipaddress
import shlex


class NucleiScan(LowLevelAction):
    def __init__(
        self,
        agent: Agent,
        host: str,
        port: int,
        service: str,
    ):
        # Only a single IP address is accepted, never arbitrary shell fragments.
        address = ipaddress.ip_address(host)
        if not 1 <= int(port) <= 65535:
            raise ValueError("Port must be between 1 and 65535")
        self.host = str(address)
        self.port = port
        self.service = service

        scheme = "https" if "ssl" in service.lower() or "https" in service.lower() else "http"
        authority = f"[{address}]" if address.version == 6 else str(address)
        target = shlex.quote(f"{scheme}://{authority}:{int(port)}")
        command = (
            f"nuclei -u {target} -pt http,ssl "
            "-severity info,low,medium,high,critical "
            "-etags dos,fuzz,bruteforce -ni -rl 10 -c 2 -bs 1 "
            "-timeout 5 -retries 1 -j -silent -nc"
        )
        super().__init__(agent, command)

    async def get_result(
        self,
        result: CommandResult,
    ) -> list[Event]:
        findings = parse_nuclei_findings(result.output, self.host, self.port, self.service)
        events = [SecurityFinding(**finding) for finding in findings]
        cves = sorted({cve for finding in findings for cve in finding["cves"]})
        # Preserve CVE events consumed by existing environment and action logic.
        events += [VulnerableServiceFound(self.port, self.host, self.service, cve) for cve in cves]
        failed = str(result.exit_code) != "0" or "timed out" in (result.stderr or "").lower()
        events.append(ScannerStatus(
            "nuclei", self.host, self.port, "failed" if failed else "completed",
            (result.stderr or "")[:1000] if failed else f"{len(findings)} template match(es)",
        ))
        return events
