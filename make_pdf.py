import subprocess
from pathlib import Path
import markdown_it

BASE = Path(__file__).parent
md_path = BASE / "ACCESSIBILITY_REPORT.md"
html_path = BASE / "temp_report.html"
pdf_path = BASE / "ACCESSIBILITY_REPORT.pdf"

md = markdown_it.MarkdownIt()
html_body = md.render(md_path.read_text(encoding="utf-8"))

full_html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>ApexAuto Accessibility Statement & Evaluation Report</title>
<style>
body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 850px; margin: 40px auto; padding: 0 20px; }}
h1 {{ color: #0f172a; border-bottom: 2px solid #0284c7; padding-bottom: 8px; }}
h2 {{ color: #0f172a; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-top: 30px; }}
h3 {{ color: #1e293b; }}
table {{ width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 0.9em; }}
th, td {{ border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; vertical-align: top; }}
th {{ background-color: #f1f5f9; font-weight: bold; color: #0f172a; }}
tr:nth-child(even) {{ background-color: #f8fafc; }}
code, pre {{ font-family: monospace; background-color: #f1f5f9; padding: 2px 4px; border-radius: 4px; }}
kbd {{ background-color: #e2e8f0; border: 1px solid #94a3b8; border-radius: 3px; padding: 1px 4px; font-family: monospace; font-size: 0.85em; }}
a {{ color: #0284c7; text-decoration: none; }}
a:hover {{ text-decoration: underline; }}
hr {{ border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0; }}
</style>
</head>
<body>
{html_body}
</body>
</html>"""

html_path.write_text(full_html, encoding="utf-8")
edge_path = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
cmd = [edge_path, "--headless", "--disable-gpu", f"--print-to-pdf={pdf_path}", str(html_path)]
subprocess.run(cmd, check=True)
html_path.unlink()
print("Successfully generated ACCESSIBILITY_REPORT.pdf!")
