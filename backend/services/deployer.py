"""Deploy service: push location data to consumer targets.

Implements FR-P04-P06 - file copy and HTTP deploy targets.
"""
import json
import logging
import os
import shlex
import shutil

import requests

from config import settings

logger = logging.getLogger(__name__)


def _deploy_file_copy(target: dict, location_dir: str, location_id: str) -> dict:
    """Copy menu.json, facts.json, and optionally images to a target directory."""
    target_path = target.get("path", "")
    if not target_path:
        return {"target": target.get("name", "unknown"), "status": "failed", "error": "No path configured"}

    # Prevent path traversal — verify resolved path is under an allowed base
    real_target = os.path.realpath(target_path)
    # Ensure target is not inside the data directory (prevent self-overwrite)
    data_dir = os.path.realpath(settings.DATA_DIR)
    if real_target.startswith(data_dir + os.sep) or real_target == data_dir:
        return {"target": target.get("name"), "status": "failed", "error": "Target cannot be inside data directory"}

    try:
        os.makedirs(real_target, exist_ok=True)

        # Copy JSON files
        for filename in ["menu.json", "facts.json"]:
            src = os.path.join(location_dir, filename)
            if os.path.exists(src):
                shutil.copy2(src, os.path.join(real_target, filename))

        # Copy images if configured
        if target.get("include_images", False):
            for img_dir in ["images", "downloaded_images", "uploaded_images"]:
                src_dir = os.path.join(location_dir, img_dir)
                dst_dir = os.path.join(real_target, img_dir)
                if os.path.exists(src_dir):
                    if os.path.exists(dst_dir):
                        shutil.rmtree(dst_dir)
                    shutil.copytree(src_dir, dst_dir)

        # Run post_command if configured
        post_command = target.get("post_command")
        if post_command:
            import subprocess
            cmd = shlex.split(post_command) if isinstance(post_command, str) else post_command
            result = subprocess.run(cmd, shell=False, timeout=30, capture_output=True, text=True)
            if result.returncode != 0:
                logger.warning("Post-command failed: %s", result.stderr)

        logger.info("File copy deploy succeeded: %s → %s", location_id, real_target)
        return {"target": target.get("name", target_path), "status": "success"}

    except Exception as exc:
        logger.error("File copy deploy failed: %s", exc)
        return {"target": target.get("name", target_path), "status": "failed", "error": str(exc)}


def _deploy_http_post(target: dict, location_dir: str, location_id: str) -> dict:
    """POST location data to a remote import endpoint."""
    url = target.get("url", "")
    if not url:
        return {"target": target.get("name", "unknown"), "status": "failed", "error": "No URL configured"}

    try:
        menu_path = os.path.join(location_dir, "menu.json")
        facts_path = os.path.join(location_dir, "facts.json")
        menu_data = {}
        facts_data = {}
        if os.path.exists(menu_path):
            with open(menu_path) as f:
                menu_data = json.load(f)
        if os.path.exists(facts_path):
            with open(facts_path) as f:
                facts_data = json.load(f)

        headers = {"Content-Type": "application/json"}
        auth_token = target.get("auth_token")
        if auth_token:
            headers["Authorization"] = f"Bearer {auth_token}"

        payload = {"location_id": location_id, "menu": menu_data, "facts": facts_data}
        response = requests.post(url, json=payload, headers=headers, timeout=15)
        response.raise_for_status()

        logger.info("HTTP POST deploy succeeded: %s → %s", location_id, url)
        return {"target": target.get("name", url), "status": "success"}

    except Exception as exc:
        logger.error("HTTP POST deploy failed: %s", exc)
        return {"target": target.get("name", url), "status": "failed", "error": str(exc)}


def deploy_location(location: dict, location_dir: str) -> list[dict]:
    """Deploy a location's data to all its configured targets.

    Returns list of per-target result dicts.
    """
    location_id = location.get("location_id", "unknown")
    deploy_targets = location.get("deploy_targets", [])

    if not deploy_targets:
        logger.info("No deploy targets configured for location: %s", location_id)
        return []

    results = []
    for target in deploy_targets:
        target_type = target.get("type", "")
        if target_type == "file_copy":
            result = _deploy_file_copy(target, location_dir, location_id)
        elif target_type == "http_post":
            result = _deploy_http_post(target, location_dir, location_id)
        else:
            result = {"target": target.get("name", "unknown"), "status": "failed", "error": f"Unknown target type: {target_type}"}

        results.append(result)

    return results
