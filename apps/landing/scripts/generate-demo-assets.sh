#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
LANDING_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
PUBLIC_DIR="${LANDING_DIR}/public"

INPUT_VIDEO="${1:-${PUBLIC_DIR}/demo.mp4}"
OUTPUT_WEBM="${PUBLIC_DIR}/demo.webm"
OUTPUT_GIF="${PUBLIC_DIR}/demo.gif"
OUTPUT_POSTER="${PUBLIC_DIR}/demo-poster.png"

WEBM_WIDTH="${WEBM_WIDTH:-1280}"
WEBM_CRF="${WEBM_CRF:-34}"
GIF_WIDTH="${GIF_WIDTH:-960}"
GIF_FPS="${GIF_FPS:-10}"
GIF_DURATION_SECONDS="${GIF_DURATION_SECONDS:-10}"
POSTER_TIMESTAMP="${POSTER_TIMESTAMP:-00:00:01}"

if [[ ! -f "${INPUT_VIDEO}" ]]; then
  echo "Input video not found: ${INPUT_VIDEO}" >&2
  exit 1
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg is required but was not found in PATH" >&2
  exit 1
fi

WEBM_SCALE_FILTER="scale='min(${WEBM_WIDTH},iw)':-2:flags=lanczos"
GIF_FILTER="fps=${GIF_FPS},scale='min(${GIF_WIDTH},iw)':-2:flags=lanczos,split[s0][s1];[s0]palettegen=reserve_transparent=0[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5"

echo "Generating demo.webm from ${INPUT_VIDEO}"
ffmpeg -y -v error \
  -i "${INPUT_VIDEO}" \
  -an \
  -vf "${WEBM_SCALE_FILTER}" \
  -c:v libvpx-vp9 \
  -pix_fmt yuv420p \
  -b:v 0 \
  -crf "${WEBM_CRF}" \
  -row-mt 1 \
  -deadline good \
  -cpu-used 2 \
  "${OUTPUT_WEBM}"

echo "Generating demo-poster.png from ${INPUT_VIDEO}"
ffmpeg -y -v error \
  -ss "${POSTER_TIMESTAMP}" \
  -i "${INPUT_VIDEO}" \
  -vf "${WEBM_SCALE_FILTER}" \
  -frames:v 1 \
  -update 1 \
  "${OUTPUT_POSTER}"

echo "Generating demo.gif from ${INPUT_VIDEO}"
ffmpeg -y -v error \
  -ss 0 \
  -t "${GIF_DURATION_SECONDS}" \
  -i "${INPUT_VIDEO}" \
  -vf "${GIF_FILTER}" \
  -loop 0 \
  "${OUTPUT_GIF}"

echo "Done."
ls -lh "${OUTPUT_WEBM}" "${OUTPUT_GIF}" "${OUTPUT_POSTER}"
