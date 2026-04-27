from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from datetime import datetime
import io

# ── COLORS ────────────────────────────────────────────────
DARK = colors.HexColor("#0f1117")
ACCENT = colors.HexColor("#1a56db")
CRITICAL = colors.HexColor("#b91c1c")
HIGH = colors.HexColor("#c2410c")
MEDIUM = colors.HexColor("#92400e")
LOW = colors.HexColor("#0a7c4c")
LIGHT_GRAY = colors.HexColor("#f7f8fa")
BORDER = colors.HexColor("#e3e5ea")

def get_severity_color(severity: str):
    return {"critical": CRITICAL, "high": HIGH, "medium": MEDIUM, "low": LOW}.get(severity.lower(), DARK)

def generate_pdf_report(scan_data: dict) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=2*cm,
        leftMargin=2*cm,
        topMargin=2*cm,
        bottomMargin=2*cm
    )

    styles = getSampleStyleSheet()
    story = []

    # ── TITLE ──────────────────────────────────────────────
    title_style = ParagraphStyle(
        "Title", fontSize=24, fontName="Helvetica-Bold",
        textColor=DARK, spaceAfter=12, alignment=TA_LEFT
    )
    subtitle_style = ParagraphStyle(
        "Subtitle", fontSize=11, fontName="Helvetica",
        textColor=colors.HexColor("#4a5060"), spaceAfter=20, spaceBefore=8
    )

    story.append(Paragraph("SecureScan", title_style))
    story.append(Paragraph("Security Vulnerability Report", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER))
    story.append(Spacer(1, 0.4*cm))

    # ── SCAN INFO ──────────────────────────────────────────
    scan_type = scan_data.get("type", "SAST")
    target = scan_data.get("target", "")
    date = datetime.now().strftime("%B %d, %Y at %H:%M")
    total = scan_data.get("total", 0)

    info_data = [
        ["Scan Type", scan_type],
        ["Target", target],
        ["Date", date],
        ["Total Findings", str(total)],
    ]

    info_table = Table(info_data, colWidths=[4*cm, 13*cm])
    info_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#4a5060")),
        ("TEXTCOLOR", (1, 0), (1, -1), DARK),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
    ]))

    story.append(info_table)
    story.append(Spacer(1, 0.4*cm))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER))
    story.append(Spacer(1, 0.4*cm))

    # ── SUMMARY ────────────────────────────────────────────
    section_style = ParagraphStyle(
        "Section", fontSize=13, fontName="Helvetica-Bold",
        textColor=DARK, spaceAfter=12, spaceBefore=8
    )
    story.append(Paragraph("Summary", section_style))

    critical = scan_data.get("critical", 0)
    high = scan_data.get("high", scan_data.get("critical", 0))
    medium = scan_data.get("medium", 0)
    low = scan_data.get("low", 0)

    summary_data = [
        ["Severity", "Count", "Risk Level"],
        ["Critical", str(critical), "Immediate action required"],
        ["High", str(high), "Fix as soon as possible"],
        ["Medium", str(medium), "Fix in next release"],
        ["Low", str(low), "Fix when possible"],
    ]

    summary_table = Table(summary_data, colWidths=[4*cm, 3*cm, 10*cm])
    summary_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), ACCENT),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_GRAY]),
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("TEXTCOLOR", (0, 1), (0, 1), CRITICAL),
        ("TEXTCOLOR", (0, 2), (0, 2), HIGH),
        ("TEXTCOLOR", (0, 3), (0, 3), MEDIUM),
        ("TEXTCOLOR", (0, 4), (0, 4), LOW),
        ("FONTNAME", (0, 1), (0, -1), "Helvetica-Bold"),
    ]))

    story.append(summary_table)
    story.append(Spacer(1, 0.6*cm))

    # ── VULNERABILITIES ────────────────────────────────────
    story.append(Paragraph("Vulnerabilities", section_style))

    vuln_style = ParagraphStyle(
        "Vuln", fontSize=11, fontName="Helvetica-Bold", textColor=DARK, spaceAfter=4
    )
    detail_style = ParagraphStyle(
        "Detail", fontSize=9, fontName="Helvetica",
        textColor=colors.HexColor("#4a5060"), spaceAfter=3, leftIndent=10
    )
    fix_style = ParagraphStyle(
        "Fix", fontSize=9, fontName="Helvetica",
        textColor=LOW, spaceAfter=3, leftIndent=10
    )
    code_style = ParagraphStyle(
        "Code", fontSize=8, fontName="Courier",
        textColor=colors.HexColor("#334155"),
        backColor=LIGHT_GRAY, leftIndent=10, rightIndent=10,
        spaceAfter=6, borderPadding=6
    )

    vulnerabilities = scan_data.get("vulnerabilities", [])

    for i, vuln in enumerate(vulnerabilities, 1):
        sev = vuln.get("severity", "low")
        sev_color = get_severity_color(sev)

        story.append(Paragraph(
            f'{i}. {vuln.get("type", "Unknown")} '
            f'<font color="#{sev_color.hexval()[2:]}">[{sev.upper()}]</font>',
            vuln_style
        ))

        location = vuln.get("file", vuln.get("endpoint", ""))
        if location:
            line = vuln.get("line", "")
            loc_text = f"📍 {location}" + (f" — line {line}" if line else "")
            story.append(Paragraph(loc_text, detail_style))

        story.append(Paragraph(f"⚠ {vuln.get('description', '')}", detail_style))
        story.append(Paragraph(f"✓ Fix: {vuln.get('fix', '')}", fix_style))

        code = vuln.get("code", vuln.get("response", ""))
        if code:
            story.append(Paragraph(code.replace("\n", "<br/>"), code_style))

        story.append(Spacer(1, 0.2*cm))

        if i < len(vulnerabilities):
            story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER))
            story.append(Spacer(1, 0.2*cm))

    # ── FOOTER ─────────────────────────────────────────────
    story.append(Spacer(1, 0.6*cm))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER))
    footer_style = ParagraphStyle(
        "Footer", fontSize=8, fontName="Helvetica",
        textColor=colors.HexColor("#8a909e"), alignment=TA_CENTER, spaceBefore=8
    )
    story.append(Paragraph(
        f"Generated by SecureScan — {date} — Confidential",
        footer_style
    ))

    doc.build(story)
    buffer.seek(0)
    return buffer.read()