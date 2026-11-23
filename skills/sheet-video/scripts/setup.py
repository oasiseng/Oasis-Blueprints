#!/usr/bin/env python3
# Oasis-Blueprints · https://github.com/oasiseng/Oasis-Blueprints · MIT License, Copyright (c) 2026 Oasis Engineering, LLC
"""setup.py - install what the sheet-video scripts need, once per machine.

    python setup.py            # packages, Chromium, voice model
    python setup.py --check    # only report what is missing

Installs the Python packages (playwright, pymupdf, pillow, numpy, kokoro-onnx, soundfile) from PyPI with pip,
Playwright's Chromium, and downloads the Kokoro voice model (about 340 MB, two files from the kokoro-onnx
project's GitHub release, each checked against a pinned SHA-256) into ~/.sheet-video/models. ffmpeg must
be installed separately (winget install ffmpeg · brew install ffmpeg · apt install ffmpeg).
"""
import argparse, hashlib, importlib, shutil, subprocess, sys, urllib.request
from _common import MODELS, KOKORO_URL, KOKORO_FILES, KOKORO_SHA256

PKGS = {"playwright": "playwright", "pymupdf": "pymupdf", "PIL": "pillow", "numpy": "numpy",
        "kokoro_onnx": "kokoro-onnx", "soundfile": "soundfile"}


def missing():
    out = []
    for mod, pip in PKGS.items():
        try:
            importlib.import_module(mod)
        except ImportError:
            out.append(pip)
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--check", action="store_true")
    a = ap.parse_args()
    miss = missing()
    models = [f for f in KOKORO_FILES if not (MODELS / f).is_file()]
    print("python packages missing:", ", ".join(miss) or "none")
    print("voice model missing:", ", ".join(models) or "none", "(%s)" % MODELS)
    print("ffmpeg:", shutil.which("ffmpeg") or "MISSING - install it separately")
    if a.check:
        return
    if miss:
        cmd = [sys.executable, "-m", "pip", "install", *miss]
        if subprocess.call(cmd) != 0:
            subprocess.check_call(cmd + ["--break-system-packages"])
    subprocess.check_call([sys.executable, "-m", "playwright", "install", "chromium"])
    MODELS.mkdir(parents=True, exist_ok=True)
    for f in models:
        print("downloading", f, "...")
        urllib.request.urlretrieve(KOKORO_URL + f, MODELS / f)
        digest = hashlib.sha256()
        with open(MODELS / f, "rb") as fh:
            for block in iter(lambda: fh.read(1 << 20), b""):
                digest.update(block)
        if digest.hexdigest() != KOKORO_SHA256[f]:
            (MODELS / f).unlink()
            sys.exit("%s did not match its expected SHA-256 and was deleted. Nothing was installed from it." % f)
    print("ready.")


if __name__ == "__main__":
    main()
