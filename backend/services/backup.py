"""Backup and restore service for JSON data files.

Implements NFR-R01, NFR-R02, NFR-R03 - backup before write, restore on failure.
"""
import shutil
import logging
import os

logger = logging.getLogger(__name__)


def create_backup(path: str) -> None:
    """Copy path → path.bak before a write operation."""
    if os.path.exists(path):
        backup_path = path + ".bak"
        shutil.copy2(path, backup_path)
        logger.debug("Backup created: %s", backup_path)


def restore_backup(path: str) -> None:
    """Restore path.bak → path after a failed write operation."""
    backup_path = path + ".bak"
    if os.path.exists(backup_path):
        shutil.copy2(backup_path, path)
        logger.warning("Backup restored: %s → %s", backup_path, path)
    else:
        logger.error("No backup found to restore for: %s", path)
