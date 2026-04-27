import subprocess
import json
import os
import zipfile
import tempfile

# ── BANDIT (Python only) ───────────────────────────────────
def run_bandit_scan(file_path: str) -> list:
    result = subprocess.run(
        ["bandit", "-r", file_path, "-f", "json", "-q"],
        capture_output=True,
        text=True
    )

    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError:
        return []

    vulnerabilities = []
    for issue in data.get("results", []):
        vulnerabilities.append({
            "type": issue.get("test_name", "Unknown"),
            "severity": issue.get("issue_severity", "LOW").lower(),
            "file": issue.get("filename", ""),
            "line": issue.get("line_number", 0),
            "description": issue.get("issue_text", ""),
            "fix": get_bandit_fix(issue.get("test_id", "")),
            "code": issue.get("code", "").strip()
        })

    return vulnerabilities


# ── SEMGREP (multi-language) ───────────────────────────────
def run_semgrep_scan(file_path: str) -> list:
    import shutil
    if not shutil.which("semgrep"):
        print("⚠️  Semgrep not found in PATH — skipping non-Python files")
        return []

    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONUTF8"] = "1"

    result = subprocess.run(
        ["semgrep", "--config", "auto", file_path, "--json", "--quiet"],
        capture_output=True,
        text=True,
        env=env,
        encoding="utf-8",
        errors="ignore"
    )

    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError:
        return []

    vulnerabilities = []
    for issue in data.get("results", []):
        severity = issue.get("extra", {}).get("severity", "WARNING").lower()
        if severity == "warning":
            severity = "medium"
        elif severity == "error":
            severity = "high"
        elif severity == "info":
            severity = "low"

        vulnerabilities.append({
            "type": issue.get("check_id", "Unknown").split(".")[-1].replace("-", " ").title(),
            "severity": severity,
            "file": issue.get("path", ""),
            "line": issue.get("start", {}).get("line", 0),
            "description": issue.get("extra", {}).get("message", ""),
            "fix": issue.get("extra", {}).get("fix", "Review this finding and follow security best practices."),
            "code": issue.get("extra", {}).get("lines", "").strip()
        })

    return vulnerabilities


# ── SMART SCAN (picks the right tool) ─────────────────────
PYTHON_EXTENSIONS = {".py"}
SEMGREP_EXTENSIONS = {".js", ".jsx", ".ts", ".tsx", ".java", ".php", ".go", ".rb", ".c", ".cpp"}

def run_scan(file_path: str) -> dict:
    """Detect language and run the right scanner"""
    
    # If it's a folder, check what languages are inside
    if os.path.isdir(file_path):
        extensions = set()
        for root, dirs, files in os.walk(file_path):
            for f in files:
                ext = os.path.splitext(f)[1].lower()
                extensions.add(ext)

        has_python = bool(extensions & PYTHON_EXTENSIONS)
        has_other = bool(extensions & SEMGREP_EXTENSIONS)

        vulns = []
        languages = []

        if has_python:
            vulns += run_bandit_scan(file_path)
            languages.append("Python")
        if has_other or not has_python:
            vulns += run_semgrep_scan(file_path)
            detected = extensions & SEMGREP_EXTENSIONS
            languages += [ext.replace(".", "").upper() for ext in detected]

        return {"vulnerabilities": vulns, "languages": list(set(languages))}

    # Single file
    ext = os.path.splitext(file_path)[1].lower()
    if ext in PYTHON_EXTENSIONS:
        return {
            "vulnerabilities": run_bandit_scan(file_path),
            "languages": ["Python"]
        }
    else:
        return {
            "vulnerabilities": run_semgrep_scan(file_path),
            "languages": [ext.replace(".", "").upper()]
        }


# ── HELPERS ────────────────────────────────────────────────
def extract_zip(zip_path: str, extract_to: str):
    import zipfile
    extract_path = Path(extract_to).resolve()
    with zipfile.ZipFile(zip_path, 'r') as z:
        for member in z.namelist():
            member_path = (extract_path / member).resolve()
            if not str(member_path).startswith(str(extract_path)):
                raise ValueError(f"Zip-slip attack detected: {member}")
        z.extractall(extract_path)


def get_bandit_fix(test_id: str) -> str:
    fixes = {
        "B101": "Avoid using assert statements in production code.",
        "B102": "Avoid using exec(), it can execute arbitrary code.",
        "B103": "Ensure file permissions are set securely.",
        "B104": "Binding to 0.0.0.0 exposes the service on all interfaces.",
        "B105": "Avoid hardcoded passwords in source code.",
        "B106": "Avoid hardcoded passwords in function arguments.",
        "B107": "Avoid hardcoded passwords in function defaults.",
        "B108": "Use a secure temp file location.",
        "B110": "Avoid bare except clauses, handle exceptions explicitly.",
        "B201": "Flask debug mode exposes sensitive information.",
        "B301": "Avoid using pickle, use JSON instead.",
        "B303": "Use hashlib.sha256 or stronger instead of MD5/SHA1.",
        "B304": "Use a secure cipher mode like AES-GCM.",
        "B307": "Avoid using eval(), it can execute arbitrary code.",
        "B311": "Use secrets module instead of random for security tokens.",
        "B324": "MD5 and SHA1 are not secure for cryptographic use.",
        "B404": "Be careful when using subprocess, validate all inputs.",
        "B501": "Do not disable SSL certificate verification.",
        "B601": "Avoid shell injection by not using shell=True.",
        "B602": "Avoid shell injection by not using shell=True.",
        "B608": "Use parameterized queries to prevent SQL injection.",
        "B703": "Avoid using django.utils.safestring with user input.",
    }
    return fixes.get(test_id, "Review this code and follow security best practices.")