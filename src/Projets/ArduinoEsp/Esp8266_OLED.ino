#include <ESP8266WiFi.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
//Code a peut pret focntionnel

const char* ssid = "AndroidF";
const char* password = "Lincoln55";
WiFiServer server(80);

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

bool invertMode = false;
const char PROGMEM html_page[] = R"rawliteral(

<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width"><title>🖥️ OLED Paint Pro+ FINAL</title>
<style>body{background:#0a0a0a;color:#fff;font-family:system-ui;padding:20px;text-align:center;}
h1{font-size:2.2em;margin:0 0 15px;color:#4ecdc4;text-shadow:0 0 10px #4ecdc4;}
canvas{border:3px solid #444;background:#fff;image-rendering:pixelated;width:90vw;max-width:420px;cursor:crosshair;box-shadow:0 10px 30px rgba(0,0,0,0.5);}
#status{padding:12px;background:linear-gradient(45deg,#222,#333);border-radius:12px;margin:15px 0;border:1px solid #4ecdc4;box-shadow:0 4px 15px rgba(78,205,196,0.3);}
.tools{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin:12px 0;}
.tools button{padding:12px 16px;border:none;border-radius:10px;background:linear-gradient(45deg,#4ecdc4,#45b7aa);color:#000;font-weight:600;cursor:pointer;transition:all 0.3s;box-shadow:0 4px 15px rgba(78,205,196,0.3);}
.tools button:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(78,205,196,0.5);}
.tools button.active{background:linear-gradient(45deg,#ff6b6b,#ff5252);box-shadow:0 4px 15px rgba(255,107,107,0.4);}
.file-label{padding:12px 24px;background:linear-gradient(45deg,#ff6b6b,#ff5252);border-radius:10px;cursor:pointer;font-weight:600;display:inline-block;box-shadow:0 4px 15px rgba(255,107,107,0.3);}
#textInput,#exportArea{width:90%;height:140px;background:#111;color:#fff;border:2px solid #444;border-radius:12px;font-family:monospace;font-size:12px;padding:12px;resize:vertical;margin:10px 0;box-shadow:inset 0 4px 15px rgba(0,0,0,0.5);}
.tama-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;max-width:450px;margin:20px auto;}
.tama-grid button{padding:20px;border-radius:15px;font-size:24px;background:linear-gradient(45deg,#6c5ce7,#a29bfe);}
.slider-container{display:flex;align-items:center;gap:8px;font-size:14px;}
.slider{width:120px;height:6px;border-radius:3px;background:#333;accent-color:#4ecdc4;cursor:pointer;}
.slider-value{font-weight:600;color:#4ecdc4;min-width:25px;}


</style>
<script src="https://unpkg.com/gifuct-js/dist/gifuct.min.js"></script>


</head><body>
<h1>🖥️ OLED Paint Pro+ FINAL</h1>
<div id="status">✅ Prêt | Outil: Pinceau | Taille: 1px | Snap: 8px | Noir</div>

<!-- CANVAS -->
<canvas id="canvas" width="128" height="64"></canvas>

<!-- TIMELINE FRAMES -->
<div style="background:rgba(255,255,255,0.05);padding:16px;border-radius:15px;margin:16px 0;border:1px solid #444;">
  <h3>🎞️ Timeline Frames</h3>

  <div class="tools">
    <button onclick="prevFrame()">⏮️ Prev</button>
    <button onclick="nextFrame()">⏭️ Next</button>
    <button onclick="addFrame()">➕ Ajouter</button>
    <button onclick="duplicateFrame()">🧬 Dupliquer</button>
    <button onclick="saveCurrentFrame()">💾 Sauver frame</button>
    <button onclick="deleteFrame()">🗑️ Supprimer</button>
  </div>

  <div class="tools">
    <button onclick="playFrames()" id="playFramesBtn">▶️ Lire</button>
    <button onclick="stopFrames()">⏹️ Stop</button>
    <button onclick="sendCurrentFrame()">📤 Frame OLED</button>
    <button onclick="sendAnimationToOled()" id="sendAnimBtn">📺 Lecture OLED</button>
  </div>

  <div class="tools">
    <div class="slider-container">
      <label>Delay frame:</label>
      <input type="range" class="slider" id="frameDelaySlider" min="50" max="1000" step="10" value="200" oninput="updateFrameDelay(this.value)">
      <span class="slider-value" id="frameDelayValue">200 ms</span>
    </div>
    <div id="frameInfo" style="padding:8px 12px;background:#111;border-radius:10px;border:1px solid #333;">
      Frame 1 / 1
    </div>
  </div>

  <div id="framesStrip" style="display:flex;gap:8px;overflow-x:auto;padding:8px 0;"></div>
</div>

<!-- OUTILS DESSIN -->
<div class="tools">
  <div>Outils:
    <button onclick="setTool('brush')" id="btn_brush" class="active">🖌️ Pinceau</button>
    <button onclick="setTool('eraser')" id="btn_eraser">🧽 Gomme</button>
    <button onclick="setTool('rect')" id="btn_rect">📦 Rect</button>
    <button onclick="setTool('circle')" id="btn_circle">⭕ Cercle</button>
    <button onclick="setTool('line')" id="btn_line">📏 Ligne</button>
    <button onclick="setTool('poly')" id="btn_poly">🔺 Poly</button>
  </div>
</div>

<!-- SLIDERS TAILLE + SNAP -->
<div class="tools">
  <div class="slider-container">
    <label>Taille:</label>
    <input type="range" class="slider" id="sizeSlider" min="1" max="8" value="1" oninput="updateSize(this.value)">
    <span class="slider-value" id="sizeValue">1px</span>
  </div>
  <div class="slider-container">
    <label>Snap:</label>
    <input type="range" class="slider" id="snapSlider" min="1" max="16" value="8" oninput="updateSnap(this.value)">
    <span class="slider-value" id="snapValue">8px</span>
  </div>
</div>

<!-- OPTIONS -->
<div class="tools">
  <label><input type="checkbox" id="fillCheck" onchange="toggleFill()"> Remplir</label>
  <label><input type="checkbox" id="gridCheck" onchange="toggleGrid()"> Grille</label>
</div>

<!-- MODE & ACTIONS -->
<div class="tools">
  <button onclick="toggleColor()">🎨 <span id="colorTxt">NOIR</span></button>
  <button onclick="toggleMode()">🎭 <span id="modeTxt">UNIQUE</span></button>
  <button onclick="undo()">↶ Undo</button>
  <button onclick="redo()">↷ Redo</button>
  <button onclick="clearScreen()">🧹 Clear</button>
  <button onclick="sendDraw()">📤 → OLED</button>
</div>

<!-- TAMA & IMAGE -->
<div class="tools">
  <button onclick="toggleInvert()">🔄 Invert</button>
  <input type="file" id="imgFile" accept="image/*,.gif" style="display:none;" onchange="loadMedia(event)">
<label for="imgFile" class="file-label">🖼️ GIF/Image</label>

<button onclick="toggleGifAnim()" id="gifBtn">⏸️ GIF</button>
<div class="slider-container">
  <label>FPS:</label>
  <input type="range" class="slider" id="fpsSlider" min="3" max="10" value="5" oninput="updateFps(this.value)">
  <span class="slider-value" id="fpsValue">5 FPS</span>
</div>

</div>



<div class="tama-grid">
  <button onclick="tama(0)">😺</button><button onclick="tama(1)">😻</button><button onclick="tama(2)">😿</button>
  <button onclick="tama(3)">🌙</button><button onclick="tama(4)">😎</button><button onclick="tama(5)">🌀</button>
</div>

<!-- TXT ART & EXPORTS -->
<div style="background:rgba(255,255,255,0.05);padding:20px;border-radius:15px;margin:20px 0;border:1px solid #444;">
  <h3>💾 TXT Art & Exports</h3>
  <textarea id="textInput" placeholder="Colle ton TXT Art (█ ░ # . @)...&#10;Ex:&#10;░░░░░░░░░░░░░░░░░░█&#10;░░░█░░░░░░░░░░░░░░█&#10;..."></textarea>
  <div class="tools">
    <button onclick="importTextArt()">← Importer Canvas</button>
    <button onclick="exportPixels()">📊 TXT + OLED</button>
    <button onclick="copyExport()">📋 Copier TXT</button>
  </div>
  <div class="tools">
    <button onclick="exportArduino()">⚡ Arduino</button>
    <button onclick="exportBuffer()">📦 Buffer</button>
    <button onclick="copyExport()">📋 Copier Code</button>
  </div>
  <textarea id="exportArea" readonly placeholder="TXT ou Code ici..."></textarea>
</div>

<script>
(function () {
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, 128, 64);
  ctx.fillStyle = '#000';

  let tool = 'brush', size = 1, fillMode = false, gridMode = false, snapSize = 8, drawing = false, uniqueMode = true, drawColor = '#000';
  let startX = 0, startY = 0, history = [], historyIndex = -1, shapeStartBuffer = null, polyPoints = [];
  let invertMode = false;

  let frames = [];
  let currentFrame = 0;
  let playbackTimer = null;
  let oledPlaybackTimer = null;
  let isPlayingFrames = false;
  let isSendingGif = false;
  let gifFps = 200; // ms par frame, conservé pour compat

  function makeEmptyFrame(delay = 200) {
    return {
      buffer: new Uint8Array(1024),
      delay
    };
  }

  function initFrames() {
    frames = [makeEmptyFrame(200)];
    currentFrame = 0;
    saveCanvasToCurrentFrame(true);
    renderFramesStrip();
    loadCurrentFrameToCanvas();
    updateFrameUi();
  }

  function pos(e) {
    const r = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: Math.floor((clientX - r.left) * 128 / r.width),
      y: Math.floor((clientY - r.top) * 64 / r.height)
    };
  }

  function snapCoord(val) {
    return Math.round(val / snapSize) * snapSize;
  }

  function saveState() {
    history = history.slice(0, historyIndex + 1);
    history.push(ctx.getImageData(0, 0, 128, 64));
    historyIndex = history.length - 1;
    if (history.length > 30) {
      history.shift();
      historyIndex = history.length - 1;
    }
  }

  function updateStatus(msg) {
    const el = document.getElementById('status');
    if (msg) {
      el.innerText = msg;
      return;
    }
    el.innerText = `Outil: ${tool} | Taille: ${size}px | Snap: ${snapSize}px | ${drawColor === '#000' ? 'NOIR' : 'BLANC'} | Frame ${currentFrame + 1}/${frames.length}`;
  }

  function updateSize(val) {
    size = parseInt(val, 10);
    document.getElementById('sizeValue').textContent = size + 'px';
    updateStatus();
  }

  function updateSnap(val) {
    snapSize = parseInt(val, 10);
    document.getElementById('snapValue').textContent = snapSize + 'px';
    updateStatus();
  }

  function drawPixel(x, y, color) {
    ctx.fillStyle = color;
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        if (x + i < 128 && y + j < 64 && x + i >= 0 && y + j >= 0) {
          ctx.fillRect(x + i, y + j, 1, 1);
        }
      }
    }
  }

  function bresenham(sx, sy, ex, ey, isPreview = false) {
    sx = Math.floor(sx); sy = Math.floor(sy); ex = Math.floor(ex); ey = Math.floor(ey);
    const dx = Math.abs(ex - sx), dy = Math.abs(ey - sy);
    const sxStep = sx < ex ? 1 : -1;
    const syStep = sy < ey ? 1 : -1;
    let err = dx - dy, x = sx, y = sy, e2;
    const color = isPreview ? '#444' : drawColor;

    while (true) {
      drawPixel(x, y, color);
      if (x === ex && y === ey) break;
      e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sxStep; }
      if (e2 < dx) { err += dx; y += syStep; }
    }
  }

  function previewShape(sx, sy, ex, ey) {
    ctx.lineWidth = 1;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (tool === 'rect') {
      const w = Math.abs(ex - sx), h = Math.abs(ey - sy);
      const rx = Math.min(sx, ex), ry = Math.min(sy, ey);
      ctx.strokeStyle = '#444';
      ctx.strokeRect(rx, ry, w, h);
      if (fillMode) {
        ctx.fillStyle = '#444';
        ctx.fillRect(rx, ry, w, h);
      }
    } else if (tool === 'circle') {
      const cx = (sx + ex) / 2, cy = (sy + ey) / 2;
      const r = Math.hypot(ex - sx, ey - sy) * 0.35;
      ctx.strokeStyle = '#444';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      if (fillMode) {
        ctx.fillStyle = '#444';
        ctx.fill();
      }
    } else if (tool === 'line') {
      bresenham(sx, sy, ex, ey, true);
    }
  }

  function drawShape(sx, sy, ex, ey) {
    ctx.lineWidth = 1;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (tool === 'rect') {
      const w = Math.abs(ex - sx), h = Math.abs(ey - sy);
      const rx = Math.min(sx, ex), ry = Math.min(sy, ey);
      ctx.strokeStyle = drawColor;
      ctx.strokeRect(rx, ry, w, h);
      if (fillMode) {
        ctx.fillStyle = drawColor;
        ctx.fillRect(rx, ry, w, h);
      }
    } else if (tool === 'circle') {
      const cx = (sx + ex) / 2, cy = (sy + ey) / 2;
      const r = Math.hypot(ex - sx, ey - sy) * 0.35;
      ctx.strokeStyle = drawColor;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      if (fillMode) {
        ctx.fillStyle = drawColor;
        ctx.fill();
      }
    } else if (tool === 'line') {
      bresenham(sx, sy, ex, ey, false);
    }
  }

  function previewPolygon() {
    if (!shapeStartBuffer || polyPoints.length === 0) return;
    ctx.putImageData(shapeStartBuffer, 0, 0);
    ctx.beginPath();
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let i = 0; i < polyPoints.length; i++) {
      const pt = polyPoints[i];
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();

    if (fillMode && polyPoints.length > 2) {
      ctx.fillStyle = '#444';
      ctx.fill();
    }
  }

  function drawPolygon() {
    if (polyPoints.length < 2) return;
    ctx.beginPath();
    ctx.strokeStyle = drawColor;
    ctx.lineWidth = 1;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let i = 0; i < polyPoints.length; i++) {
      const pt = polyPoints[i];
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.closePath();
    ctx.stroke();
    if (fillMode) {
      ctx.fillStyle = drawColor;
      ctx.fill();
    }
    saveState();
  }

  function startDraw(e) {
    e.preventDefault();
    drawing = true;
    saveState();

    const p = pos(e);
    startX = snapCoord(p.x);
    startY = snapCoord(p.y);
    shapeStartBuffer = ctx.getImageData(0, 0, 128, 64);

    if (tool === 'brush') {
      drawPixel(p.x, p.y, drawColor);
    } else if (tool === 'eraser') {
      drawPixel(p.x, p.y, '#fff');
    } else if (tool === 'poly') {
      if (!polyPoints.length) polyPoints.push({ x: startX, y: startY });
      else polyPoints.push({ x: startX, y: startY });
      previewPolygon();
    }
  }

  function moveDraw(e) {
    if (!drawing) return;
    e.preventDefault();
    const p = pos(e);
    const ex = snapCoord(p.x), ey = snapCoord(p.y);
    const sx = startX, sy = startY;

    if (tool === 'brush') {
      drawPixel(p.x, p.y, drawColor);
    } else if (tool === 'eraser') {
      drawPixel(p.x, p.y, '#fff');
    } else if (tool === 'poly') {
      if (polyPoints.length) {
        const temp = polyPoints.slice();
        temp[temp.length - 1] = { x: ex, y: ey };
        ctx.putImageData(shapeStartBuffer, 0, 0);
        ctx.beginPath();
        ctx.strokeStyle = '#444';
        for (let i = 0; i < temp.length; i++) {
          const pt = temp[i];
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
      }
    } else {
      ctx.putImageData(shapeStartBuffer, 0, 0);
      previewShape(sx, sy, ex, ey);
    }
  }

  function endDraw(e) {
    if (!drawing) return;
    e.preventDefault();

    const p = pos(e.changedTouches ? e.changedTouches[0] : e);
    const ex = snapCoord(p.x), ey = snapCoord(p.y);
    const sx = startX, sy = startY;

    if (tool === 'poly') {
      if (polyPoints.length > 2) {
        const first = polyPoints[0];
        if (Math.hypot(ex - first.x, ey - first.y) < snapSize) {
          polyPoints.push({ x: first.x, y: first.y });
          ctx.putImageData(shapeStartBuffer, 0, 0);
          drawPolygon();
          polyPoints = [];
        } else {
          polyPoints[polyPoints.length - 1] = { x: ex, y: ey };
          previewPolygon();
        }
      } else if (polyPoints.length) {
        polyPoints[polyPoints.length - 1] = { x: ex, y: ey };
        previewPolygon();
      }
    } else if (tool !== 'brush' && tool !== 'eraser') {
      ctx.putImageData(shapeStartBuffer, 0, 0);
      drawShape(sx, sy, ex, ey);
      saveState();
    }

    drawing = false;
    shapeStartBuffer = null;
    saveCanvasToCurrentFrame();
    renderFramesStrip();
    updateStatus();
  }

  function toggleFill() {
    fillMode = document.getElementById('fillCheck').checked;
    updateStatus();
  }

  function toggleGrid() {
    gridMode = document.getElementById('gridCheck').checked;
    redrawCanvasFromCurrentFrame();
    updateStatus();
  }

  function drawGrid() {
    if (!gridMode) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(128,128,128,0.25)';
    ctx.lineWidth = 1;
    for (let x = 0; x < 128; x += snapSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 64);
      ctx.stroke();
    }
    for (let y = 0; y < 64; y += snapSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(128, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function redrawCanvasFromCurrentFrame() {
    drawBufferToCanvas(frames[currentFrame].buffer);
  }

  function toggleColor() {
    drawColor = drawColor === '#000' ? '#fff' : '#000';
    document.getElementById('colorTxt').innerText = drawColor === '#000' ? 'NOIR' : 'BLANC';
    updateStatus();
  }

  function toggleMode() {
    uniqueMode = !uniqueMode;
    document.getElementById('modeTxt').innerText = uniqueMode ? 'UNIQUE' : 'CONTINU';
    updateStatus();
  }

  function undo() {
    if (historyIndex > 0) {
      historyIndex--;
      ctx.putImageData(history[historyIndex], 0, 0);
      drawGrid();
      saveCanvasToCurrentFrame(true);
      renderFramesStrip();
    }
  }

  function redo() {
    if (historyIndex < history.length - 1) {
      historyIndex++;
      ctx.putImageData(history[historyIndex], 0, 0);
      drawGrid();
      saveCanvasToCurrentFrame(true);
      renderFramesStrip();
    }
  }

  function clearScreen() {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 128, 64);
    ctx.fillStyle = '#000';
    saveState();
    drawGrid();
    saveCanvasToCurrentFrame(true);

    const zeroBuf = new Uint8Array(1024);
    fetch('/draw', { method: 'POST', body: zeroBuf }).catch(() => {});
    updateStatus('🧹 Clear OLED + frame');
    renderFramesStrip();
  }

  function toggleInvert() {
    invertMode = !invertMode;
    fetch('/invert').catch(() => {});
    updateStatus('🔄 OLED inversé');
  }

  function getBuffer() {
    const data = ctx.getImageData(0, 0, 128, 64).data;
    const buf = new Uint8Array(1024);
    for (let page = 0; page < 8; page++) {
      for (let x = 0; x < 128; x++) {
        let b = 0;
        for (let bit = 0; bit < 8; bit++) {
          const y = page * 8 + bit;
          const i = (y * 128 + x) * 4;
          if (data[i] < 128) b |= (1 << bit);
        }
        buf[page * 128 + x] = b;
      }
    }
    return buf;
  }

  function getBufferFromImageData(imgData) {
    const data = imgData.data;
    const buf = new Uint8Array(1024);
    for (let page = 0; page < 8; page++) {
      for (let x = 0; x < 128; x++) {
        let b = 0;
        for (let bit = 0; bit < 8; bit++) {
          const y = page * 8 + bit;
          const i = (y * 128 + x) * 4;
          if (data[i] < 128) b |= (1 << bit);
        }
        buf[page * 128 + x] = b;
      }
    }
    return buf;
  }

  function drawBufferToCanvas(buf) {
    const canvasData = ctx.createImageData(128, 64);
    for (let page = 0; page < 8; page++) {
      for (let x = 0; x < 128; x++) {
        const b = buf[page * 128 + x];
        for (let bit = 0; bit < 8; bit++) {
          const y = page * 8 + bit;
          const i = (y * 128 + x) * 4;
          const color = (b & (1 << bit)) ? 0 : 255;
          canvasData.data[i] = color;
          canvasData.data[i + 1] = color;
          canvasData.data[i + 2] = color;
          canvasData.data[i + 3] = 255;
        }
      }
    }
    ctx.putImageData(canvasData, 0, 0);
    drawGrid();
  }

  function saveCanvasToCurrentFrame(silent = false) {
    if (!frames[currentFrame]) return;
    frames[currentFrame].buffer = getBuffer();
    if (!silent) updateStatus(`💾 Frame ${currentFrame + 1} sauvée`);
  }

  function loadCurrentFrameToCanvas() {
    if (!frames[currentFrame]) return;
    drawBufferToCanvas(frames[currentFrame].buffer);
    saveState();
    updateFrameUi();
  }

  function updateFrameUi() {
    const fi = document.getElementById('frameInfo');
    if (fi) fi.textContent = `Frame ${currentFrame + 1} / ${frames.length}`;

    const slider = document.getElementById('frameDelaySlider');
    const val = document.getElementById('frameDelayValue');
    if (frames[currentFrame] && slider && val) {
      slider.value = frames[currentFrame].delay;
      val.textContent = frames[currentFrame].delay + ' ms';
    }
    updateStatus();
  }

  function renderFramesStrip() {
    const strip = document.getElementById('framesStrip');
    if (!strip) return;
    strip.innerHTML = '';

    frames.forEach((frame, index) => {
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 32;
      c.style.width = '64px';
      c.style.height = '32px';
      c.style.border = index === currentFrame ? '2px solid #4ecdc4' : '1px solid #555';
      c.style.borderRadius = '8px';
      c.style.background = '#fff';
      c.style.cursor = 'pointer';
      c.title = `Frame ${index + 1} (${frame.delay} ms)`;

      const cctx = c.getContext('2d');
      const preview = cctx.createImageData(64, 32);

      for (let py = 0; py < 32; py++) {
        for (let px = 0; px < 64; px++) {
          const sx = px * 2;
          const sy = py * 2;
          const byteIndex = (Math.floor(sy / 8) * 128) + sx;
          const bit = sy % 8;
          const color = (frame.buffer[byteIndex] & (1 << bit)) ? 0 : 255;
          const i = (py * 64 + px) * 4;
          preview.data[i] = color;
          preview.data[i + 1] = color;
          preview.data[i + 2] = color;
          preview.data[i + 3] = 255;
        }
      }

      cctx.putImageData(preview, 0, 0);

      c.addEventListener('click', () => {
        saveCanvasToCurrentFrame(true);
        currentFrame = index;
        loadCurrentFrameToCanvas();
        renderFramesStrip();
      });

      strip.appendChild(c);
    });
  }

  function addFrame() {
    saveCanvasToCurrentFrame(true);
    const delay = frames[currentFrame] ? frames[currentFrame].delay : 200;
    frames.splice(currentFrame + 1, 0, makeEmptyFrame(delay));
    currentFrame++;
    loadCurrentFrameToCanvas();
    renderFramesStrip();
    updateStatus(`➕ Frame ${currentFrame + 1} ajoutée`);
  }

  function duplicateFrame() {
    saveCanvasToCurrentFrame(true);
    const src = frames[currentFrame];
    const copy = {
      buffer: new Uint8Array(src.buffer),
      delay: src.delay
    };
    frames.splice(currentFrame + 1, 0, copy);
    currentFrame++;
    loadCurrentFrameToCanvas();
    renderFramesStrip();
    updateStatus(`🧬 Frame ${currentFrame + 1} dupliquée`);
  }

  function deleteFrame() {
    if (frames.length <= 1) {
      updateStatus('❌ Il faut garder au moins 1 frame');
      return;
    }
    frames.splice(currentFrame, 1);
    currentFrame = Math.max(0, currentFrame - 1);
    loadCurrentFrameToCanvas();
    renderFramesStrip();
    updateStatus('🗑️ Frame supprimée');
  }

  function prevFrame() {
    saveCanvasToCurrentFrame(true);
    currentFrame = (currentFrame - 1 + frames.length) % frames.length;
    loadCurrentFrameToCanvas();
    renderFramesStrip();
  }

  function nextFrame() {
    saveCanvasToCurrentFrame(true);
    currentFrame = (currentFrame + 1) % frames.length;
    loadCurrentFrameToCanvas();
    renderFramesStrip();
  }

  function saveCurrentFrame() {
    saveCanvasToCurrentFrame();
    renderFramesStrip();
  }

  function updateFrameDelay(val) {
    if (!frames[currentFrame]) return;
    frames[currentFrame].delay = parseInt(val, 10);
    document.getElementById('frameDelayValue').textContent = val + ' ms';
    renderFramesStrip();
    updateStatus(`⏱️ Delay frame ${currentFrame + 1}: ${val} ms`);
  }

  function playFrameLoop(index = 0) {
    if (!isPlayingFrames || !frames.length) return;

    currentFrame = index % frames.length;
    drawBufferToCanvas(frames[currentFrame].buffer);
    renderFramesStrip();
    updateFrameUi();

    const delay = frames[currentFrame].delay || 100;
    playbackTimer = setTimeout(() => {
      playFrameLoop((currentFrame + 1) % frames.length);
    }, delay);
  }

  function playFrames() {
    saveCanvasToCurrentFrame(true);
    stopFrames();
    isPlayingFrames = true;
    document.getElementById('playFramesBtn').innerText = '⏸️ Pause';
    playFrameLoop(currentFrame);
    updateStatus('▶️ Lecture timeline');
  }

  function stopFrames() {
    isPlayingFrames = false;
    if (playbackTimer) clearTimeout(playbackTimer);
    playbackTimer = null;
    const btn = document.getElementById('playFramesBtn');
    if (btn) btn.innerText = '▶️ Lire';
    updateStatus('⏹️ Timeline stoppée');
  }

  async function sendCurrentFrame() {
    saveCanvasToCurrentFrame(true);
    try {
      await fetch('/draw', { method: 'POST', body: frames[currentFrame].buffer });
      updateStatus(`📤 Frame ${currentFrame + 1} envoyée OLED`);
    } catch (e) {
      updateStatus('❌ Envoi OLED impossible');
    }
  }

  function sendAnimationToOled() {
    saveCanvasToCurrentFrame(true);

    if (oledPlaybackTimer) {
      clearTimeout(oledPlaybackTimer);
      oledPlaybackTimer = null;
      const btn = document.getElementById('sendAnimBtn');
      if (btn) btn.innerText = '📺 Lecture OLED';
      updateStatus('⏹️ Lecture OLED stoppée');
      return;
    }

    const btn = document.getElementById('sendAnimBtn');
    if (btn) btn.innerText = '⏸️ Stop OLED';

    let idx = currentFrame;
    const loop = async () => {
      if (!frames.length || oledPlaybackTimer === null) return;

      currentFrame = idx % frames.length;
      drawBufferToCanvas(frames[currentFrame].buffer);
      renderFramesStrip();
      updateFrameUi();

      if (!isSendingGif) {
        isSendingGif = true;
        try {
          await fetch('/draw', { method: 'POST', body: frames[currentFrame].buffer });
        } catch (e) {}
        isSendingGif = false;
      }

      const delay = frames[currentFrame].delay || 100;
      idx = (idx + 1) % frames.length;
      oledPlaybackTimer = setTimeout(loop, delay);
    };

    oledPlaybackTimer = setTimeout(loop, 0);
    updateStatus('📺 Lecture animation sur OLED');
  }

  function updateFps(val) {
    gifFps = 1000 / parseInt(val, 10);
    document.getElementById('fpsValue').textContent = val + ' FPS';
    const forcedDelay = Math.round(gifFps);
    if (frames.length > 0) {
      frames[currentFrame].delay = forcedDelay;
      updateFrameUi();
      renderFramesStrip();
    }
    updateStatus(`🎞️ FPS réglé à ${val}`);
  }

  function ditherFS(imageData) {
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      data[i] = data[i + 1] = data[i + 2] = gray;
    }

    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 128; x++) {
        const idx = (y * 128 + x) * 4;
        const oldp = data[idx] / 255;
        const newp = oldp < 0.5 ? 0 : 1;
        const quantErr = (oldp - newp) * 255;

        data[idx] = data[idx + 1] = data[idx + 2] = newp * 255;

        if (x + 1 < 128) {
          for (let c = 0; c < 3; c++) data[idx + 4 + c] = clamp255(data[idx + 4 + c] + quantErr * 7 / 16);
        }
        if (y + 1 < 64) {
          if (x > 0) for (let c = 0; c < 3; c++) data[idx + 128 * 4 - 4 + c] = clamp255(data[idx + 128 * 4 - 4 + c] + quantErr * 3 / 16);
          for (let c = 0; c < 3; c++) data[idx + 128 * 4 + c] = clamp255(data[idx + 128 * 4 + c] + quantErr * 5 / 16);
          if (x + 1 < 128) for (let c = 0; c < 3; c++) data[idx + 128 * 4 + 4 + c] = clamp255(data[idx + 128 * 4 + 4 + c] + quantErr * 1 / 16);
        }
      }
    }
  }

  function clamp255(v) {
    return Math.max(0, Math.min(255, v));
  }

  function fitContain(srcW, srcH, dstW, dstH) {
    const ratio = srcW / srcH;
    const dstRatio = dstW / dstH;
    let drawW, drawH, offsetX = 0, offsetY = 0;

    if (ratio > dstRatio) {
      drawW = dstW;
      drawH = dstW / ratio;
      offsetY = (dstH - drawH) / 2;
    } else {
      drawH = dstH;
      drawW = dstH * ratio;
      offsetX = (dstW - drawW) / 2;
    }
    return { drawW, drawH, offsetX, offsetY };
  }

  function importTextArt() {
    const text = document.getElementById('textInput').value;
    if (!text.trim()) {
      updateStatus('❌ Colle du TXT Art');
      return;
    }

    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 128, 64);

    const lines = text.split('\n').filter(l => l.trim().length);
    const maxWidth = Math.max(...lines.map(l => l.length));
    const scaleX = 128 / maxWidth;
    const scaleY = 64 / lines.length;
    const scale = Math.max(1, Math.floor(Math.min(scaleX, scaleY)));

    const offsetX = Math.floor((128 - maxWidth * scale) / 2);
    const offsetY = Math.floor((64 - lines.length * scale) / 2);

    for (let y = 0; y < lines.length; y++) {
      const line = lines[y];
      for (let x = 0; x < line.length; x++) {
        if (['█', '#', '@'].includes(line[x])) {
          for (let sy = 0; sy < scale; sy++) {
            for (let sx = 0; sx < scale; sx++) {
              const px = offsetX + x * scale + sx;
              const py = offsetY + y * scale + sy;
              if (px >= 0 && px < 128 && py >= 0 && py < 64) {
                ctx.fillStyle = '#000';
                ctx.fillRect(px, py, 1, 1);
              }
            }
          }
        }
      }
    }

    saveState();
    drawGrid();
    saveCanvasToCurrentFrame(true);
    renderFramesStrip();
    updateStatus('✅ TXT Art importé dans la frame');
  }

  function exportPixels() {
    saveCanvasToCurrentFrame(true);
    const data = ctx.getImageData(0, 0, 128, 64).data;
    let txt = '';

    for (let y = 0; y < 64; y++) {
      let line = '';
      for (let x = 0; x < 128; x++) {
        const i = (y * 128 + x) * 4;
        line += data[i] < 128 ? '█' : '░';
      }
      txt += line + '\n';
    }

    document.getElementById('exportArea').value = txt;
    fetch('/draw', { method: 'POST', body: getBuffer() }).catch(() => {});
    updateStatus('✅ TXT exporté + OLED');
  }

  async function loadMedia(e) {
    const file = e.target.files[0];
    if (!file) return;

    const ext = file.name.toLowerCase().split('.').pop();

    if (ext === 'gif') {
      await loadGifAsFrames(file);
      return;
    }

    const img = new Image();
    img.onload = () => {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = 128;
      tempCanvas.height = 64;
      const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
      tempCtx.fillStyle = '#fff';
      tempCtx.fillRect(0, 0, 128, 64);

      const fit = fitContain(img.width, img.height, 128, 64);
      tempCtx.drawImage(img, fit.offsetX, fit.offsetY, fit.drawW, fit.drawH);

      const imgData = tempCtx.getImageData(0, 0, 128, 64);
      ditherFS(imgData);
      ctx.putImageData(imgData, 0, 0);

      saveState();
      drawGrid();
      saveCanvasToCurrentFrame(true);
      renderFramesStrip();
      updateStatus('🖼️ Image chargée dans la frame');
    };
    img.src = URL.createObjectURL(file);
  }

  async function loadGifAsFrames(file) {
    try {
      if (!window.gifuct || !window.gifuct.parseGIF || !window.gifuct.decompressFrames) {
        throw new Error('gifuct-js non chargé');
      }

      const arrayBuffer = await file.arrayBuffer();
      const gif = window.gifuct.parseGIF(arrayBuffer);
      const rawFrames = window.gifuct.decompressFrames(gif, true);

      if (!rawFrames || !rawFrames.length) {
        throw new Error('Aucune frame décodée');
      }

      const gifW = gif.lsd.width;
      const gifH = gif.lsd.height;

      const compositingCanvas = document.createElement('canvas');
      compositingCanvas.width = gifW;
      compositingCanvas.height = gifH;
      const compositingCtx = compositingCanvas.getContext('2d', { willReadFrequently: true });

      const previousCanvas = document.createElement('canvas');
      previousCanvas.width = gifW;
      previousCanvas.height = gifH;
      const previousCtx = previousCanvas.getContext('2d', { willReadFrequently: true });

      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = 128;
      finalCanvas.height = 64;
      const finalCtx = finalCanvas.getContext('2d', { willReadFrequently: true });

      compositingCtx.clearRect(0, 0, gifW, gifH);
      previousCtx.clearRect(0, 0, gifW, gifH);

      const newFrames = [];

      for (let i = 0; i < rawFrames.length; i++) {
        const frame = rawFrames[i];
        const prevFrame = rawFrames[i - 1];

        if (prevFrame) {
          if (prevFrame.disposalType === 2) {
            const d = prevFrame.dims;
            compositingCtx.clearRect(d.left, d.top, d.width, d.height);
          } else if (prevFrame.disposalType === 3) {
            compositingCtx.clearRect(0, 0, gifW, gifH);
            compositingCtx.drawImage(previousCanvas, 0, 0);
          }
        }

        previousCtx.clearRect(0, 0, gifW, gifH);
        previousCtx.drawImage(compositingCanvas, 0, 0);

        const patch = new ImageData(frame.patch, frame.dims.width, frame.dims.height);
        compositingCtx.putImageData(patch, frame.dims.left, frame.dims.top);

        finalCtx.fillStyle = '#fff';
        finalCtx.fillRect(0, 0, 128, 64);

        const fit = fitContain(gifW, gifH, 128, 64);
        finalCtx.drawImage(compositingCanvas, fit.offsetX, fit.offsetY, fit.drawW, fit.drawH);

        const full = finalCtx.getImageData(0, 0, 128, 64);
        ditherFS(full);

        newFrames.push({
          buffer: getBufferFromImageData(full),
          delay: Math.max(20, frame.delay || 100)
        });
      }

      frames = newFrames.length ? newFrames : [makeEmptyFrame(200)];
      currentFrame = 0;
      loadCurrentFrameToCanvas();
      renderFramesStrip();
      updateFrameUi();
      updateStatus(`🎞️ GIF importé: ${frames.length} frames`);
    } catch (e) {
      updateStatus('❌ Erreur GIF: ' + e.message);
    }
  }

  function toggleGifAnim() {
    if (isPlayingFrames) stopFrames();
    else playFrames();
  }

  function sendDraw() {
    sendCurrentFrame();
  }

  function exportArduino() {
    saveCanvasToCurrentFrame(true);
    const data = ctx.getImageData(0, 0, 128, 64).data;
    let code = 'void monDessin() {\\n  display.clearDisplay();\\n';
    const pixels = [];

    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 128; x++) {
        const i = (y * 128 + x) * 4;
        if (data[i] < 128) {
          pixels.push(`  display.drawPixel(${x},${y},SSD1306_WHITE);`);
        }
      }
    }

    code += pixels.join('\\n');
    code += '\\n  display.display();\\n}\\n\\n// Appel: monDessin();';

    if (frames.length > 1) {
      code += '\\n\\n// Animation timeline';
      for (let f = 0; f < frames.length; f++) {
        code += `\\nconst uint8_t frame_${f}[] PROGMEM = {`;
        for (let i = 0; i < 1024; i++) {
          if (i % 16 === 0) code += '\\n  ';
          code += '0x' + frames[f].buffer[i].toString(16).padStart(2, '0') + ', ';
        }
        code += '\\n};\\n';
      }
    }

    document.getElementById('exportArea').value = code;
    updateStatus('⚡ Arduino exporté');
  }

  function exportBuffer() {
    saveCanvasToCurrentFrame(true);

    if (frames.length === 1) {
      const buf = frames[0].buffer;
      let hex = 'const uint8_t monDessin[] PROGMEM = {\\n';
      for (let i = 0; i < 1024; i++) {
        hex += (i % 16 === 0 ? '  ' : ' ') + '0x' + buf[i].toString(16).padStart(2, '0') + (i % 16 === 15 ? ',\\n' : ',');
      }
      hex += '};\\n\\n// renderBuffer(monDessin, 1024);';
      document.getElementById('exportArea').value = hex;
    } else {
      const exported = {
        width: 128,
        height: 64,
        frames: frames.map(f => ({
          delay: f.delay,
          data: Array.from(f.buffer)
        }))
      };
      document.getElementById('exportArea').value = JSON.stringify(exported, null, 2);
    }

    updateStatus('📦 Buffer/anim exporté');
  }

  function copyExport() {
    const area = document.getElementById('exportArea');
    area.select();
    document.execCommand('copy');
    updateStatus('📋 Copié');
  }

  function tama(id) {
    fetch('/element?id=' + id).catch(() => {});
    updateStatus('🎨 Tama ' + id + ' envoyé');
  }

  function setTool(t) {
    tool = t;
    document.querySelectorAll('[id^="btn_"]').forEach(b => b.classList.remove('active'));
    document.getElementById('btn_' + t)?.classList.add('active');
    polyPoints = [];
    updateStatus();
  }

  canvas.addEventListener('mousedown', startDraw);
  canvas.addEventListener('mousemove', moveDraw);
  canvas.addEventListener('mouseup', endDraw);
  canvas.addEventListener('mouseleave', endDraw);

  canvas.addEventListener('touchstart', startDraw, { passive: false });
  canvas.addEventListener('touchmove', moveDraw, { passive: false });
  canvas.addEventListener('touchend', endDraw, { passive: false });

  window.setTool = setTool;
  window.updateFps = updateFps;
  window.updateSize = updateSize;
  window.updateSnap = updateSnap;
  window.toggleFill = toggleFill;
  window.toggleGrid = toggleGrid;
  window.toggleColor = toggleColor;
  window.toggleMode = toggleMode;
  window.undo = undo;
  window.redo = redo;
  window.clearScreen = clearScreen;
  window.sendDraw = sendDraw;
  window.toggleInvert = toggleInvert;
  window.importTextArt = importTextArt;
  window.exportPixels = exportPixels;
  window.loadMedia = loadMedia;
  window.toggleGifAnim = toggleGifAnim;
  window.exportArduino = exportArduino;
  window.exportBuffer = exportBuffer;
  window.copyExport = copyExport;
  window.tama = tama;

  window.prevFrame = prevFrame;
  window.nextFrame = nextFrame;
  window.addFrame = addFrame;
  window.duplicateFrame = duplicateFrame;
  window.deleteFrame = deleteFrame;
  window.saveCurrentFrame = saveCurrentFrame;
  window.playFrames = playFrames;
  window.stopFrames = stopFrames;
  window.sendCurrentFrame = sendCurrentFrame;
  window.sendAnimationToOled = sendAnimationToOled;
  window.updateFrameDelay = updateFrameDelay;

  initFrames();
  updateStatus('✅ App animation prête');
})();
</script>
</body></html>
)rawliteral";

void setup() {
  Serial.begin(115200);
  if(!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("OLED FAIL");
    while(1);
  }

  WiFi.begin(ssid, password);
  Serial.print("WiFi");
  while(WiFi.status() != WL_CONNECTED) {
    delay(500); Serial.print("."); yield();
  }
  Serial.println("\nIP: " + WiFi.localIP().toString());
  server.begin();
}

void sendHTML(WiFiClient& client) {
  client.print(F("HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nConnection: close\r\n\r\n"));
  size_t len = strlen_P((PGM_P)html_page);
  const char* p = html_page;
  char chunk[512];
  while (len > 0) {
    size_t toSend = min((size_t)512, len);
    memcpy_P(chunk, p, toSend);
    client.write((uint8_t*)chunk, toSend);
    p += toSend;
    len -= toSend;
    yield();
  }
}

String urlDecode(String str) {
  str.replace("%20", " ");
  str.replace("%21", "!");
  str.replace("%2C", ",");
  str.replace("%3F", "?");
  str.replace("+", " ");
  return str;
}

// REMPLACER renderBuffer COMPLETEMENT// REMPLACER renderBuffer COMPLETEMENT
void renderBuffer(uint8_t* buf, int size) {
  static uint8_t lastBuf[1024] = {0};

  bool isClear = true;
  for(int i = 0; i < 1024; i++) {
    if(buf[i] != 0) { isClear = false; break; }
  }

  if(isClear) {
    // FORCE CLEAR + RESET lastBuf
    display.clearDisplay();
    memset(lastBuf, 0, 1024);
  } else {
    // Différentiel normal
    for(int page = 0; page < 8; page++) {
      for(int x = 0; x < 128; x++) {
        uint8_t b = buf[page*128 + x];
        uint8_t lastB = lastBuf[page*128 + x];
        if(b != lastB) {
          for(int row = 0; row < 8; row++) {
            int y = page*8 + row;
            bool newPixel = (b & (1<<row));
            bool lastPixel = (lastB & (1<<row));
            if(newPixel != lastPixel) {
              display.drawPixel(x, y, newPixel ? SSD1306_WHITE : SSD1306_BLACK);
            }
          }
        }
      }
    }
    memcpy(lastBuf, buf, 1024);
  }
  display.display();
}

void loop() {
  WiFiClient client = server.available();
  if (!client) return;

  Serial.println(">>> Client: " + client.remoteIP().toString());

  unsigned long timeout = millis() + 3000;
  while (client.connected() && !client.available() && millis() < timeout) {
    delay(1); yield();
  }
  if (!client.connected() || !client.available()) {
    client.stop();
    return;
  }

  String req = client.readStringUntil('\r');
  Serial.println("Req: " + req);
  client.flush();

// REMPLACER le bloc POST /draw dans loop() COMPLETEMENT
if(req.indexOf("POST /draw") != -1) {
  // Skip headers
  while(client.available()) {
    String line = client.readStringUntil('\n');
    if(line == "\r") break;
  }

  uint8_t buf[1024];
  int totalBytes = 0;
  unsigned long timeout = millis() + 5000; // 5s timeout

  // LECTURE COMPLÈTE 1024 bytes (attend tout le flux)
  while(totalBytes < 1024 && millis() < timeout) {
    while(client.available()) {
      buf[totalBytes++] = client.read();
      if(totalBytes == 1024) break;
    }
    yield();
  }

  // VÉRIFICATION + rendu
  if(totalBytes == 1024) {
    renderBuffer(buf, 1024);
    Serial.println("✓ Buffer 1024 OK");
  } else {
    Serial.println("✗ Buffer incomplet: " + String(totalBytes));
    // Envoi buffer zéro si erreur (anti full-blanc)
    memset(buf, 0, 1024);
    renderBuffer(buf, 1024);
  }

  client.println(F("HTTP/1.1 200 OK\r\nConnection: close\r\n\r\nOK"));
  client.stop();
  return;
}

  if(req.indexOf("GET /text?") != -1) {
    int start = req.indexOf("text=") + 5;
    int end = req.indexOf(" HTTP", start);
    if(start > 4 && end > start) {
      String text = urlDecode(req.substring(start, end));
      display.clearDisplay();
      display.setTextSize(2);
      display.setTextColor(SSD1306_WHITE);
      display.setCursor(0, 20);
      display.print(text);
      display.display();
    }
    client.println(F("HTTP/1.1 200 OK\r\nConnection: close\r\n\r\n"));
    client.stop();
    return;
  }

  if(req.indexOf("/clear") != -1) {
    display.clearDisplay();
    display.display();
    client.println(F("HTTP/1.1 200 OK\r\nConnection: close\r\n\r\n"));
    client.stop();
    return;
  }

  if(req.indexOf("/invert") != -1) {
    invertMode = !invertMode;
    display.invertDisplay(invertMode);
    client.println(F("HTTP/1.1 200 OK\r\nConnection: close\r\n\r\n"));
    client.stop();
    return;
  }

  if(req.indexOf("/element?") != -1) {
    int idStart = req.indexOf("id=") + 3;
    int idEnd = req.indexOf(" ", idStart);
    int id = idEnd > 0 ? req.substring(idStart, idEnd).toInt() : 0;
    display.clearDisplay();
    switch(id) {
      case 0: display.setCursor(20,20);display.setTextSize(2);display.print("😺"); break;
      case 1: display.fillCircle(64,32,20,SSD1306_WHITE); break;
      case 2: display.drawRect(10,10,108,44,SSD1306_WHITE); break;
      case 3: display.fillCircle(64,32,15,SSD1306_WHITE);display.drawCircle(64,32,25,SSD1306_WHITE); break;
      case 4: for(int i=0;i<128;i+=4)display.drawPixel(i,32,SSD1306_WHITE); break;
      case 5: display.fillRect(50,20,28,24,SSD1306_WHITE); break;
    }
    display.display();
    client.println(F("HTTP/1.1 200 OK\r\nConnection: close\r\n\r\n"));
    client.stop();
    return;
  }

  sendHTML(client);
  client.stop();
}
