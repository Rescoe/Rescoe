#include <ESP8266WiFi.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <LittleFS.h>


const char* ssid = "";
const char* password = "";

IPAddress local_IP(192, 168, 1, 16);
IPAddress gateway(192, 168, 1, 1);
IPAddress subnet(255, 255, 255, 0);
IPAddress primaryDNS(1, 1, 1, 1);
IPAddress secondaryDNS(8, 8, 8, 8);

WiFiServer server(5058);

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);


#define GALLERY_SIZE 20
#define ANIM_MAX_FRAMES 5

uint8_t lastRendered[1024] = {0};

struct GalleryIndex {
  uint16_t magic;
  uint16_t version;
  uint16_t head;
  uint16_t count;
};

GalleryIndex galleryIndex = {0xBEEF, 1, 0, 0};

String pendingAuthor = "";
String pendingTimestamp = "";


struct AnimFrame { uint8_t* buf; uint16_t delay; };
AnimFrame animFrames[ANIM_MAX_FRAMES];
uint8_t   animFrameCount = 0;
uint8_t   animCurFrame   = 0;
bool      animRunning    = false;
unsigned long animLastT  = 0;

const char PROGMEM html_page[] = R"rawliteral(
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Collaborative Oled Galerie</title>

<style>
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Space+Grotesk:wght@400;500;700&display=swap');

  :root {
    --bg:      #0d0d0f;
    --surface: #17171a;
    --surf2:   #1e1e22;
    --border:  #2a2a30;
    --accent:  #00e5b0;
    --red:     #ff4757;
    --orange:  #ffa502;
    --text:    #e8e8ed;
    --text2:   #7a7a8a;
    --mono:    'JetBrains Mono', monospace;
    --sans:    'Space Grotesk', sans-serif;
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: var(--bg); color: var(--text); font-family: var(--sans);
    min-height: 100vh; display: flex; flex-direction: column;
    align-items: center; padding: 14px; gap: 10px;
  }

  header {
    width: 100%; max-width: 560px; display: flex;
    align-items: center; justify-content: space-between;
    padding: 10px 14px; background: var(--surface);
    border: 1px solid var(--border); border-radius: 10px;
  }
  header h1 { font-family: var(--mono); font-size: 13px; font-weight: 700; color: var(--accent); letter-spacing: .06em; text-transform: uppercase; }
  #userBadge { font-family: var(--mono); font-size: 11px; color: var(--text2); display: flex; align-items: center; gap: 6px; }
  #userBadge strong { color: var(--orange); }

  #status {
    width: 100%; max-width: 560px; font-family: var(--mono); font-size: 11px;
    color: var(--text2); padding: 6px 12px; background: var(--surface);
    border: 1px solid var(--border); border-radius: 8px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }

  #canvasWrap {
    position: relative; display: inline-block;
    border: 2px solid var(--border); border-radius: 6px; overflow: hidden;
    box-shadow: 0 0 28px rgba(0,229,176,.06); background: #fff;
  }
  #canvas, #layerCanvas {
    display: block; width: min(90vw, 512px); height: auto;
    image-rendering: pixelated; cursor: crosshair;
  }
  #layerCanvas { position: absolute; top:0; left:0; pointer-events: none; }

  .tabs {
    width: 100%; max-width: 560px; display: flex; gap: 4px; padding: 5px;
    background: var(--surface); border: 1px solid var(--border); border-radius: 10px;
  }
  .tab-btn {
    flex: 1; padding: 8px 4px; background: none; border: none; border-radius: 7px;
    color: var(--text2); font-family: var(--mono); font-size: 11px; font-weight: 600;
    cursor: pointer; transition: all .2s; white-space: nowrap;
  }
  .tab-btn:hover { color: var(--text); background: var(--surf2); }
  .tab-btn.active { background: var(--accent); color: #000; }

  .panel {
    display: none; width: 100%; max-width: 560px; background: var(--surface);
    border: 1px solid var(--border); border-radius: 10px;
    padding: 14px; gap: 10px; flex-direction: column;
  }
  .panel.active { display: flex; }
  .panel-title {
    font-family: var(--mono); font-size: 11px; font-weight: 700;
    color: var(--accent); text-transform: uppercase; letter-spacing: .08em;
    padding-bottom: 8px; border-bottom: 1px solid var(--border);
  }

  .row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }

  button.btn {
    padding: 7px 11px; background: var(--surf2); border: 1px solid var(--border);
    border-radius: 7px; color: var(--text); font-family: var(--mono);
    font-size: 11px; font-weight: 600; cursor: pointer; transition: all .15s; white-space: nowrap;
  }
  button.btn:hover  { border-color: var(--accent); color: var(--accent); }
  button.btn.active { background: var(--accent); border-color: var(--accent); color: #000; }
  button.btn.danger { border-color: var(--red); color: var(--red); }
  button.btn.danger:hover { background: var(--red); color: #fff; }
  button.btn.send   { border-color: var(--accent); color: var(--accent); }
  button.btn.send:hover { background: var(--accent); color: #000; }

  .sr { display:flex; align-items:center; gap:8px; font-family:var(--mono); font-size:11px; color:var(--text2); }
  .sr label { min-width:44px; }
  .sr input[type=range] { width:90px; accent-color:var(--accent); cursor:pointer; }
  .sv { color:var(--accent); font-weight:600; min-width:38px; }

  .tog { display:flex; align-items:center; gap:8px; font-family:var(--mono); font-size:11px; color:var(--text2); cursor:pointer; user-select:none; }
  .tog input { display:none; }
  .tok { width:36px; height:18px; background:var(--surf2); border:1px solid var(--border); border-radius:9px; position:relative; transition:background .2s; }
  .tok::after { content:''; position:absolute; width:12px; height:12px; background:var(--text2); border-radius:50%; top:2px; left:2px; transition:all .2s; }
  .tog input:checked + .tok { background:var(--accent); border-color:var(--accent); }
  .tog input:checked + .tok::after { left:20px; background:#000; }

  #framesStrip { display:flex; gap:6px; overflow-x:auto; padding:4px 0; min-height:42px; }
  #framesStrip canvas { border-radius:5px; cursor:pointer; flex-shrink:0; transition:transform .15s; }
  #framesStrip canvas:hover { transform:scale(1.05); }
  #frameInfo { font-family:var(--mono); font-size:11px; color:var(--orange); padding:5px 10px; background:var(--surf2); border:1px solid var(--border); border-radius:6px; white-space:nowrap; }

  textarea { width:100%; height:110px; background:var(--surf2); color:var(--text); border:1px solid var(--border); border-radius:7px; font-family:var(--mono); font-size:11px; padding:9px; resize:vertical; }

  .file-btn { padding:7px 11px; background:var(--surf2); border:1px solid var(--red); border-radius:7px; color:var(--red); font-family:var(--mono); font-size:11px; font-weight:600; cursor:pointer; transition:all .15s; display:inline-block; white-space:nowrap; }
  .file-btn:hover { background:var(--red); color:#fff; }

  .overlay { position:fixed; inset:0; background:rgba(0,0,0,.88); display:none; justify-content:center; align-items:center; z-index:200; padding:16px; }
  .overlay.active { display:flex; }
  .mbox { background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:20px; width:100%; max-width:380px; display:flex; flex-direction:column; gap:14px; }
  .mtitle { font-family:var(--mono); font-size:13px; font-weight:700; color:var(--accent); text-transform:uppercase; }
  .mbox p { font-family:var(--mono); font-size:11px; color:var(--text2); line-height:1.6; }
  .mbox input[type=text] { width:100%; padding:10px 12px; background:var(--surf2); border:1px solid var(--border); border-radius:7px; color:var(--text); font-family:var(--mono); font-size:14px; outline:none; transition:border-color .2s; }
  .mbox input[type=text]:focus { border-color:var(--accent); }

  #cropPreview { image-rendering:pixelated; border:1px solid var(--border); border-radius:4px; background:#fff; width:100%; max-width:256px; height:auto; display:block; margin:0 auto; }

  select { padding:6px 9px; background:var(--surf2); border:1px solid var(--border); border-radius:7px; color:var(--text); font-family:var(--mono); font-size:11px; cursor:pointer; }

.gallery-grid{
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(150px,1fr));
  gap:10px;
}
.gcard{
  background:var(--surf2);
  border:1px solid var(--border);
  border-radius:8px;
  padding:8px;
  display:flex;
  flex-direction:column;
  gap:8px;
}
.gmeta{
  display:flex;
  flex-direction:column;
  gap:2px;
  font-family:var(--mono);
  font-size:10px;
  color:var(--text2);
}
.gmeta strong{
  color:var(--text);
  font-size:11px;
}
.gempty{
  font-family:var(--mono);
  font-size:11px;
  color:var(--text2);
  padding:8px;
}

.dither-preview-card {
  background: var(--surf2); border: 1px solid var(--border); border-radius: 7px;
  padding: 6px; cursor: pointer; display: flex; flex-direction: column; gap: 4px;
  font-family: var(--mono); font-size: 10px; color: var(--text2); text-align: center;
  transition: border-color .15s;
}
.dither-preview-card:hover  { border-color: var(--accent); }
.dither-preview-card.active { border-color: var(--accent); color: var(--accent); }
</style>
</head>
<body>

<header>
  <h1>◼ OLED Paint</h1>
  <div id="userBadge">Dernier envoi: <strong id="userDisplay">—</strong></div>
</header>

<div id="status">Prêt</div>

<div id="canvasWrap">
  <canvas id="canvas"      width="128" height="64"></canvas>
  <canvas id="layerCanvas" width="128" height="64"></canvas>
</div>

<div class="tabs">
  <button class="tab-btn active" onclick="showTab('frames',this)">🎞 Frames</button>
  <button class="tab-btn"        onclick="showTab('draw',this)"  >🖌 Dessin</button>
  <button class="tab-btn"        onclick="showTab('media',this)" >🖼 Média</button>
  <button class="tab-btn"        onclick="showTab('export',this)">💾 Export</button>
  <button class="tab-btn" onclick="showTab('gallery',this); loadGallery();">Galerie</button>

</div>

<!-- FRAMES -->
<div class="panel active" id="panel-frames">
  <div class="panel-title">Timeline & Animation</div>
  <div class="row">
    <button class="btn" onclick="prevFrame()">⏮ Prev</button>
    <button class="btn" onclick="nextFrame()">⏭ Next</button>
    <button class="btn" onclick="addFrame()">＋ Ajouter</button>
    <button class="btn" onclick="dupFrame()">⎘ Dupliquer</button>
    <button class="btn danger" onclick="delFrame()">✕ Suppr</button>
  </div>
  <div class="row">
    <button class="btn"      onclick="togglePlay()" id="playBtn">▶ Lire</button>
    <button class="btn send" onclick="sendFrame()">↑ Frame→OLED</button>
    <button class="btn send" onclick="toggleOledAnim()" id="animBtn">📺 Anim→OLED</button>
  </div>
  <div class="row">
    <div class="sr">
      <label>Délai:</label>
      <input type="range" min="50" max="2000" step="10" value="200" id="delaySlider" oninput="setDelay(this.value)">
      <span class="sv" id="delayVal">200ms</span>
    </div>
    <div id="frameInfo">Frame 1/1</div>
  </div>
  <div class="row">
    <label class="tog">
      <input type="checkbox" id="onionCheck" onchange="toggleOnion()">
      <span class="tok"></span>
      Onion Skin (2 frames)
    </label>
    <div class="sr">
      <label>Opacité:</label>
      <input type="range" min="10" max="80" value="35" id="onionSlider" oninput="setOnionOpacity(this.value)">
      <span class="sv" id="onionVal">35%</span>
    </div>
  </div>

  <div class="row">
  <button class="btn" onclick="saveCurrentPng()">Sauver PNG</button>
  <button class="btn" onclick="saveAnimationGif()">Sauver GIF</button>
</div>


  <div id="framesStrip"></div>

</div>

<!-- DRAW -->
<div class="panel" id="panel-draw">
  <div class="panel-title">Outils de Dessin</div>
  <div class="row">
    <button class="btn active" id="btn_brush"  onclick="setTool('brush')" >🖌 Pinceau</button>
    <button class="btn"        id="btn_eraser" onclick="setTool('eraser')">⬜ Gomme</button>
    <button class="btn"        id="btn_line"   onclick="setTool('line')"  >╱ Ligne</button>
    <button class="btn"        id="btn_rect"   onclick="setTool('rect')"  >▭ Rect</button>
    <button class="btn"        id="btn_circle" onclick="setTool('circle')">◯ Cercle</button>
    <button class="btn"        id="btn_poly"   onclick="setTool('poly')"  >△ Poly</button>
  </div>
  <div class="row">
    <div class="sr">
      <label>Taille:</label>
      <input type="range" min="1" max="8" value="1" id="sizeSlider" oninput="setSize(this.value)">
      <span class="sv" id="sizeVal">1px</span>
    </div>
    <div class="sr">
      <label>Snap:</label>
      <input type="range" min="1" max="16" value="1" id="snapSlider" oninput="setSnap(this.value)">
      <span class="sv" id="snapVal">1px</span>
    </div>
  </div>
  <div class="row">
    <label class="tog"><input type="checkbox" id="fillCheck" onchange="setFill(this.checked)"><span class="tok"></span>Remplir</label>
    <label class="tog"><input type="checkbox" id="gridCheck" onchange="setGrid(this.checked)"><span class="tok"></span>Grille</label>
    <label class="tog"><input type="checkbox" id="symCheck"  onchange="setSym(this.checked)"> <span class="tok"></span>Symétrie</label>
  </div>
  <div class="row">
    <button class="btn" onclick="toggleColor()" id="colorBtn">● NOIR</button>
    <button class="btn" onclick="undo()">↶ Undo</button>
    <button class="btn" onclick="redo()">↷ Redo</button>
    <button class="btn" onclick="flipH()">↔ Flip H</button>
    <button class="btn" onclick="flipV()">↕ Flip V</button>
    <button class="btn danger" onclick="clearCanvas()">✕ Vider</button>
    <button class="btn" onclick="toggleInvert()">⬛ Invert</button>
  </div>
</div>

<!-- MEDIA -->
<div class="panel" id="panel-media">
  <div class="panel-title">Import Média</div>
  <div class="row">
    <input type="file" id="fileInput" accept="image/*,.gif" style="display:none" onchange="loadFile(event)">
    <label for="fileInput" class="file-btn">🖼 Ouvrir image / GIF</label>
  </div>
  <div class="row">
    <div class="sr">
      <label>Seuil:</label>
      <input type="range" min="0" max="255" value="128" id="threshSlider" oninput="setThreshold(this.value)">
      <span class="sv" id="threshVal">128</span>
    </div>
  </div>
  <!-- Boutons de mode dithering avec preview intégrée -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px;">
    <div id="dp_floyd"    class="dither-preview-card active" onclick="setDither('floyd')"    data-mode="floyd">
      <canvas id="preview_floyd"    width="128" height="64" style="width:100%;height:auto;image-rendering:pixelated;background:#fff;border-radius:4px;"></canvas>
      <span>Floyd-Steinberg</span>
    </div>
    <div id="dp_ordered"  class="dither-preview-card" onclick="setDither('ordered')"  data-mode="ordered">
      <canvas id="preview_ordered"  width="128" height="64" style="width:100%;height:auto;image-rendering:pixelated;background:#fff;border-radius:4px;"></canvas>
      <span>Ordered 4×4</span>
    </div>
    <div id="dp_atkinson" class="dither-preview-card" onclick="setDither('atkinson')" data-mode="atkinson">
      <canvas id="preview_atkinson" width="128" height="64" style="width:100%;height:auto;image-rendering:pixelated;background:#fff;border-radius:4px;"></canvas>
      <span>Atkinson</span>
    </div>
    <div id="dp_none"     class="dither-preview-card" onclick="setDither('none')"     data-mode="none">
      <canvas id="preview_none"     width="128" height="64" style="width:100%;height:auto;image-rendering:pixelated;background:#fff;border-radius:4px;"></canvas>
      <span>Seuil simple</span>
    </div>
  </div>
  <!-- Preview text art de l'image -->
  <div id="txtArtPreview" style="display:none;margin-top:6px;">
    <div class="panel-title" style="margin-bottom:4px;">Aperçu Text Art</div>
    <pre id="txtArtPreviewContent" style="font-size:4px;line-height:1;background:var(--surf2);padding:6px;border-radius:6px;overflow:hidden;white-space:pre;"></pre>
  </div>
  <div class="row" style="margin-top:6px;">
    <button class="btn" onclick="applySelectedDither()">✓ Appliquer ce mode</button>
    <button class="btn" onclick="toggleTxtArtPreview()">📄 Aperçu Text Art</button>
  </div>
  <textarea id="txtArt" placeholder="Coller du TXT Art ici (█ # @)..."></textarea>
  <div class="row">
    <button class="btn" onclick="importTxtArt()">← Importer TXT</button>
  </div>
</div>


<!-- EXPORT -->
<div class="panel" id="panel-export">
  <div class="panel-title">Export</div>
  <div class="row">
    <button class="btn" onclick="exportTxt()">📄 TXT Art</button>
    <button class="btn" onclick="exportArduino()">⚡ Arduino</button>
    <button class="btn" onclick="exportBuffer()">📦 Buffer</button>
    <button class="btn" onclick="copyExport()">⎘ Copier</button>
  </div>
  <textarea id="exportArea" readonly placeholder="Code exporté ici..."></textarea>
</div>

<div class="panel" id="panel-gallery">
  <div class="panel-title">Dernières œuvres</div>
  <div id="galleryGrid" class="gallery-grid"></div>
</div>

<!-- MODAL: USERNAME — popup à chaque envoi vers OLED -->
<div class="overlay" id="userModal">
  <div class="mbox">
    <div class="mtitle">👤 Qui dessine ?</div>
    <p>Ton prénom apparaîtra brièvement en haut de l'écran OLED, puis ton dessin s'affichera.</p>
    <input type="text" id="usernameInput" placeholder="Ton prénom (max 10 car.)..." maxlength="10">
    <div class="row">
      <button class="btn send"   onclick="confirmSend()" style="flex:1">↑ Envoyer</button>
      <button class="btn danger" onclick="cancelSend()"  style="flex:1">✕ Annuler</button>
    </div>
  </div>
</div>

<!-- MODAL: CROP — contain / cover / stretch sans sliders -->
<div class="overlay" id="cropModal">
  <div class="mbox">
    <div class="mtitle">📐 Recadrage</div>
    <canvas id="cropPreview" width="128" height="64"></canvas>
    <div class="row">
      <button class="btn active" id="cropContain" onclick="setCropFit('contain')">Contain</button>
      <button class="btn"        id="cropCover"   onclick="setCropFit('cover')"  >Cover</button>
      <button class="btn"        id="cropStretch" onclick="setCropFit('stretch')">Étirer</button>
    </div>
    <div class="row">
      <button class="btn send"   onclick="applyCrop()"  style="flex:1">✓ Appliquer</button>
      <button class="btn danger" onclick="cancelCrop()" style="flex:1">✕ Annuler</button>
    </div>
  </div>
</div>

<script>
(function () {

// ═══════════════════════════════════════════════════════════════════
//  CANVAS
// ═══════════════════════════════════════════════════════════════════
const canvas = document.getElementById('canvas');
const lcanvas = document.getElementById('layerCanvas');
const ctx  = canvas.getContext('2d', { willReadFrequently: true });
const lctx = lcanvas.getContext('2d', { willReadFrequently: true });
ctx.imageSmoothingEnabled = lctx.imageSmoothingEnabled = false;
ctx.fillStyle = '#fff';
ctx.fillRect(0, 0, 128, 64);

// ═══════════════════════════════════════════════════════════════════
//  DRAWING STATE
// ═══════════════════════════════════════════════════════════════════
let tool = 'brush', drawColor = '#000';
let size = 1, snapSize = 1;
let rawSourceImg = null; // ImageData brute de l'image chargée, avant dithering

let fillMode = false, gridMode = false, symMode = false;
let drawing = false, startX = 0, startY = 0, shapeSnap = null;
let polyPoints = [];
let threshold = 128, ditherMode = 'floyd';
let oledInverted = true;

// ═══════════════════════════════════════════════════════════════════
//  HISTORY  (Uint8Array per frame — lightweight, always in-sync)
// ═══════════════════════════════════════════════════════════════════
let history = [], histIdx = -1;

function saveHistory() {
  history = history.slice(0, histIdx + 1);
  history.push(new Uint8Array(frames[curFrame].buffer));
  histIdx = history.length - 1;
  if (history.length > 40) { history.shift(); histIdx = history.length - 1; }
}

window.undo = () => {
  if (histIdx <= 0) return;
  histIdx--;
  frames[curFrame].buffer = new Uint8Array(history[histIdx]);
  bufToCanvas(frames[curFrame].buffer);
  clearOverlay(); renderStrip();
};
window.redo = () => {
  if (histIdx >= history.length - 1) return;
  histIdx++;
  frames[curFrame].buffer = new Uint8Array(history[histIdx]);
  bufToCanvas(frames[curFrame].buffer);
  clearOverlay(); renderStrip();
};

// ═══════════════════════════════════════════════════════════════════
//  FRAMES
// ═══════════════════════════════════════════════════════════════════
let frames = [], curFrame = 0;

function makeFrame(delay = 200) { return { buffer: new Uint8Array(1024), delay }; }

function initFrames() {
  //clearOverlay();
  frames = [makeFrame()]; curFrame = 0;
  saveToFrame(true); renderStrip(); loadFrame(); updateFrameUi();
}

function saveToFrame(silent = false) {
  if (!frames[curFrame]) return;
  // Always binarise when writing to buffer — prevents grid/overlay bleed
  frames[curFrame].buffer = imgDataToBuf(ctx.getImageData(0, 0, 128, 64));
  if (!silent) setStatus('Frame ' + (curFrame + 1) + ' sauvée');
}

function loadFrame() {
  if (!frames[curFrame]) return;
  bufToCanvas(frames[curFrame].buffer);
  clearOverlay(); saveHistory(); updateFrameUi();
}

function updateFrameUi() {
  document.getElementById('frameInfo').textContent = 'Frame ' + (curFrame + 1) + '/' + frames.length;
  const f = frames[curFrame];
  if (f) {
    document.getElementById('delaySlider').value = f.delay;
    document.getElementById('delayVal').textContent = f.delay + 'ms';
  }
  setStatus();
}

function renderStrip() {
  const strip = document.getElementById('framesStrip');
  strip.innerHTML = '';
  frames.forEach((f, i) => {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 32;
    Object.assign(c.style, { width:'64px', height:'32px', background:'#fff',
      border: i === curFrame ? '2px solid var(--accent)' : '1px solid #333',
      borderRadius: '5px' });
    c.title = 'Frame ' + (i+1) + ' (' + f.delay + 'ms)';
    const fc = c.getContext('2d');
    const img = fc.createImageData(64, 32);
    for (let py=0; py<32; py++) for (let px=0; px<64; px++) {
      const bi = Math.floor(py*2/8)*128 + px*2, bit = (py*2)%8;
      const v = (f.buffer[bi] & (1<<bit)) ? 0 : 255;
      const ii = (py*64+px)*4;
      img.data[ii]=img.data[ii+1]=img.data[ii+2]=v; img.data[ii+3]=255;
    }
    fc.putImageData(img, 0, 0);
    c.addEventListener('click', () => { saveToFrame(true); curFrame=i; loadFrame(); renderStrip(); });
    strip.appendChild(c);
  });
}

window.prevFrame = () => { saveToFrame(true); curFrame=(curFrame-1+frames.length)%frames.length; loadFrame(); renderStrip(); };
window.nextFrame = () => { saveToFrame(true); curFrame=(curFrame+1)%frames.length; loadFrame(); renderStrip(); };
window.addFrame  = () => { saveToFrame(true); frames.splice(curFrame+1,0,makeFrame(frames[curFrame]?.delay||200)); curFrame++; loadFrame(); renderStrip(); setStatus('Frame '+(curFrame+1)+' ajoutée'); };
window.setDelay  = v => { if(!frames[curFrame])return; frames[curFrame].delay=parseInt(v); document.getElementById('delayVal').textContent=v+'ms'; renderStrip(); };

// ═══════════════════════════════════════════════════════════════════
//  PLAYBACK — requestAnimationFrame (survives tab switch)
// ═══════════════════════════════════════════════════════════════════
let playRafId=null, playLastT=0, isPlaying=false;

function playLoop(ts) {
  if (!isPlaying) return;
  if (ts - playLastT >= (frames[curFrame].delay||100)) {
    playLastT = ts;
    curFrame = (curFrame+1)%frames.length;
    bufToCanvas(frames[curFrame].buffer); clearOverlay(); renderStrip(); updateFrameUi();
  }
  playRafId = requestAnimationFrame(playLoop);
}


window.showTab = (name, btn) => {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('panel-' + name).classList.add('active');
};

window.dupFrame = () => {
  saveToFrame(true);
  const s = frames[curFrame];
  frames.splice(curFrame + 1, 0, {
    buffer: new Uint8Array(s.buffer),
    delay: s.delay
  });
  curFrame++;
  loadFrame();
  renderStrip();
  setStatus('Frame ' + (curFrame + 1) + ' dupliquée');
};

window.delFrame = () => {
  if (frames.length <= 1) {
    setStatus('1 frame minimum');
    return;
  }
  frames.splice(curFrame, 1);
  curFrame = Math.max(0, curFrame - 1);
  loadFrame();
  renderStrip();
  setStatus('Frame supprimée');
};

window.togglePlay = () => {
  if (isPlaying) {
    isPlaying = false;
    cancelAnimationFrame(playRafId);
    playRafId = null;
    document.getElementById('playBtn').textContent = '▶ Lire';
    setStatus('Lecture stoppée');
  } else {
    saveToFrame(true);
    isPlaying = true;
    playLastT = performance.now();
    document.getElementById('playBtn').textContent = '⏸ Pause';
    playRafId = requestAnimationFrame(playLoop);
    setStatus('Lecture…');
  }
};

// ─── TOGGLE OLED ANIM (version fusionnée) ───────────────────────────────────
window.toggleOledAnim = async () => {
  const btn = document.getElementById('animBtn');

  // — STOP —
  if (btn.dataset.running === '1') {
    btn.dataset.running = '0';
    btn.textContent = '📺 Anim→OLED';
    await fetch('/frames/stop', { method: 'POST' }).catch(() => {});
    setStatus('Animation OLED stoppée');
    return;
  }

  saveToFrame(true);

  // Une seule frame → envoi simple via le flow normal
  if (frames.length === 1) {
    window.sendFrame();
    return;
  }

  // Multi-frames → ouvrir le modal username d'abord
  pendingBuf = null;
  window._pendingAnimSend = true;          // flag pour confirmSend
  document.getElementById('usernameInput').value = window._lastName || '';
  document.getElementById('userModal').classList.add('active');
  setTimeout(() => {
    const inp = document.getElementById('usernameInput');
    inp.focus(); inp.select();
  }, 60);
};

// ─── CONFIRM SEND (version fusionnée — gère image seule ET animation) ────────
window.confirmSend = async () => {
  const name = document.getElementById('usernameInput').value.trim();
  if (!name) { document.getElementById('usernameInput').focus(); return; }

  window._lastName = name;
  document.getElementById('userDisplay').textContent = name;
  document.getElementById('userModal').classList.remove('active');

  // ── CAS 1 : upload animation multi-frames ──
  if (window._pendingAnimSend) {
    window._pendingAnimSend = false;
    const btn = document.getElementById('animBtn');
    btn.dataset.running = '1';
    btn.textContent = '⏸ Stop OLED';
    setStatus('Upload animation (' + frames.length + ' frames) par ' + name + '…');

    // Envoyer le username d'abord (affichage bref sur OLED)
    try {
      await fetch('/username?n=' + encodeURIComponent(name) +
                  '&t=' + encodeURIComponent(new Date().toLocaleString('fr-FR')));
      await new Promise(r => setTimeout(r, 300));
await stopOledAnimationOnly();
    } catch (_) {}

    // Sérialiser toutes les frames : [delay lo][delay hi][1024 bytes] × N
    const blob = new Uint8Array(frames.length * 1026);
    frames.forEach((f, i) => {
      const d = f.delay & 0xFFFF;
      blob[i * 1026 + 0] = d & 0xFF;
      blob[i * 1026 + 1] = (d >> 8) & 0xFF;
      blob.set(f.buffer, i * 1026 + 2);
    });

    try {
      const r = await fetch('/frames', { method: 'POST', body: blob });
      const count = await r.text();
      setStatus('Animation autonome: ' + count + ' frames sur OLED ✓ (' + name + ')');
    } catch {
      btn.dataset.running = '0';
      btn.textContent = '📺 Anim→OLED';
      setStatus('Erreur upload animation');
    }
    return;
  }

  // ── CAS 2 : envoi frame seule (flow normal) ──
  setStatus('Envoi par ' + name + '…');
  await doSend(pendingBuf, name);
  pendingBuf = null;
  setStatus('Envoyé sur OLED ✓ (' + name + ')');
};

// ═══════════════════════════════════════════════════════════════════
//  USERNAME — popup à chaque envoi
// ═══════════════════════════════════════════════════════════════════
let pendingBuf = null;

async function sendCurrentFrameToOled(saveToGallery = false) {
  saveToFrame(true);
  const buf = frames[curFrame].buffer;
  const url = saveToGallery ? "draw" : "draw?save=0";
  await fetch(url, {
    method: "POST",
    body: buf
  });
}

// "Frame→OLED" always opens the username popup first
window.sendFrame = () => {
  saveToFrame(true);
  pendingBuf = frames[curFrame].buffer;
  // Pre-fill with last used name for convenience
  document.getElementById('usernameInput').value = window._lastName || '';
  document.getElementById('userModal').classList.add('active');
  setTimeout(() => {
    const inp = document.getElementById('usernameInput');
    inp.focus(); inp.select();
  }, 60);
};

window.confirmSend = async () => {
  const name = document.getElementById('usernameInput').value.trim();
  if (!name) { document.getElementById('usernameInput').focus(); return; }
  window._lastName = name;
  document.getElementById('userDisplay').textContent = name;
  document.getElementById('userModal').classList.remove('active');

  // ← Branche animation
  if (window._pendingAnimSend) {
    window._pendingAnimSend = false;
    document.getElementById('animBtn').dataset.running = '1';
    document.getElementById('animBtn').textContent = '⏸ Stop OLED';
    setStatus('Upload animation (' + frames.length + ' frames)…');

    // Envoyer d'abord le nom/timestamp
    const ts = encodeURIComponent(new Date().toLocaleString('fr-FR', {
      day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'
    }));
    await fetch('/username?n=' + encodeURIComponent(name) + '&ts=' + ts);
    await new Promise(r => setTimeout(r, 300));

    const blob = new Uint8Array(frames.length * 1026);
    frames.forEach((f, i) => {
      const d = f.delay & 0xFFFF;
      blob[i * 1026 + 0] = d & 0xFF;
      blob[i * 1026 + 1] = (d >> 8) & 0xFF;
      blob.set(f.buffer, i * 1026 + 2);
    });
    try {
      const r = await fetch('/frames', { method: 'POST', body: blob });
      const count = await r.text();
      setStatus('Animation autonome: ' + count + ' frames ✓ (' + name + ')');
    } catch { setStatus('Erreur upload animation'); }
    return;
  }

  // Branche normale (frame unique)
  setStatus('Envoi par ' + name + '…');
  await doSend(pendingBuf, name);
  pendingBuf = null;
  setStatus('Envoyé sur OLED ✓ (' + name + ')');
};

window.cancelSend = () => {
  pendingBuf=null;
  document.getElementById('userModal').classList.remove('active');
  setStatus('Envoi annulé');
};

document.getElementById('usernameInput').addEventListener('keydown', e => {
  if (e.key==='Enter')  window.confirmSend();
  if (e.key==='Escape') window.cancelSend();
});


async function stopOledAnimationOnly() {
  try {
    await fetch("/frames/stop", { method: "POST" })
  } catch (e) {}
}

async function resetOledForStillImage() {
  try {
    await fetch("/frames/stop", { method: "POST" })
  } catch (e) {}
  try {
    await fetch("draw?save=0", {
      method: "POST",
      body: new Uint8Array(1024)
    });
    await new Promise(r => setTimeout(r, 40));
  } catch (e) {}
}


async function prepareOledForNewContent() {
  try {
    await fetch("/frames/stop", { method: "POST" })
  } catch (e) {}

  try {
    await fetch("draw?save=0", { method: "POST", body: new Uint8Array(1024) });
    await new Promise(r => setTimeout(r, 80));
  } catch (e) {}
}

async function doSend(buf, name, saveToGallery = true) {
  try {
    if (name) {
      const ts = encodeURIComponent(new Date().toLocaleString("fr-FR", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit"
      }));
      await fetch(`username?n=${encodeURIComponent(name)}&ts=${ts}`);
      await new Promise(r => setTimeout(r, 300));
    }

    await resetOledForStillImage();

    const url = saveToGallery ? "draw" : "draw?save=0";
    await fetch(url, { method: "POST", body: buf });
  } catch (err) {
    setStatus("Erreur envoi OLED");
  }
}


// ═══════════════════════════════════════════════════════════════════
//  ONION SKIN — 2 previous frames
//  frame-1 at onionOpacity, frame-2 at onionOpacity * 0.45
// ═══════════════════════════════════════════════════════════════════
let onionEnabled=false, onionOpacity=0.35;

window.toggleOnion     = () => { onionEnabled=document.getElementById('onionCheck').checked; clearOverlay(); setStatus('Onion skin: '+(onionEnabled?'ON':'OFF')); };
window.setOnionOpacity = v  => { onionOpacity=v/100; document.getElementById('onionVal').textContent=v+'%'; if(onionEnabled) clearOverlay(); };

function drawOnionSkin() {
  if (!onionEnabled) return;

  // Build layer list: [{buf, alpha}, ...]
  const layers = [];
  if (curFrame >= 1) layers.push({ buf: frames[curFrame-1].buffer, alpha: onionOpacity });
  if (curFrame >= 2) layers.push({ buf: frames[curFrame-2].buffer, alpha: onionOpacity * 0.45 });
  if (!layers.length) return;

  // Read current overlay (may already have something from a previous layer)
  const composite = lctx.getImageData(0, 0, 128, 64);

  layers.forEach(({ buf, alpha }) => {
    const a255 = Math.floor(255 * alpha);
    for (let page=0; page<8; page++) {
      for (let x=0; x<128; x++) {
        const b = buf[page*128+x];
        for (let bit=0; bit<8; bit++) {
          if (!((b>>bit)&1)) continue;
          const y = page*8+bit;
          const i = (y*128+x)*4;
          // Only paint if this pixel is more opaque than what's already there
          if (a255 > composite.data[i+3]) {
            composite.data[i]   = 0;
            composite.data[i+1] = 200;
            composite.data[i+2] = 140;
            composite.data[i+3] = a255;
          }
        }
      }
    }
  });
  lctx.putImageData(composite, 0, 0);
}

// Master overlay reset: clear → onion → optional live shape preview
function clearOverlay(previewFn = null) {
  lctx.clearRect(0, 0, 128, 64);
  drawOnionSkin();
  if (previewFn) previewFn();
}

// ═══════════════════════════════════════════════════════════════════
//  BUFFER ↔ CANVAS
// ═══════════════════════════════════════════════════════════════════
function imgDataToBuf(imgData) {
  const d = imgData.data, buf = new Uint8Array(1024);
  for (let page=0; page<8; page++) {
    for (let x=0; x<128; x++) {
      let b=0;
      for (let bit=0; bit<8; bit++) {
        const y=page*8+bit, i=(y*128+x)*4;
        if (d[i] < 128) b |= (1<<bit);
      }
      buf[page*128+x]=b;
    }
  }
  return buf;
}

function bufToCanvas(buf, targetCtx=ctx) {
  const img=targetCtx.createImageData(128,64);
  for (let page=0; page<8; page++) {
    for (let x=0; x<128; x++) {
      const b=buf[page*128+x];
      for (let bit=0; bit<8; bit++) {
        const y=page*8+bit, i=(y*128+x)*4, v=(b>>bit)&1?0:255;
        img.data[i]=img.data[i+1]=img.data[i+2]=v; img.data[i+3]=255;
      }
    }
  }
  targetCtx.putImageData(img,0,0);
  if (targetCtx===ctx && gridMode) drawGrid();
}

// ═══════════════════════════════════════════════════════════════════
//  PIXEL / SHAPE DRAWING
// ═══════════════════════════════════════════════════════════════════
function putPx(x, y, color) {
  ctx.fillStyle = color;
  for (let i=0; i<size; i++) for (let j=0; j<size; j++) {
    const px=x+i, py=y+j;
    if (px>=0&&px<128&&py>=0&&py<64) {
      ctx.fillRect(px,py,1,1);
      if (symMode) { const sx=127-px; if(sx>=0) ctx.fillRect(sx,py,1,1); }
    }
  }
}

function bresenham(sx,sy,ex,ey,col=drawColor) {
  sx=Math.floor(sx);sy=Math.floor(sy);ex=Math.floor(ex);ey=Math.floor(ey);
  let dx=Math.abs(ex-sx),dy=Math.abs(ey-sy),xs=sx<ex?1:-1,ys=sy<ey?1:-1,err=dx-dy,x=sx,y=sy;
  while(true){putPx(x,y,col);if(x===ex&&y===ey)break;const e2=2*err;if(e2>-dy){err-=dy;x+=xs;}if(e2<dx){err+=dx;y+=ys;}}
}

function drawRect(sx,sy,ex,ey){
  const rx=Math.min(sx,ex),ry=Math.min(sy,ey),w=Math.abs(ex-sx),h=Math.abs(ey-sy);
  if(fillMode){for(let y=ry;y<=ry+h;y++)for(let x=rx;x<=rx+w;x++)putPx(x,y,drawColor);}
  else{for(let x=rx;x<=rx+w;x++){putPx(x,ry,drawColor);putPx(x,ry+h,drawColor);}for(let y=ry;y<=ry+h;y++){putPx(rx,y,drawColor);putPx(rx+w,y,drawColor);}}
}

function drawCircle(sx,sy,ex,ey){
  const cx=Math.floor((sx+ex)/2),cy=Math.floor((sy+ey)/2),r=Math.floor(Math.hypot(ex-sx,ey-sy)*0.35);
  let x=r,y=0,err=0;
  while(x>=y){
    if(fillMode){for(let i=cx-x;i<=cx+x;i++){putPx(i,cy+y,drawColor);putPx(i,cy-y,drawColor);}for(let i=cx-y;i<=cx+y;i++){putPx(i,cy+x,drawColor);putPx(i,cy-x,drawColor);}}
    else{[[cx+x,cy+y],[cx+y,cy+x],[cx-y,cy+x],[cx-x,cy+y],[cx-x,cy-y],[cx-y,cy-x],[cx+y,cy-x],[cx+x,cy-y]].forEach(([px,py])=>putPx(px,py,drawColor));}
    y++;if(err<=0)err+=2*y+1;else{x--;err-=2*x+1;}
  }
}

function drawShapeFinal(sx,sy,ex,ey){
  if(tool==='rect')  drawRect(sx,sy,ex,ey);
  else if(tool==='circle') drawCircle(sx,sy,ex,ey);
  else if(tool==='line')   bresenham(sx,sy,ex,ey);
}

// Live preview on the overlay canvas
function previewOnLayer(sx,sy,ex,ey){
  clearOverlay(()=>{
    lctx.save();
    lctx.strokeStyle='rgba(0,229,176,.75)'; lctx.fillStyle='rgba(0,229,176,.3)';
    lctx.lineWidth=1; lctx.setLineDash([3,2]);
    if(tool==='rect'){const w=Math.abs(ex-sx),h=Math.abs(ey-sy),rx=Math.min(sx,ex),ry=Math.min(sy,ey);lctx.strokeRect(rx,ry,w,h);if(fillMode)lctx.fillRect(rx,ry,w,h);}
    else if(tool==='circle'){const cx=(sx+ex)/2,cy=(sy+ey)/2,r=Math.hypot(ex-sx,ey-sy)*0.35;lctx.beginPath();lctx.arc(cx,cy,r,0,Math.PI*2);lctx.stroke();if(fillMode)lctx.fill();}
    else if(tool==='line'){lctx.beginPath();lctx.moveTo(sx,sy);lctx.lineTo(ex,ey);lctx.stroke();}
    lctx.setLineDash([]); lctx.restore();
  });
}

function previewPolyOnLayer(mx,my){
  if(!polyPoints.length)return;
  clearOverlay(()=>{
    lctx.save(); lctx.strokeStyle='rgba(0,229,176,.75)'; lctx.lineWidth=1; lctx.setLineDash([3,2]);
    lctx.beginPath();
    [...polyPoints,{x:mx,y:my}].forEach((p,i)=>i===0?lctx.moveTo(p.x,p.y):lctx.lineTo(p.x,p.y));
    lctx.stroke(); lctx.setLineDash([]); lctx.restore();
  });
}

// ═══════════════════════════════════════════════════════════════════
//  INPUT
// ═══════════════════════════════════════════════════════════════════
function getPos(e){
  const r=canvas.getBoundingClientRect(), src=e.touches?e.touches[0]:e;
  return {x:Math.floor((src.clientX-r.left)*128/r.width), y:Math.floor((src.clientY-r.top)*64/r.height)};
}
function snap(v){return snapSize<=1?v:Math.round(v/snapSize)*snapSize;}

function startDraw(e){
  e.preventDefault(); drawing=true;
  const p=getPos(e); startX=snap(p.x); startY=snap(p.y);
  // Take snapshot from clean buffer (no grid artefacts)
  bufToCanvas(frames[curFrame].buffer);
  shapeSnap=ctx.getImageData(0,0,128,64);
  if(gridMode)drawGrid();
  if(tool==='brush'){saveHistory();putPx(p.x,p.y,drawColor);saveToFrame(true);}
  else if(tool==='eraser'){saveHistory();putPx(p.x,p.y,'#fff');saveToFrame(true);}
  else if(tool==='poly'){polyPoints.push({x:startX,y:startY});previewPolyOnLayer(startX,startY);}
}

function moveDraw(e){
  if(!drawing)return; e.preventDefault();
  const p=getPos(e), ex=snap(p.x), ey=snap(p.y);
  if(tool==='brush'){putPx(p.x,p.y,drawColor);saveToFrame(true);}
  else if(tool==='eraser'){putPx(p.x,p.y,'#fff');saveToFrame(true);}
  else if(tool==='poly'){previewPolyOnLayer(ex,ey);}
  else{ctx.putImageData(shapeSnap,0,0);if(gridMode)drawGrid();previewOnLayer(startX,startY,ex,ey);}
}

function endDraw(e){
  if(!drawing)return; e.preventDefault(); drawing=false;
  const r=canvas.getBoundingClientRect(), src=e.changedTouches?e.changedTouches[0]:e;
  const ex=snap(Math.floor((src.clientX-r.left)*128/r.width));
  const ey=snap(Math.floor((src.clientY-r.top)*64/r.height));
  if(tool==='poly'){polyPoints.push({x:ex,y:ey});previewPolyOnLayer(ex,ey);shapeSnap=null;return;}
  if(tool!=='brush'&&tool!=='eraser'){ctx.putImageData(shapeSnap,0,0);if(gridMode)drawGrid();drawShapeFinal(startX,startY,ex,ey);saveHistory();}
  clearOverlay(); saveToFrame(true); renderStrip(); shapeSnap=null; setStatus();
}

// Double-click closes polygon
canvas.addEventListener('dblclick', e=>{
  if(tool!=='poly'||polyPoints.length<2)return;
  if(shapeSnap){ctx.putImageData(shapeSnap,0,0);if(gridMode)drawGrid();}
  ctx.beginPath(); ctx.strokeStyle=drawColor;
  polyPoints.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));
  ctx.closePath(); ctx.stroke();
  if(fillMode){ctx.fillStyle=drawColor;ctx.fill();}
  polyPoints=[];shapeSnap=null; saveHistory(); clearOverlay(); saveToFrame(true); renderStrip(); setStatus('Polygone terminé');
});

canvas.addEventListener('mousedown', startDraw);
canvas.addEventListener('mousemove', moveDraw);
canvas.addEventListener('mouseup',   endDraw);
canvas.addEventListener('touchstart',startDraw,{passive:false});
canvas.addEventListener('touchmove', moveDraw, {passive:false});
canvas.addEventListener('touchend',  endDraw,  {passive:false});

// ═══════════════════════════════════════════════════════════════════
//  TOOL CONTROLS
// ═══════════════════════════════════════════════════════════════════
window.setTool = t => {
  tool=t; polyPoints=[]; shapeSnap=null;
  document.querySelectorAll('[id^="btn_"]').forEach(b=>b.classList.remove('active'));
  document.getElementById('btn_'+t)?.classList.add('active');
  setStatus();
};
window.toggleColor = () => {
  drawColor=drawColor==='#000'?'#fff':'#000';
  document.getElementById('colorBtn').textContent=drawColor==='#000'?'● NOIR':'○ BLANC';
  setStatus();
};
window.setSize = v => { size=parseInt(v);    document.getElementById('sizeVal').textContent=v+'px'; setStatus(); };
window.setSnap = v => { snapSize=parseInt(v);document.getElementById('snapVal').textContent=v+'px'; setStatus(); };
window.setFill = v => { fillMode=v; setStatus(); };
window.setSym  = v => { symMode=v;  setStatus('Symétrie: '+(v?'ON':'OFF')); };
window.setGrid = v => { gridMode=v; bufToCanvas(frames[curFrame].buffer); clearOverlay(); };

function drawGrid(){
  ctx.save(); ctx.strokeStyle='rgba(110,110,130,.2)'; ctx.lineWidth=1;
  const step=Math.max(snapSize,8);
  for(let x=0;x<128;x+=step){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,64);ctx.stroke();}
  for(let y=0;y<64; y+=step){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(128,y);ctx.stroke();}
  ctx.restore();
}

window.clearCanvas = async function () {
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, 128, 64);
  saveHistory();
  if (gridMode) drawGrid();
  saveToFrame(true);
  clearOverlay();
  renderStrip();

  try {
    await fetch("/frames/stop", { method: "POST" }) // stop anim en cours
    await fetch("draw?save=0", { method: "POST", body: new Uint8Array(1024) }); // clear sans galerie
    setStatus("Canvas vidé");
  } catch (e) {
    setStatus("Erreur clear OLED");
  }
};

function downloadBlob(blob, filename){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

window.saveCurrentPng = function(){
  saveToFrame(true);
  const tmp = document.createElement('canvas');
  tmp.width = 128;
  tmp.height = 64;
  const tctx = tmp.getContext('2d', { willReadFrequently: true });
  bufToCanvas(frames[curFrame].buffer, tctx);
  tmp.toBlob(blob => {
    if(!blob) return setStatus('Erreur export PNG');
    const name = (window.lastName || 'oeuvre').replace(/[^\w-]/g, '_');
    downloadBlob(blob, `${name}-${Date.now()}.png`);
    setStatus('PNG sauvegardé');
  }, 'image/png');
};

//SAVE & EXPORT


window.saveAnimationGif = function() {
  saveToFrame(true);
  if (typeof GIF === 'undefined') { setStatus('Erreur: gif.js non chargé'); return; }

  setStatus('Rendu GIF en cours…');

  const gif = new GIF({
    workers: 1,
    quality: 5,
    width: 128,
    height: 64,
    workerScript: 'https://cdn.jsdelivr.net/npm/gif.js.optimized/dist/gif.worker.js',
    background: '#ffffff',
    dither: false
  });

  frames.forEach(f => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 64;
    bufToCanvas(f.buffer, c.getContext('2d', { willReadFrequently: true }));
    gif.addFrame(c, { delay: f.delay, copy: true });
  });

  gif.on('finished', blob => {
    const name = (window._lastName || 'animation').replace(/[^\w-]/g, '_');
    downloadBlob(blob, name + '-' + Date.now() + '.gif');
    setStatus('GIF sauvegardé (' + frames.length + ' frames)');
  });

gif.on('error', () => {
  // Fallback : export PNG frame par frame si GIF échoue
  setStatus('Worker GIF indisponible — export PNG de chaque frame');
  frames.forEach((f, i) => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 64;
    bufToCanvas(f.buffer, c.getContext('2d', { willReadFrequently: true }));
    c.toBlob(blob => downloadBlob(blob, 'frame_' + i + '.png'), 'image/png');
  });
});

  try {
    gif.render();
  } catch(e) {
    setStatus('Erreur rendu GIF: ' + e.message);
  }
};

window.toggleInvert = async function () {
  try {
    saveToFrame(true);

    const src = frames[curFrame].buffer;
    const dst = new Uint8Array(1024);

    for (let i = 0; i < 1024; i++) {
      dst[i] = src[i] ^ 0xFF;
    }

    frames[curFrame].buffer = dst;
    oledInverted = !oledInverted;

    bufToCanvas(dst);
    clearOverlay();
    renderStrip();
    saveHistory();

    await sendCurrentFrameToOled(false);
    setStatus(`Invert ${oledInverted ? "ON" : "OFF"}`);
  } catch (e) {
    setStatus(`Erreur invert: ${e.message}`);
  }
};
window.flipH = async function () {
  try {
    saveToFrame(true);

    const src = frames[curFrame].buffer;
    const dst = new Uint8Array(1024);

    for (let page = 0; page < 8; page++) {
      for (let x = 0; x < 128; x++) {
        dst[page * 128 + (127 - x)] = src[page * 128 + x];
      }
    }

    frames[curFrame].buffer = dst;
    bufToCanvas(dst);
    clearOverlay();
    renderStrip();
    saveHistory();

    await sendCurrentFrameToOled(false);
    setStatus("Flip H");
  } catch (e) {
    setStatus(`Erreur flip H: ${e.message}`);
  }
};

window.flipV = async function () {
  try {
    saveToFrame(true);

    const src = frames[curFrame].buffer;
    const dst = new Uint8Array(1024);

    for (let y = 0; y < 64; y++) {
      const ny = 63 - y;
      for (let x = 0; x < 128; x++) {
        const srcIndex = Math.floor(y / 8) * 128 + x;
        const srcBit = y % 8;
        const on = (src[srcIndex] >> srcBit) & 1;

        if (on) {
          const dstIndex = Math.floor(ny / 8) * 128 + x;
          const dstBit = ny % 8;
          dst[dstIndex] |= (1 << dstBit);
        }
      }
    }

    frames[curFrame].buffer = dst;
    bufToCanvas(dst);
    clearOverlay();
    renderStrip();
    saveHistory();

    await sendCurrentFrameToOled(false);
    setStatus("Flip V");
  } catch (e) {
    setStatus(`Erreur flip V: ${e.message}`);
  }
};

// ═══════════════════════════════════════════════════════════════════
//  DITHERING
// ═══════════════════════════════════════════════════════════════════
window.setThreshold = v => {
  threshold = parseInt(v);
  document.getElementById('threshVal').textContent = v;

  if (rawGifFrames.length) rebuildGifFromSource();
  else applyDitherToSource();
};

window.setDither = function(v) {
  ditherMode = v;

  document.querySelectorAll('.dither-preview-card').forEach(card => {
    card.classList.toggle('active', card.dataset.mode === v);
  });

  if (rawGifFrames && rawGifFrames.length) {
    rebuildGifFromSource();
  } else {
    applyDitherToSource();
  }

  updateDitherPreviews();
  setStatus(`Mode ${ditherMode} appliqué`);
};

window.applySelectedDither = () => {
  if (rawGifFrames.length) rebuildGifFromSource();
  else applyDitherToSource();

  updateDitherPreviews();
  setStatus('Mode ' + ditherMode + ' appliqué');
};

window.toggleTxtArtPreview = () => {
  if (!rawSourceImg) { setStatus('Chargez une image d\'abord'); return; }
  const wrap = document.getElementById('txtArtPreview');
  const pre  = document.getElementById('txtArtPreviewContent');
  if (wrap.style.display === 'none') {
    // Générer le text art depuis le buffer courant
    const id = new ImageData(new Uint8ClampedArray(rawSourceImg.data), 128, 64);
    const saved = ditherMode; applyDither(id); ditherMode = saved;
    let out = '';
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 128; x++) out += id.data[(y*128+x)*4] < 128 ? '█' : '░';
      out += '\n';
    }
    pre.textContent = out;
    wrap.style.display = 'block';
  } else {
    wrap.style.display = 'none';
  }
};


function applyDither(imgData){
  const d=imgData.data;
  if(ditherMode==='floyd'){
    for(let i=0;i<d.length;i+=4){const g=.299*d[i]+.587*d[i+1]+.114*d[i+2];d[i]=d[i+1]=d[i+2]=g;}
    for(let y=0;y<64;y++)for(let x=0;x<128;x++){
      const idx=(y*128+x)*4,old=d[idx]/255,nw=old<threshold/255?0:1,err=(old-nw)*255;
      d[idx]=d[idx+1]=d[idx+2]=nw*255;
      const sp=(x2,y2,w)=>{if(x2<0||x2>=128||y2<0||y2>=64)return;const i2=(y2*128+x2)*4;for(let c=0;c<3;c++)d[i2+c]=Math.max(0,Math.min(255,d[i2+c]+err*w));};
      sp(x+1,y,7/16);sp(x-1,y+1,3/16);sp(x,y+1,5/16);sp(x+1,y+1,1/16);
    }
  } else if(ditherMode==='ordered'){
    const M=[[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]];
    for(let i=0;i<d.length;i+=4){
      const g=.299*d[i]+.587*d[i+1]+.114*d[i+2];d[i]=d[i+1]=d[i+2]=g;
      }
    for(let y=0;y<64;y++)for(let x=0;x<128;x++){
      const idx=(y*128+x)*4,dv=M[y%4][x%4]/16;d[idx]=d[idx+1]=d[idx+2]=(d[idx]+dv*32-16>threshold)?255:0;
      }
} else if (ditherMode === 'atkinson') {
    for (let i = 0; i < d.length; i += 4) { const g = .299*d[i]+.587*d[i+1]+.114*d[i+2]; d[i]=d[i+1]=d[i+2]=g; }
    for (let y = 0; y < 64; y++) for (let x = 0; x < 128; x++) {
      const idx = (y*128+x)*4, old = d[idx], nw = old < threshold ? 0 : 255, err = Math.floor((old - nw) / 8);
      d[idx]=d[idx+1]=d[idx+2]=nw;
      const sp = (x2, y2) => { if(x2<0||x2>=128||y2<0||y2>=64) return; const i2=(y2*128+x2)*4; for(let c=0;c<3;c++) d[i2+c]=Math.max(0,Math.min(255,d[i2+c]+err)); };
      sp(x+1,y); sp(x+2,y); sp(x-1,y+1); sp(x,y+1); sp(x+1,y+1); sp(x,y+2);
    }
  } else {
    for(let i=0;i<d.length;i+=4){const g=.299*d[i]+.587*d[i+1]+.114*d[i+2];d[i]=d[i+1]=d[i+2]=(g>threshold)?255:0;d[i+3]=255;}
  }
}

// ═══════════════════════════════════════════════════════════════════
//  CROP MODAL — contain / cover / stretch, no sliders
// ═══════════════════════════════════════════════════════════════════
let cropFit='contain', cropSrcImg=null, cropSrcGifFrames=[];

function fitContain(sw,sh){const r=sw/sh,dr=2;return r>dr?{w:128,h:128/r,ox:0,oy:(64-128/r)/2}:{w:64*r,h:64,ox:(128-64*r)/2,oy:0};}
function fitCover(sw,sh) {const r=sw/sh,dr=2;return r>dr?{w:64*r,h:64,ox:(128-64*r)/2,oy:0}:{w:128,h:128/r,ox:0,oy:(64-128/r)/2};}
function fitParams(sw,sh){if(cropFit==='contain')return fitContain(sw,sh);if(cropFit==='cover')return fitCover(sw,sh);return{w:128,h:64,ox:0,oy:0};}

function openCropModal(){
  cropFit='contain'; updateCropPreview();
  document.getElementById('cropModal').classList.add('active');
  ['contain','cover','stretch'].forEach(f=>{
    document.getElementById('crop'+f.charAt(0).toUpperCase()+f.slice(1)).classList.toggle('active',f==='contain');
  });
}

window.setCropFit = f => {
  cropFit=f;
  ['contain','cover','stretch'].forEach(k=>{
    document.getElementById('crop'+k.charAt(0).toUpperCase()+k.slice(1)).classList.toggle('active',k===f);
  });
  updateCropPreview();
};

function updateCropPreview(){
  const pctx=document.getElementById('cropPreview').getContext('2d');
  pctx.fillStyle='#fff'; pctx.fillRect(0,0,128,64);
  if(cropSrcImg){
    const f=fitParams(cropSrcImg.width,cropSrcImg.height);
    pctx.drawImage(cropSrcImg,f.ox,f.oy,f.w,f.h);
  } else if(cropSrcGifFrames.length){
    const tmp=document.createElement('canvas');tmp.width=128;tmp.height=64;
    tmp.getContext('2d').putImageData(cropSrcGifFrames[0].imageData,0,0);
    pctx.drawImage(tmp,0,0);
  }
}

function applyDitherToSource() {
  if (!rawSourceImg) {
    updateDitherPreviews();
    return;
  }

  const id = new ImageData(
    new Uint8ClampedArray(rawSourceImg.data),
    128,
    64
  );

  applyDither(id);
  ctx.putImageData(id, 0, 0);

  if (gridMode) drawGrid();
  saveToFrame(true);
  clearOverlay();
  renderStrip();
  updateDitherPreviews();
}



function updateDitherPreviews() {
  const modes = ['floyd', 'ordered', 'atkinson', 'none'];

  let previewSource = null;
  if (rawGifFrames && rawGifFrames.length && rawGifFrames[0].imageData) {
    previewSource = rawGifFrames[0].imageData;
  } else if (rawSourceImg) {
    previewSource = rawSourceImg;
  }

  modes.forEach(mode => {
    const canvas = document.getElementById(`preview_${mode}`);
    if (!canvas) return;

    const pctx = canvas.getContext('2d', { willReadFrequently: true });

    if (!previewSource) {
      pctx.fillStyle = '#fff';
      pctx.fillRect(0, 0, 128, 64);
      return;
    }

    const id = new ImageData(
      new Uint8ClampedArray(previewSource.data),
      128,
      64
    );

    const savedMode = ditherMode;
    ditherMode = mode;
    applyDither(id);
    ditherMode = savedMode;

    pctx.putImageData(id, 0, 0);
  });
}


window.applyCrop = () => {
  if (cropSrcImg) {
    const tmp = document.createElement('canvas'); tmp.width = 128; tmp.height = 64;
    const tctx = tmp.getContext('2d', { willReadFrequently: true });
    tctx.fillStyle = '#fff'; tctx.fillRect(0, 0, 128, 64);
    const f = fitParams(cropSrcImg.width, cropSrcImg.height);
    tctx.drawImage(cropSrcImg, f.ox, f.oy, f.w, f.h);
    rawSourceImg = tctx.getImageData(0, 0, 128, 64); // ← sauvegarder la source brute
    applyDitherToSource(); // ← appliquer le dithering courant
    saveHistory(); saveToFrame(true); clearOverlay(); renderStrip(); setStatus('Image importée');
 } else if (cropSrcGifFrames.length) {
  rawGifFrames = cropSrcGifFrames.slice(0, 5).map(fr => ({
    imageData: new ImageData(
      new Uint8ClampedArray(fr.imageData.data),
      128,
      64
    ),
    delay: fr.delay || 100
  }));

  rawSourceImg = null;
  curFrame = 0;
  rebuildGifFromSource();
  setStatus('GIF importé: ' + rawGifFrames.length + ' frames');
}
  document.getElementById('cropModal').classList.remove('active');
  cropSrcImg = null; cropSrcGifFrames = [];
};

window.cancelCrop=()=>{document.getElementById('cropModal').classList.remove('active');cropSrcImg=null;cropSrcGifFrames=[];};

// ═══════════════════════════════════════════════════════════════════
//  MEDIA LOAD
// ═══════════════════════════════════════════════════════════════════


function readU8(view, pos) {
  return view.getUint8(pos);
}

function readU16LE(view, pos) {
  return view.getUint16(pos, true);
}

function lzwDecode(minCodeSize, data, expectedSize) {
  const CLEAR = 1 << minCodeSize;
  const END = CLEAR + 1;
  let codeSize = minCodeSize + 1;
  let dict = [];
  let output = [];
  let bits = 0;
  let cur = 0;
  let bytePos = 0;

  function resetDict() {
    dict = [];
    for (let i = 0; i < CLEAR; i++) dict[i] = [i];
    dict[CLEAR] = null;
    dict[END] = null;
    codeSize = minCodeSize + 1;
  }

  function nextCode() {
    while (bits < codeSize) {
      if (bytePos >= data.length) return null;
      cur |= data[bytePos++] << bits;
      bits += 8;
    }
    const code = cur & ((1 << codeSize) - 1);
    cur >>= codeSize;
    bits -= codeSize;
    return code;
  }

  resetDict();
  let prev = null;

  while (true) {
    const code = nextCode();
    if (code === null) break;
    if (code === CLEAR) {
      resetDict();
      prev = null;
      continue;
    }
    if (code === END) break;

    let entry;
    if (dict[code]) {
      entry = dict[code].slice();
    } else if (code === dict.length && prev !== null) {
      entry = dict[prev].slice();
      entry.push(dict[prev][0]);
    } else {
      break;
    }

    output.push(...entry);

    if (prev !== null) {
      const newEntry = dict[prev].slice();
      newEntry.push(entry[0]);
      dict.push(newEntry);
      if (dict.length === (1 << codeSize) && codeSize < 12) codeSize++;
    }

    prev = code;

    if (expectedSize && output.length >= expectedSize) break;
  }

  return output;
}

function parseGif(buffer) {
  const view = new DataView(buffer);
  let pos = 0;

  function u8() {
    return view.getUint8(pos++);
  }

  function u16() {
    const v = view.getUint16(pos, true);
    pos += 2;
    return v;
  }

  function readSubBlocks() {
    const chunks = [];
    while (pos < view.byteLength) {
      const size = u8();
      if (size === 0) break;
      for (let i = 0; i < size; i++) chunks.push(u8());
    }
    return new Uint8Array(chunks);
  }

  function lzwDecode(minCodeSize, data, expectedSize) {
    const CLEAR = 1 << minCodeSize;
    const END = CLEAR + 1;
    let codeSize = minCodeSize + 1;
    let dict = [];
    let output = [];
    let bitPos = 0;

    function resetDict() {
      dict = [];
      for (let i = 0; i < CLEAR; i++) dict[i] = [i];
      dict[CLEAR] = null;
      dict[END] = null;
      codeSize = minCodeSize + 1;
    }

    function nextCode() {
      let cur = 0;
      let bits = 0;
      while (bits < codeSize) {
        const byteIndex = bitPos >> 3;
        if (byteIndex >= data.length) return null;
        const remaining = 8 - (bitPos & 7);
        const take = Math.min(codeSize - bits, remaining);
        const mask = (1 << take) - 1;
        cur |= ((data[byteIndex] >> (bitPos & 7)) & mask) << bits;
        bitPos += take;
        bits += take;
      }
      return cur;
    }

    resetDict();
    let prev = null;

    while (true) {
      const code = nextCode();
      if (code === null) break;

      if (code === CLEAR) {
        resetDict();
        prev = null;
        continue;
      }

      if (code === END) break;

      let entry;
      if (dict[code]) {
        entry = dict[code].slice();
      } else if (code === dict.length && prev !== null) {
        entry = dict[prev].slice();
        entry.push(dict[prev][0]);
      } else {
        break;
      }

      output.push(...entry);

      if (prev !== null) {
        const newEntry = dict[prev].slice();
        newEntry.push(entry[0]);
        dict.push(newEntry);
        if (dict.length === (1 << codeSize) && codeSize < 12) codeSize++;
      }

      prev = code;

      if (expectedSize && output.length >= expectedSize) break;
    }

    return output;
  }

  const header = String.fromCharCode(
    u8(), u8(), u8(), u8(), u8(), u8()
  );
  if (header !== "GIF87a" && header !== "GIF89a") {
    throw new Error("Not a GIF file");
  }

  const width = u16();
  const height = u16();
  const packed = u8();
  const gctFlag = (packed & 0x80) !== 0;
  const gctSize = 1 << ((packed & 0x07) + 1);
  u8();
  u8();

  let globalColorTable = null;
  if (gctFlag) {
    globalColorTable = [];
    for (let i = 0; i < gctSize; i++) {
      globalColorTable.push([u8(), u8(), u8()]);
    }
  }

  const frames = [];
  let gce = {
    delay: 100,
    disposal: 0,
    transparentIndex: null
  };

  while (pos < view.byteLength) {
    const introducer = u8();

    if (introducer === 0x3B) break;

    if (introducer === 0x21) {
      const label = u8();

      if (label === 0xF9) {
        const blockSize = u8();
        if (blockSize !== 4) {
          pos += blockSize;
          if (pos < view.byteLength) u8();
          continue;
        }

        const packedFields = u8();
        const disposal = (packedFields >> 2) & 0x07;
        const transparentFlag = (packedFields & 0x01) !== 0;
        const delay = u16();
        const transparentIndex = u8();
        u8();

        gce = {
          delay: Math.max(20, delay * 10),
          disposal,
          transparentIndex: transparentFlag ? transparentIndex : null
        };
      } else {
        readSubBlocks();
      }
      continue;
    }

    if (introducer !== 0x2C) {
      continue;
    }

    const left = u16();
    const top = u16();
    const frameWidth = u16();
    const frameHeight = u16();
    const ip = u8();
    const lctFlag = (ip & 0x80) !== 0;
    const interlaced = (ip & 0x40) !== 0;
    const lctSize = 1 << ((ip & 0x07) + 1);

    let colorTable = globalColorTable;
    if (lctFlag) {
      colorTable = [];
      for (let i = 0; i < lctSize; i++) {
        colorTable.push([u8(), u8(), u8()]);
      }
    }

    const minCodeSize = u8();
    const compressed = readSubBlocks();
    const indices = lzwDecode(minCodeSize, compressed, frameWidth * frameHeight);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const img = ctx.createImageData(width, height);

    for (let i = 0; i < img.data.length; i += 4) {
      img.data[i] = 255;
      img.data[i + 1] = 255;
      img.data[i + 2] = 255;
      img.data[i + 3] = 255;
    }

    let src = 0;
    const passStarts = [0, 4, 2, 1];
    const passSteps = [8, 8, 4, 2];
    const passRows = [];

    if (interlaced) {
      for (let p = 0; p < 4; p++) {
        for (let y = passStarts[p]; y < frameHeight; y += passSteps[p]) {
          passRows.push(y);
        }
      }
    }

    for (let y = 0; y < frameHeight; y++) {
      const py = interlaced ? passRows[y] : y;
      if (py === undefined || py + top >= height) continue;

      for (let x = 0; x < frameWidth; x++) {
        if (src >= indices.length) break;

        const idx = indices[src++];
        const px = left + x;
        const oy = top + py;

        if (px < 0 || oy < 0 || px >= width || oy >= height) continue;
        if (idx === gce.transparentIndex) continue;

        const c = colorTable && colorTable[idx] ? colorTable[idx] : [255, 255, 255];
        const off = (oy * width + px) * 4;
        img.data[off] = c[0];
        img.data[off + 1] = c[1];
        img.data[off + 2] = c[2];
        img.data[off + 3] = 255;
      }
    }

    ctx.putImageData(img, 0, 0);

    frames.push({
      imageData: img,
      delay: gce.delay,
      disposal: gce.disposal,
      transparentIndex: gce.transparentIndex
    });

    gce = {
      delay: 100,
      disposal: 0,
      transparentIndex: null
    };
  }

  return { width, height, frames };
}


function imageDataToCanvas(imgData) {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 64;
  const cctx = c.getContext("2d", { willReadFrequently: true });
  cctx.putImageData(imgData, 0, 0);
  return c;
}

async function gifToFrames(file) {
  const buffer = await file.arrayBuffer();
  const parsed = parseGif(buffer);

  const outFrames = [];

  for (const fr of parsed.frames) {
    const tmp = document.createElement("canvas");
    tmp.width = 128;
    tmp.height = 64;
    const tctx = tmp.getContext("2d", { willReadFrequently: true });
    tctx.fillStyle = "#fff";
    tctx.fillRect(0, 0, 128, 64);

    const fit = fitContain(parsed.width, parsed.height);
    tctx.drawImage(imageDataToCanvas(fr.imageData), fit.ox, fit.oy, fit.w, fit.h);

    const id = tctx.getImageData(0, 0, 128, 64);
    applyDither(id);

    outFrames.push({
      buffer: imgDataToBuf(id),
      delay: fr.delay || 100
    });
  }

  return outFrames;
}


window.loadFile = async function (e) {
  const file = e.target.files[0];
  if (!file) return;

  // Stopper tout ce qui est encore actif avant de charger un nouveau média
  resetCurrentMediaState();

  if (file.name.toLowerCase().endsWith(".gif")) {
    await loadGif(file);
    e.target.value = "";
    return;
  }

  const img = new Image();
  const url = URL.createObjectURL(file);

  img.onload = () => {
    cropSrcImg = img;
    cropSrcGifFrames = [];

    // S'assurer qu'aucun ancien GIF ne reste en source active
    rawGifFrames = [];
    rawSourceImg = null;

    openCropModal();
    URL.revokeObjectURL(url);
    setStatus("Image chargée");
  };

  img.onerror = () => {
    URL.revokeObjectURL(url);
    setStatus("Erreur chargement image");
  };

  img.src = url;
  e.target.value = "";
};


function startGifPreview(canvas, frames, delays) {
  if (!Array.isArray(frames) || !frames.length) return;

  const gctx = canvas.getContext('2d', { willReadFrequently: true });
  let i = 0;

  if (canvas._gifTimer) {
    clearTimeout(canvas._gifTimer);
    canvas._gifTimer = null;
  }

  function draw() {
    bufToCanvas(new Uint8Array(frames[i]), gctx);
    const d = Array.isArray(delays) ? (delays[i] || 100) : 100;
    i = (i + 1) % frames.length;
    canvas._gifTimer = setTimeout(draw, d);
  }

  draw();
}

window.loadGallery = async function() {
  const grid = document.getElementById('galleryGrid');
  grid.innerHTML = '<div class="gempty">Chargement...</div>';

  try {
    const res = await fetch('/gallery', { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);

    const text = await res.text();
    console.log('[gallery] raw:', text);

    let items;
    try {
      items = JSON.parse(text);
    } catch (e) {
      throw new Error('JSON /gallery invalide: ' + e.message + ' >>> ' + text);
    }

    grid.innerHTML = '';

    if (!Array.isArray(items) || !items.length) {
      grid.innerHTML = '<div class="gempty">Aucune œuvre enregistrée pour le moment.</div>';
      setStatus('Galerie vide');
      return;
    }

    for (const item of items) {
      const wrap = document.createElement('div');
      wrap.className = 'gcard';

      wrap.innerHTML = `
  <canvas width="128" height="64" style="width:100%;height:auto;background:#fff;border-radius:6px;image-rendering:pixelated"></canvas>
  <div class="gmeta">
    <strong>${item.name || 'Anonyme'}</strong>
    <span>${item.timestamp || 'Sans date'}</span>
  </div>
  <button class="btn send" style="font-size:10px;padding:5px 8px;"
    onclick="resendFromGallery(${item.slot})">↑ OLED</button>
`;

      grid.appendChild(wrap);

      const c = wrap.querySelector('canvas');

      // Fetch isolé avec try/catch pour ne pas bloquer les autres slots
      try {
        const r = await fetch(`/gallery-item?slot=${item.slot}`, { cache: 'no-store' });

        if (!r.ok) throw new Error('HTTP ' + r.status + ' pour slot ' + item.slot);

        const txt = await r.text();
        console.log('[gallery-item] slot', item.slot, 'raw length:', txt.length, 'preview:', txt.substring(0, 80));

        let full;
        try {
          full = JSON.parse(txt);
        } catch (e) {
          throw new Error('JSON invalide slot ' + item.slot + ': ' + e.message);
        }

        console.log('[gallery-item] slot', item.slot, 'keys:', Object.keys(full), 'data.length:', full.data?.length);

if (full.type === 'gif' && Array.isArray(full.frames) && full.frames.length) {
  startGifPreview(c, full.frames, full.delays || []);
} else if (Array.isArray(full.data) && full.data.length === 1024) {
  bufToCanvas(new Uint8Array(full.data), c.getContext('2d', { willReadFrequently: true }));
} else {
  throw new Error('contenu invalide slot ' + item.slot);
}

      } catch (err) {
        console.error('[gallery-item] slot', item.slot, 'error:', err.message);
        // Affiche l'erreur visuellement dans la card plutôt que crash global
        const ectx = c.getContext('2d');
        ectx.fillStyle = '#222';
        ectx.fillRect(0, 0, 128, 64);
        ectx.fillStyle = '#ff4757';
        ectx.font = '8px monospace';
        ectx.fillText('ERR slot ' + item.slot, 4, 34);
      }
    }

    setStatus('Galerie chargée (' + items.length + ' œuvres)');

  } catch (e) {
    console.error('[loadGallery] fatal:', e);
    grid.innerHTML = '<div class="gempty">Erreur de chargement galerie.</div>';
    setStatus('Erreur chargement galerie');
  }
};


window.resendFromGallery = async (slot) => {
  setStatus('Chargement slot ' + slot + '…');

  try {
    const r = await fetch('/gallery-item?slot=' + slot, { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);

    const full = await r.json();

    if (full.type === 'gif' && Array.isArray(full.frames) && full.frames.length) {
      frames = full.frames.slice(0, 5).map((buf, i) => ({
        buffer: new Uint8Array(buf),
        delay: (full.delays && full.delays[i]) || 100
      }));
      curFrame = 0;
      rawSourceImg = null;
      rawGifFrames = [];
      loadFrame();
      renderStrip();
      updateFrameUi();

      document.getElementById('usernameInput').value = window._lastName || '';
      window._pendingAnimSend = true;
      document.getElementById('userModal').classList.add('active');
      setStatus('Prêt à renvoyer le GIF du slot ' + slot);
      return;
    }

    if (!Array.isArray(full.data) || full.data.length !== 1024) {
      throw new Error('data invalide');
    }

    pendingBuf = new Uint8Array(full.data);
    document.getElementById('usernameInput').value = window._lastName || '';
    document.getElementById('userModal').classList.add('active');
    setTimeout(() => {
      const inp = document.getElementById('usernameInput');
      inp.focus();
      inp.select();
    }, 60);

    setStatus('Prêt à renvoyer le slot ' + slot);
  } catch (e) {
    setStatus('Erreur chargement slot ' + slot + ': ' + e.message);
  }
};



let rawGifFrames = [];

function stopLocalPlaybackIfNeeded() {
  if (!isPlaying) return;
  isPlaying = false;
  cancelAnimationFrame(playRafId);
  playRafId = null;
  const pb = document.getElementById('playBtn');
  if (pb) pb.textContent = '▶ Lire';
}

function resetCurrentMediaState() {
  stopLocalPlaybackIfNeeded();

  rawGifFrames = [];
  rawSourceImg = null;
  cropSrcImg = null;
  cropSrcGifFrames = [];
  pendingBuf = null;
  window._pendingAnimSend = false;

  clearOverlay();
}

function rebuildGifFromSource() {
  if (!rawGifFrames || !rawGifFrames.length) {
    updateDitherPreviews();
    return;
  }

  frames = rawGifFrames.slice(0, 5).map(fr => {
    const id = new ImageData(
      new Uint8ClampedArray(fr.imageData.data),
      128,
      64
    );
    applyDither(id);
    return {
      buffer: imgDataToBuf(id),
      delay: fr.delay || 100
    };
  });

  curFrame = 0;
  loadFrame();
  renderStrip();
  updateFrameUi();
  updateDitherPreviews();
  saveHistory();
}

async function loadGif(file) {
  try {
    setStatus("Décodage GIF...");

    const buffer = await file.arrayBuffer();
    const parsed = parseGif(buffer);

    if (!parsed.frames.length) {
      throw new Error("Aucune frame détectée");
    }

    rawGifFrames = [];

    for (const fr of parsed.frames.slice(0, 5)) {
      const tmp = document.createElement("canvas");
      tmp.width = 128;
      tmp.height = 64;
      const tctx = tmp.getContext("2d", { willReadFrequently: true });

      tctx.fillStyle = "#fff";
      tctx.fillRect(0, 0, 128, 64);

      const srcCanvas = document.createElement("canvas");
      srcCanvas.width = parsed.width;
      srcCanvas.height = parsed.height;
      const sctx = srcCanvas.getContext("2d", { willReadFrequently: true });
      sctx.putImageData(fr.imageData, 0, 0);

      const fit = fitContain(parsed.width, parsed.height);
      tctx.drawImage(srcCanvas, fit.ox, fit.oy, fit.w, fit.h);

      const fitted = tctx.getImageData(0, 0, 128, 64);

      rawGifFrames.push({
        imageData: fitted,
        delay: fr.delay || 100
      });
    }

    rawSourceImg = null;
    cropSrcImg = null;
    cropSrcGifFrames = [];
    curFrame = 0;

    rebuildGifFromSource();
    setStatus(`GIF importé: ${rawGifFrames.length} frames`);

  } catch (e) {
    console.error(e);
    setStatus(`Erreur GIF: ${e.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
//  TXT ART
// ═══════════════════════════════════════════════════════════════════
window.importTxtArt = () => {
  const txt = document.getElementById('txtArt').value;
  if (!txt) { setStatus('Collez du texte art'); return; }
  // Conserver les lignes vides pour préserver la géométrie
  const lines = txt.split('\n');
  // Retirer uniquement les lignes vides en fin de fichier
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  if (!lines.length) { setStatus('Texte vide'); return; }

  const maxW = lines.reduce((m, l) => Math.max(m, l.length), 0);
  if (!maxW) { setStatus('Aucun caractère trouvé'); return; }

  const scale = Math.max(1, Math.floor(Math.min(128 / maxW, 64 / lines.length)));
  const ox = Math.floor((128 - maxW * scale) / 2);
  const oy = Math.floor((64 - lines.length * scale) / 2);

  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 128, 64);

  lines.forEach((line, y) => {
    [...line].forEach((ch, x) => {
      if (!['█', '#', '@', '*', '■', '▪', '•'].includes(ch)) return;
      ctx.fillStyle = '#000';
      for (let sy = 0; sy < scale; sy++)
        for (let sx = 0; sx < scale; sx++) {
          const px = ox + x * scale + sx, py = oy + y * scale + sy;
          if (px >= 0 && px < 128 && py >= 0 && py < 64) ctx.fillRect(px, py, 1, 1);
        }
    });
  });

  if (gridMode) drawGrid();
  saveHistory(); saveToFrame(true); clearOverlay(); renderStrip();
  setStatus('TXT Art importé (' + lines.length + ' lignes, ' + maxW + ' cols)');
};

// ═══════════════════════════════════════════════════════════════════
//  EXPORTS
// ═══════════════════════════════════════════════════════════════════
window.exportTxt = () => {
  saveToFrame(true); const d=ctx.getImageData(0,0,128,64).data; let out='';
  for(let y=0;y<64;y++){for(let x=0;x<128;x++)out+=d[(y*128+x)*4]<128?'█':'░';out+='\n';}
  document.getElementById('exportArea').value=out; setStatus('TXT Art exporté');
};
window.exportArduino = () => {
  saveToFrame(true); const d=ctx.getImageData(0,0,128,64).data;
  let code='void monDessin(){\n  display.clearDisplay();\n';
  for(let y=0;y<64;y++)for(let x=0;x<128;x++)if(d[(y*128+x)*4]<128)code+=`  display.drawPixel(${x},${y},SSD1306_WHITE);\n`;
  code+='  display.display();\n}\n// Appel: monDessin();';
  if(frames.length>1){code+='\n\n// Animation:\n';frames.forEach((f,fi)=>{code+=`const uint8_t frame_${fi}[] PROGMEM = {\n  `;code+=Array.from(f.buffer).map(b=>'0x'+b.toString(16).padStart(2,'0')).join(', ');code+='\n};\n';});}
  document.getElementById('exportArea').value=code; setStatus('Arduino exporté');
};
window.exportBuffer = () => {
  saveToFrame(true);
  if(frames.length===1){let hex='const uint8_t monDessin[] PROGMEM = {\n  ';hex+=Array.from(frames[0].buffer).map(b=>'0x'+b.toString(16).padStart(2,'0')).join(', ');hex+='\n};';document.getElementById('exportArea').value=hex;}
  else{document.getElementById('exportArea').value=JSON.stringify({width:128,height:64,frames:frames.map(f=>({delay:f.delay,data:Array.from(f.buffer)}))},null,2);}
  setStatus('Buffer exporté');
};
window.copyExport = () => { const el=document.getElementById('exportArea');el.select();document.execCommand('copy');setStatus('Copié !'); };

// ═══════════════════════════════════════════════════════════════════
//  UI
// ═══════════════════════════════════════════════════════════════════
function setStatus(msg){
  document.getElementById('status').textContent=msg||`Outil: ${tool} | ${size}px | Snap: ${snapSize}px | ${drawColor==='#000'?'NOIR':'BLANC'} | Frame ${curFrame+1}/${frames.length}`;
}


// ═══════════════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════════════
initFrames();
setStatus('Prêt — dessinez et envoyez !');

})();
</script>
</body>
</html>
)rawliteral";

//GALERIE LITTLEFS

String galleryJsonPath(int slot) {
  char path[16];
  snprintf(path, sizeof(path), "/g%02d.json", slot);
  return String(path);
}

String jsonEscape(const String& s) {
  String out;
  out.reserve(s.length() + 8);
  for (size_t i = 0; i < s.length(); i++) {
    char c = s[i];
    if (c == '\"' || c == '\\') {
      out += '\\';
      out += c;
    } else if ((uint8_t)c >= 32) {
      out += c;
    }
  }
  return out;
}

bool saveGalleryIndex() {
  File f = LittleFS.open("/gallery-index.json", "w");
  if (!f) return false;

  f.print("{\"magic\":");
  f.print(galleryIndex.magic);
  f.print(",\"version\":");
  f.print(galleryIndex.version);
  f.print(",\"head\":");
  f.print(galleryIndex.head);
  f.print(",\"count\":");
  f.print(galleryIndex.count);
  f.print("}");
  f.close();
  return true;
}

bool loadGalleryIndex() {
  galleryIndex = {0xBEEF, 1, 0, 0};

  if (!LittleFS.exists("/gallery-index.json")) {
    return false;
  }

  File f = LittleFS.open("/gallery-index.json", "r");
  if (!f) return false;

  String s = f.readString();
  f.close();

  auto extractInt = [&](const char* key, int fallback) -> int {
    String pattern = String("\"") + key + "\":";
    int p = s.indexOf(pattern);
    if (p < 0) return fallback;
    p += pattern.length();
    int e = p;
    while (e < (int)s.length() && isDigit(s[e])) e++;
    return s.substring(p, e).toInt();
  };

  galleryIndex.magic   = extractInt("magic", 0xBEEF);
  galleryIndex.version = extractInt("version", 1);
  galleryIndex.head    = extractInt("head", 0);
  galleryIndex.count   = extractInt("count", 0);

  if (galleryIndex.magic != 0xBEEF ||
      galleryIndex.version != 1 ||
      galleryIndex.head >= GALLERY_SIZE ||
      galleryIndex.count > GALLERY_SIZE) {
    galleryIndex = {0xBEEF, 1, 0, 0};
    return false;
  }

  return true;
}

bool writeGalleryGifJson(int slot, AnimFrame* frames, int count, const String& author, const String& stamp) {
  if (slot < 0 || slot >= GALLERY_SIZE) return false;
  if (count <= 0) return false;

  File f = LittleFS.open(galleryJsonPath(slot), "w");
  if (!f) return false;

  f.print("{\"slot\":");
  f.print(slot);
  f.print(",\"type\":\"gif\"");
  f.print(",\"name\":\"");
  f.print(jsonEscape(author));
  f.print("\",\"timestamp\":\"");
  f.print(jsonEscape(stamp));
  f.print("\",\"width\":128,\"height\":64,\"frameCount\":");
  f.print(count);

  f.print(",\"delays\":[");
  for (int k = 0; k < count; k++) {
    f.print(frames[k].delay);
    if (k < count - 1) f.print(",");
  }
  f.print("]");

  f.print(",\"frames\":[");
  for (int k = 0; k < count; k++) {
    f.print("[");
    for (int i = 0; i < 1024; i++) {
      f.print(frames[k].buf[i]);
      if (i < 1023) f.print(",");
      if ((i & 63) == 0) yield();
    }
    f.print("]");
    if (k < count - 1) f.print(",");
  }
  f.print("]}");

  f.close();
  return true;
}
int headerScrollOffset() {
  static unsigned long lastStep = 0;
  static int offset = 0;

  String author = pendingAuthor.length() ? pendingAuthor : "Anonyme";
  String stamp  = pendingTimestamp.length() ? pendingTimestamp : "";
  String line   = stamp.length() ? (author + " • " + stamp) : author;

  int textPx = line.length() * 6;
  if (textPx <= 128) {
    offset = 0;
    return 0;
  }

  unsigned long now = millis();
  if (now - lastStep > 180) {
    lastStep = now;
    offset++;
    int loopWidth = textPx + 24;
    if (offset > loopWidth) offset = 0;
  }

  return offset;
}
void drawHeaderBar() {
  String author = pendingAuthor.length() ? pendingAuthor : "Anonyme";
  String stamp  = pendingTimestamp.length() ? pendingTimestamp : "";

  bool showAuthor = ((millis() / 10000UL) % 2UL) == 0UL;
  String line = showAuthor ? author : stamp;

  if (!line.length()) line = showAuthor ? "Anonyme" : "";

  display.setTextWrap(false);
  display.fillRect(0, 0, 128, 8, SSD1306_BLACK);

  if (line.length()) {
    if (line.length() > 21) line = line.substring(0, 21);
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE, SSD1306_BLACK);
    display.setCursor(0, 0);
    display.print(line);
  }
}

void renderBufferWithHeader(const uint8_t* buf) {
  display.clearDisplay();

  for (int page = 0; page < 8; page++) {
    for (int x = 0; x < 128; x++) {
      uint8_t b = buf[page * 128 + x];
      for (int bit = 0; bit < 8; bit++) {
        if (b & (1 << bit)) {
          display.drawPixel(x, page * 8 + bit, SSD1306_WHITE);
        }
      }
    }
  }

  drawHeaderBar();
  display.display();
}

void tickStillHeader() {
  static unsigned long lastRefresh = 0;
  if (animRunning) return;
  if (!pendingAuthor.length() && !pendingTimestamp.length()) return;

  unsigned long now = millis();
  if (now - lastRefresh >= 500) {
    lastRefresh = now;
    renderBufferWithHeader(lastRendered);
  }
}

bool writeGallerySlotJson(int slot, const uint8_t* buf, const String& author, const String& stamp) {
  if (slot < 0 || slot >= GALLERY_SIZE) return false;

  File f = LittleFS.open(galleryJsonPath(slot), "w");
  if (!f) return false;

  f.print("{\"slot\":");
  f.print(slot);
  f.print(",\"type\":\"still\"");
  f.print(",\"name\":\"");
  f.print(jsonEscape(author));
  f.print("\",\"timestamp\":\"");
  f.print(jsonEscape(stamp));
  f.print("\",\"width\":128,\"height\":64,\"data\":[");

  for (int i = 0; i < 1024; i++) {
    f.print(buf[i]);
    if (i < 1023) f.print(",");
    if ((i & 63) == 0) yield();
  }

  f.print("]}");
  f.close();
  return true;
}

bool saveGifToGallery(AnimFrame* frames, int count, const String& author, const String& stamp) {
  int slot = galleryIndex.head;

  if (!writeGalleryGifJson(slot, frames, count, author, stamp)) {
    return false;
  }

  galleryIndex.head = (galleryIndex.head + 1) % GALLERY_SIZE;
  if (galleryIndex.count < GALLERY_SIZE) galleryIndex.count++;
  saveGalleryIndex();
  return true;
}

bool readGallerySlotMeta(int slot, String& name, String& timestamp) {
  if (slot < 0 || slot >= GALLERY_SIZE) return false;

  String path = galleryJsonPath(slot);
  if (!LittleFS.exists(path)) return false;

  File f = LittleFS.open(path, "r");
  if (!f) return false;

  String s = f.readString();
  f.close();

  auto extractString = [&](const char* key) -> String {
    String pattern = String("\"") + key + "\":\"";
    int p = s.indexOf(pattern);
    if (p < 0) return "";
    p += pattern.length();
    int e = p;
    while (e < (int)s.length()) {
      if (s[e] == '"' && s[e - 1] != '\\') break;
      e++;
    }
    String val = s.substring(p, e);
    val.replace("\\\"", "\"");
    val.replace("\\\\", "\\");
    return val;
  };

  name = extractString("name");
  timestamp = extractString("timestamp");
  return true;
}


// ══════════════════════════════════════════════════════════════
//  ARDUINO
// ══════════════════════════════════════════════════════════════
void setup() {
  Serial.begin(115200);
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("OLED FAIL"); while (1);
  }
  if (!WiFi.config(local_IP, gateway, subnet, primaryDNS, secondaryDNS))
    Serial.println("Echec IP fixe");
  WiFi.begin(ssid, password);
  Serial.print("WiFi");
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); yield(); }
  Serial.println("\nIP: " + WiFi.localIP().toString());

if (!LittleFS.begin()) {
  Serial.println(F("LittleFS mount failed"));
} else {
  Serial.println(F("LittleFS mounted"));

  if (loadGalleryIndex()) {
    Serial.print(F("Gallery index JSON loaded, count="));
    Serial.print(galleryIndex.count);
    Serial.print(F(" head="));
    Serial.println(galleryIndex.head);
  } else {
    Serial.println(F("New gallery index JSON created"));
    saveGalleryIndex();
  }
}


  server.begin();
  }

void sendHTML(WiFiClient& client) {
  Serial.println(F("[HTML] sendHTML() start"));

  size_t len = strlen_P(html_page);
  Serial.print(F("[HTML] html bytes = "));
  Serial.println(len);

  client.println(F("HTTP/1.1 200 OK"));
  client.println(F("Content-Type: text/html; charset=utf-8"));
  client.println(F("Cache-Control: no-store"));
  client.println(F("Connection: close"));
  client.println();

  PGM_P p = html_page;
  char chunk[512];
  size_t sent = 0;

  while (len > 0) {
    size_t n = (len > sizeof(chunk)) ? sizeof(chunk) : len;
    memcpy_P(chunk, p, n);
    size_t w = client.write((const uint8_t*)chunk, n);
    sent += w;
    if (w != n) {
      Serial.println(F("[HTML] WARNING: partial write"));
      break;
    }
    p += n;
    len -= n;
    yield();
  }

  client.flush();
  Serial.print(F("[HTML] total sent = "));
  Serial.println(sent);
  Serial.println(F("[HTML] sendHTML() done"));
}

static bool renderCacheValid = false; // variable globale, avant loop()

void invalidateRenderCache() {
  renderCacheValid = false;
  display.clearDisplay();
  display.display();
}

void renderBuffer(uint8_t* buf) {
  static uint8_t last[1024] = {0};

  bool isClear = true;
  for (int i = 0; i < 1024; i++) if (buf[i]) { isClear = false; break; }

  if (isClear) {
    display.clearDisplay();
    display.display();
    memset(last, 0, 1024);
    renderCacheValid = true;
    return;
  }

  if (!renderCacheValid) {
    display.clearDisplay();
    for (int page = 0; page < 8; page++)
      for (int x = 0; x < 128; x++) {
        const uint8_t b = buf[page*128+x];
        for (int bit = 0; bit < 8; bit++)
          if (b & (1<<bit)) display.drawPixel(x, page*8+bit, SSD1306_WHITE);
      }
  } else {
    for (int page = 0; page < 8; page++)
      for (int x = 0; x < 128; x++) {
        uint8_t b = buf[page*128+x], lb = last[page*128+x];
        if (b == lb) continue;
        for (int row = 0; row < 8; row++) {
          bool np = (b>>row)&1, lp = (lb>>row)&1;
          if (np != lp) display.drawPixel(x, page*8+row, np ? SSD1306_WHITE : SSD1306_BLACK);
        }
      }
  }

  display.display();
  memcpy(last, buf, 1024);
  renderCacheValid = true;
}
void freeAnimFrames() {
  for (int i = 0; i < animFrameCount; i++) {
    if (animFrames[i].buf) { free(animFrames[i].buf); animFrames[i].buf = nullptr; }
  }
  animFrameCount = 0; animCurFrame = 0; animRunning = false;
  invalidateRenderCache(); // ← vide l'écran et invalide le cache
}


void tickAnim() {
  if (!animRunning || animFrameCount == 0) return;
  unsigned long now = millis();
  if (now - animLastT < animFrames[animCurFrame].delay) return;
  animLastT = now;
  animCurFrame = (animCurFrame + 1) % animFrameCount;
renderBufferWithHeader(animFrames[animCurFrame].buf);
}


bool streamGallerySlotJson(WiFiClient& client, int slot) {
  if (slot < 0 || slot >= GALLERY_SIZE) return false;

  String path = galleryJsonPath(slot);
  if (!LittleFS.exists(path)) return false;

  File f = LittleFS.open(path, "r");
  if (!f) return false;

  while (f.available()) {
    char buf[256];
    size_t n = f.readBytes(buf, sizeof(buf));
    client.write((const uint8_t*)buf, n);
    yield();
  }

  f.close();
  return true;
}

String urlDecode(String s) {
  String out = "";
  for (int i = 0; i < (int)s.length(); i++) {
    if (s[i] == '+') { out += ' '; }
    else if (s[i] == '%' && i + 2 < (int)s.length()) {
      char h[3] = { s[i+1], s[i+2], 0 };
      out += (char)strtol(h, nullptr, 16);
      i += 2;
    } else { out += s[i]; }
  }
  return out;
}

void sendGallery(WiFiClient& client) {
  Serial.println(F("[GALLERY] sendGallery() start"));
  Serial.print(F("[GALLERY] head="));
  Serial.print(galleryIndex.head);
  Serial.print(F(" count="));
  Serial.println(galleryIndex.count);

  client.println(F("HTTP/1.1 200 OK"));
  client.println(F("Content-Type: application/json; charset=utf-8"));
  client.println(F("Access-Control-Allow-Origin: *"));
  client.println(F("Cache-Control: no-store"));
  client.println(F("Connection: close"));
  client.println();

  String body = "[";
  bool first = true;
  int validCount = 0;

  for (int i = 0; i < galleryIndex.count; i++) {
    int slot = (galleryIndex.head - 1 - i + GALLERY_SIZE) % GALLERY_SIZE;

    Serial.print(F("[GALLERY] check i="));
    Serial.print(i);
    Serial.print(F(" -> slot="));
    Serial.println(slot);

    String path = galleryJsonPath(slot);
    Serial.print(F("[GALLERY] path="));
    Serial.print(path);
    Serial.print(F(" exists="));
    Serial.println(LittleFS.exists(path) ? F("yes") : F("no"));

    String name, timestamp;
    if (!readGallerySlotMeta(slot, name, timestamp)) {
      Serial.print(F("[GALLERY] meta read FAILED for slot "));
      Serial.println(slot);
      continue;
    }

    Serial.print(F("[GALLERY] meta OK slot="));
    Serial.print(slot);
    Serial.print(F(" name='"));
    Serial.print(name);
    Serial.print(F("' timestamp='"));
    Serial.print(timestamp);
    Serial.println(F("'"));

    if (!first) body += ",";
    first = false;

    body += "{\"slot\":";
    body += String(slot);
    body += ",\"name\":\"";
    body += jsonEscape(name);
    body += "\",\"timestamp\":\"";
    body += jsonEscape(timestamp);
    body += "\"}";

    validCount++;
    yield();
  }

  body += "]";

  Serial.print(F("[GALLERY] validCount="));
  Serial.println(validCount);
  Serial.print(F("[GALLERY] body length="));
  Serial.println(body.length());
  Serial.print(F("[GALLERY] body="));
  Serial.println(body);

  client.print(body);
  Serial.println(F("[GALLERY] sendGallery() done"));
}


void sendGalleryItem(WiFiClient& client, int slot) {
  Serial.print(F("[ITEM] sendGalleryItem slot="));
  Serial.println(slot);

  if (slot < 0 || slot >= GALLERY_SIZE) {
    Serial.println(F("[ITEM] invalid slot"));
    client.println(F("HTTP/1.1 404 Not Found"));
    client.println(F("Content-Type: application/json"));
    client.println(F("Access-Control-Allow-Origin: *"));
    client.println(F("Connection: close"));
    client.println();
    client.print(F("{\"error\":\"invalid slot\"}"));
    return;
  }

  String path = galleryJsonPath(slot);
  Serial.print(F("[ITEM] path="));
  Serial.println(path);

  if (!LittleFS.exists(path)) {
    Serial.println(F("[ITEM] file not found"));
    client.println(F("HTTP/1.1 404 Not Found"));
    client.println(F("Content-Type: application/json"));
    client.println(F("Access-Control-Allow-Origin: *"));
    client.println(F("Connection: close"));
    client.println();
    client.print(F("{\"error\":\"file not found\"}"));
    return;
  }

  File f = LittleFS.open(path, "r");
  if (!f) {
    Serial.println(F("[ITEM] open failed"));
    client.println(F("HTTP/1.1 500 Internal Error"));
    client.println(F("Access-Control-Allow-Origin: *"));
    client.println(F("Connection: close"));
    client.println();
    return;
  }

  size_t fileSize = f.size();
  Serial.print(F("[ITEM] file size="));
  Serial.println(fileSize);

  // Log des 80 premiers octets pour vérifier le JSON en série
  {
    char preview[81];
    size_t n = f.readBytes(preview, 80);
    preview[n] = '\0';
    Serial.print(F("[ITEM] preview: "));
    Serial.println(preview);
    f.seek(0); // rembobiner avant le vrai envoi
  }

  client.println(F("HTTP/1.1 200 OK"));
  client.println(F("Content-Type: application/json; charset=utf-8"));
  client.print(F("Content-Length: "));
  client.println(fileSize);
  client.println(F("Cache-Control: no-store"));
  client.println(F("Access-Control-Allow-Origin: *"));
  client.println(F("Connection: close"));
  client.println();

  while (f.available()) {
    char buf[256];
    size_t n = f.readBytes(buf, sizeof(buf));
    client.write((const uint8_t*)buf, n);
    yield();
  }

  f.close();
  Serial.println(F("[ITEM] response sent"));
}


void saveToGallery(const uint8_t* buf) {
  String author = pendingAuthor.length() ? pendingAuthor : "Anonyme";
  String stamp  = pendingTimestamp.length() ? pendingTimestamp : String(millis());

  author = author.substring(0, 15);
  stamp  = stamp.substring(0, 23);

  int slot = galleryIndex.head;

  if (!writeGallerySlotJson(slot, buf, author, stamp)) {
    Serial.println(F("Gallery JSON write failed"));
    return;
  }

  galleryIndex.head = (galleryIndex.head + 1) % GALLERY_SIZE;
  if (galleryIndex.count < GALLERY_SIZE) galleryIndex.count++;

  if (!saveGalleryIndex()) {
    Serial.println(F("Gallery index JSON save failed"));
  }

  pendingAuthor = "";
  pendingTimestamp = "";

  Serial.print(F("Gallery saved JSON slot="));
  Serial.print(slot);
  Serial.print(F(" count="));
  Serial.println(galleryIndex.count);
}

// Force la fermeture propre de la connexion.
// Attend que le client ait lu toutes les données avant de couper.
void drainAndClose(WiFiClient& client) {
  client.flush();
  // Attendre max 200ms que le client vide son buffer de réception
  unsigned long t = millis() + 200;
  while (client.connected() && millis() < t) {
    if (client.available()) client.read(); // vider les données entrantes résiduelles
    yield();
  }
  client.stop();
}


void loop() {
  tickAnim();
  tickStillHeader();

  WiFiClient client = server.available();
  if (!client) return;

  unsigned long t = millis() + 3000;
  while (client.connected() && !client.available() && millis() < t) {
    delay(1);
    yield();
  }

  if (!client.connected() || !client.available()) {
    Serial.println(F("[HTTP] timeout/no data"));
    drainAndClose(client);
    return;
  }

  String req = client.readStringUntil('\r');
  req.trim();

  if (client.available()) {
    client.read();
  }

  Serial.println();
  Serial.println(F("========== HTTP =========="));
  Serial.print(F("[REQ] >"));
  Serial.print(req);
  Serial.println(F("<"));

  // =========================
  // OPTIONS (CORS preflight)
  // =========================
  if (req.startsWith("OPTIONS ")) {
    Serial.println(F("[ROUTE] OPTIONS"));

    while (client.connected()) {
      String line = client.readStringUntil('\n');
      line.trim();
      if (!line.length()) break;
      Serial.print(F("[HDR] "));
      Serial.println(line);
    }

    client.println(F("HTTP/1.1 200 OK"));
    client.println(F("Access-Control-Allow-Origin: *"));
    client.println(F("Access-Control-Allow-Methods: GET, POST, OPTIONS"));
    client.println(F("Access-Control-Allow-Headers: Content-Type"));
    client.println(F("Connection: close"));
    client.println();
    drainAndClose(client);
    return;
  }

  // =========================
  // POST /draw
  // =========================
  if (req.startsWith("POST /draw")) {
    Serial.println(F("[ROUTE] POST /draw"));

    int contentLength = -1;

    while (client.connected()) {
      String line = client.readStringUntil('\n');
      line.trim();
      if (!line.length()) break;

      Serial.print(F("[HDR] "));
      Serial.println(line);

      if (line.startsWith("Content-Length:")) {
        contentLength = line.substring(strlen("Content-Length:")).toInt();
      }
    }

    Serial.print(F("[DRAW] Content-Length = "));
    Serial.println(contentLength);

    uint8_t buf[1024];
    int total = 0;
    unsigned long deadline = millis() + 5000;

    while (total < 1024 && millis() < deadline) {
      while (client.available() && total < 1024) {
        buf[total++] = client.read();
      }
      yield();
    }

    Serial.print(F("[DRAW] bytes read = "));
    Serial.println(total);

    if (total != 1024) {
      Serial.println(F("[DRAW] invalid body size, zero-fill"));
      memset(buf, 0, 1024);
    }

  // APRÈS :
  freeAnimFrames();
renderBufferWithHeader(buf);
// Sauvegarder en galerie seulement si ?save=1 (absent = 0 pour l'animation)
if (req.indexOf("save=0") < 0) {
  saveToGallery(buf);
}

    client.println(F("HTTP/1.1 200 OK"));
    client.println(F("Access-Control-Allow-Origin: *"));
    client.println(F("Connection: close"));
    client.println();
    drainAndClose(client);

    Serial.println(F("[DRAW] done"));
    return;
  }

  // =========================
  // GET /gallery-item?slot=
  // =========================
  if (req.startsWith("GET /gallery-item?slot=")) {
    int s = req.indexOf("slot=");
    if (s >= 0) {
      s += 5;
      int e = req.indexOf(" HTTP", s);
      if (e < 0) e = req.length();

      String rawSlot = req.substring(s, e);
      rawSlot.trim();
      int slot = rawSlot.toInt();

      Serial.print(F("[ROUTE] GET /gallery-item slot raw="));
      Serial.print(rawSlot);
      Serial.print(F(" parsed="));
      Serial.println(slot);

      sendGalleryItem(client, slot);
      drainAndClose(client);
      return;
    } else {
      client.println(F("HTTP/1.1 400 Bad Request"));
      client.println(F("Access-Control-Allow-Origin: *"));
      client.println(F("Connection: close"));
      client.println();
      drainAndClose(client);
      return;
    }
  }

  // =========================
  // GET /gallery
  // =========================
  // Le \r protège contre HTTP/1.0 et variantes sans espace final
  if (req.startsWith("GET /gallery ") || req.startsWith("GET /gallery\r")) {
    Serial.println(F("[ROUTE] GET /gallery"));
    sendGallery(client);
    drainAndClose(client);
    return;
  }

// =========================
  // GET /username?n=...
  // =========================
  if (req.startsWith("GET /username?")) {
  while (client.connected()) {
    String line = client.readStringUntil('\n'); line.trim();
    if (!line.length()) break;
  }

  // Extraire n=
  int ns = req.indexOf("n=");
  if (ns >= 0) {
    ns += 2;
    int eAmp  = req.indexOf("&", ns);
    int eHTTP = req.indexOf(" HTTP", ns);
    if (eHTTP < 0) eHTTP = req.length();
    int ne = (eAmp >= 0 && eAmp < eHTTP) ? eAmp : eHTTP;
    if (ne > ns) {
      pendingAuthor = urlDecode(req.substring(ns, ne)).substring(0, 15);
    }
  }

  // Extraire &ts=
  int ts = req.indexOf("&ts=");
  if (ts >= 0) {
    ts += 4;
    int te = req.indexOf(" HTTP", ts);
    if (te < 0) te = req.length();
    pendingTimestamp = urlDecode(req.substring(ts, te)).substring(0, 23);
  } else {
    unsigned long sec = millis() / 1000;
    char buf[20];
    snprintf(buf, sizeof(buf), "%lus depuis boot", sec);
    pendingTimestamp = String(buf);
  }

  Serial.print(F("[USERNAME] author=")); Serial.println(pendingAuthor);
  Serial.print(F("[USERNAME] stamp="));  Serial.println(pendingTimestamp);

  if (pendingAuthor.length()) {
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(2, 1);
    display.print(pendingAuthor.substring(0, 12));
    display.display();
  }

  client.println(F("HTTP/1.1 200 OK"));
  client.println(F("Access-Control-Allow-Origin: *"));
  client.println(F("Connection: close"));
  client.println();
  client.println(F("OK"));
  client.flush();
  client.stop();
  return;
}

  // =========================
  // GET /invert
  // =========================
  if (req.startsWith("GET /invert")) {
    while (client.connected()) {
      String line = client.readStringUntil('\n');
      line.trim();
      if (!line.length()) break;
      Serial.print(F("[HDR] "));
      Serial.println(line);
    }

    static bool inv = false;
    inv = !inv;

    Serial.print(F("[ROUTE] GET /invert -> "));
    Serial.println(inv ? F("ON") : F("OFF"));

    display.invertDisplay(inv);

    client.println(F("HTTP/1.1 200 OK"));
    client.println(F("Access-Control-Allow-Origin: *"));
    client.println(F("Connection: close"));
    client.println();
    client.println(F("OK"));
    drainAndClose(client);
    return;
  }

  // =========================
  // GET /
  // =========================
  if (req.startsWith("GET / ") || req.startsWith("GET /HTTP")) {
    while (client.connected()) {
      String line = client.readStringUntil('\n');
      line.trim();
      if (!line.length()) break;
      Serial.print(F("[HDR] "));
      Serial.println(line);
    }

    Serial.println(F("[ROUTE] HTML /"));
    sendHTML(client);
    drainAndClose(client);
    return;
  }

  // POST /frames  — upload de toutes les frames pour animation autonome
// Body : [2 bytes little-endian delay][1024 bytes buf] × N frames
if (req.startsWith("POST /frames")) {
  int contentLength = -1;
  while (client.connected()) {
    String line = client.readStringUntil('\n'); line.trim();
    if (!line.length()) break;
    if (line.startsWith("Content-Length:"))
      contentLength = line.substring(16).toInt();
  }

  freeAnimFrames();
  const int frameSize = 1026; // 2 delay + 1024 buf
  int maxFrames = min((int)ANIM_MAX_FRAMES, contentLength / frameSize);

  unsigned long deadline = millis() + 8000;
  int total = 0, needed = maxFrames * frameSize;
  uint8_t* raw = (uint8_t*)malloc(needed);

  if (raw) {
    while (total < needed && millis() < deadline) {
      while (client.available() && total < needed) raw[total++] = client.read();
      yield();
    }
    for (int i = 0; i < maxFrames; i++) {
      uint8_t* p = raw + i * frameSize;
      uint16_t d = p[0] | (p[1] << 8);
      uint8_t* b = (uint8_t*)malloc(1024);
      if (b) { memcpy(b, p + 2, 1024); animFrames[i] = {b, d}; animFrameCount++; }
    }
    free(raw);
    animRunning = (animFrameCount > 0);
    animLastT   = millis();
if (animRunning) renderBufferWithHeader(animFrames[0].buf);
saveGifToGallery(animFrames, animFrameCount, pendingAuthor, pendingTimestamp);

  }

  client.println(F("HTTP/1.1 200 OK"));
  client.println(F("Access-Control-Allow-Origin: *"));
  client.println(F("Connection: close"));
  client.println();
  client.print(animFrameCount);
  drainAndClose(client); return;
}

// POST /frames/stop  — stoppe l'animation autonome
if (req.startsWith("POST /frames/stop") || req.startsWith("GET /frames/stop")) {
  while (client.connected()) {
    String line = client.readStringUntil('\n'); line.trim();
    if (!line.length()) break;
  }
  freeAnimFrames();
  client.println(F("HTTP/1.1 200 OK"));
  client.println(F("Access-Control-Allow-Origin: *"));
  client.println(F("Connection: close"));
  client.println();
  drainAndClose(client); return;
}


  // =========================
  // Fallback HTML
  // =========================
  while (client.connected()) {
    String line = client.readStringUntil('\n');
    line.trim();
    if (!line.length()) break;
    Serial.print(F("[HDR] "));
    Serial.println(line);
  }

  Serial.println(F("[ROUTE] HTML fallback"));
  sendHTML(client);
  client.stop();
}
