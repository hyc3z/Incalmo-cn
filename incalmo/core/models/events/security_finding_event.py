from .event import Event


class SecurityFinding(Event):
    """A scanner match, requiring review; may have no CVE identifier."""

    def __init__(self, **finding):
        self.__dict__.update(finding)

    def __str__(self):
        return f"SecurityFinding: {self.host}:{self.port} [{self.severity}] {self.title}"


class ScannerStatus(Event):
    def __init__(self, scanner, host, port, status, detail=""):
        self.scanner = scanner
        self.host = host
        self.port = port
        self.status = status
        self.detail = detail

    def __str__(self):
        return f"ScannerStatus: {self.scanner} {self.host}:{self.port} {self.status}: {self.detail}"
