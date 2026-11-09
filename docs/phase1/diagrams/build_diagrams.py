"""
Automated Mermaid Diagram Compiler for Bank Management System Phase 1 SAD.
Reads existing .md source files directly and renders high-resolution PNGs via @mermaid-js/mermaid-cli.
Does NOT overwrite markdown source files.
"""

import os
import subprocess
from pathlib import Path

DIAGRAMS_DIR = Path(__file__).resolve().parent

def render_diagrams():
    diagram_configs = [
        ("component_diagram.md", "component_diagram.png"),
        ("data_model.md", "data_model_er.png"),
        ("account_status_states.md", "account_status_states.png"),
        ("fund_transfer_sequence.md", "fund_transfer_sequence.png"),
        ("fraud_detection_sequence.md", "fraud_detection_sequence.png"),
        ("login_sequence.md", "login_sequence.png"),
    ]

    for md_file, png_file in diagram_configs:
        md_path = DIAGRAMS_DIR / md_file
        if not md_path.exists():
            print(f"Skipping {md_file}: file does not exist.")
            continue

        content = md_path.read_text(encoding="utf-8")
        start = content.find("```mermaid")
        if start == -1:
            print(f"Skipping {md_file}: no ```mermaid block found.")
            continue
        start += len("```mermaid")
        end = content.find("```", start)
        if end == -1:
            print(f"Skipping {md_file}: unterminated ``` block.")
            continue

        mermaid_code = content[start:end].strip()

        temp_mmd = DIAGRAMS_DIR / f"temp_{png_file}.mmd"
        out_png = DIAGRAMS_DIR / png_file
        temp_mmd.write_text(mermaid_code, encoding="utf-8")

        print(f"Rendering {png_file} from {md_file} via mmdc...")
        cmd = ["npx", "-p", "@mermaid-js/mermaid-cli", "mmdc", "-i", str(temp_mmd), "-o", str(out_png), "-s", "2", "-b", "white"]
        res = subprocess.run(cmd, capture_output=True, text=True, shell=True)
        if res.returncode == 0:
            print(f"  Successfully rendered {png_file} ({out_png.stat().st_size:,} bytes)")
        else:
            print(f"  Failed rendering {png_file}: {res.stderr}")

        if temp_mmd.exists():
            temp_mmd.unlink()

if __name__ == "__main__":
    render_diagrams()
