#!/usr/bin/env bash
# watch.sh URL [OUT_DIR]
# Prints a video's metadata and a plain-text transcript for any yt-dlp site
# (YouTube, Shorts, Instagram reels, TikTok, X, LinkedIn, Vimeo, Loom...).
# Subtitles first; no subtitles -> local whisper-cpp on the audio.
set -euo pipefail
URL="${1:?usage: watch.sh URL [OUT_DIR]}"
OUT="${2:-${TMPDIR:-/tmp}/agent-reach/$(date +%s)}"
# Browser whose logins yt-dlp borrows when a site wants one: Brave if installed.
BROWSER="${AGENT_REACH_BROWSER:-$([[ -d "/Applications/Brave Browser.app" ]] && echo brave || echo chrome)}"
MODEL="${WHISPER_MODEL:-$HOME/.agent-reach/models/ggml-small.bin}"
mkdir -p "$OUT"

ytdlp() {
  yt-dlp -q --no-warnings "$@" "$URL" 2>"$OUT/err.txt" ||
    yt-dlp -q --no-warnings --cookies-from-browser "$BROWSER" "$@" "$URL" 2>>"$OUT/err.txt"
}

ytdlp --dump-single-json > "$OUT/meta.json" || { cat "$OUT/err.txt" >&2; exit 1; }
python3 - "$OUT/meta.json" <<'PY'
import json, sys
d = json.load(open(sys.argv[1]))
for k in ("title", "uploader", "channel", "upload_date", "duration", "view_count", "like_count", "webpage_url"):
    if d.get(k) is not None: print(f"{k}: {d[k]}")
print("description:", (d.get("description") or "").strip()[:2000])
ch = d.get("chapters") or []
if ch: print("chapters:", "; ".join(f'{int(c["start_time"])}s {c["title"]}' for c in ch))
PY

# 1. Subtitles (manual or auto) when the site has them.
ytdlp --skip-download --write-subs --write-auto-subs --sub-langs "en.*,en,ar.*" \
  --sub-format vtt --convert-subs vtt -o "$OUT/subs.%(ext)s" || true
VTT=$(ls "$OUT"/subs*.vtt 2>/dev/null | head -1 || true)
if [[ -n "$VTT" ]]; then
  echo; echo "--- transcript (subtitles: $(basename "$VTT")) ---"
  # Drop cue timings, tags and the rolling duplicate lines auto-subs carry.
  sed -e '/-->/d' -e '/^WEBVTT/d' -e '/^Kind:/d' -e '/^Language:/d' -e 's/<[^>]*>//g' "$VTT" |
    awk 'NF && !seen[$0]++' | tee "$OUT/transcript.txt"
  exit 0
fi

# 2. No subtitles: transcribe the audio locally.
ytdlp -f "bestaudio/best" -x --audio-format wav -o "$OUT/audio.%(ext)s" || { cat "$OUT/err.txt" >&2; exit 1; }
ffmpeg -loglevel error -y -i "$OUT/audio.wav" -ar 16000 -ac 1 "$OUT/audio16.wav"
echo; echo "--- transcript (whisper, local) ---"
whisper-cli -m "$MODEL" -l auto -nt -np -f "$OUT/audio16.wav" 2>/dev/null | sed '/^\s*$/d' | tee "$OUT/transcript.txt"
