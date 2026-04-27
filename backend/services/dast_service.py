import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
import logging

logger = logging.getLogger(__name__)

# Disable SSL warnings
requests.packages.urllib3.disable_warnings(
    requests.packages.urllib3.exceptions.InsecureRequestWarning
)

HEADERS = {
    "User-Agent": "SecureScan Security Scanner"
}

# ── 1. CRAWL ──────────────────────────────────────────────
def crawl(base_url: str, max_pages: int = 10) -> list:
    """Find all links on the target website"""
    visited = set()
    to_visit = [base_url]
    found = []

    while to_visit and len(visited) < max_pages:
        url = to_visit.pop(0)
        if url in visited:
            continue
        try:
            res = requests.get(url, headers=HEADERS, timeout=5, verify=False)
            visited.add(url)
            found.append(url)
            soup = BeautifulSoup(res.text, "html.parser")
            for tag in soup.find_all("a", href=True):
                link = urljoin(base_url, tag["href"])
                if urlparse(link).netloc == urlparse(base_url).netloc:
                    if link not in visited:
                        to_visit.append(link)
        except Exception as e:
            logger.debug(f"Crawl failed for {url}: {e}")
            continue

    return found

# ── 2. COLLECT FORMS ──────────────────────────────────────
def get_forms(url: str) -> list:
    """Extract all forms from a page"""
    try:
        res = requests.get(url, headers=HEADERS, timeout=5, verify=False)
        soup = BeautifulSoup(res.text, "html.parser")
        return soup.find_all("form")
    except Exception as e:
        logger.debug(f"Failed to get forms from {url}: {e}")
        return []

def get_form_details(form) -> dict:
    """Extract details from a form"""
    details = {"action": form.attrs.get("action", ""), "method": form.attrs.get("method", "get").lower(), "inputs": []}
    for tag in form.find_all(["input", "textarea"]):
        details["inputs"].append({
            "name": tag.attrs.get("name", ""),
            "type": tag.attrs.get("type", "text"),
            "value": tag.attrs.get("value", "test")
        })
    return details

# ── 3. SECURITY TESTS ─────────────────────────────────────
def test_xss(url: str, form, form_details: dict) -> dict | None:
    """Test a form for XSS vulnerability"""
    payload = '<script>alert("XSS")</script>'
    data = {}
    for inp in form_details["inputs"]:
        data[inp["name"]] = payload if inp["type"] != "hidden" else inp["value"]

    try:
        target = urljoin(url, form_details["action"])
        if form_details["method"] == "post":
            res = requests.post(target, data=data, headers=HEADERS, timeout=5, verify=False)
        else:
            res = requests.get(target, params=data, headers=HEADERS, timeout=5, verify=False)

        if payload in res.text:
            return {
                "type": "Cross-Site Scripting (XSS)",
                "severity": "high",
                "endpoint": f"{form_details['method'].upper()} {target}",
                "description": "The form reflects user input directly without encoding — XSS payload was found in the response.",
                "fix": "Encode all output using context-appropriate escaping. Use a library like DOMPurify on the frontend.",
                "response": f"Payload reflected in response — {res.status_code}"
            }
    except Exception as e:
        logger.debug(f"XSS test failed for {target}: {e}")
    return None

def test_sql_injection(url: str, form, form_details: dict) -> dict | None:
    """Test a form for SQL injection"""
    payload = "' OR '1'='1"
    data = {}
    for inp in form_details["inputs"]:
        data[inp["name"]] = payload if inp["type"] != "hidden" else inp["value"]

    try:
        target = urljoin(url, form_details["action"])
        if form_details["method"] == "post":
            res = requests.post(target, data=data, headers=HEADERS, timeout=5, verify=False)
        else:
            res = requests.get(target, params=data, headers=HEADERS, timeout=5, verify=False)

        errors = ["sql", "mysql", "syntax error", "ora-", "postgresql", "sqlite"]
        for error in errors:
            if error in res.text.lower():
                return {
                    "type": "SQL Injection",
                    "severity": "critical",
                    "endpoint": f"{form_details['method'].upper()} {target}",
                    "description": "SQL error detected in response — the form may be vulnerable to SQL injection.",
                    "fix": "Use parameterized queries or prepared statements. Never concatenate user input into SQL queries.",
                    "response": f"SQL error found in response — {res.status_code}"
                }
    except Exception as e:
        logger.debug(f"SQLi test failed for {target}: {e}")
    return None

def check_security_headers(url: str) -> list:
    """Check if important security headers are missing"""
    vulnerabilities = []
    try:
        res = requests.get(url, headers=HEADERS, timeout=5, verify=False)
        headers = res.headers

        checks = [
            ("Content-Security-Policy", "Missing Content-Security-Policy header", "Add a Content-Security-Policy header to prevent XSS attacks."),
            ("X-Frame-Options", "Missing X-Frame-Options header", "Add X-Frame-Options: DENY to prevent clickjacking attacks."),
            ("X-Content-Type-Options", "Missing X-Content-Type-Options header", "Add X-Content-Type-Options: nosniff to prevent MIME sniffing."),
            ("Strict-Transport-Security", "Missing HSTS header", "Add Strict-Transport-Security header to enforce HTTPS."),
        ]

        for header, description, fix in checks:
            if header not in headers:
                vulnerabilities.append({
                    "type": f"Missing Security Header: {header}",
                    "severity": "medium",
                    "endpoint": url,
                    "description": description,
                    "fix": fix,
                    "response": f"Header '{header}' not found in server response"
                })
    except Exception as e:
        logger.debug(f"Security header check failed for {url}: {e}")
    return vulnerabilities

# ── 4. MAIN SCAN FUNCTION ─────────────────────────────────
def run_dast_scan(target_url: str) -> list:
    """Run full DAST scan on a target URL"""
    vulnerabilities = []
    seen = set()  # track duplicates

    # Step 1 - Check security headers
    vulnerabilities.extend(check_security_headers(target_url))

    # Step 2 - Crawl the site
    pages = crawl(target_url)

    # Step 3 - Test each page's forms
    for page_url in pages:
        forms = get_forms(page_url)
        for form in forms:
            details = get_form_details(form)
            target = urljoin(page_url, details["action"])

            xss = test_xss(page_url, form, details)
            if xss:
                key = f"xss-{target}"
                if key not in seen:
                    seen.add(key)
                    vulnerabilities.append(xss)

            sqli = test_sql_injection(page_url, form, details)
            if sqli:
                key = f"sqli-{target}"
                if key not in seen:
                    seen.add(key)
                    vulnerabilities.append(sqli)

    return vulnerabilities