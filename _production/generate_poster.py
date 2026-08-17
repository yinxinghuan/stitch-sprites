#!/usr/bin/env python3
"""Generate the official Stitch Sprites poster through Aigram transit."""

import json
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "poster.png"
PROVENANCE = ROOT / "_production" / "poster-provenance.json"
ENDPOINT = "https://chat.aiwaves.tech/aigram/api/gen-image"

PROMPT = """
Square 1024x1024 premium mobile puzzle game key art, modern whimsical miniature craft world.
At the TOP within the upper 20 percent, clearly typeset the exact four Chinese characters
“拆线精灵” in large bold dark-charcoal contemporary sans-serif lettering, perfectly readable,
no other words anywhere.

Hero scene: a huge warm wooden embroidery hoop viewed from a gentle three-quarter overhead angle.
Inside it is a vibrant cross-stitch mosaic made from thick tactile coral, mustard yellow, lake blue,
lavender and charcoal thread. The lower outer layer has been removed, leaving an unmistakable clean
cream fabric path leading inward. Five tiny original thread sprites work together: round soft yarn
bodies, expressive eyes, two loose-thread antennae, tiny legs, each holding a silver unpicking needle.
One sprite triumphantly pulls a long colored X-stitch out of the fabric while the thread whips back
into a matching reel; two sprites run along the newly opened path; one waits beside a wooden reel rack.
Make the action readable at 160x160 thumbnail size.

Tactile fibers, macro photography material detail, painterly 3D illustration, warm window light,
soft contact shadows, playful energy, premium casual-game polish, strong silhouettes, authored
character design, contemporary global visual language. Not Chinese traditional style: no lanterns,
no palace, no scrolls, no red-gold theme, no cloud motifs, no calligraphy. Not a game screenshot,
no HUD, no buttons, no phone frame, no watermark, no logo besides the exact title. Keep the bottom
20 percent quiet with only softly lit tabletop so platform controls cannot cover the characters.
""".strip()


def main():
    payload = json.dumps({"prompt": PROMPT}).encode()
    started = time.time()
    generated = subprocess.run(
        [
            "curl", "-fsS", "--max-time", "420",
            "-H", "Content-Type: application/json",
            "-H", "Origin: https://aigram.app",
            "-H", "Referer: https://aigram.app/",
            "-H", "User-Agent: Mozilla/5.0",
            "--data-binary", "@-", ENDPOINT,
        ],
        input=payload,
        capture_output=True,
        check=True,
    )
    body = json.loads(generated.stdout)
    url = body.get("url")
    if not url:
        raise RuntimeError(f"No image URL in response: {body}")

    temporary = ROOT / "_production" / "poster-source"
    subprocess.run(
        ["curl", "-fsSL", "--max-time", "90", "-A", "Mozilla/5.0", "-o", str(temporary), url],
        check=True,
        capture_output=True,
    )
    subprocess.run(
        ["sips", "-s", "format", "png", str(temporary), "--out", str(OUTPUT)],
        check=True,
        capture_output=True,
    )
    temporary.unlink(missing_ok=True)

    provenance = {
        "endpoint": ENDPOINT,
        "origin": "https://aigram.app",
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "elapsed_seconds": round(time.time() - started, 1),
        "returned_url": url,
        "prompt": PROMPT,
        "output": "public/poster.png",
        "source": "Aigram platform transit txt2img; not a screenshot, SVG, Canvas, ComfyUI, or local workflow",
    }
    PROVENANCE.write_text(json.dumps(provenance, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"url": url, "output": str(OUTPUT), "elapsed": provenance["elapsed_seconds"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
