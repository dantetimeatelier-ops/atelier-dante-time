#!/usr/bin/env bash
# Příprava videa hodinek do katalogu (spouští agent, ne CI).
# Použití: scripts/video-katalog.sh <slug> <video> <NN>
# Výsledek: katalog/<slug>/NN.mp4 (H.264, SDR bt709, 720 px na šířku u videa na výšku, bez zvuku
# a bez metadat – žádná poloha ani značky Dolby Vision) + NN-l.webp / NN-s.webp (náhled).
# HDR videa z iPhonu (HLG / Dolby Vision) se převedou na běžné barvy, jinak je Safari zobrazuje špatně.
set -euo pipefail
slug="$1"; src="$2"; nn="$3"
dir="$(dirname "$0")/../katalog/$slug"; mkdir -p "$dir"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
trc="$(ffprobe -v error -select_streams v:0 -show_entries stream=color_transfer -of default=nw=1:nk=1 "$src")"
if [[ "$trc" == "arib-std-b67" || "$trc" == "smpte2084" ]]; then
  vf="zscale=t=linear:npl=203,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p,scale='if(gt(iw,ih),1280,720)':-2"
else
  vf="format=yuv420p,scale='if(gt(iw,ih),1280,720)':-2"
fi
ffmpeg -v error -y -i "$src" -map 0:v:0 -an -map_metadata -1 -vf "$vf" -color_primaries bt709 -color_trc bt709 -colorspace bt709 \
  -c:v libx264 -preset slow -crf 26 -profile:v high -level 3.1 "$tmp/v.mp4"
fps="$(ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate -of default=nw=1:nk=1 "$tmp/v.mp4")"
ffmpeg -v error -y -i "$tmp/v.mp4" -c copy -bsf:v h264_mp4toannexb -f h264 "$tmp/v.h264"
ffmpeg -v error -y -r "$fps" -i "$tmp/v.h264" -c copy -movflags +faststart "$dir/$nn.mp4"
ffmpeg -v error -y -ss 1.5 -i "$dir/$nn.mp4" -frames:v 1 "$tmp/p.png"
python3 - "$tmp/p.png" "$dir/$nn" <<'PY'
import sys; from PIL import Image
im = Image.open(sys.argv[1]).convert('RGB')
for s, size, q in (('l', 2000, 84), ('s', 800, 80)):
    c = im.copy(); c.thumbnail((size, size)); c.save(f'{sys.argv[2]}-{s}.webp', 'WEBP', quality=q, method=6)
print(im.size)
PY
