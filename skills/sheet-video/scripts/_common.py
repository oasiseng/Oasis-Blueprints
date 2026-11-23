# Oasis-Blueprints · https://github.com/oasiseng/Oasis-Blueprints · MIT License, Copyright (c) 2026 Oasis Engineering, LLC
"""Shared helpers for the sheet-video scripts: where things live, the browser, the brand file."""
import json, os, shutil, sys
from pathlib import Path

SKILL = Path(__file__).resolve().parents[1]
ASSETS = SKILL / "assets"
# One folder per user for things that outlive a project: the voice model and the saved brand.
HOME = Path(os.environ.get("SHEET_VIDEO_HOME", Path.home() / ".sheet-video"))
MODELS = HOME / "models"
KOKORO_URL = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/"
KOKORO_FILES = ("kokoro-v1.0.onnx", "voices-v1.0.bin")
# SHA-256 of each model file. setup.py checks a download against these and deletes a file that does not match.
KOKORO_SHA256 = {"kokoro-v1.0.onnx": "7d5df8ecf7d4b1878015a32686053fd0eebe2bc377234608764cc0ef3636a6c5",
                 "voices-v1.0.bin": "bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d"}


def need(module, pip_name=None):
    """Import a module or stop with the install line."""
    try:
        return __import__(module)
    except ImportError:
        sys.exit("Missing Python package '%s'. Run: python %s/setup.py   (or pip install %s)"
                 % (module, Path(__file__).parent, pip_name or module))


def ffmpeg():
    exe = shutil.which("ffmpeg")
    if not exe:
        sys.exit("ffmpeg is not installed. Install it (winget install ffmpeg · brew install ffmpeg · apt install ffmpeg).")
    return exe


def launch(pw):
    """Chromium from Playwright, or the browser named in SHEET_VIDEO_CHROME."""
    exe = os.environ.get("SHEET_VIDEO_CHROME")
    try:
        return pw.chromium.launch(executable_path=exe) if exe else pw.chromium.launch()
    except Exception as e:
        sys.exit("Could not start Chromium (%s).\nRun: python -m playwright install chromium" % str(e).splitlines()[0])


def load_brand(path=None):
    """brand.json: the given path, else ./brand.json, else the saved one in ~/.sheet-video, else the example."""
    for p in [path, "brand.json", HOME / "brand.json", ASSETS / "brand" / "brand.example.json"]:
        if p and Path(p).is_file():
            b = json.loads(Path(p).read_text(encoding="utf-8"))
            b["_dir"] = str(Path(p).resolve().parent)
            return b
    sys.exit("No brand.json found.")
