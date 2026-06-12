from pathlib import Path
import html
import re

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
    Preformatted,
)


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs" / "EVALUATION_REPORT.md"
OUTPUT = ROOT / "docs" / "EVALUATION_REPORT.pdf"


def inline_markup(text: str) -> str:
    escaped = html.escape(text.strip())
    escaped = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", escaped)
    escaped = re.sub(r"`(.+?)`", r"<font name='Courier'>\1</font>", escaped)
    return escaped


def make_styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "ReportTitle",
            parent=base["Title"],
            fontName="Helvetica-Bold",
            fontSize=22,
            leading=28,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#102A43"),
            spaceAfter=18,
        ),
        "h1": ParagraphStyle(
            "Heading1Custom",
            parent=base["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=16,
            leading=20,
            textColor=colors.HexColor("#126B5F"),
            spaceBefore=12,
            spaceAfter=8,
        ),
        "h2": ParagraphStyle(
            "Heading2Custom",
            parent=base["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=13,
            leading=17,
            textColor=colors.HexColor("#1D4ED8"),
            spaceBefore=8,
            spaceAfter=6,
        ),
        "body": ParagraphStyle(
            "BodyCustom",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=10,
            leading=14,
            textColor=colors.HexColor("#17202A"),
            spaceAfter=7,
        ),
        "bullet": ParagraphStyle(
            "BulletCustom",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=10,
            leading=14,
            leftIndent=16,
            firstLineIndent=-10,
            spaceAfter=4,
        ),
        "code": ParagraphStyle(
            "CodeCustom",
            parent=base["Code"],
            fontName="Courier",
            fontSize=8.5,
            leading=11,
            textColor=colors.HexColor("#0F172A"),
        ),
    }


def add_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#667085"))
    canvas.drawString(inch * 0.7, 0.45 * inch, "CS406.3 Evaluation Report - Smart Employment Gateway")
    canvas.drawRightString(A4[0] - inch * 0.7, 0.45 * inch, f"Page {doc.page}")
    canvas.restoreState()


def table_from_lines(lines, styles):
    rows = []
    for line in lines:
        parts = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if all(set(part) <= {"-", ":", " "} for part in parts):
            continue
        rows.append([Paragraph(inline_markup(part), styles["body"]) for part in parts])

    table = Table(rows, repeatRows=1, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#102A43")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#CBD5E1")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
            ]
        )
    )
    return table


def build_story(markdown: str):
    styles = make_styles()
    story = []
    lines = markdown.splitlines()
    i = 0

    while i < len(lines):
        line = lines[i].rstrip()

        if not line:
            i += 1
            continue

        if line.startswith("# "):
            story.append(Paragraph(inline_markup(line[2:]), styles["title"]))
            story.append(Spacer(1, 8))
        elif line.startswith("## "):
            story.append(Paragraph(inline_markup(line[3:]), styles["h1"]))
        elif line.startswith("### "):
            story.append(Paragraph(inline_markup(line[4:]), styles["h2"]))
        elif line.startswith("```"):
            code_lines = []
            i += 1
            while i < len(lines) and not lines[i].startswith("```"):
                code_lines.append(lines[i])
                i += 1
            story.append(Preformatted("\n".join(code_lines), styles["code"]))
            story.append(Spacer(1, 8))
        elif line.startswith("|"):
            table_lines = [line]
            i += 1
            while i < len(lines) and lines[i].startswith("|"):
                table_lines.append(lines[i].rstrip())
                i += 1
            story.append(table_from_lines(table_lines, styles))
            story.append(Spacer(1, 10))
            continue
        elif line.startswith("- "):
            story.append(Paragraph(f"• {inline_markup(line[2:])}", styles["bullet"]))
        elif re.match(r"^\d+\.\s+", line):
            story.append(Paragraph(inline_markup(line), styles["bullet"]))
        else:
            paragraph = [line]
            i += 1
            while i < len(lines) and lines[i].strip() and not re.match(r"^(#|```|\||- |\d+\.\s+)", lines[i]):
                paragraph.append(lines[i].strip())
                i += 1
            story.append(Paragraph(inline_markup(" ".join(paragraph)), styles["body"]))
            continue

        i += 1

    story.append(PageBreak())
    story.append(Paragraph("Appendix: Files Used", styles["h1"]))
    story.append(Paragraph("Source report: docs/EVALUATION_REPORT.md", styles["body"]))
    story.append(Paragraph("Generated PDF: docs/EVALUATION_REPORT.pdf", styles["body"]))
    return story


def main():
    doc = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        rightMargin=0.7 * inch,
        leftMargin=0.7 * inch,
        topMargin=0.72 * inch,
        bottomMargin=0.72 * inch,
        title="CS406.3 Evaluation Report",
        author="CS406.3 Student",
    )
    story = build_story(SOURCE.read_text(encoding="utf-8"))
    doc.build(story, onFirstPage=add_footer, onLaterPages=add_footer)
    print(OUTPUT)


if __name__ == "__main__":
    main()
