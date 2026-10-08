# Launch trailer

Renders the launch trailer straight from the game, frame by frame, so it is smooth even on a slow machine.

- `vclock.js` replaces the page clock: time only advances when the recorder asks, and each step renders exactly one frame.
- `trailer.js` is the timeline: camera moves, scripted gameplay (building, growing, day to night) and the caption overlays.
- `record.cjs` drives Chromium with Playwright and saves JPEG frames.
- `music.py` generates the soundtrack with numpy.

```bash
npm run build && npx vite preview --port 4173 &
npm i -D playwright            # once
URL='http://localhost:4173/?rec' OUT=frames W=1920 H=1080 Q=low node trailer/record.cjs
python3 trailer/music.py 39 music.wav
ffmpeg -framerate 30 -i frames/f%05d.jpg -i music.wav -c:v libx264 -pix_fmt yuv420p -crf 18 -c:a aac -b:a 192k -shortest hotel-tycoon-trailer.mp4
```

`?rec` lowers the shadow-map size to speed up rendering. Set `ONLY=0,30,60` to save just a few frames for a quick check, or `START=840` to re-render from a scene cut (earlier frames only advance the simulation).
