#!/usr/bin/env python3
"""Resynchronise brand/<marque>/ from the four product repositories.

The script is idempotent. It rewrites a brand.json only when the source
commit, the extracted CSS variables, the watched branch tips, or an asset
hash actually changes. Positioning copy, voice and studio defaults stay.

Public repositories clone without credentials. Private ones need the
environment variable BRAND_REPOS_TOKEN (see brand/SYNC.md). The token is
never printed.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BRAND_DIR = ROOT / "brand"
TOKEN = os.environ.get("BRAND_REPOS_TOKEN", "").strip()
UA = "proplace-brand-sync"

REPOS = {
    "proplace": {
        "repo": "proplace-co/proplace-co.github.io",
        "public_site": "https://proplace.co/",
        "files": ["index.html", "logo.png", "favicon.png", "CNAME"],
        "assets": [("logo.png", "logo.png"), ("favicon.png", "favicon.png")],
    },
    "maximum": {
        "repo": "proplace-co/maximum-insurance",
        # Le site v6 n'est pas encore dans git. Cette branche porte les commits
        # v6 de l'app. Dès que assets/site/ y est commité, les jetons --mx-*
        # remplacent le snapshot du build local du 2026-11-08.
        "branch": "sauvegarde/auto/maximum-insurance-main/branches/feature/mi-design",
        "css_prefix": "--mx-",
        "public_site": "https://maximum-insurance.com/",
    },
    "profund": {
        "repo": "proplace-co/profund-vc",
        "public_site": "https://profund.vc/",
        "files": ["src/index.css", "public/logo.png", "public/favicon.png", "tailwind.config.ts"],
        "assets": [("public/logo.png", "logo.png"), ("public/favicon.png", "favicon.png")],
    },
    "sosuites": {
        "repo": "proplace-co/sosuites",
        "public_site": "https://www.sosuites.com/",
        "public_assets": [
            ("https://www.sosuites.com/public/v3/logo.webp", "logo.webp"),
            ("https://www.sosuites.com/public/v3/icon-32.png", "icon-32.png"),
            ("https://www.sosuites.com/public/v3/icon-180.png", "icon-180.png"),
            ("https://www.sosuites.com/public/v3/og-home.png", "og-home.png"),
        ],
    },
}

VAR_RE = re.compile(r"(--[A-Za-z0-9_-]+)\s*:\s*([^;{}]+)")


def redact(text: str) -> str:
    if TOKEN and TOKEN in text:
        return text.replace(TOKEN, "***")
    return text


def run(cmd, cwd=None):
    env = os.environ.copy()
    env["GIT_TERMINAL_PROMPT"] = "0"
    proc = subprocess.run(cmd, cwd=cwd, env=env, text=True, capture_output=True)
    if proc.returncode != 0:
        raise RuntimeError(redact(proc.stderr.strip() or proc.stdout.strip() or "git failed"))
    return proc.stdout


def auth_url(repo: str) -> str:
    if TOKEN:
        return f"https://x-access-token:{TOKEN}@github.com/{repo}.git"
    return f"https://github.com/{repo}.git"


def http_get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=45) as res:
        return res.read()


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def keep_value(value: str) -> bool:
    v = " ".join(value.split())
    if not v or len(v) > 220:
        return False
    if any(tok in v for tok in ("hover", "function", "var(--", "{", "}")):
        return False
    return True


def extract_vars(text: str, prefix: str | None = None) -> dict:
    found = {}
    for name, raw in VAR_RE.findall(text):
        if prefix and not name.startswith(prefix):
            continue
        value = " ".join(raw.split())
        if keep_value(value):
            found[name] = value
    return dict(sorted(found.items()))


def remote_heads(repo: str) -> tuple[str, dict]:
    """Return (default branch, {branch: sha})."""
    out = run(["git", "ls-remote", "--symref", auth_url(repo), "HEAD", "refs/heads/*"])
    default = "main"
    heads = {}
    for line in out.splitlines():
        if line.startswith("ref:"):
            ref = line.split()[1]
            if ref.startswith("refs/heads/"):
                default = ref.split("/", 2)[-1]
            continue
        sha, ref = line.split()
        if ref.startswith("refs/heads/"):
            heads[ref[len("refs/heads/"):]] = sha
    return default, heads


def choose_branch(spec: dict, default: str, heads: dict) -> str:
    pinned = spec.get("branch")
    if pinned:
        return pinned
    prefer = spec.get("prefer")
    if not prefer:
        return default if default in heads or not heads else next(iter(heads))
    matches = [name for name in heads if prefer.search(name)]
    if not matches:
        return default
    # One fetch per candidate, depth 1, newest committer date wins.
    best_name, best_date = matches[0], ""
    for name in matches:
        with tempfile.TemporaryDirectory() as tmp:
            dest = Path(tmp) / "repo"
            try:
                run(["git", "clone", "--depth", "1", "--branch", name, auth_url(spec["repo"]), str(dest)])
                date = run(["git", "log", "-1", "--format=%cI"], cwd=dest).strip()
            except RuntimeError:
                continue
        if date >= best_date:
            best_name, best_date = name, date
    return best_name


def clone_repo(repo: str, branch: str, files: list[str] | None, dest: Path) -> str:
    if dest.exists():
        shutil.rmtree(dest)
    if files:
        run(["git", "clone", "--depth", "1", "--filter=blob:none", "--sparse", "--branch", branch, auth_url(repo), str(dest)])
        run(["git", "sparse-checkout", "set", "--no-cone", *files], cwd=dest)
    else:
        run(["git", "clone", "--depth", "1", "--branch", branch, auth_url(repo), str(dest)])
    return run(["git", "rev-parse", "HEAD"], cwd=dest).strip()


def read_tree_text(dest: Path) -> str:
    chunks = []
    for path in dest.rglob("*"):
        if not path.is_file():
            continue
        if any(part in {".git", "node_modules", "dist", "build"} for part in path.parts):
            continue
        if path.suffix.lower() not in {".css", ".scss", ".html", ".py", ".js", ".tsx", ".ts"}:
            continue
        if path.stat().st_size > 1_200_000:
            continue
        chunks.append(path.read_text(errors="ignore"))
    return "\n".join(chunks)


def write_if_changed(path: Path, data: bytes) -> bool:
    if path.exists() and sha256(path.read_bytes()) == sha256(data):
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return True


def load_brand(brand_id: str) -> dict:
    return json.loads((BRAND_DIR / brand_id / "brand.json").read_text())


def save_brand(brand_id: str, data: dict) -> None:
    path = BRAND_DIR / brand_id / "brand.json"
    text = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    if path.read_text() == text:
        return
    path.write_text(text)


def proplace_css(repo_dir: Path) -> str:
    html = (repo_dir / "index.html").read_text(errors="ignore")
    match = re.search(r'href="(/assets/index-[^"]+\.css)"', html)
    if not match:
        return ""
    rel = match.group(1).lstrip("/")
    run(["git", "sparse-checkout", "add", "--no-cone", rel], cwd=repo_dir)
    css_path = repo_dir / rel
    if not css_path.exists():
        return ""
    return css_path.read_text(errors="ignore")


def sync_one(brand_id: str, work: Path) -> str:
    spec = REPOS[brand_id]
    brand = load_brand(brand_id)
    folder = BRAND_DIR / brand_id
    notes = []
    commit = None
    branch = spec.get("branch")
    heads = {}
    css = {}
    asset_hashes = {}
    changed_assets = []

    try:
        default, heads = remote_heads(spec["repo"])
        branch = choose_branch(spec, default, heads)
        dest = work / brand_id
        commit = clone_repo(spec["repo"], branch, spec.get("files"), dest)
        if brand_id == "proplace":
            css = extract_vars(proplace_css(dest), "--pp-")
        elif brand_id == "profund":
            css = extract_vars((dest / "src/index.css").read_text(errors="ignore"))
        else:
            css = extract_vars(read_tree_text(dest), spec.get("css_prefix"))
        for src_rel, dest_name in spec.get("assets") or []:
            src = dest / src_rel
            if not src.exists():
                notes.append(f"asset manquant dans le repo : {src_rel}")
                continue
            data = src.read_bytes()
            if write_if_changed(folder / dest_name, data):
                changed_assets.append(dest_name)
            asset_hashes[dest_name] = sha256(data)
        access = "repo"
    except RuntimeError as exc:
        access = "unavailable"
        notes.append(f"repo {spec['repo']} illisible : {exc}")
        heads = {}

    if spec.get("css_prefix") and not css:
        kept = (brand.get("sync") or {}).get("cssVariables") or {}
        css = {k: v for k, v in kept.items() if str(k).startswith(spec["css_prefix"])}
        notes.append(
            "Jetons "
            + spec["css_prefix"]
            + "* conservés. Le build du site (assets/site/) n'est pas sur la branche : "
            + "le committer pour que la synchro le suive. Le site public n'est pas repris comme source."
        )
    elif spec.get("public_site") and (access != "repo" or not css):
        try:
            html = http_get(spec["public_site"]).decode("utf-8", "ignore")
            site_vars = extract_vars(html)
            if site_vars:
                css = site_vars
            notes.append(f"repli site public {spec['public_site']}")
        except Exception as exc:  # noqa: BLE001 — network failures stay in the manifest note
            notes.append(f"site public illisible : {exc}")
        for url, dest_name in spec.get("public_assets") or []:
            try:
                data = http_get(url)
            except Exception as exc:  # noqa: BLE001
                notes.append(f"asset public manquant {dest_name} : {exc}")
                continue
            if write_if_changed(folder / dest_name, data):
                changed_assets.append(dest_name)
            asset_hashes[dest_name] = sha256(data)

    # Hashes of files we did not refresh, so the manifest still names them.
    for path in sorted(folder.iterdir()):
        if path.is_file() and path.name != "brand.json" and path.name not in asset_hashes:
            asset_hashes[path.name] = sha256(path.read_bytes())

    other = {name: sha for name, sha in sorted(heads.items()) if name != branch}
    sync = {
        "access": access,
        "repo": spec["repo"],
        "branch": branch,
        "commit": commit,
        "otherBranches": other,
        "cssVariables": css,
        "assets": dict(sorted(asset_hashes.items())),
        "notes": notes,
    }
    source = brand.setdefault("source", {})
    if commit:
        source["commit"] = commit
        source["branch"] = branch
        source["access"] = "repo"
    elif access == "unavailable":
        source["access"] = "unavailable"
    previous = brand.get("sync")
    brand["sync"] = sync
    if previous != sync:
        save_brand(brand_id, brand)
        return f"{brand_id}: mis à jour ({access}, {len(css)} variables, assets {changed_assets or 'inchangés'})"
    return f"{brand_id}: inchangé ({access})"


def main() -> int:
    work = Path(tempfile.mkdtemp(prefix="brand-sync-"))
    try:
        reports = [sync_one(brand_id, work) for brand_id in REPOS]
    finally:
        shutil.rmtree(work, ignore_errors=True)
    print("\n".join(reports))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:  # noqa: BLE001
        print(redact(str(exc)), file=sys.stderr)
        sys.exit(1)
