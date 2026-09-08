#!/usr/bin/env python3
"""Master the ZBANK film with an artist-produced soundtrack.

The previous procedural score was intentionally removed. This script uses a licensed,
professionally mixed source recording and only performs editorial mastering: selecting the
right passage, tightening its pace to the film, filtering unnecessary sub-bass, and applying
clean broadcast-level loudness and fades.
"""

from pathlib import Path
import shutil
import subprocess


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "audio" / "candidates" / "dark-score.mp3"
OUTPUT = ROOT / "output" / "zbank-score-v3.wav"
DURATION = 45.12


def run(*args: str) -> None:
    subprocess.run(args, check=True)


if shutil.which("ffmpeg") is None:
    raise SystemExit("ffmpeg is required")
if not SOURCE.exists():
    raise SystemExit(f"Missing licensed soundtrack source: {SOURCE}")

OUTPUT.parent.mkdir(parents=True, exist_ok=True)

# Start after the source's long cold-open and gently compress time so its authored energy
# changes land near the film's chapter changes. No synthesized melody, pings, or drone is
# added. The final fade leaves the URL and launch statuses room to breathe.
audio_filter = ",".join(
    [
        "atempo=1.08",
        "highpass=f=34",
        "lowpass=f=15000",
        "afade=t=in:st=0:d=1.15",
        f"afade=t=out:st={DURATION - 2.7}:d=2.7",
        f"atrim=duration={DURATION}",
        "loudnorm=I=-18:LRA=8:TP=-1.5",
    ]
)

run(
    "ffmpeg",
    "-y",
    "-v",
    "error",
    "-ss",
    "9.5",
    "-i",
    str(SOURCE),
    "-af",
    audio_filter,
    "-ar",
    "48000",
    "-ac",
    "2",
    "-c:a",
    "pcm_s24le",
    str(OUTPUT),
)

print(OUTPUT)
