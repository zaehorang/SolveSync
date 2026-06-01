"""Shared exception types for harness modules."""


class HarnessError(Exception):
    """Base error for harness failures."""


class PhaseValidationError(HarnessError):
    """Raised when phase index files do not satisfy the harness contract."""


class GitOperationError(HarnessError):
    """Raised when a git operation fails."""


class BlockedStep(HarnessError):
    """Raised when a step requires user intervention."""


class FailedStep(HarnessError):
    """Raised when a step fails after allowed attempts."""
