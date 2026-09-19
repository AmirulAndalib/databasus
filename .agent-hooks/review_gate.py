#!/usr/bin/env python3
"""Review gate shared by the Claude Code and Codex hooks.

Actions:
  snapshot   UserPromptSubmit: remember the request and the working tree it started from.
  plan-gate  Claude PreToolUse on ExitPlanMode: review the plan before the user sees it.
  claude     Claude Stop: review the finished turn.
  codex      Codex Stop: review the finished turn.

Every review runs a separate read-only Claude process. A failed review is never accepted.
"""

import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys


AUTOMATIC_REVIEW_PREFIX = "AUTOMATIC REVIEW:"
MAX_REVISIONS = 3
REVIEW_TIMEOUT_SECONDS = 540
REVIEWER_MODEL = "claude-opus-5"
REVIEWER_EFFORT = "low"
REVIEWER_ACTIVE_ENV = "AGENT_REVIEW_HOOK_ACTIVE"
EXPLICIT_PLANNING_COMMANDS = (
    "/opsx:propose",
    "/opsx:update",
    "$openspec-propose",
    "$openspec-update-change",
)


def read_payload():
    try:
        value = json.load(sys.stdin)
    except (json.JSONDecodeError, OSError):
        return {}
    return value if isinstance(value, dict) else {}


def emit(value):
    json.dump(value, sys.stdout, ensure_ascii=False)
    sys.stdout.write("\n")


def run_git(root, *args):
    return subprocess.run(
        ["git", *args],
        cwd=root,
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    ).stdout


def find_root(payload):
    cwd = Path(payload.get("cwd") or Path.cwd()).resolve()
    try:
        return Path(run_git(cwd, "rev-parse", "--show-toplevel").decode().strip())
    except (OSError, subprocess.CalledProcessError):
        return Path(__file__).resolve().parent.parent


def get_untracked_paths(root):
    try:
        output = run_git(root, "ls-files", "--others", "--exclude-standard", "-z")
    except (OSError, subprocess.CalledProcessError):
        return []
    return [path for path in output.decode(errors="replace").split("\0") if path]


def get_changed_paths(root):
    paths = set(get_untracked_paths(root))
    try:
        output = run_git(root, "diff", "--name-only", "-z", "HEAD", "--")
        paths.update(path for path in output.decode(errors="replace").split("\0") if path)
    except (OSError, subprocess.CalledProcessError):
        pass
    return sorted(paths)


def get_workspace_fingerprint(root):
    digest = hashlib.sha256()
    try:
        digest.update(run_git(root, "rev-parse", "HEAD"))
        digest.update(run_git(root, "diff", "--binary", "HEAD", "--"))
    except (OSError, subprocess.CalledProcessError):
        digest.update(run_git(root, "diff", "--binary", "--cached", "--"))
        digest.update(run_git(root, "diff", "--binary", "--"))

    for relative_path in get_untracked_paths(root):
        path = root / relative_path
        if path.is_symlink():
            digest.update(relative_path.encode())
            digest.update(os.readlink(path).encode())
            continue
        if not path.is_file():
            continue
        digest.update(relative_path.encode())
        try:
            with path.open("rb") as source:
                while chunk := source.read(1024 * 1024):
                    digest.update(chunk)
        except OSError:
            digest.update(b"unreadable")
    return digest.hexdigest()


def get_state_path(root, payload):
    session_id = re.sub(r"[^A-Za-z0-9_.-]", "_", str(payload.get("session_id") or "unknown"))
    try:
        git_dir = Path(run_git(root, "rev-parse", "--absolute-git-dir").decode().strip())
    except (OSError, subprocess.CalledProcessError):
        git_dir = root / ".git"
    return git_dir / "agent-review-hooks" / f"{session_id}.json"


def load_state(path):
    try:
        value = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError):
        return {}
    return value if isinstance(value, dict) else {}


def save_state(path, state):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(state, ensure_ascii=False))
    temporary.replace(path)


def snapshot(payload, root, state_path):
    prompt = str(payload.get("prompt") or "")
    if prompt.startswith(AUTOMATIC_REVIEW_PREFIX) and load_state(state_path):
        return
    save_state(
        state_path,
        {
            "baseline": get_workspace_fingerprint(root),
            "baseline_paths": get_changed_paths(root),
            "blocks": 0,
            "plan_blocks": 0,
            "is_accepted": False,
            "prompt": prompt,
        },
    )


def is_planning_request(prompt):
    lowered = prompt.lower()
    return any(command in lowered for command in EXPLICIT_PLANNING_COMMANDS)


def get_stop_review_mode(payload, state, paths):
    if payload.get("permission_mode") == "plan":
        return "planning"

    if is_planning_request(str(state.get("prompt") or "")):
        return "planning"

    new_paths = set(paths) - set(state.get("baseline_paths") or [])
    if new_paths and all(path.startswith("openspec/") for path in new_paths):
        return "planning"
    return "implementation"


def build_review_prompt(root, state, mode, candidate, paths):
    instructions = (Path(__file__).parent / "review-prompt.md").read_text()
    original_prompt = str(state.get("prompt") or "(not captured)")
    path_list = "\n".join(f"- {path}" for path in paths) or "- none"
    baseline_path_list = "\n".join(f"- {path}" for path in state.get("baseline_paths") or []) or "- none"
    return f"""{instructions}

Review mode: {mode}
Repository root: {root}

Latest user request:
<user_request>
{original_prompt}
</user_request>

Candidate:
<candidate>
{candidate}
</candidate>

Paths that already had changes before this request:
{baseline_path_list}

Currently changed paths:
{path_list}
"""


def parse_review_result(text):
    value = json.loads(text)
    if isinstance(value, dict) and isinstance(value.get("structured_output"), dict):
        value = value["structured_output"]
    if not isinstance(value, dict):
        raise ValueError("reviewer returned a non-object result")
    if not isinstance(value.get("ok"), bool) or not isinstance(value.get("reason"), str):
        raise ValueError("reviewer result does not match the required schema")
    return value


def run_reviewer(root, prompt):
    schema = (Path(__file__).parent / "review-result.schema.json").read_text()
    command = [
        "claude",
        "--print",
        "--model",
        REVIEWER_MODEL,
        "--effort",
        REVIEWER_EFFORT,
        "--permission-mode",
        "plan",
        # The reviewer loads this repository's hooks too; its own stop must never be gated.
        "--settings",
        '{"disableAllHooks": true}',
        "--tools",
        "Read,Glob,Grep,Bash",
        "--allowed-tools",
        "Read,Glob,Grep,Bash(git status *),Bash(git diff *),Bash(git log *),Bash(git show *),Bash(git ls-files *),Bash(git rev-parse *)",
        "--max-turns",
        "30",
        "--no-session-persistence",
        "--prompt-suggestions",
        "false",
        "--output-format",
        "json",
        "--json-schema",
        schema,
    ]
    environment = os.environ.copy()
    environment[REVIEWER_ACTIVE_ENV] = "1"
    environment.pop("CLAUDECODE", None)
    environment.pop("CLAUDE_CODE_SESSION_ID", None)
    environment.pop("CODEX_SESSION_ID", None)
    environment.pop("CODEX_THREAD_ID", None)
    process = subprocess.run(
        command,
        cwd=root,
        input=prompt,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=environment,
        timeout=REVIEW_TIMEOUT_SECONDS,
    )
    if process.returncode != 0:
        raise RuntimeError(process.stderr.strip() or process.stdout.strip() or f"claude exited with {process.returncode}")
    return parse_review_result(process.stdout)


def review(root, prompt):
    """Returns (is_accepted, reason). A reviewer that could not run never accepts."""
    try:
        result = run_reviewer(root, prompt)
    except (OSError, ValueError, RuntimeError, subprocess.TimeoutExpired) as error:
        message = str(error).strip()[-1200:] or "unknown reviewer error"
        return False, f"The automatic reviewer could not run: {message}"

    if result["ok"]:
        return True, ""
    return False, result["reason"].strip() or "The reviewer rejected the result without a reason."


def read_plan(tool_input):
    plan = str(tool_input.get("plan") or "").strip()
    if plan:
        return plan
    try:
        return Path(str(tool_input.get("planFilePath") or "")).read_text().strip()
    except OSError:
        return ""


def gate_plan(payload, root, state_path):
    state = load_state(state_path)
    plan = read_plan(payload.get("tool_input") or {})
    if plan:
        prompt = build_review_prompt(root, state, "plan", plan, get_changed_paths(root))
        is_accepted, reason = review(root, prompt)
    else:
        is_accepted, reason = False, "ExitPlanMode carried no plan text, so the plan could not be reviewed."

    if is_accepted:
        state["plan_blocks"] = 0
        save_state(state_path, state)
        emit({})
        return

    plan_blocks = int(state.get("plan_blocks") or 0) + 1
    state["plan_blocks"] = plan_blocks
    save_state(state_path, state)
    if plan_blocks > MAX_REVISIONS:
        emit(
            {
                "continue": False,
                "stopReason": f"Automatic plan review still fails after {MAX_REVISIONS} revisions: {reason}",
                "systemMessage": "Automatic plan review reached its revision limit. The plan was not accepted.",
            }
        )
        return
    emit(
        {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny",
                "permissionDecisionReason": f"{AUTOMATIC_REVIEW_PREFIX}\n{reason}\nRevise the plan and call ExitPlanMode again.",
            }
        }
    )


def is_stop_review_needed(payload, state, fingerprint):
    if int(state.get("blocks") or 0) > 0:
        return True

    is_workspace_changed = state.get("baseline") != fingerprint
    # Another Stop hook can resume the turn; an accepted result it did not change needs no second review.
    if state.get("is_accepted") and not is_workspace_changed:
        return False
    # In plan mode the plan reaches the user through ExitPlanMode, which the plan gate reviews.
    if payload.get("permission_mode") == "plan":
        return is_workspace_changed
    return is_workspace_changed or is_planning_request(str(state.get("prompt") or ""))


def gate_stop(client, payload, root, state_path):
    state = load_state(state_path)
    fingerprint = get_workspace_fingerprint(root)
    if not is_stop_review_needed(payload, state, fingerprint):
        emit({})
        return

    paths = get_changed_paths(root)
    mode = get_stop_review_mode(payload, state, paths)
    candidate = str(payload.get("last_assistant_message") or "(not available)")
    prompt = build_review_prompt(root, state, mode, candidate, paths)
    is_accepted, reason = review(root, prompt)

    if is_accepted:
        state.update({"baseline": fingerprint, "blocks": 0, "is_accepted": True})
        save_state(state_path, state)
        emit({})
        return

    blocks = int(state.get("blocks") or 0) + 1
    state["blocks"] = blocks
    save_state(state_path, state)
    if blocks > MAX_REVISIONS:
        emit(
            {
                "continue": False,
                "stopReason": f"Automatic {client} review still fails after {MAX_REVISIONS} revisions: {reason}",
                "systemMessage": "Automatic review reached its revision limit. The result was not accepted.",
            }
        )
        return
    emit(
        {
            "decision": "block",
            "reason": f"{AUTOMATIC_REVIEW_PREFIX}\n{reason}\nFix the result, update OpenSpec when requested, and finish with another review.",
        }
    )


def main():
    payload = read_payload()
    if os.environ.get(REVIEWER_ACTIVE_ENV) == "1":
        emit({})
        return

    root = find_root(payload)
    state_path = get_state_path(root, payload)
    action = sys.argv[1] if len(sys.argv) > 1 else ""
    if action == "snapshot":
        snapshot(payload, root, state_path)
        return
    if action == "plan-gate":
        gate_plan(payload, root, state_path)
        return
    if action in {"claude", "codex"}:
        gate_stop(action, payload, root, state_path)
        return
    emit({"continue": False, "stopReason": f"Unknown review hook action: {action}"})


if __name__ == "__main__":
    main()
