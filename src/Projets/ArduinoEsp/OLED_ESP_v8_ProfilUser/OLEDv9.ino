#include <ESP8266WiFi.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <LittleFS.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecureBearSSL.h>
#include <ArduinoJson.h>

#include <SPI.h>
#include <Wire.h>

// ── Waveshare epd2in7_V2 (télécharge https://github.com/waveshareteam/e-Paper) ──

// ── Pins e-ink (identiques à ton Uno, adaptées ESP8266) ────────────

#define EPD_SCK   D5   // GPIO14
#define EPD_MOSI  D7   // GPIO13
#define EPD_CS    D8   // GPIO15
#define EPD_DC    D2   // GPIO4
#define EPD_RST   D1   // GPIO5
#define EPD_BUSY  D0   // GPIO16


#define OLED_SDA D6  // GPIO12 - NOUVEAU pour I2C
#define OLED_SCL D4  // GPIO2  - NOUVEAU pour I2C


#include "epd2in7_V2.h"
#include <SPI.h>
#include <pgmspace.h>
#include "epdpaint.h"  // Paint pour dessin texte
#include "fonts.h"


Epd epd;

#define EPD_W 176
#define EPD_H 264
#define WIDTH_BYTES (EPD_W / 8)
#define BUFFER_SIZE (WIDTH_BYTES * EPD_H)

#define EINK_BUF_FULL ((EPD_W * EPD_H) / 8)
static const int EINKHEADERH = 16;

//Paint e-ink
#define COLORED     0
#define UNCOLORED   1

// ── ADXL345 I2C (partage D1/D2 avec OLED) ───────────────────────
float accelX = 0, accelY = 0, accelZ = 0;
String currentOrientation = "inconnu";

// ── OLED ─────────────────────────────────────────────────────────
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64

#define OLED_RESET -1
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);



// ── ADXL345 I2C (partage D1/D2 avec OLED) ───────────────────────
#define ADXL345_ADDR  0x53
#define ADXL345_POWER 0x2D
#define ADXL345_DATA  0x32


#define EINK_WIDTH  176
#define EINK_HEIGHT 264


String pendingEinkAuthor;
String pendingEinkTimestamp;
String pendingEinkArtistName;
String pendingEinkEthAddress;
bool pendingEinkForSale = false;
static bool renderCacheValid = false; // variable globale, avant loop()
bool einkLandscape = false;  // défaut portrait


WiFiServer server(5058);


const char* RESCOE_SYNC_URL = "https://www.rescoe.xyz/api/esp/sync-to-discord";
const char* RESCOE_SYNC_SECRET = "IlajouteausslesfonctionsJSinjecterdanslecodEDpournotifierRESCOEaprsublicationeffectivesurlcran";

#define GALLERY_SIZE 20
#define ANIM_MAX_FRAMES 50

uint8_t lastRendered[1024] = {0};


// Police bitmap 5x7 (ASCII 32-126) — remplace display.getPixel()
// Chaque caractère = 5 octets, 1 bit par pixel, LSB = ligne haute
static const uint8_t FONT5x7[][5] PROGMEM = {
  {0x00,0x00,0x00,0x00,0x00}, // 32 space
  {0x00,0x00,0x5F,0x00,0x00}, // 33 !
  {0x00,0x07,0x00,0x07,0x00}, // 34 "
  {0x14,0x7F,0x14,0x7F,0x14}, // 35 #
  {0x24,0x2A,0x7F,0x2A,0x12}, // 36 $
  {0x23,0x13,0x08,0x64,0x62}, // 37 %
  {0x36,0x49,0x55,0x22,0x50}, // 38 &
  {0x00,0x05,0x03,0x00,0x00}, // 39 '
  {0x00,0x1C,0x22,0x41,0x00}, // 40 (
  {0x00,0x41,0x22,0x1C,0x00}, // 41 )
  {0x14,0x08,0x3E,0x08,0x14}, // 42 *
  {0x08,0x08,0x3E,0x08,0x08}, // 43 +
  {0x00,0x50,0x30,0x00,0x00}, // 44 ,
  {0x08,0x08,0x08,0x08,0x08}, // 45 -
  {0x00,0x60,0x60,0x00,0x00}, // 46 .
  {0x20,0x10,0x08,0x04,0x02}, // 47 /
  {0x3E,0x51,0x49,0x45,0x3E}, // 48 0
  {0x00,0x42,0x7F,0x40,0x00}, // 49 1
  {0x42,0x61,0x51,0x49,0x46}, // 50 2
  {0x21,0x41,0x45,0x4B,0x31}, // 51 3
  {0x18,0x14,0x12,0x7F,0x10}, // 52 4
  {0x27,0x45,0x45,0x45,0x39}, // 53 5
  {0x3C,0x4A,0x49,0x49,0x30}, // 54 6
  {0x01,0x71,0x09,0x05,0x03}, // 55 7
  {0x36,0x49,0x49,0x49,0x36}, // 56 8
  {0x06,0x49,0x49,0x29,0x1E}, // 57 9
  {0x00,0x36,0x36,0x00,0x00}, // 58 :
  {0x00,0x56,0x36,0x00,0x00}, // 59 ;
  {0x08,0x14,0x22,0x41,0x00}, // 60
  {0x14,0x14,0x14,0x14,0x14}, // 61 =
  {0x00,0x41,0x22,0x14,0x08}, // 62 >
  {0x02,0x01,0x51,0x09,0x06}, // 63 ?
  {0x32,0x49,0x79,0x41,0x3E}, // 64 @
  {0x7E,0x11,0x11,0x11,0x7E}, // 65 A
  {0x7F,0x49,0x49,0x49,0x36}, // 66 B
  {0x3E,0x41,0x41,0x41,0x22}, // 67 C
  {0x7F,0x41,0x41,0x22,0x1C}, // 68 D
  {0x7F,0x49,0x49,0x49,0x41}, // 69 E
  {0x7F,0x09,0x09,0x09,0x01}, // 70 F
  {0x3E,0x41,0x49,0x49,0x7A}, // 71 G
  {0x7F,0x08,0x08,0x08,0x7F}, // 72 H
  {0x00,0x41,0x7F,0x41,0x00}, // 73 I
  {0x20,0x40,0x41,0x3F,0x01}, // 74 J
  {0x7F,0x08,0x14,0x22,0x41}, // 75 K
  {0x7F,0x40,0x40,0x40,0x40}, // 76 L
  {0x7F,0x02,0x04,0x02,0x7F}, // 77 M
  {0x7F,0x04,0x08,0x10,0x7F}, // 78 N
  {0x3E,0x41,0x41,0x41,0x3E}, // 79 O
  {0x7F,0x09,0x09,0x09,0x06}, // 80 P
  {0x3E,0x41,0x51,0x21,0x5E}, // 81 Q
  {0x7F,0x09,0x19,0x29,0x46}, // 82 R
  {0x46,0x49,0x49,0x49,0x31}, // 83 S
  {0x01,0x01,0x7F,0x01,0x01}, // 84 T
  {0x3F,0x40,0x40,0x40,0x3F}, // 85 U
  {0x1F,0x20,0x40,0x20,0x1F}, // 86 V
  {0x3F,0x40,0x38,0x40,0x3F}, // 87 W
  {0x63,0x14,0x08,0x14,0x63}, // 88 X
  {0x07,0x08,0x70,0x08,0x07}, // 89 Y
  {0x61,0x51,0x49,0x45,0x43}, // 90 Z
  {0x00,0x7F,0x41,0x41,0x00}, // 91 [
  {0x02,0x04,0x08,0x10,0x20}, // 92 backslash
  {0x00,0x41,0x41,0x7F,0x00}, // 93 ]
  {0x04,0x02,0x01,0x02,0x04}, // 94 ^
  {0x40,0x40,0x40,0x40,0x40}, // 95 _
  {0x00,0x01,0x02,0x04,0x00}, // 96 `
  {0x20,0x54,0x54,0x54,0x78}, // 97 a
  {0x7F,0x48,0x44,0x44,0x38}, // 98 b
  {0x38,0x44,0x44,0x44,0x20}, // 99 c
  {0x38,0x44,0x44,0x48,0x7F}, // 100 d
  {0x38,0x54,0x54,0x54,0x18}, // 101 e
  {0x08,0x7E,0x09,0x01,0x02}, // 102 f
  {0x0C,0x52,0x52,0x52,0x3E}, // 103 g
  {0x7F,0x08,0x04,0x04,0x78}, // 104 h
  {0x00,0x44,0x7D,0x40,0x00}, // 105 i
  {0x20,0x40,0x44,0x3D,0x00}, // 106 j
  {0x7F,0x10,0x28,0x44,0x00}, // 107 k
  {0x00,0x41,0x7F,0x40,0x00}, // 108 l
  {0x7C,0x04,0x18,0x04,0x78}, // 109 m
  {0x7C,0x08,0x04,0x04,0x78}, // 110 n
  {0x38,0x44,0x44,0x44,0x38}, // 111 o
  {0x7C,0x14,0x14,0x14,0x08}, // 112 p
  {0x08,0x14,0x14,0x18,0x7C}, // 113 q
  {0x7C,0x08,0x04,0x04,0x08}, // 114 r
  {0x48,0x54,0x54,0x54,0x20}, // 115 s
  {0x04,0x3F,0x44,0x40,0x20}, // 116 t
  {0x3C,0x40,0x40,0x40,0x7C}, // 117 u
  {0x1C,0x20,0x40,0x20,0x1C}, // 118 v
  {0x3C,0x40,0x30,0x40,0x3C}, // 119 w
  {0x44,0x28,0x10,0x28,0x44}, // 120 x
  {0x0C,0x50,0x50,0x50,0x3C}, // 121 y
  {0x44,0x64,0x54,0x4C,0x44}, // 122 z
  {0x00,0x08,0x36,0x41,0x00}, // 123 {
  {0x00,0x00,0x7F,0x00,0x00}, // 124 |
  {0x00,0x41,0x36,0x08,0x00}, // 125 }
  {0x10,0x08,0x08,0x10,0x08}, // 126 ~
};


struct GalleryIndex {
  uint16_t magic;
  uint16_t version;
  uint16_t head;
  uint16_t count;
};

GalleryIndex galleryIndex = {0xBEEF, 1, 0, 0};

String pendingAuthor = "";
String pendingTimestamp = "";
String pendingArtistName = "";

String pendingEthAddress;
bool   pendingForSale = false;
String pendingUid;
String pendingMode = "still";
String pendingType = "still";


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

<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="logo" href="/logo.png">

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
.app-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px;
}

.app-logo {
  display: block;
  width: 60px;
  height: 60px;
  min-width: 60px;
  min-height: 60px;
  max-width: 60px;
  max-height: 60px;
  flex: 0 0 60px;
  object-fit: contain;
  overflow: hidden;
}

.app-header h1 {
  margin: 0;
  line-height: 1.1;
}

  #userBadge { font-family: var(--mono); font-size: 11px; color: var(--text2); display: flex; align-items: center; gap: 6px; }
  #userBadge strong { color: var(--orange); }

  #status {
    width: 100%; max-width: 560px; font-family: var(--mono); font-size: 11px;
    color: var(--text2); padding: 6px 12px; background: var(--surface);
    border: 1px solid var(--border); border-radius: 8px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }

#canvasWrap {
  position: relative;
  display: inline-block;
  border: 2px solid var(--border);
  border-radius: 6px;
  overflow: visible; /* important pour la rotation */
  box-shadow: 0 0 28px rgba(0,229,176,.06);
  background: #fff;
  transition: width 0.2s, height 0.2s;
}


  #canvas, #layerCanvas {
    display: block; width: min(90vw, 512px); height: auto;
    image-rendering: pixelated; cursor: crosshair;
  }

  #canvasWrap:fullscreen {
  display:flex;
  align-items:center;
  justify-content:center;
  background:#000;
  border:none;
  width:100vw;
  height:100vh;
}

#canvasWrap:fullscreen canvas {
  width:90vw !important;
  height:auto !important;
  max-height:90vh;
}


#fsConfig {
  position: fixed;
  top: 20px;
  right: 20px;
  background: var(--surface);
  border: 1px solid var(--accent);
  border-radius: 8px;
  padding: 12px;
  z-index: 10000;
  gap: 6px;
  max-width: 300px;
}

#fsConfig select {
  padding: 6px 8px;
  background: var(--surf2);
  border: 1px solid var(--border);
  border-radius: 5px;
  color: var(--text);
  font-size: 10px;
  font-family: var(--mono);
}


#fsToolbar {
  position: fixed;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  display: flex !important;  /* ✅ Force l'affichage */
  gap: 8px;
  padding: 6px 10px;
  background: rgba(0,0,0,0.85);  /* ✅ Plus opaque */
  border: 1px solid var(--border);
  border-radius: 8px;
  backdrop-filter: blur(8px);
  z-index: 9999;  /* ✅ Plus haut */
  opacity: 1;     /* ✅ Toujours visible */
  transition: all 0.2s;
}

#fsToolbar:hover {
  background: rgba(0,0,0,0.95);
  transform: translateX(-50%) scale(1.05);
}

/* ✅ Cache par défaut en mode normal */
body:not(.fs-mode) #fsToolbar {
  display: none !important;
}


/* boutons un peu plus gros */
#fsToolbar .btn {
  font-size: 13px;
  padding: 8px 10px;
}

  #layerCanvas { position: absolute; top:0; left:0; pointer-events: none; }

.tabs{
  width:100%;
  max-width:560px;
  min-width:0;
  display:flex;
  gap:4px;
  padding:5px;
  background:var(--surface);
  border:1px solid var(--border);
  border-radius:10px;
  overflow-x:auto;
  overflow-y:hidden;
  flex-wrap:nowrap;
  -webkit-overflow-scrolling:touch;
  scrollbar-width:none;
}

.tabs::-webkit-scrollbar{
  display:none;
}

.tab-btn{
  flex:0 0 auto;
  min-width:max-content;
  padding:8px 10px;
  background:none;
  border:none;
  border-radius:7px;
  color:var(--text2);
  font-family:var(--mono);
  font-size:11px;
  font-weight:600;
  white-space:nowrap;
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

.profile-field {
  display: flex; flex-direction: column; gap: 4px;
}
.profile-field label {
  font-family: var(--mono); font-size: 10px; color: var(--text2); text-transform: uppercase; letter-spacing: .06em;
}
.profile-field input[type=text] {
  width: 100%; padding: 8px 10px; background: var(--surf2);
  border: 1px solid var(--border); border-radius: 7px;
  color: var(--text); font-family: var(--mono); font-size: 12px;
  outline: none; transition: border-color .2s;
}
.profile-field input[type=text]:focus { border-color: var(--accent); }
.eth-field { display: none; }
.eth-field.visible { display: flex; }
.profile-badge {
  font-family: var(--mono); font-size: 10px; color: var(--text2);
  padding: 6px 10px; background: var(--surf2);
  border: 1px solid var(--border); border-radius: 6px;
  word-break: break-all;
}
.profile-badge span { color: var(--accent); }


.poetry-preview-wrap {
  position: relative; background: #000; border-radius: 6px;
  overflow: hidden; width: 100%;
  aspect-ratio: 128/64; image-rendering: pixelated;
}
.poetry-preview-wrap canvas {
  display: block; width: 100%; height: 100%; image-rendering: pixelated;
}
.poetry-char-counter {
  font-family: var(--mono); font-size: 10px; color: var(--text2);
  text-align: right; padding: 2px 0;
}
.poetry-char-counter.warn  { color: var(--orange); }
.poetry-char-counter.error { color: var(--red); }
.poetry-scroll-opts { display: none; }
.poetry-scroll-opts.visible { display: flex; }
.preview-panel {
  margin-top: 8px;
}

.preview-toggle {
  cursor: pointer;
  user-select: none;
  width: fit-content;
  margin: 0 auto 8px;
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--panel, rgba(255,255,255,0.03));
  font-family: var(--mono);
  font-size: 11px;
  color: var(--text);
}

/* ✅ GRID → toujours côte à côte */
.preview-grid {
  display: grid;
  grid-template-columns: auto auto;
  justify-content: center;
  gap: 10px;
}

.preview-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 6px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--panel, rgba(255,255,255,0.02));
}

/* ✅ tailles contrôlées (évite le wrap) */
.preview-card-oled {
  width: 160px;
}

.preview-card-eink {
  width: 120px;
}

.preview-title {
  font-family: var(--mono);
  font-size: 10px;
  color: var(--text2);
}

.preview-meta {
  font-family: var(--mono);
  font-size: 9px;
  color: var(--text2);
}

.preview-frame {
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 2px;
}

.preview-frame-oled {
  background: #000;
}

.preview-frame-eink {
  background: #e8e4d8;
}

/* ✅ canvas propre */
#oledPreview,
#einkPreview {
  display: block;
  image-rendering: pixelated;
  max-width: 100%;
  height: auto;
}

/* ✅ respect ratio OLED */
#oledPreview {
  width: 100%;
  aspect-ratio: 128 / 64;
}

/* ✅ E-INK piloté par JS (orientation réelle) */
#einkPreview {
  width: 100%;
}

/* ✅ mobile safe (stack uniquement si vraiment trop petit) */
@media (max-width: 400px) {
  .preview-grid {
    grid-template-columns: 1fr;
  }
}

  .tool-group{
  width:100%;
  display:flex;
  flex-direction:column;
  gap:0;
}

.tool-summary{
  list-style:none;
  cursor:pointer;
  padding:8px 10px;
  background:var(--surf2);
  border:1px solid var(--border);
  border-radius:7px;
  font-family:var(--mono);
  font-size:11px;
  font-weight:700;
  color:var(--text2);
  user-select:none;
  transition:all .15s;
}

.tool-summary::-webkit-details-marker{ display:none; }

.tool-summary:hover{
  border-color:var(--accent);
  color:var(--text);
}

.tool-group[open] .tool-summary{
  border-color:var(--accent);
  color:var(--accent);
  border-radius:7px 7px 0 0;
}

.tool-group-row{
  display:flex;
  flex-wrap:wrap;
  gap:6px;
  align-items:center;
  padding:8px;
  background:rgba(255,255,255,0.02);
  border:1px solid var(--border);
  border-top:none;
  border-radius:0 0 7px 7px;
}

.row-soft{
  padding:2px 0;
}

.tog.compact{
  padding-left:4px;
}

.tog.compact .tok{
  width:30px;
  height:16px;
}

.tog.compact .tok::after{
  width:10px;
  height:10px;
}

.tog.compact input:checked + .tok::after{
  left:18px;
}

.color-swatch{
  min-width:96px;
  text-align:center;
  font-weight:700;
  border-width:2px;
}

.color-swatch.is-black{
  background:#000;
  color:#fff;
  border-color:#666;
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.08);
}

.color-swatch.is-white{
  background:#fff;
  color:#000;
  border-color:#999;
  box-shadow:inset 0 0 0 1px rgba(0,0,0,.08);
}

</style>
</head>
<body>

<header>
  <div class="app-header" style="display:flex; align-items:center; gap:12px;">
<img src="/logo.png?v=10" alt="OLED Paint" width="64" height="64">
    <h1 style="margin:0;">Paint Mémors</h1>
  </div>

<div id="userBadge" style="display:flex;flex-direction:column;align-items:flex-end;gap:2px;">
  <span style="font-family:var(--mono);font-size:10px;color:var(--text2)">
    Artiste: <strong id="artistDisplay" style="color:var(--accent)">—</strong>
  </span>
  <span style="font-family:var(--mono);font-size:10px;color:var(--text2)">
    Œuvre: <strong id="userDisplay" style="color:var(--orange)">—</strong>
  </span>
</div>
</header>
<div id="status">Prêt</div>

<!-- DRAW ZONE -->
<div id="drawArea" style="width:100%;max-width:560px;display:flex;flex-direction:column;gap:8px;">

  <!-- ACTIONS CANVAS -->
  <div class="row">
    <button class="btn" onclick="toggleFullscreenCanvas()">⛶ Plein écran</button>
  </div>
<!-- CONFIG FULLSCREEN (NOUVEAU) -->
<div id="fsConfig" class="row" style="display:none;">
  <div style="font-family:var(--mono);font-size:10px;color:var(--text2);">
    Fullscreen tools:
  </div>
  <select id="fsTool1" onchange="saveFsConfig()">
    <option value="brush">🖌 Pinceau</option>
    <option value="eraser">🧽 Gomme</option>
    <option value="line">📏 Ligne</option>
    <option value="rect">⬜ Rect</option>
  </select>
  <select id="fsTool2" onchange="saveFsConfig()">
    <option value="circle">○ Cercle</option>
    <option value="fill">🪣 Remplir</option>
    <option value="addFrame">＋ Frame</option>
    <option value="sendFrame">↑ Send</option>
  </select>
  <select id="fsTool3" onchange="saveFsConfig()">
    <option value="undo">↶ Undo</option>
    <option value="clearCanvas">🗑 Clear</option>
  </select>
  <button class="btn" onclick="showFsConfig(false)">✓</button>
</div>

  <!-- CANVAS -->
  <div id="canvasWrap">
    <canvas id="canvas" width="128" height="64"></canvas>
    <canvas id="layerCanvas" width="128" height="64"></canvas>
  </div>

</div>

<!-- PREVIEW -->
<details id="previewPanel" open class="preview-panel">
  <summary class="preview-toggle">Aperçu écrans</summary>

  <div class="preview-grid">

    <!-- OLED -->
    <div class="preview-card preview-card-oled">
      <div class="preview-title">OLED 0.96"</div>

      <div class="preview-frame preview-frame-oled">
        <canvas id="oledPreview" width="128" height="64"></canvas>
      </div>

      <div class="row preview-actions" style="gap:4px;">
        <button
          class="btn"
          id="oledColorBtn"
          style="font-size:9px;padding:4px 7px;"
          onclick="toggleOledPreviewColor()"
        >
          🔵 Mode
        </button>
      </div>
    </div>

    <!-- E-INK -->
    <div class="preview-card preview-card-eink">
      <div class="preview-title">E-INK 2.7"</div>

      <div class="preview-frame preview-frame-eink">
        <!-- IMPORTANT : plus de classe portrait/landscape -->
        <canvas
          id="einkPreview"
          width="176"
          height="264"
          title="Aperçu e-ink"
        ></canvas>
      </div>

      <div class="preview-meta" id="einkOrientLabel">Portrait</div>
    </div>

  </div>
</details>

<!-- ORIENTATION -->
<div style="display:flex;gap:8px;width:100%;max-width:560px;align-items:center;font-family:var(--mono);font-size:11px;color:var(--text2);">
  <button class="btn active" id="orientPortraitBtn" onclick="setOrientation('portrait')">
    ⬜ Portrait
  </button>

  <button class="btn" id="orientLandscapeBtn" onclick="setOrientation('landscape')">
    ⬛ Paysage
  </button>



  <span id="orientSensorBadge" style="margin-left:8px;font-size:10px;color:var(--accent);display:none">
    📡
  </span>

  <button class="btn" id="sensorOrientBtn"
    onclick="sensorOrientationActive ? stopSensorOrientation() : startSensorOrientation()"
    style="margin-left:auto;font-size:10px;">
    📡
  </button>

</div>




<div class="tabs">
  <button class="tab-btn active" onclick="showTab('frames',this)">🎞 Frames</button>
  <button class="tab-btn"        onclick="showTab('draw',this)"  >🖌 Dessin</button>
  <button class="tab-btn"        onclick="showTab('media',this)" >📸 Média</button>
  <button class="tab-btn" onclick="showTab('gallery',this); loadGallery();">🖼️ Galerie</button>
  <button class="tab-btn" onclick="showTab('poetry',this)">✍ Poésie</button>
  <button class="tab-btn" onclick="showTab('profile',this)">👤 Profil</button>
</div>

<!-- FRAMES -->
<div class="panel active" id="panel-frames">
  <div class="panel-title">Timeline & Animation</div>
<center>
  <!-- 🎬 PREVIEW (PRIORITÉ VISUELLE) -->
  <div id="framesStrip"></div>

  <!-- 🎮 NAVIGATION + LECTURE (CENTRÉE SUR PLAY) -->
  <div class="row">
    <button class="btn" onclick="prevFrame()">⏮</button>
    <button class="btn" onclick="togglePlay()" id="playBtn">▶</button>
    <button class="btn" onclick="nextFrame()">⏭</button>

    <button class="btn" onclick="addFrame()">＋</button>
    <button class="btn" onclick="dupFrame()">⎘</button>
    <button class="btn danger" onclick="delFrame()">✕</button>
    <button class="btn" onclick="toggleInvert()">◐</button>

  </div>
</center>

  <!-- ⏱️ DÉLAI (VISIBLE) -->
  <div class="row row-soft">
    <div class="sr">
      <label>Délai</label>
      <input type="range" min="50" max="2000" step="10" value="200"
        id="delaySlider" oninput="setDelay(this.value)">
      <span class="sv" id="delayVal">200ms</span>
    </div>

    <label class="tog compact">
      <input type="checkbox" id="delayAllFrames">
      <span class="tok"></span>
      Toutes
    </label>

    <div id="frameInfo" style="font-family:var(--mono);font-size:11px;color:var(--orange);">Frame 1/1</div>

  </div>

  <!-- 👁️ ONION SKIN (VISIBLE) -->
  <div class="row row-soft">
    <label class="tog">
      <input type="checkbox" id="onionCheck" onchange="toggleOnion()">
      <span class="tok"></span>Onion
    </label>

    <div class="sr">
      <label>Opacité</label>
      <input type="range" min="10" max="80" value="35" id="onionSlider" oninput="setOnionOpacity(this.value)">
      <span class="sv" id="onionVal">35%</span>
    </div>
  </div>

  <!-- 📤 ENVOI SIMPLIFIÉ -->
  <div class="row">
    <button class="btn send" onclick="sendFrame()">↑ Envoyer Frame</button>

    <select onchange="setStillDisplayTarget(this.value)">
      <option value="2" selected>OLED + E-INK</option>
      <option value="0">OLED</option>
      <option value="1">E-INK</option>
    </select>

    <button class="btn send" onclick="toggleOledAnim()" id="animBtn">📺 Envoyer Animation (OLED)</button>
  </div>

  <!-- ⚙️ MULTI-SÉLECTION (AVANCÉ) -->
  <details class="tool-group">
    <summary class="tool-summary">Multi-sélection</summary>
    <div class="tool-group-row">
      <button class="btn" id="frameSelBtn" onclick="toggleFrameSelectionMode()">⬚ Multi-select</button>
      <button class="btn" onclick="cutSelectedFrames()">✂ Couper</button>
      <button class="btn" onclick="copySelectedFrames()">⎘ Copier</button>
      <button class="btn" onclick="pasteFrames()">⬇ Coller</button>
      <button class="btn" onclick="moveSelectedFramesLeft()">← reculer </button>
      <button class="btn" onclick="moveSelectedFramesRight()">avancer →</button>
      <button class="btn danger" onclick="deleteSelectedFrames()">✕ Suppr</button>
    </div>
  </details>

  <div id="frameMultiInfo" style="display:none;font-family:var(--mono);font-size:10px;color:var(--orange);padding:4px 8px;background:var(--surf2);border:1px solid var(--border);border-radius:6px;"></div>

  <!-- 💾 EXPORT -->
  <details class="tool-group">
    <summary class="tool-summary">Export</summary>
    <div class="tool-group-row">
      <button class="btn" onclick="saveCurrentPng()">📄 PNG</button>
      <button class="btn" onclick="saveAnimationGif()">🎞 GIF</button>
    </div>
  </details>

</div>


<!-- DRAW -->
<!-- DRAW -->
<div class="panel" id="panel-draw">
  <div class="panel-title">Outils de Dessin</div>

  <!-- 🔴 OUTILS PRINCIPAUX (TOUJOURS VISIBLES) -->
  <div class="row">
    <button class="btn active" id="btnbrush" onclick="setTool('brush')">Pinceau</button>
    <button class="btn" id="btneraser" onclick="setTool('eraser')">Gomme</button>

    <button class="btn" id="btnline" onclick="setTool('line')">Ligne</button>
    <button class="btn" id="btnrect" onclick="setTool('rect')">Rect</button>
    <button class="btn" id="btncircle" onclick="setTool('circle')">Cercle</button>
    <button class="btn" id="btnpoly" onclick="setTool('poly')">Poly</button>

    <button class="btn" id="btnfill" onclick="setTool('fill')">Remplir</button>
  </div>

  <!-- 🎨 OPTIONS LIÉES AU DESSIN -->
  <div class="row row-soft">
    <label class="tog compact">
      <input type="checkbox" id="fillCheck" onchange="setFill(this.checked)">
      <span class="tok"></span>Forme pleine
    </label>

    <button class="btn color-swatch" onclick="toggleColor()" id="colorBtn">NOIR</button>
  </div>

  <!-- 📏 RÉGLAGES -->
  <details class="tool-group" open>
    <summary class="tool-summary">Réglages</summary>
    <div class="tool-group-row">
      <div class="sr">
        <label>Taille</label>
        <input type="range" min="1" max="8" value="1" id="sizeSlider" oninput="setSize(this.value)">
        <span class="sv" id="sizeVal">1px</span>
      </div>
      <div class="sr">
        <label>Snap</label>
        <input type="range" min="1" max="16" value="1" id="snapSlider" oninput="setSnap(this.value)">
        <span class="sv" id="snapVal">1px</span>
      </div>
    </div>
  </details>

  <!-- ✂️ SÉLECTION -->
  <details class="tool-group">
    <summary class="tool-summary">Sélection</summary>
    <div class="tool-group-row">
      <button class="btn" id="btnselect" onclick="setTool('select')">Sélect.</button>
      <button class="btn" id="btnwand" onclick="setTool('wand')">Baguette</button>
    </div>
  </details>


  <div id="selectActions" class="row" style="display:none;">
    <button class="btn" onclick="cutSelection()">Déplacer</button>
    <button class="btn" onclick="confirmMoveSelection()">Fin déplacement</button>
    <button class="btn" onclick="setStampFromSelection()">Tampon</button>
    <button class="btn danger" onclick="clearSelectionArea()">Effacer</button>
  </div>

  <div id="selectToolInfo" style="display:none;font-family:var(--mono);font-size:10px;color:var(--text2);padding:4px 8px;background:var(--surf2);border:1px solid var(--border);border-radius:6px;line-height:1.5;"></div>


  <!-- 🔄 TRANSFORMATIONS (SECONDARY → REPLIÉ) -->
  <details class="tool-group">
    <summary class="tool-summary">Transformations</summary>
    <div class="tool-group-row">
      <button class="btn" onclick="flipH()">↔ Flip H</button>
      <button class="btn" onclick="flipV()">↕ Flip V</button>
    </div>
  </details>

  <!-- ↩️ HISTORIQUE + AFFICHAGE -->
  <div class="row row-soft">
    <button class="btn" onclick="undo()">Undo</button>
    <button class="btn" onclick="redo()">Redo</button>

    <label class="tog">
      <input type="checkbox" id="gridCheck" onchange="setGrid(this.checked)">
      <span class="tok"></span>Grille
    </label>

    <label class="tog">
      <input type="checkbox" id="symCheck" onchange="setSym(this.checked)">
      <span class="tok"></span>Symétrie
    </label>
  </div>

  <!-- ⚠️ ACTION DESTRUCTIVE ISOLÉE -->
  <div class="row">
    <button class="btn danger" onclick="clearCanvas()">Vider le canvas</button>
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
  <button class="btn send" id="sendTxtArtBtn" style="display:none" onclick="sendTxtArtToOled()">↑ Envoyer à l'OLED</button>
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

<!-- PROFIL, (export suppr) -->
<div class="panel" id="panel-profile">
  <div class="panel-title">Profil Artiste</div>

  <div class="profile-field">
    <label>Nom artiste</label>
    <input type="text" id="profileArtistName" maxlength="20" placeholder="Ton nom d'artiste...">
  </div>

  <div class="row">
    <label class="tog">
      <input type="checkbox" id="profileForSale" onchange="toggleEthField()">
      <span class="tok"></span>
      Mettre mes œuvres en vente
    </label>
  </div>

  <div class="profile-field eth-field" id="ethFieldWrap">
    <label>Adresse ETH (Base)</label>
    <input type="text" id="profileEthAddress" maxlength="42" placeholder="0x...">
  </div>

  <div class="row">
    <button class="btn send" onclick="saveProfile()">💾 Sauvegarder le profil</button>
    <button class="btn danger" onclick="resetProfile()">✕ Réinitialiser</button>
  </div>

  <div id="profileStatus" class="profile-badge" style="display:none"></div>
</div>

<div class="panel" id="panel-gallery">
  <div class="panel-title">Galerie</div>
  <div class="row" style="margin-bottom:6px;">
    <button class="btn active" id="galleryTabArtwork"
      onclick="switchGalleryTab('artwork',this)">🖼 Œuvres</button>
    <button class="btn" id="galleryTabPoetry"
      onclick="switchGalleryTab('poetry',this)">✍ Poésies</button>
  </div>
  <div id="galleryGrid"       class="gallery-grid"></div>
  <div id="galleryGridPoetry" class="gallery-grid" style="display:none"></div>
</div>

<div class="panel" id="panel-poetry">
  <div class="panel-title">Poésie / Texte libre</div>

  <!-- Taille de texte -->
  <div class="row">
    <div class="sr">
      <label>Taille:</label>
      <select id="poetrySize" onchange="poetryUpdate()">
        <option value="1">1× — 21 car/ligne</option>
        <option value="2" selected>2× — 10 car/ligne</option>
        <option value="3">3× — 7 car/ligne</option>
      </select>
    </div>
    <div id="poetryCharCounter" class="poetry-char-counter">0 / 48 car.</div>
  </div>

  <!-- Zone de saisie -->
  <textarea id="poetryInput" placeholder="Écris ta poésie ici…"
     style="height:80px;resize:vertical;"></textarea>

  <!-- Scroll -->
  <div class="row">
    <label class="tog">
      <input type="checkbox" id="poetryScrollCheck" onchange="poetryToggleScroll()">
      <span class="tok"></span>
      Mode scroll
    </label>
    <div class="sr poetry-scroll-opts" id="poetryScrollOpts">
      <label>Vitesse:</label>
      <input type="range" min="20" max="300" step="10" value="80"
        id="poetryScrollSpeed" oninput="poetryScrollSpeedUpdate(this.value)">
      <span class="sv" id="poetryScrollSpeedVal">80ms</span>
    </div>
  </div>

  <!-- Preview OLED (fond noir, pixels bleus) -->
  <div class="poetry-preview-wrap">
    <canvas id="poetryCanvas" width="128" height="64"></canvas>
  </div>

  <!-- Avertissement dépassement -->
  <div id="poetryWarning" style="display:none;font-family:var(--mono);font-size:10px;color:var(--orange);padding:4px 0;"></div>

  <!-- Actions -->
  <div class="row">
    <button class="btn send" onclick="poetrySendToOled()">↑ Envoyer à l'OLED</button>
    <button class="btn"      onclick="poetrySaveToGallery()">💾 Sauver en galerie</button>
  </div>
</div>

<!-- MODAL: USERNAME — popup à chaque envoi vers OLED -->
<!-- REMPLACER le modal userModal entièrement : -->
<div class="overlay" id="userModal">
  <div class="mbox">
    <div class="mtitle">✏️ Envoyer à l'OLED</div>
    <div id="modalArtistBadge" style="font-family:var(--mono);font-size:10px;color:var(--text2);padding:4px 0;display:none">
      Artiste : <span id="modalArtistDisplay" style="color:var(--accent)"></span>
    </div>
    <p>Nom de cette œuvre :</p>
    <input type="text" id="usernameInput" placeholder="Nom de l'œuvre (max 20 car.)..." maxlength="20">
    <div class="row" id="forSaleRow" style="display:none">
      <label class="tog">
        <input type="checkbox" id="modalForSale">
        <span class="tok"></span>
        Mettre en vente
      </label>
    </div>
    <div class="row">
      <button class="btn send"   onclick="confirmSend()" style="flex:1">↑ Envoyer</button>
      <button class="btn danger" onclick="cancelSend()"  style="flex:1">✕ Annuler</button>
    </div>
  </div>
</div>

<div class="overlay" id="firstRunModal">
  <div class="mbox">
    <div class="mtitle">👋 Bienvenue !</div>
    <p>Avant de commencer, configure ton profil artiste. Tu pourras le modifier plus tard dans l'onglet Profil.</p>

    <div class="profile-field">
      <label>Ton nom d'artiste</label>
      <input type="text" id="firstRunName" maxlength="20" placeholder="Ex: Jean-Michel...">
    </div>

    <div class="row">
      <label class="tog">
        <input type="checkbox" id="firstRunForSale" onchange="toggleFirstRunEth()">
        <span class="tok"></span>
        Je veux mettre mes œuvres en vente
      </label>
    </div>

    <div class="profile-field eth-field" id="firstRunEthWrap">
      <label>Adresse ETH (Base)</label>
      <input type="text" id="firstRunEth" maxlength="42" placeholder="0x...">
    </div>

    <div class="row">
      <button class="btn send" onclick="confirmFirstRun()" style="flex:1">Commencer</button>
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

// ═══════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════
//  S
// ═══════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════
//  C
// ═══════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════
//  R
// ═══════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════
//  I
// ═══════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════
//  P
// ═══════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════
//  T
// ═══════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════


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
//  DRAWING STATE - Variable Etat - variables d'état
// ═══════════════════════════════════════════════════════════════════
let tool = 'brush';

const PIXEL_ON_COLOR = '#000';
const PIXEL_OFF_COLOR = '#fff';
let drawColor = PIXEL_ON_COLOR;

window.finishSelectionMove = function () {
  moveMode = false;
  selectionFloating = false;
  moveDragStart = null;
  clearOverlay();
  drawSelectionOverlay();
  showSelectActions(true);
  setTool('select');
  setStatus('Déplacement terminé');
};

window.toggleColor = function () {
  drawColor = drawColor === PIXEL_ON_COLOR ? PIXEL_OFF_COLOR : PIXEL_ON_COLOR;
  const btn = document.getElementById('colorBtn');
  const isBlack = drawColor === PIXEL_ON_COLOR;
  btn.textContent = isBlack ? 'NOIR' : 'BLANC';
  btn.classList.toggle('is-black', isBlack);
  btn.classList.toggle('is-white', !isBlack);
  setStatus(isBlack ? 'Couleur noir' : 'Couleur blanc');
};

document.getElementById('colorBtn')?.classList.add('is-black');




let size = 1, snapSize = 1;
let rawSourceImg = null; // ImageData brute de l'image chargée, avant dithering

let fillMode = false, gridMode = false, symMode = false;
let drawing = false, startX = 0, startY = 0, shapeSnap = null;

// ─── SÉLECTION / DÉPLACEMENT ──────────────────────────────────────
let selectionActive = false;      // une sélection rectangulaire est active
let selRect = null;               // {x,y,w,h} sélection en cours
let selectionData = null;         // ImageData de la zone sélectionnée
let selectionBuf  = null;         // Uint8Array(1024) de la frame avant la sélection
let moveMode = false;             // on est en train de déplacer la sélection dupliquée
let moveOffsetX = 0, moveOffsetY = 0; // offset drag
let moveDragStart = null;         // {x,y} point de départ du drag
let selectionFloating = false;    // sélection déplaçable directement, sans duplication
let frameSelection = new Set();   // multi-sélection de frames
let frameClipboard = [];          // tampon de duplication de frames
let draggingFrameSelection = false;
let frameDropIndex = -1;
let polyPoints = [];
let threshold = 128, ditherMode = 'floyd';
let oledInverted = true;

const POETRY_FONT_W = 6;  // largeur px par char (textSize=1)
const POETRY_FONT_H = 8;  // hauteur px par char

let poetryScrollEnabled = false;
let poetryScrollSpeed   = 80;   // ms par pixel
let poetryScrollRafId   = null;
let poetryScrollOffset  = 0;    // offset vertical en pixels (scroll bas→haut)
let poetryScrollBuf     = null; // buffer total (hauteur variable) avant découpage

const POETRY_HARD_CHAR_LIMIT = 500;
const GIF_MAX_FRAMES = 50
let poetryUpdateTimer = null;
let poetryBusy = false;

//e-INK :

// 0=OLED seul, 1=e-ink seul, 2=OLED+e-ink (défaut)
let stillDisplayTarget = 2;




window.setStillDisplayTarget = v => {
  const n = Number(v);
  stillDisplayTarget = (n === 0 || n === 1 || n === 2) ? n : 2;
  setStatus(
    'Destination image fixe : ' +
    (stillDisplayTarget === 0 ? 'OLED' :
     stillDisplayTarget === 1 ? 'E-INK' : 'OLED + E-INK')
  );
};


// ═══════════════════════════════════════════════════════════════════
//  ORIENTATION — 'portrait' | 'landscape'
// ═══════════════════════════════════════════════════════════════════
let sensorOrientationActive  = false;      // true si le capteur pilote l'orientation
let sensorPollInterval       = null;


let currentCanvasOrientation = 'landscape';

function syncOrientationUI() {
  document.getElementById('orientPortraitBtn').classList.toggle('active', currentCanvasOrientation === 'portrait');
  document.getElementById('orientLandscapeBtn').classList.toggle('active', currentCanvasOrientation === 'landscape');

  const label = document.getElementById('einkOrientLabel');
  if (label) label.textContent = currentCanvasOrientation === 'portrait' ? 'Portrait' : 'Paysage';
}

function applyOrientationToDrawingCanvas() {
  const wrap = document.getElementById('canvasWrap');
  const canvasEl = document.getElementById('canvas');
  const layerEl = document.getElementById('layerCanvas');

  const baseW = 128;
  const baseH = 64;
  const scale = Math.min(window.innerWidth * 0.9, 512) / baseW;
  const cssW = Math.round(baseW * scale);
  const cssH = Math.round(baseH * scale);

  [canvasEl, layerEl].forEach(el => {
    el.style.width = cssW + 'px';
    el.style.height = cssH + 'px';
    el.style.position = 'absolute';
    el.style.left = '50%';
    el.style.top = '50%';
    el.style.transformOrigin = 'center center';
  });

  if (currentCanvasOrientation === 'portrait') {
    wrap.style.width = cssH + 'px';
    wrap.style.height = cssW + 'px';
    canvasEl.style.transform = 'translate(-50%, -50%) rotate(-90deg)';
    layerEl.style.transform  = 'translate(-50%, -50%) rotate(-90deg)';
  } else {
    wrap.style.width = cssW + 'px';
    wrap.style.height = cssH + 'px';
    canvasEl.style.transform = 'translate(-50%, -50%) rotate(0deg)';
    layerEl.style.transform  = 'translate(-50%, -50%) rotate(0deg)';
  }

  wrap.style.position = 'relative';
  wrap.style.overflow = 'hidden';
}

function applyOrientationEverywhere() {
  syncOrientationUI();
  applyOrientationToDrawingCanvas();
  if (frames[curFrame]) {
    updateOledPreview(frames[curFrame].buffer);
    updateEinkPreview(frames[curFrame].buffer);
  }
}

window.setOrientation = function(orient) {
  currentCanvasOrientation = orient;
  sensorOrientationActive = false;
  document.getElementById('orientSensorBadge').style.display = 'none';
  document.getElementById('sensorOrientBtn').classList.remove('active');
  applyOrientationEverywhere();
  setStatus('Orientation : ' + orient);
};


window.toggleFullscreenCanvas = function () {
  const canvasWrap = document.getElementById('canvasWrap');
  if (!canvasWrap) return;

  if (!document.fullscreenElement) {
    canvasWrap.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
};


document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement) {
    document.body.classList.remove('fs-mode');
  }
});

// ✅ Charge la config au démarrage
let fsConfig = JSON.parse(localStorage.getItem('fsConfig') || '["brush","eraser","addFrame"]');

// ✅ Toggle config fullscreen
function showFsConfig(show) {
  document.getElementById('fsConfig').style.display = show ? 'flex' : 'none';
  if (!show) saveFsConfig();
}

// ✅ Sauvegarde config
function saveFsConfig() {
  fsConfig = [
    document.getElementById('fsTool1').value,
    document.getElementById('fsTool2').value,
    document.getElementById('fsTool3').value
  ];
  localStorage.setItem('fsConfig', JSON.stringify(fsConfig));
  updateFsToolbar();  // Met à jour les boutons
}

// ✅ Met à jour la toolbar fullscreen
function updateFsToolbar() {
  const toolbar = document.getElementById('fsToolbar');
  if (!toolbar) return;

  toolbar.innerHTML = `
    <button class="btn" onclick="runFsAction('${fsConfig[0]}')">${getFsIcon(fsConfig[0])}</button>
    <button class="btn" onclick="runFsAction('${fsConfig[1]}')">${getFsIcon(fsConfig[1])}</button>
    <button class="btn" onclick="runFsAction('${fsConfig[2]}')">${getFsIcon(fsConfig[2])}</button>
    <button class="btn danger" onclick="toggleFullscreenCanvas()">✕</button>
  `;
}

window.runFsAction = function (action) {
  if (action === 'addFrame') return addFrame();
  if (action === 'undo') return undo();
  if (action === 'clearCanvas') return clearCanvas();
  if (action === 'sendFrame') return sendFrame();
  setTool(action);
};


// ✅ Icones pour les boutons
function getFsIcon(tool) {
  const icons = {
    'brush': '🖌', 'eraser': '🧽', 'line': '📏', 'rect': '⬜',
    'circle': '○', 'fill': '🪣', 'addFrame': '＋', 'sendFrame': '↑',
    'undo': '↶', 'clearCanvas': '🗑'
  };
  return icons[tool] || '⚙️';
}

// ✅ Initialise au chargement
updateFsToolbar();

// ✅ Toggle config avec double-tap ESC ou clic long sur ✕
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.fullscreenElement) {
    showFsConfig(true);
  }
});


function applyOrientationToUI() {
  const einkPc = document.getElementById('einkPreview');
  const label  = document.getElementById('einkOrientLabel');
  if (!einkPc) return;

  einkPc.classList.remove('eink-portrait', 'eink-landscape');
  einkPc.style.transform = 'none';
  einkPc.style.transformOrigin = 'center center';
  einkPc.style.display = 'block';

  if (currentCanvasOrientation === 'portrait') {
    einkPc.classList.add('eink-portrait');
    if (label) label.textContent = 'Portrait';
  } else {
    einkPc.classList.add('eink-landscape');
    if (label) label.textContent = 'Paysage';
  }
}


function updateEinkPreview(oledBuf) {
  const pc = document.getElementById('einkPreview');
  if (!pc) return;

  const einkBuf = buildEinkStillBufferFromOledBuf(oledBuf);
  const ctx = pc.getContext('2d', { willReadFrequently: true });

  const W = 176;
  const H = 264;

  // ⚠️ IMPORTANT : on change la taille du canvas selon orientation
  if (currentCanvasOrientation === 'portrait') {
    pc.width = W;
    pc.height = H;
  } else {
    pc.width = H;
    pc.height = W;
  }

  ctx.clearRect(0, 0, pc.width, pc.height);

  // fond
  ctx.fillStyle = '#e8e4d8';
  ctx.fillRect(0, 0, pc.width, pc.height);

  ctx.fillStyle = '#1a1a1a';

  ctx.save();

  // 🎯 ROTATION RÉELLE
  if (currentCanvasOrientation === 'landscape') {
    ctx.translate(pc.width, 0);
    ctx.rotate(Math.PI / 2);
  }

  // dessin dans repère NORMAL (portrait)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const bitIdx  = x + y * W;
      const byteIdx = Math.floor(bitIdx / 8);
      const bitPos  = 7 - (bitIdx % 8);

      if (einkBuf[byteIdx] & (1 << bitPos)) {
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  ctx.restore();

  applyOrientationToUI();
}



// ── Polling capteur (/orientation toutes les 800ms) ────────────────
window.startSensorOrientation = function() {
  sensorOrientationActive = true;

document.getElementById('sensorOrientBtn').classList.add('active');


  document.getElementById('orientSensorBadge').style.display = 'inline';
  document.getElementById('orientPortraitBtn').classList.remove('active');
  document.getElementById('orientLandscapeBtn').classList.remove('active');

  if (sensorPollInterval) clearInterval(sensorPollInterval);
  sensorPollInterval = setInterval(async () => {
    if (!sensorOrientationActive) { clearInterval(sensorPollInterval); return; }
    try {
      const r = await fetch('/orientation', { cache: 'no-store' });
      if (!r.ok) return;
      const data = await r.json();
      const orient = data.landscape ? 'landscape' : 'portrait';
      if (orient !== currentCanvasOrientation) {
        currentCanvasOrientation = orient;
        applyOrientationToUI();
        if (frames[curFrame]) updateEinkPreview(frames[curFrame].buffer);
        setStatus('Orientation capteur : ' + orient);
      }
    } catch(e) {}
  }, 800);
};

window.stopSensorOrientation = function() {
  sensorOrientationActive = false;

document.getElementById('sensorOrientBtn').classList.remove('active');

  document.getElementById('orientSensorBadge').style.display = 'none';
  if (sensorPollInterval) { clearInterval(sensorPollInterval); sensorPollInterval = null; }
};

//Helper de conversion: ecran E-ink
const EINK_WIDTH = 176; //taille
const EINK_HEIGHT = 264;

function oledBufToImageData(buf, w = 128, h = 64) {
  const tmp = document.createElement('canvas');
  tmp.width = w;
  tmp.height = h;
  const tctx = tmp.getContext('2d', { willReadFrequently: true });
  const id = tctx.createImageData(w, h);

  for (let page = 0; page < 8; page++) {
    for (let x = 0; x < 128; x++) {
      const b = buf[page * 128 + x];
      for (let bit = 0; bit < 8; bit++) {
        const y = page * 8 + bit;
        const i = (y * 128 + x) * 4;
        const on = (b >> bit) & 1;
        const v = on ? 0 : 255;
        id.data[i] = v;
        id.data[i + 1] = v;
        id.data[i + 2] = v;
        id.data[i + 3] = 255;
      }
    }
  }
  return id;
}

function buildEinkStillBufferFromOledBuf(buf) {
  const src = document.createElement('canvas');
  src.width = 128;
  src.height = 64;
  const sctx = src.getContext('2d', { willReadFrequently: true });
  sctx.putImageData(oledBufToImageData(buf), 0, 0);

  const dst = document.createElement('canvas');
  dst.width = EINK_WIDTH;
  dst.height = EINK_HEIGHT;
  const dctx = dst.getContext('2d', { willReadFrequently: true });
  dctx.imageSmoothingEnabled = false;
  dctx.fillStyle = '#fff';
  dctx.fillRect(0, 0, EINK_WIDTH, EINK_HEIGHT);

  const HEADER_H = 16;
  const FOOTER_H = 22;
  const availW = EINK_WIDTH;
  const availH = EINK_HEIGHT - HEADER_H - FOOTER_H;

  dctx.save();

  if (currentCanvasOrientation === 'portrait') {
    const rotatedW = 64;
    const rotatedH = 128;
    const scale = Math.min(availW / rotatedW, availH / rotatedH);
    const w = Math.round(rotatedW * scale);
    const h = Math.round(rotatedH * scale);
    const cx = EINK_WIDTH / 2;
    const cy = HEADER_H + availH / 2;

    dctx.translate(cx, cy);
    dctx.rotate(-Math.PI / 2);
    dctx.drawImage(src, -128 * scale / 2, -64 * scale / 2, 128 * scale, 64 * scale);
  } else {
    const rotatedW = 264;
    const rotatedH = 176 - HEADER_H - FOOTER_H;
    const scale = Math.min(rotatedW / 128, rotatedH / 64);
    const cx = EINK_WIDTH / 2;
    const cy = EINK_HEIGHT / 2;

    dctx.translate(cx, cy);
    dctx.rotate(Math.PI / 2);
    dctx.drawImage(src, -(128 * scale) / 2, -(64 * scale) / 2, 128 * scale, 64 * scale);
  }

  dctx.restore();

  const id = dctx.getImageData(0, 0, EINK_WIDTH, EINK_HEIGHT);
  const out = new Uint8Array((EINK_WIDTH * EINK_HEIGHT) / 8);
  for (let y = 0; y < EINK_HEIGHT; y++) {
    for (let x = 0; x < EINK_WIDTH; x++) {
      const i = (y * EINK_WIDTH + x) * 4;
      const lum = (id.data[i] + id.data[i + 1] + id.data[i + 2]) / 3;
      if (lum < 128) {
        const bi = x + y * EINK_WIDTH;
        out[(bi / 8) | 0] |= (0x80 >> (bi % 8));
      }
    }
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════
//  PROFIL ARTISTE — localStorage
// ═══════════════════════════════════════════════════════════════════
const PROFILE_KEY = 'oled_artist_profile';

function loadProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch(e) { return null; }
}

function saveProfileToStorage(profile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

function getProfile() {
  return loadProfile() || { artistName: '', ethAddress: '', forSale: false };
}


function makeClientUid({ type = 'still', mode = 'still', artist = 'anonyme', name = 'sans-titre', timestamp = '' }) {
  const stamp = String(timestamp || new Date().toLocaleString('fr-FR'))
    .replace(/[/:\s]+/g, '-')
    .replace(/-+/g, '-');
  const a = String(artist || 'anonyme').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const n = String(name || 'sans-titre').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `${stamp}-${type}-${mode}-${a}-${n}`.replace(/-+/g, '-');
}



// ═══════════════════════════════════════════════════════════════
//  REMPLACER l'ancienne fonction notifyRescoeDiscord dans le HTML
//  de l'ESP par celle-ci.
//
//  CHANGEMENT CLÉ : on poste DIRECTEMENT à rescoe.xyz (Vercel)
//  sans passer par /notify-discord (ESP relay).
//  L'ESP relay était le goulot d'étranglement RAM pour les GIFs.
//
//  Pour les profils et stills (petits payloads) on garde le relay
//  ESP comme fallback si Vercel n'est pas accessible directement.
// ═══════════════════════════════════════════════════════════════

// URL directe vers Vercel (pas via ESP)
const RESCOE_DISCORD_URL = 'https://www.rescoe.xyz/api/esp/sync-to-discord';
const RESCOE_SYNC_SECRET = 'IlajouteausslesfonctionsJSinjecterdanslecodEDpournotifierRESCOEaprsublicationeffectivesurlcran';

async function notifyRescoeDiscord(payload) {
  try {
    if (!payload || typeof payload !== 'object') payload = {};

    // Compacter oledBuffer simple → oledBufferCompact (string hex)
    if (Array.isArray(payload.oledBuffer) && payload.oledBuffer.length === 1024) {
      // Envoyer comme string hex compacte : "00ff3a..." (2048 chars)
      payload.oledBufferCompact = payload.oledBuffer
        .map(b => (b & 0xFF).toString(16).padStart(2, '0'))
        .join('');
      delete payload.oledBuffer;
    }

    // Compacter les frames → framesCompact [{buf:"2048hex", delay:N}]
    if (Array.isArray(payload.frames) && payload.frames.length > 0) {
      payload.framesCompact = payload.frames.map(fr => ({
        buf: Array.from(fr.buffer, b => (b & 0xFF).toString(16).padStart(2, '0')).join(''),
        delay: fr.delay || 100
      }));
      delete payload.frames;
    }

    // Ajouter le secret
    payload.secret = RESCOE_SYNC_SECRET;

    const body = JSON.stringify(payload);

    console.log('[Discord] size:', body.length, 'bytes');
    console.log('[Discord] type:', payload.type, 'mode:', payload.mode);
    console.log('[Discord] framesCompact:', Array.isArray(payload.framesCompact) ? payload.framesCompact.length + ' frames' : 'none');

    // ── Poster DIRECTEMENT à Vercel (pas via ESP relay) ──────────
    // Retry x3 avec délai croissant
    const MAX_RETRIES = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 1) {
          const wait = attempt * 1500;
          console.log(`[Discord] retry ${attempt}/${MAX_RETRIES} in ${wait}ms...`);
          await new Promise(r => setTimeout(r, wait));
        }

        const controller = new AbortController();
        const timeoutId  = setTimeout(() => controller.abort(), 30000); // 30s

        const r = await fetch(RESCOE_DISCORD_URL, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          signal:  controller.signal,
        });

        clearTimeout(timeoutId);
        const txt = await r.text().catch(() => '');

        console.log('[Discord] response:', r.status, txt.slice(0, 100));

        if (!r.ok) {
          lastError = `HTTP ${r.status}: ${txt.slice(0, 80)}`;
          continue;
        }

        setStatus('Discord ✓');
        return true;

      } catch (err) {
        lastError = err?.message || String(err);
        console.warn(`[Discord] attempt ${attempt} failed:`, lastError);
      }
    }

    setStatus('Discord KO: ' + lastError);
    return false;

  } catch (e) {
    console.warn('[Discord] fatal:', e);
    setStatus('Discord erreur: ' + (e?.message || e));
    return false;
  }
};

window.resetProfile = () => {
  localStorage.removeItem(PROFILE_KEY);
  document.getElementById('profileArtistName').value = '';
  document.getElementById('profileEthAddress').value = '';
  document.getElementById('profileForSale').checked = false;
  document.getElementById('ethFieldWrap').classList.remove('visible');
  document.getElementById('profileStatus').style.display = 'none';
  setStatus('Profil réinitialisé');
};

window.toggleEthField = () => {
  const checked = document.getElementById('profileForSale').checked;
  document.getElementById('ethFieldWrap').classList.toggle('visible', checked);
};

window.toggleFirstRunEth = () => {
  const checked = document.getElementById('firstRunForSale').checked;
  document.getElementById('firstRunEthWrap').classList.toggle('visible', checked);
};

window.confirmFirstRun = () => {
  const name = document.getElementById('firstRunName').value.trim();
  if (!name) {
    document.getElementById('firstRunName').focus(); return;
  }
  const eth  = document.getElementById('firstRunEth').value.trim();
  const sale = document.getElementById('firstRunForSale').checked;

  if (sale && eth && !/^0x[0-9a-fA-F]{40}$/.test(eth)) {
    setStatus('Adresse ETH invalide'); return;
  }

  const profile = { artistName: name, ethAddress: sale ? eth : '', forSale: sale };
  saveProfileToStorage(profile);
  applyProfileToUI(profile);
  document.getElementById('firstRunModal').classList.remove('active');
  setStatus('Bienvenue ' + name + ' !');
};

function applyProfileToUI(profile) {
  if (!profile) return;
  // Header
  document.getElementById('artistDisplay').textContent = profile.artistName || '—';
  // Pré-remplir le tab profil
  document.getElementById('profileArtistName').value = profile.artistName || '';
  document.getElementById('profileEthAddress').value = profile.ethAddress || '';
  document.getElementById('profileForSale').checked  = profile.forSale || false;
  if (profile.forSale) {
    document.getElementById('ethFieldWrap').classList.add('visible');
  }
  // window._lastName reste utilisé pour le nom de l'œuvre (pré-rempli avec artistName par défaut)
  if (!window._lastName && profile.artistName) {
    window._lastName = profile.artistName;
  }
}

function checkFirstRun() {
  const profile = loadProfile();
  if (!profile || !profile.artistName) {
    document.getElementById('firstRunModal').classList.add('active');
    setTimeout(() => document.getElementById('firstRunName').focus(), 100);
  } else {
    applyProfileToUI(profile);
  }
}


window.saveProfile = async function () {
  const oldProfile = loadProfile() || { artistName: '', ethAddress: '', forSale: false };
  const oldName = (oldProfile.artistName || '').trim();

  const name = document.getElementById('profileArtistName').value.trim();
  const eth = document.getElementById('profileEthAddress').value.trim();
  const sale = document.getElementById('profileForSale').checked;

  if (!name) {
    setStatus('Nom artiste requis');
    return;
  }

  if (sale && !/^0x[0-9a-fA-F]{40}$/.test(eth)) {
    setStatus('Adresse ETH invalide format 0x...');
    return;
  }

  const profile = {
    artistName: name,
    ethAddress: sale ? eth : '',
    forSale: sale
  };

  saveProfileToStorage(profile);
  applyProfileToUI(profile);

  const badge = document.getElementById('profileStatus');
  badge.style.display = 'block';
  badge.innerHTML =
    `Profil sauvegardé • Artiste <span>${name}</span>` +
    (sale && eth ? ` • ETH <span>${eth.substring(0, 8)}…</span>` : '');

  setStatus('Profil sauvegardé');

  try {
    const previous = oldName || 'Anonyme';
    const changed = oldName && oldName !== name;

    const payload = {
      uid: makeClientUid('profile', 'rename', name, 'profile-update', new Date().toLocaleString('fr-FR')),
      type: 'profile',
      mode: changed ? 'rename' : 'save',
      name: 'profile-update',
      artist: name,
      timestamp: new Date().toLocaleString('fr-FR'),
      forSale: false,
      ethAddress: '',
      text: changed
        ? `${previous} a changé de nom et s'appelle désormais ${name}`
        : `${name} a sauvegardé son profil artiste`
    };

    console.log('[PROFILE] notify payload:', payload);

    const ok = await notifyRescoeDiscord(payload);

    if (ok) {
      setStatus(changed
        ? `Profil sauvegardé + annonce Discord: ${previous} → ${name}`
        : 'Profil sauvegardé + annonce Discord');
    } else {
      setStatus('Profil sauvegardé, mais annonce Discord KO');
    }
  } catch (e) {
    console.error('saveProfile notify error', e);
    setStatus('Profil sauvegardé, mais erreur annonce Discord');
  }
};


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
  frames[curFrame].buffer = imgDataToBuf(ctx.getImageData(0, 0, 128, 64));
  if (!silent) setStatus('Frame ' + (curFrame + 1) + ' sauvée');
  updateOledPreview(frames[curFrame].buffer); // ← ajout
  updateEinkPreview(frames[curFrame].buffer);
}

function loadFrame() {
  if (!frames[curFrame]) return;
  bufToCanvas(frames[curFrame].buffer);
  clearOverlay(); saveHistory(); updateFrameUi();
  updateOledPreview(frames[curFrame].buffer); // ← ajout
  updateEinkPreview(frames[curFrame].buffer);
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
    const isCur = i === curFrame;
    const isSel = frameSelection.has(i);
    Object.assign(c.style, {
      width:'64px', height:'32px', background:'#fff',
      border: isCur ? '2px solid var(--accent)' : (isSel ? '2px solid var(--orange)' : '1px solid #333'),
      borderRadius: '5px',
      boxShadow: isSel ? '0 0 0 2px rgba(255,165,0,.2)' : 'none'
    });
    c.title = 'Frame ' + (i+1) + ' (' + f.delay + 'ms)';
    c.dataset.index = i;
    const fc = c.getContext('2d');
    const img = fc.createImageData(64, 32);
    for (let py=0; py<32; py++) for (let px=0; px<64; px++) {
      const bi = Math.floor(py*2/8)*128 + px*2, bit = (py*2)%8;
      const v = (f.buffer[bi] & (1<<bit)) ? 0 : 255;
      const ii = (py*64+px)*4;
      img.data[ii]=img.data[ii+1]=img.data[ii+2]=v; img.data[ii+3]=255;
    }
    fc.putImageData(img, 0, 0);
    c.addEventListener('click', (ev) => {
      if(window.frameSelectionMode){
        if(frameSelection.has(i)) frameSelection.delete(i); else frameSelection.add(i);
        renderStrip();
        updateFrameMultiInfo();
        return;
      }
      saveToFrame(true); curFrame=i; loadFrame(); renderStrip();
    });
    strip.appendChild(c);
  });
}

window.prevFrame = () => { saveToFrame(true); curFrame=(curFrame-1+frames.length)%frames.length; loadFrame(); renderStrip(); };
window.nextFrame = () => { saveToFrame(true); curFrame=(curFrame+1)%frames.length; loadFrame(); renderStrip(); };
window.addFrame  = () => { saveToFrame(true); frames.splice(curFrame+1,0,makeFrame(frames[curFrame]?.delay||200)); curFrame++; loadFrame(); renderStrip(); setStatus('Frame '+(curFrame+1)+' ajoutée'); };
window.setDelay = v => {
  if (!frames[curFrame]) return;
  const applyAll = document.getElementById('delayAllFrames').checked;
  if (applyAll) {
    frames.forEach(f => f.delay = parseInt(v));
  } else {
    frames[curFrame].delay = parseInt(v);
  }
  document.getElementById('delayVal').textContent = v + 'ms';
  renderStrip();
};
// ═══════════════════════════════════════════════════════════════════
//  PLAYBACK — requestAnimationFrame (survives tab switch)
// ═══════════════════════════════════════════════════════════════════
let playRafId=null, playLastT=0, isPlaying=false;

function playLoop(ts) {
  if (!isPlaying) return;
  const hdr = document.querySelector('header');
  if(hdr){ hdr.style.display='flex'; hdr.style.visibility='visible'; hdr.style.opacity='1'; }
  const badge = document.getElementById('userBadge');
  if(badge){ badge.style.display='flex'; badge.style.visibility='visible'; badge.style.opacity='1'; }
  if (ts - playLastT >= (frames[curFrame].delay||100)) {
    playLastT = ts;
    curFrame = (curFrame+1)%frames.length;
    bufToCanvas(frames[curFrame].buffer);
    clearOverlay();
    const stripCanvases = document.getElementById('framesStrip').querySelectorAll('canvas');
    stripCanvases.forEach((c, i) => {
      c.style.border = i === curFrame ? '2px solid var(--accent)' : (frameSelection.has(i) ? '2px solid var(--orange)' : '1px solid #333');
      c.style.boxShadow = frameSelection.has(i) ? '0 0 0 2px rgba(255,165,0,.2)' : 'none';
    });
    document.getElementById('frameInfo').textContent = 'Frame ' + (curFrame + 1) + '/' + frames.length;
    const f = frames[curFrame];
    if (f) {
      document.getElementById('delaySlider').value = f.delay;
      document.getElementById('delayVal').textContent = f.delay + 'ms';
    }
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


// ═══════════════════════════════════════════════════════════════════
//  MINI-PREVIEW OLED
// ═══════════════════════════════════════════════════════════════════
let oledPreviewColor = 'blue'; // 'blue' | 'white'


function updateOledPreview(buf) {
  const pc = document.getElementById('oledPreview');
  if (!pc) return;
  const isPortrait = currentCanvasOrientation === 'portrait';

  if (isPortrait) {
    pc.width = 64; pc.height = 128;
    pc.style.aspectRatio = '1/2';
    pc.style.width = 'auto';
    pc.style.height = '100%';
    pc.style.maxHeight = '128px';
  } else {
    pc.width = 128; pc.height = 64;
    pc.style.aspectRatio = '2/1';
    pc.style.width = '100%';
    pc.style.height = 'auto';
    pc.style.maxHeight = '';
  }

  const pctx = pc.getContext('2d', { willReadFrequently: true });
  const id = pctx.createImageData(pc.width, pc.height);

  for (let page = 0; page < 8; page++) {
    for (let x = 0; x < 128; x++) {
      const b = buf[page * 128 + x];
      for (let bit = 0; bit < 8; bit++) {
        const sy = page * 8 + bit;
        const sx = x;
        let dx, dy;

        if (isPortrait) {
          // Rotation CW : (sx, sy) → (63-sy, sx) dans espace 64×128
          dx = 63 - sy;  // [0..63]
          dy = sx;       // [0..127]
        } else {
          dx = sx; dy = sy;
        }

        if (dx < 0 || dx >= pc.width || dy < 0 || dy >= pc.height) continue;
        const i = (dy * pc.width + dx) * 4;
        const on = (b >> bit) & 1;
        id.data[i+3] = 255;
        if (on) {
          if (oledPreviewColor === 'blue') {
            id.data[i] = 0x44; id.data[i+1] = 0xaa; id.data[i+2] = 0xff;
          } else {
            id.data[i] = id.data[i+1] = id.data[i+2] = 255;
          }
        }
      }
    }
  }
  pctx.putImageData(id, 0, 0);
}



window.toggleOledPreviewColor = () => {
  oledPreviewColor = oledPreviewColor === 'blue' ? 'white' : 'blue';
  document.getElementById('oledColorBtn').textContent =
    oledPreviewColor === 'blue' ? '🔵 Bleu' : '⚪ Blanc';
  // Re-render avec le frame courant
  if (frames[curFrame]) updateOledPreview(frames[curFrame].buffer);
};


// ─── TOGGLE OLED ANIM (version fusionnée) ───────────────────────────────────




window.toggleOledAnim = async () => {
  const btn = document.getElementById('animBtn');

  if (btn.dataset.running === '1') {
    btn.dataset.running = '0';
    btn.textContent = '📺 Anim→OLED';
    await fetch('/frames/stop', { method: 'POST' }).catch(() => {});
    setStatus('Animation OLED stoppée');
    return;
  }

  saveToFrame(true);

  if (frames.length === 1) {
    resetSendContext();
    sendContext.mode = 'still';
    sendContext.source = 'artwork';
    window.sendFrame();
    return;
  }

  const profile = getProfile();
  resetSendContext();
  sendContext.mode = 'anim';
  sendContext.source = 'artwork';

  pendingBuf = null;
  document.getElementById('usernameInput').value = getLastArtworkName(profile);

  const badge = document.getElementById('modalArtistBadge');
  const artistSpan = document.getElementById('modalArtistDisplay');
  if (profile.artistName) {
    artistSpan.textContent = profile.artistName;
    badge.style.display = 'block';
  } else {
    badge.style.display = 'none';
  }

  const forSaleRow = document.getElementById('forSaleRow');
  if (profile.forSale && profile.ethAddress) {
    forSaleRow.style.display = 'flex';
    document.getElementById('modalForSale').checked = false;
  } else {
    forSaleRow.style.display = 'none';
  }

  document.getElementById('userModal').classList.add('active');
  setTimeout(() => {
    const inp = document.getElementById('usernameInput');
    if (inp) { inp.focus(); inp.select(); }
  }, 60);
};

// ═══════════════════════════════════════════════════════════════════
//  USERNAME — popup à chaque envoi
// ═══════════════════════════════════════════════════════════════════


let pendingBuf = null;


const sendContext = {
  mode: 'still',          // 'still' | 'anim'
  source: 'artwork',      // 'artwork' | 'poetry'
  scroll: false,          // true si poésie scroll
  poetryText: '',
  poetryBuffer: null,     // Uint8Array(1024) pour poésie fixe
  poetryFrames: null      // [{buffer,delay}] pour poésie scroll
};

function resetSendContext() {
  sendContext.mode = 'still';
  sendContext.source = 'artwork';
  sendContext.scroll = false;
  sendContext.poetryText = '';
  sendContext.poetryBuffer = null;
  sendContext.poetryFrames = null;
}

function getLastArtworkName(profile) {
  return window._lastName || profile?.artistName || '';
}


async function sendCurrentFrameToOled(saveToGallery = false) {
  saveToFrame(true);
  const buf = frames[curFrame].buffer;
  const url = saveToGallery ? "/draw" : "/draw?save=0";
  await fetch(url, {
    method: "POST",
    body: buf
  });
}

// "Frame→OLED" always opens the username popup first
window.sendFrame = () => {
  saveToFrame(true);
  pendingBuf = new Uint8Array(frames[curFrame].buffer);

  const profile = getProfile();
  resetSendContext();
  sendContext.mode = 'still';
  sendContext.source = 'artwork';

  document.getElementById('usernameInput').value = getLastArtworkName(profile);

  const badge = document.getElementById('modalArtistBadge');
  const artistSpan = document.getElementById('modalArtistDisplay');
  if (profile.artistName) {
    artistSpan.textContent = profile.artistName;
    badge.style.display = 'block';
  } else {
    badge.style.display = 'none';
  }

  const forSaleRow = document.getElementById('forSaleRow');
  if (profile.forSale && profile.ethAddress) {
    forSaleRow.style.display = 'flex';
    document.getElementById('modalForSale').checked = false;
  } else {
    forSaleRow.style.display = 'none';
  }

  document.getElementById('userModal').classList.add('active');
  setTimeout(() => {
    const inp = document.getElementById('usernameInput');
    if (inp) { inp.focus(); inp.select(); }
  }, 60);
};

async function savePoetryStillToGallery({ name, text, buf, profile }) {
  const payload = {
    type: 'poetry',
    artworkName: name,
    artistName: (profile.artistName || 'Anonyme').trim(),
    createdAt: new Date().toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }),
    text,
    oledBuffer: Array.from(buf)
  };

  const r = await fetch('poetry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!r.ok) throw new Error('HTTP ' + r.status);
}

async function savePoetryScrollToGallery({ name, text, frameList, profile }) {
  const firstFrame =
    Array.isArray(frameList) &&
    frameList.length &&
    frameList[0] &&
    frameList[0].buffer &&
    frameList[0].buffer.length === 1024
      ? frameList[0].buffer
      : null;

  if (!firstFrame) throw new Error('Aucune frame scroll valide');

  const payload = {
    type: 'poetry',
    mode: 'scroll',
    artworkName: name,
    artistName: (profile.artistName || 'Anonyme').trim(),
    createdAt: new Date().toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }),
    text,
    oledBuffer: Array.from(firstFrame)
  };

  const r = await fetch('/poetry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!r.ok) throw new Error('HTTP ' + r.status);
}

window.confirmSend = async () => {
  const name = document.getElementById('usernameInput').value.trim();
  if (!name) {
    document.getElementById('usernameInput').focus();
    return;
  }

  const profile = getProfile();
  window._lastName = name;
  document.getElementById('userDisplay').textContent = name;
  document.getElementById('userModal').classList.remove('active');

  try {
    // ─────────────────────────────
    // POÉSIE SCROLL
    // ─────────────────────────────
    if (sendContext.source === 'poetry' && sendContext.mode === 'anim') {
      const btn = document.getElementById('animBtn');
      if (btn) {
        btn.dataset.running = '1';
        btn.textContent = '⏸ Stop OLED';
      }

      setStatus(`Upload scroll poésie (${frames.length} frames)…`);

      const ts = encodeURIComponent(
        new Date().toLocaleString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      );

      const artistName = profile.artistName || 'Anonyme';

      await fetch(`/username?n=${encodeURIComponent(name)}&ts=${ts}&a=${encodeURIComponent(artistName)}`, {
        cache: 'no-store'
      });

      await new Promise(r => setTimeout(r, 300));

      const blob = new Uint8Array(frames.length * 1026);

      frames.forEach((f, i) => {
        const d = f.delay & 0xffff;
        blob[i * 1026 + 0] = d & 0xff;
        blob[i * 1026 + 1] = (d >> 8) & 0xff;
        blob.set(f.buffer, i * 1026 + 2);
      });

      const r = await fetch('/frames?save=0', { method: 'POST', body: blob });
      if (!r.ok) throw new Error('HTTP ' + r.status);

      await new Promise(resolve => setTimeout(resolve, 1500));

      await savePoetryScrollToGallery({
        name,
        text: sendContext.poetryText,
        frameList: sendContext.poetryFrames || frames,
        profile
      });

      const timestamp = new Date().toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const firstFrame =
        (sendContext.poetryFrames && sendContext.poetryFrames[0]) ||
        (frames && frames[0]) ||
        null;

      await notifyRescoeDiscord({
        uid: makeClientUid({
          type: 'poetry',
          mode: 'scroll',
          artist: artistName,
          name,
          timestamp
        }),
        type: 'poetry',
        mode: 'scroll',
        name,
        artist: artistName,
        timestamp,
        forSale: false,
        ethAddress: '',
        text: sendContext.poetryText || '',
        oledBufferCompact: firstFrame
          ? Array.from(firstFrame.buffer, b => (b & 0xff).toString(16).padStart(2, '0'))
          : []
      });

      setStatus('Scroll poésie envoyé sur OLED et classé en poésies');
      resetSendContext();
      return;
    }

    // ─────────────────────────────
    // POÉSIE FIXE
    // ─────────────────────────────
    if (sendContext.source === 'poetry' && sendContext.mode === 'still') {
      const buf = sendContext.poetryBuffer || pendingBuf;

      if (!buf || buf.length !== 1024) {
        setStatus('Buffer poésie invalide');
        return;
      }

      const artistName = profile.artistName || 'Anonyme';

      const timestamp = new Date().toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      await fetch(`/username?n=${encodeURIComponent(name)}&ts=${encodeURIComponent(timestamp)}&a=${encodeURIComponent(artistName)}`, {
        cache: 'no-store'
      });

      await new Promise(r => setTimeout(r, 300));

      await resetOledForStillImage();

      const r = await fetch('/draw?save=0', {
        method: 'POST',
        body: buf
      });

      if (!r.ok) throw new Error('HTTP ' + r.status);

      await new Promise(r => setTimeout(r, 800));

      await savePoetryStillToGallery({
        name,
        text: sendContext.poetryText,
        buf,
        profile
      });

      await notifyRescoeDiscord({
        uid: makeClientUid({
          type: 'poetry',
          mode: 'still',
          artist: artistName,
          name,
          timestamp
        }),
        type: 'poetry',
        mode: 'still',
        name,
        artist: artistName,
        timestamp,
        forSale: false,
        ethAddress: '',
        text: sendContext.poetryText || '',
        oledBufferCompact: Array.from(buf, b => (b & 0xff).toString(16).padStart(2, '0'))
      });

      pendingBuf = null;
      setStatus('Poésie envoyée sur OLED et classée en poésies');
      resetSendContext();
      return;
    }

    // ─────────────────────────────
    // ŒUVRE ANIMÉE
    // ─────────────────────────────
    if (sendContext.source === 'artwork' && sendContext.mode === 'anim') {
      const btn = document.getElementById('animBtn');
      btn.dataset.running = '1';
      btn.textContent = '⏸ Stop OLED';

      setStatus(`Upload animation (${frames.length} frames)…`);

      const ts = encodeURIComponent(
        new Date().toLocaleString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      );

      await fetch(`/username?n=${encodeURIComponent(name)}&ts=${ts}`);
      await new Promise(r => setTimeout(r, 300));

      const blob = new Uint8Array(frames.length * 1026);

      frames.forEach((f, i) => {
        const d = f.delay & 0xffff;
        blob[i * 1026 + 0] = d & 0xff;
        blob[i * 1026 + 1] = (d >> 8) & 0xff;
        blob.set(f.buffer, i * 1026 + 2);
      });

      const r = await fetch('/frames', { method: 'POST', body: blob });

      const modalForSale = document.getElementById('modalForSale');
      const isForSale = !!(profile.forSale && profile.ethAddress && modalForSale?.checked);

      const timestamp = new Date().toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      await notifyRescoeDiscord({
        uid: makeClientUid({
          type: 'gif',
          mode: 'anim',
          artist: profile.artistName || 'Anonyme',
          name,
          timestamp
        }),
        type: 'gif',
        mode: 'anim',
        name,
        artist: profile.artistName || 'Anonyme',
        timestamp,
        forSale: isForSale,
        ethAddress: isForSale ? profile.ethAddress : '',
        frames: frames.map(fr => ({
          buffer: Array.from(fr.buffer),
          delay: fr.delay
        }))
      });

      if (!r.ok) throw new Error('HTTP ' + r.status);

      setStatus(`Animation autonome: ${frames.length} frames ✓ (${name})`);
      resetSendContext();
      return;
    }

    // ─────────────────────────────
    // ŒUVRE FIXE
    // ─────────────────────────────
    if (!pendingBuf || pendingBuf.length !== 1024) {
      setStatus('Aucun buffer à envoyer');
      return;
    }

    const artistName = profile.artistName || name;

    const timestamp = new Date().toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const modalForSale = document.getElementById('modalForSale');
    const isForSale = !!(profile.forSale && profile.ethAddress && modalForSale?.checked);

    const sendToOled = stillDisplayTarget === 0 || stillDisplayTarget === 2;
    const sendToEink = stillDisplayTarget === 1 || stillDisplayTarget === 2;

    setStatus(
      `Envoi ${name}` +
        (sendToOled && sendToEink
          ? ' → OLED + E-INK'
          : sendToOled
          ? ' → OLED'
          : ' → E-INK') +
        '…'
    );

    // OLED
    if (sendToOled) {
      let usernameUrl = `username?n=${encodeURIComponent(name)}&ts=${encodeURIComponent(timestamp)}&a=${encodeURIComponent(artistName)}`;

      if (isForSale && profile.ethAddress) {
        usernameUrl += `&eth=${encodeURIComponent(profile.ethAddress)}`;
      }

      const userRes = await fetch(usernameUrl, { cache: 'no-store' });
      if (!userRes.ok) throw new Error('username HTTP ' + userRes.status);

      await new Promise(r => setTimeout(r, 300));

      await resetOledForStillImage();

      const drawRes = await fetch('/draw', {
        method: 'POST',
        body: pendingBuf
      });

      if (!drawRes.ok) throw new Error('draw HTTP ' + drawRes.status);
    }

    // E-INK
    if (sendToEink) {
      const einkBuf = buildEinkStillBufferFromOledBuf(pendingBuf);

// Rotation logique si paysage : le buffer e-ink est déjà orienté par buildEinkStillBufferFromOledBuf
// Transmettre l'orientation à l'ESP pour qu'il sache comment afficher
await fetch(`/eink-username?n=${encodeURIComponent(name)}&ts=${encodeURIComponent(timestamp)}&a=${encodeURIComponent(artistName)}&orient=${encodeURIComponent(currentCanvasOrientation)}`, { cache: 'no-store' }).catch(()=>{});

      if (!einkBuf || einkBuf.length !== 264 * 176 / 8) {
        throw new Error('buildEinkBuffer: taille invalide ' + einkBuf?.length);
      }

      let einkUserUrl = `/eink-username?n=${encodeURIComponent(name)}&ts=${encodeURIComponent(timestamp)}&a=${encodeURIComponent(artistName)}`;

      if (isForSale && profile.ethAddress) {
        einkUserUrl += `&eth=${encodeURIComponent(profile.ethAddress)}`;
      }

      const einkUserRes = await fetch(einkUserUrl, { cache: 'no-store' });
      if (!einkUserRes.ok) throw new Error('eink-username HTTP ' + einkUserRes.status);

      await new Promise(r => setTimeout(r, 200));

      setStatus('E-INK : envoi 5808 octets…');

      const einkDrawRes = await fetch('/eink-draw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: einkBuf
      });

      if (!einkDrawRes.ok) throw new Error('eink-draw HTTP ' + einkDrawRes.status);
    }

    // Discord
    await notifyRescoeDiscord({
      uid: makeClientUid({
        type: 'still',
        mode: 'still',
        artist: artistName,
        name,
        timestamp
      }),
      type: 'still',
      mode: 'still',
      name,
      artist: artistName,
      timestamp,
      forSale: isForSale,
      ethAddress: isForSale ? profile.ethAddress : '',
      oledBufferCompact: Array.from(pendingBuf, b => (b & 0xff).toString(16).padStart(2, '0'))
    });

    pendingBuf = null;

    setStatus(
      sendToOled && sendToEink
        ? `OLED + E-INK ✓ (${name})`
        : sendToOled
        ? `OLED ✓ (${name})`
        : `E-INK ✓ (${name})`
    );

    resetSendContext();
    return;

    // ⚠️ fallback logique DOIT rester dans le try
    throw new Error('Cible d’affichage inconnue');

  } catch (e) {
    console.error('Erreur confirmSend:', e);
    setStatus('Erreur envoi: ' + e.message);
    pendingBuf = null;
    resetSendContext();
  }
};


window.cancelSend = () => {
  pendingBuf = null;
  resetSendContext();
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
    await fetch("/draw?save=0", { method: "POST", body: new Uint8Array(1024) });
    await new Promise(r => setTimeout(r, 80));
  } catch (e) {}
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


function bufToCanvas(buf, targetCtx = ctx) {
  const img = targetCtx.createImageData(128, 64);
  for (let page = 0; page < 8; page++) {
    for (let x = 0; x < 128; x++) {
      const b = buf[page * 128 + x];
      for (let bit = 0; bit < 8; bit++) {
        const y = page * 8 + bit;
        const i = (y * 128 + x) * 4;
        const v = (b >> bit) & 1 ? 0 : 255;
        img.data[i] = img.data[i+1] = img.data[i+2] = v;
        img.data[i+3] = 255;
      }
    }
  }
  targetCtx.putImageData(img, 0, 0);
  if (targetCtx === ctx && gridMode) drawGrid();
}

function imgDataToBuf(imgData) {
  const d = imgData.data;
  const buf = new Uint8Array(1024);
  for (let page = 0; page < 8; page++) {
    for (let x = 0; x < 128; x++) {
      let b = 0;
      for (let bit = 0; bit < 8; bit++) {
        const y = page * 8 + bit;
        const i = (y * 128 + x) * 4;
        const lum = (d[i] + d[i+1] + d[i+2]) / 3;
        if (lum < 128) b |= (1 << bit);
      }
      buf[page * 128 + x] = b;
    }
  }
  return buf;
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

function getPos(e) {
  const r = canvas.getBoundingClientRect();
  const src = e.touches ? e.touches[0] : e;
  const relX = src.clientX - r.left;
  const relY = src.clientY - r.top;

  if (currentCanvasOrientation === 'portrait') {
    const x = Math.floor((relY / r.height) * 128);
    const y = Math.floor(((r.width - relX) / r.width) * 64);
    return {
      x: Math.max(0, Math.min(127, x)),
      y: Math.max(0, Math.min(63, y))
    };
  }

  return {
    x: Math.max(0, Math.min(127, Math.floor((relX / r.width) * 128))),
    y: Math.max(0, Math.min(63, Math.floor((relY / r.height) * 64)))
  };
}


function snap(v){return snapSize<=1?v:Math.round(v/snapSize)*snapSize;}

function startDraw(e){
  e.preventDefault();
  const p = getPos(e);

if(tool === 'stamp') {
    if(!stampData) { setStatus('Pas de tampon — sélectionnez d\'abord une zone puis → Tampon'); return; }
    saveHistory();
    const sw = stampData.width, sh = stampData.height;
    const d = stampData.data;
    const dx = snap(p.x) - Math.floor(sw/2);
    const dy = snap(p.y) - Math.floor(sh/2);
    for(let py=0; py<sh; py++) {
      for(let px=0; px<sw; px++) {
        const i = (py*sw+px)*4;
        if(d[i+3] === 0) continue;
        const tx = dx+px, ty = dy+py;
        if(tx<0||tx>=128||ty<0||ty>=64) continue;
        const lum = (d[i]*0.299+d[i+1]*0.587+d[i+2]*0.114);
        ctx.fillStyle = lum < 128 ? '#000' : '#fff';
        ctx.fillRect(tx, ty, 1, 1);
      }
    }
    saveToFrame(true);
    renderStrip();
    updateEinkPreview(frames[curFrame].buffer);
    return;
  }

  if(tool === 'fill'){
    bucketFill(snap(p.x), snap(p.y));
    return;
  }

  if(tool === 'move'){
    if(selectionActive && selRect){
      moveMode = true;
      selectionFloating = true;
      selectionBuf = new Uint8Array(frames[curFrame].buffer);
      moveDragStart = {x: p.x, y: p.y};
      drawing = true;
    }
    return;
  }

  if(tool === 'wand'){
    // si clic dans sélection existante => déplacer directement
    if(selectionActive && selRect && p.x >= selRect.x && p.x <= selRect.x+selRect.w && p.y >= selRect.y && p.y <= selRect.y+selRect.h){
      moveMode = true;
      selectionFloating = true;
      selectionBuf = new Uint8Array(frames[curFrame].buffer);
      moveDragStart = {x: p.x, y: p.y};
      setTool('move');
      drawing = true;
      return;
    }
    floodSelect(snap(p.x), snap(p.y));
    return;
  }

  if(tool === 'select'){
    if(selectionActive && selRect && p.x >= selRect.x && p.x <= selRect.x+selRect.w && p.y >= selRect.y && p.y <= selRect.y+selRect.h){
      moveMode = true;
      selectionFloating = true;
      selectionBuf = new Uint8Array(frames[curFrame].buffer);
      moveDragStart = {x: p.x, y: p.y};
      setTool('move');
      drawing = true;
      return;
    }
    cancelSelection();
    drawing = true;
    startX = snap(p.x); startY = snap(p.y);
    selRect = {x: startX, y: startY, w: 0, h: 0};
    drawSelectionOverlay();
    return;
  }

  drawing = true;
  startX = snap(p.x); startY = snap(p.y);
  bufToCanvas(frames[curFrame].buffer);
  shapeSnap = ctx.getImageData(0,0,128,64);
  if(gridMode) drawGrid();

  if(tool === 'brush'){
    saveHistory();
    putPx(p.x, p.y, drawColor);
    saveToFrame(true);
  }
  else if(tool === 'eraser'){
    saveHistory();
    putPx(p.x, p.y, PIXEL_OFF_COLOR);
    saveToFrame(true);
  }
  else if(tool === 'poly'){
    polyPoints.push({x:startX, y:startY});
    previewPolyOnLayer(startX, startY);
  }
}

function moveDraw(e){
  if(!drawing) return;
  e.preventDefault();

  const p = getPos(e), ex = snap(p.x), ey = snap(p.y);

  // ── Outil MOVE : mettre à jour l'offset et redessiner ─────
  if(tool === 'move' && moveMode && moveDragStart){
    moveOffsetX = ex - moveDragStart.x;
    moveOffsetY = ey - moveDragStart.y;
    drawMovePreview();
    return;
  }

  // ── Outil SELECT : mettre à jour le rectangle ─────────────
  if(tool === 'select'){
    selRect = {
      x: Math.min(startX, ex),
      y: Math.min(startY, ey),
      w: Math.abs(ex - startX),
      h: Math.abs(ey - startY)
    };
    drawSelectionOverlay();
    return;
  }

  if(tool === 'brush'){
    putPx(p.x, p.y, drawColor);
    saveToFrame(true);
  }
  else if(tool === 'eraser'){
    putPx(p.x, p.y, PIXEL_OFF_COLOR);
    saveToFrame(true);
  }
  else if(tool === 'poly'){
    previewPolyOnLayer(ex, ey);
  }
  else if(tool === 'brush' || tool === 'eraser' || tool === 'select' || tool === 'move'){
    // déjà géré au-dessus ou pas d'action en moveDraw
  }
  else{
    if(shapeSnap instanceof ImageData){
      ctx.putImageData(shapeSnap, 0, 0);
      if(gridMode) drawGrid();
      previewOnLayer(startX, startY, ex, ey);
    }
  }
}

function endDraw(e) {
  if (!drawing) return;
  e.preventDefault();
  drawing = false;

  // Utiliser getPos() comme startDraw/moveDraw pour la cohérence
  const src = e.changedTouches ? e.changedTouches[0] : e;
  const fakeEvent = { clientX: src.clientX, clientY: src.clientY, touches: null };
  const p = getPos(fakeEvent);
  const ex = snap(p.x);
  const ey = snap(p.y);

  if (tool === 'move' && moveMode) {
    commitMoveSelection();
    drawing = false;
    moveDragStart = null;
    return;
  }

  if (tool === 'select') {
    drawing = false;
    if (selRect && selRect.w > 1 && selRect.h > 1) {
      selectionActive = true;
      selectionBuf = new Uint8Array(frames[curFrame].buffer);
      selectionData = ctx.getImageData(selRect.x, selRect.y, selRect.w, selRect.h);
      drawSelectionOverlay();
      showSelectActions(true);
    } else {
      cancelSelection();
    }
    return;
  }

  if (tool === 'poly') { polyPoints.push({x:ex,y:ey}); previewPolyOnLayer(ex,ey); shapeSnap=null; return; }
  if (tool !== 'brush' && tool !== 'eraser' && tool !== 'select' && tool !== 'move') {
    if (shapeSnap instanceof ImageData) {
      ctx.putImageData(shapeSnap, 0, 0);
      if (gridMode) drawGrid();
      drawShapeFinal(startX, startY, ex, ey);
      saveHistory();
    }
  }
  clearOverlay();
  saveToFrame(true);
  renderStrip();
  shapeSnap = null;
  updateOledPreview(frames[curFrame].buffer);
  updateEinkPreview(frames[curFrame].buffer);
  setStatus();
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

// ═══════════════════════════════════════════════════════════════════
//  OUTILS SÉLECTION & DÉPLACEMENT
// ═══════════════════════════════════════════════════════════════════

// Dessine le cadre de sélection sur le layer canvas
function drawSelectionOverlay(){
  clearOverlay();
  if(!selRect || selRect.w <= 0 || selRect.h <= 0) return;
  lctx.save();
  lctx.strokeStyle = 'rgba(0,229,176,0.9)';
  lctx.fillStyle   = 'rgba(0,229,176,0.08)';
  lctx.lineWidth   = 1;
  lctx.setLineDash([2, 2]);
  lctx.strokeRect(selRect.x, selRect.y, selRect.w, selRect.h);
  lctx.fillRect(selRect.x, selRect.y, selRect.w, selRect.h);
  lctx.setLineDash([]);
  lctx.restore();
  // Si on a une copie en cours de déplacement, l'afficher aussi
  if(moveMode && selectionData){
    const dx = selRect.x + moveOffsetX;
    const dy = selRect.y + moveOffsetY;
    lctx.save();
    lctx.globalAlpha = 0.75;
    // Créer un canvas temporaire pour l'ImageData
    const tmp = document.createElement('canvas');
    tmp.width = selRect.w; tmp.height = selRect.h;
    tmp.getContext('2d').putImageData(selectionData, 0, 0);
    lctx.drawImage(tmp, dx, dy, selRect.w, selRect.h);
    lctx.restore();
    // Dessiner le contour de la copie
    lctx.save();
    lctx.strokeStyle = 'rgba(255,165,0,0.9)';
    lctx.lineWidth = 1;
    lctx.setLineDash([3, 2]);
    lctx.strokeRect(dx, dy, selRect.w, selRect.h);
    lctx.setLineDash([]);
    lctx.restore();
  }
  updateSelectInfo();
}

// Met à jour le texte d'info de l'outil sélection
function updateSelectInfo(){
  const info = document.getElementById('selectToolInfo');
  if(!info) return;
  if(tool === 'select' && !selectionActive){
    info.style.display = 'block';
    info.textContent = '⬚ Tracez un rectangle pour sélectionner une zone.';
  } else if(tool === 'select' && selectionActive){
    info.style.display = 'block';
    info.textContent = `✓ Sélection: ${selRect.w}×${selRect.h} px — Cliquez dedans ou utilisez les boutons ci-dessous.`;
  } else if(tool === 'move'){
    info.style.display = 'block';
    info.textContent = '✥ Faites glisser pour déplacer la copie, puis cliquez "Appliquer".';
  } else {
    info.style.display = 'none';
  }
}

// Affiche/masque les boutons d'action de sélection
function showSelectActions(show){
  const el = document.getElementById('selectActions');
  if(el) el.style.display = show ? 'flex' : 'none';
  updateSelectInfo();
}

// ─── FLOOD SELECT (Baguette magique) ────────────────────────────
// Sélectionne tous les pixels connexes de même couleur à partir d'un point
function floodSelect(px, py){
  const imgData = ctx.getImageData(0, 0, 128, 64);
  const d = imgData.data;
  const W = 128, H = 64;
  const idx = (x, y) => (y * W + x) * 4;
  const inside = (x,y)=> x>=0 && x<W && y>=0 && y<H;
  const i0 = idx(px, py);
  const targetLum = (d[i0]*0.299 + d[i0+1]*0.587 + d[i0+2]*0.114) < 128 ? 0 : 255;
  const isTarget = (x, y) => {
    if(!inside(x,y)) return false;
    const i = idx(x, y);
    const lum = (d[i]*0.299 + d[i+1]*0.587 + d[i+2]*0.114) < 128 ? 0 : 255;
    return lum === targetLum;
  };
  const visited = new Uint8Array(W * H);
  const pixels = [];
  const queue = [{x:px,y:py}];
  visited[py * W + px] = 1;
  let qi = 0;
  while(qi < queue.length){
    const {x,y} = queue[qi++];
    pixels.push({x,y});
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=x+dx, ny=y+dy;
      if(inside(nx,ny) && !visited[ny*W+nx] && isTarget(nx,ny)){
        visited[ny*W+nx] = 1;
        queue.push({x:nx,y:ny});
      }
    }
  }
  if(!pixels.length) return;
  let minX=W,maxX=0,minY=H,maxY=0;
  for(const {x,y} of pixels){ if(x<minX)minX=x; if(x>maxX)maxX=x; if(y<minY)minY=y; if(y>maxY)maxY=y; }
  const bw = maxX-minX+1, bh = maxY-minY+1;
  const masked = new ImageData(bw, bh);
  for(const {x,y} of pixels){
    const si = ((y-minY)*bw + (x-minX))*4;

// targetLum est la couleur SÉLECTIONNÉE (celle sur laquelle on a cliqué)
// On la garde opaque, tout le reste (hors zone flood) est déjà à alpha=0
const v = targetLum === 255 ? 255 : 0;
masked.data[si] = v; masked.data[si+1] = v; masked.data[si+2] = v; masked.data[si+3] = 255;
// Note : les pixels HORS sélection ont déjà alpha=0 car ImageData est initialisé à 0
  }
  cancelSelection();
  selRect = {x:minX,y:minY,w:bw,h:bh};
  selectionData = masked;
  selectionBuf = new Uint8Array(frames[curFrame].buffer);
  selectionActive = true;
  selectionFloating = false;
  moveMode = false;
  drawSelectionOverlay();
  showSelectActions(true);
  setStatus(`Baguette : ${pixels.length} px sélectionnés`);
}


// ─── BUCKET FILL (Remplissage) ────────────────────────────────────
// Remplit la zone connexe de même couleur avec drawColor (flood fill)
function bucketFill(px, py){
  const imgData = ctx.getImageData(0, 0, 128, 64);
  const d = imgData.data;
  const W = 128, H = 64;
  const idx = (x, y) => (y * W + x) * 4;
  const i0 = idx(px, py);
  const targetLum = (d[i0]*0.299 + d[i0+1]*0.587 + d[i0+2]*0.114) < 128 ? 0 : 255;
  const fillCol = drawColor === '#000' ? 0 : 255;
  if(targetLum === fillCol) return; // déjà la bonne couleur, rien à faire
  const isTarget = (x, y) => {
    if(x < 0 || x >= W || y < 0 || y >= H) return false;
    const i = idx(x, y);
    return ((d[i]*0.299 + d[i+1]*0.587 + d[i+2]*0.114) < 128 ? 0 : 255) === targetLum;
  };
  const visited = new Uint8Array(W * H);
  const queue = [{x: px, y: py}];
  visited[py * W + px] = 1;
  while(queue.length){
    const {x, y} = queue.shift();
    const i = idx(x, y);
    d[i] = fillCol; d[i+1] = fillCol; d[i+2] = fillCol; d[i+3] = 255;
    for(const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx = x+dx, ny = y+dy;
      if(!visited[ny*W+nx] && isTarget(nx, ny)){
        visited[ny*W+nx] = 1;
        queue.push({x:nx, y:ny});
      }
    }
  }
  ctx.putImageData(imgData, 0, 0);
  saveHistory();
  saveToFrame(true);
  renderStrip();
  updateOledPreview(frames[curFrame].buffer);
  setStatus('Remplissage appliqué');
}

// Annule la sélection courante
window.cancelSelection = function(){
  selectionActive = false;
  selRect = null;
  selectionData = null;
  selectionBuf = null;
  moveMode = false;
  selectionFloating = false;
  moveOffsetX = 0; moveOffsetY = 0;
  moveDragStart = null;
  clearOverlay();
  showSelectActions(false);
  const info = document.getElementById('selectToolInfo');
  if(info && !['select','move','wand','fill'].includes(tool)) info.style.display = 'none';
};

// REMPLACER maskWhitePixels par ceci :
function maskBackgroundPixels(imgData) {
  const d = new Uint8ClampedArray(imgData.data);
  // Le "fond" à rendre transparent est l'opposé de drawColor
  // drawColor === '#000' (NOIR) → fond = blanc (lum >= 128) → transparent
  // drawColor === '#fff' (BLANC) → fond = noir (lum < 128) → transparent
  const maskLight = (drawColor === PIXEL_ON_COLOR); // PIXEL_ON_COLOR = '#000'
  for (let i = 0; i < d.length; i += 4) {
    const lum = d[i] * 0.299 + d[i+1] * 0.587 + d[i+2] * 0.114;
    const isLight = lum >= 128;
    if (maskLight ? isLight : !isLight) {
      // C'est le fond → transparent
      d[i] = 0; d[i+1] = 0; d[i+2] = 0; d[i+3] = 0;
    } else {
      // C'est le dessin → opaque, couleur active
      const v = maskLight ? 0 : 255;
      d[i] = v; d[i+1] = v; d[i+2] = v; d[i+3] = 255;
    }
  }
  return new ImageData(d, imgData.width, imgData.height);
}

// Dupliquer la sélection et passer en mode move
window.duplicateSelection = function(){
  if(!selectionActive || !selRect || selRect.w < 1 || selRect.h < 1) return;
  // Capturer l'ImageData brute de la zone, puis masquer le blanc
  const raw = ctx.getImageData(selRect.x, selRect.y, selRect.w, selRect.h);
  selectionData = maskBackgroundPixels(raw);
  selectionBuf  = new Uint8Array(frames[curFrame].buffer);
  moveMode = true;
  moveOffsetX = 4; moveOffsetY = 4;
  setTool('move');
  drawSelectionOverlay();
  showSelectActions(true);
  updateSelectInfo();
  setStatus('Glissez pour placer la copie, puis ✓ Appliquer');
};

// Aperçu du déplacement sur le layer canvas
function drawMovePreview(){
  bufToCanvas(selectionBuf || frames[curFrame].buffer);
  if(gridMode) drawGrid();
  clearOverlay();
  if(!(selectionData instanceof ImageData) || !selRect) return;

  const dx = selRect.x + moveOffsetX;
  const dy = selRect.y + moveOffsetY;

  const tmp = document.createElement('canvas');
  tmp.width = selectionData.width;
  tmp.height = selectionData.height;
  tmp.getContext('2d').putImageData(selectionData, 0, 0);

  // PREVIEW sur le layer overlay, pas sur le canvas principal
  lctx.drawImage(tmp, dx, dy);

  lctx.save();
  lctx.strokeStyle = 'rgba(255,165,0,0.9)';
  lctx.lineWidth = 1;
  lctx.setLineDash([3,2]);
  lctx.strokeRect(dx, dy, selRect.w, selRect.h);
  lctx.setLineDash([]);
  lctx.restore();
}

// Valider le déplacement → écrire sur le canvas
// Valider le déplacement → efface la source, colle à destination (vrai cut+move)
function commitMoveSelection(){
  if(!(selectionData instanceof ImageData) || !selRect) return;

  // 1. Restaurer la frame SANS la zone source (elle a été effacée dans startCutMove)
  bufToCanvas(selectionBuf || frames[curFrame].buffer);
  if(gridMode) drawGrid();

  // 2. Coller la sélection à la nouvelle position
  const dx = Math.max(0, Math.min(127, selRect.x + moveOffsetX));
  const dy = Math.max(0, Math.min(63,  selRect.y + moveOffsetY));
  const sw = selectionData.width, sh = selectionData.height;
  const d  = selectionData.data;

  for(let py = 0; py < sh; py++){
    for(let px = 0; px < sw; px++){
      const i = (py * sw + px) * 4;
      if(d[i+3] === 0) continue;
      const tx = dx + px, ty = dy + py;
      if(tx < 0 || tx >= 128 || ty < 0 || ty >= 64) continue;
      const lum = (d[i]*0.299 + d[i+1]*0.587 + d[i+2]*0.114);
      ctx.fillStyle = lum < 128 ? '#000' : '#fff';
      ctx.fillRect(tx, ty, 1, 1);
    }
  }

  saveHistory();
  saveToFrame(true);
  clearOverlay();
  renderStrip();
  updateEinkPreview(frames[curFrame].buffer);

  moveMode = false;
  selectionFloating = false;
  moveOffsetX = 0; moveOffsetY = 0; moveDragStart = null;

  selRect = {x: dx, y: dy, w: sw, h: sh};
  selectionBuf    = new Uint8Array(frames[curFrame].buffer);
  selectionActive = true;
  setTool('select');
  drawSelectionOverlay();
  showSelectActions(true);
  setStatus('Déplacement validé');
}

// Bouton "Valider déplacement" (alias public)
window.confirmMoveSelection = function () {
  finishSelectionMove();
};


// Outil stamp : copier la sélection dans un tampon réutilisable (sans effacer la source)
let stampData = null;  // ImageData du tampon courant
let stampMode = false; // on est en train de poser le tampon

window.setStampFromSelection = function () {
  if (!selectionActive || !selectionData || !selRect) {
    setStatus('Sélectionnez d’abord une zone');
    return;
  }
  const raw = ctx.getImageData(selRect.x, selRect.y, selRect.w, selRect.h);
  stampData = maskBackgroundPixels ? maskBackgroundPixels(raw) : maskWhitePixels(raw);
  moveMode = false;
  selectionFloating = false;
  moveDragStart = null;
  setTool('stamp');
  setStatus('Tampon prêt : cliquez pour dupliquer');
};

// Effacer la zone sélectionnée
window.clearSelectionArea = function(){
  if(!selectionActive || !selRect || selRect.w < 1 || selRect.h < 1) return;
  saveHistory();
  ctx.fillStyle = '#fff';
  ctx.fillRect(selRect.x, selRect.y, selRect.w, selRect.h);
  saveToFrame(true);
  clearOverlay();
  renderStrip();
  cancelSelection();
  setStatus('Zone effacée');
};

// Couper la sélection : mémorise les pixels, efface la zone source
window.cutSelection = function() {
  if(!selectionActive || !selRect || selRect.w < 1 || selRect.h < 1) return;
  const raw = ctx.getImageData(selRect.x, selRect.y, selRect.w, selRect.h);
  selectionData = maskBackgroundPixels(raw);
  selectionBuf  = new Uint8Array(frames[curFrame].buffer);

  // Effacer la zone source
  saveHistory();
  ctx.fillStyle = '#fff';
  ctx.fillRect(selRect.x, selRect.y, selRect.w, selRect.h);
  saveToFrame(true);

  moveMode = true;
  moveOffsetX = 0; moveOffsetY = 0;
  setTool('move');
  drawSelectionOverlay();
  showSelectActions(true);
  setStatus('Zone coupée — glissez pour repositionner, puis ✓ Valider');
};

canvas.addEventListener('mousedown', startDraw);
canvas.addEventListener('mousemove', moveDraw);
canvas.addEventListener('mouseup',   endDraw);
canvas.addEventListener('touchstart',startDraw,{passive:false});
canvas.addEventListener('touchmove', moveDraw, {passive:false});
canvas.addEventListener('touchend',  endDraw,  {passive:false});

// ═══════════════════════════════════════════════════════════════════
//  TOOL CONTROLS
// ═══════════════════════════════════════════════════════════════════

function updateFrameMultiInfo(){
  const el = document.getElementById('frameMultiInfo');
  if(!el) return;
  el.style.display = window.frameSelectionMode ? 'block' : 'none';
  el.textContent = window.frameSelectionMode
    ? ('Mode sélection de frames actif : ' + frameSelection.size + ' frame(s) sélectionnée(s).')
    : 'Mode sélection de frames inactif';
}
window.frameSelectionMode = false;
window.toggleFrameSelectionMode = function(){
  window.frameSelectionMode = !window.frameSelectionMode;
  document.getElementById('frameSelBtn')?.classList.toggle('active', window.frameSelectionMode);
  if(!window.frameSelectionMode) frameSelection.clear();
  renderStrip();
  updateFrameMultiInfo();
}
window.clearFrameSelection = function(){
  frameSelection.clear();
  window.frameSelectionMode = false;
  document.getElementById('frameSelBtn')?.classList.remove('active');
  renderStrip();
  updateFrameMultiInfo();
}
window.duplicateSelectedFrames = function(){
  const arr = Array.from(frameSelection).sort((a,b)=>a-b);
  if(!arr.length) return;
  const clones = arr.map(i => ({ buffer:new Uint8Array(frames[i].buffer), delay:frames[i].delay }));
  const insertAt = arr[arr.length-1] + 1;
  frames.splice(insertAt, 0, ...clones);
  frameSelection = new Set(clones.map((_,k)=>insertAt+k));
  renderStrip(); updateFrameUi(); updateFrameMultiInfo(); setStatus('Frames dupliquées');
}
window.moveSelectedFramesLeft = function(){
  const arr = Array.from(frameSelection).sort((a,b)=>a-b);
  if(!arr.length || arr[0]===0) return;
  arr.forEach(i => { const tmp=frames[i-1]; frames[i-1]=frames[i]; frames[i]=tmp; });
  frameSelection = new Set(arr.map(i=>i-1));
  curFrame = Math.max(0, curFrame-1);
  renderStrip(); updateFrameUi(); updateFrameMultiInfo(); setStatus('Frames déplacées à gauche');
}
window.moveSelectedFramesRight = function(){
  const arr = Array.from(frameSelection).sort((a,b)=>b-a);
  if(!arr.length || arr[0]===frames.length-1) return;
  arr.forEach(i => { const tmp=frames[i+1]; frames[i+1]=frames[i]; frames[i]=tmp; });
  frameSelection = new Set(arr.map(i=>i+1));
  curFrame = Math.min(frames.length-1, curFrame+1);
  renderStrip(); updateFrameUi(); updateFrameMultiInfo(); setStatus('Frames déplacées à droite');
}


// ── Presse-papier de frames ───────────────────────────────────────
let frameClipboardIsCut = false;

window.copySelectedFrames = function() {
  const arr = Array.from(frameSelection).sort((a,b)=>a-b);
  if(!arr.length) { setStatus('Aucune frame sélectionnée'); return; }
  frameClipboard = arr.map(i => ({
    buffer: new Uint8Array(frames[i].buffer),
    delay:  frames[i].delay
  }));
  frameClipboardIsCut = false;
  setStatus(arr.length + ' frame(s) copiée(s)');
  updateFrameMultiInfo();
};

window.cutSelectedFrames = function() {
  const arr = Array.from(frameSelection).sort((a,b)=>a-b);
  if(!arr.length) { setStatus('Aucune frame sélectionnée'); return; }
  if(frames.length - arr.length < 1) { setStatus('Impossible : 1 frame minimum'); return; }
  frameClipboard = arr.map(i => ({
    buffer: new Uint8Array(frames[i].buffer),
    delay:  frames[i].delay
  }));
  frameClipboardIsCut = true;
  // Supprimer dans l'ordre décroissant pour ne pas décaler les indices
  arr.slice().reverse().forEach(i => frames.splice(i, 1));
  curFrame = Math.max(0, Math.min(curFrame, frames.length - 1));
  frameSelection.clear();
  loadFrame(); renderStrip(); updateFrameUi(); updateFrameMultiInfo();
  setStatus(frameClipboard.length + ' frame(s) coupée(s)');
};

window.pasteFrames = function() {
  if(!frameClipboard.length) { setStatus('Presse-papier vide'); return; }
  const insertAt = curFrame + 1;
  const clones = frameClipboard.map(f => ({
    buffer: new Uint8Array(f.buffer),
    delay:  f.delay
  }));
  frames.splice(insertAt, 0, ...clones);
  frameSelection = new Set(clones.map((_,k) => insertAt + k));
  curFrame = insertAt;
  loadFrame(); renderStrip(); updateFrameUi(); updateFrameMultiInfo();
  setStatus(clones.length + ' frame(s) collée(s) après la frame ' + insertAt);
};

window.deleteSelectedFrames = function() {
  const arr = Array.from(frameSelection).sort((a,b)=>a-b);
  if(!arr.length) { setStatus('Aucune frame sélectionnée'); return; }
  if(frames.length - arr.length < 1) { setStatus('Impossible : 1 frame minimum'); return; }
  arr.slice().reverse().forEach(i => frames.splice(i, 1));
  curFrame = Math.max(0, Math.min(curFrame, frames.length - 1));
  frameSelection.clear();
  window.frameSelectionMode = false;
  document.getElementById('frameSelBtn')?.classList.remove('active');
  loadFrame(); renderStrip(); updateFrameUi(); updateFrameMultiInfo();
  setStatus(arr.length + ' frame(s) supprimée(s)');
};


window.setTool = t => {
  const wasSelectLike = (tool === 'select' || tool === 'move' || tool === 'wand');
  const becomesSelectLike = (t === 'select' || t === 'move' || t === 'wand');
if(!becomesSelectLike && t !== 'fill' && t !== 'stamp'){
    cancelSelection();
  }
  if(t === 'fill'){
    moveMode = false;
    selectionFloating = false;
  }
  tool=t; polyPoints=[]; shapeSnap=null;
  document.querySelectorAll('[id^="btn_"]').forEach(b=>b.classList.remove('active'));
  document.getElementById('btn_'+t)?.classList.add('active');
  const info = document.getElementById('selectToolInfo');
  if(info){
    if(t === 'select'){
      info.style.display = 'block';
      info.textContent = selectionActive ? '⬚ Sélection active : cliquez-glissez dedans pour déplacer, ou redessinez une sélection.' : '⬚ Tracez un rectangle pour sélectionner une zone.';
    } else if(t === 'wand'){
      info.style.display = 'block';
      info.textContent = selectionActive ? '🪄 Sélection active : cliquez-glissez dedans pour déplacer, ou cliquez ailleurs pour reselectionner.' : '🪄 Cliquez sur un pixel pour sélectionner tous les pixels connectés de même couleur.';
    } else if(t === 'fill'){
      info.style.display = 'block';
      info.textContent = '🪣 Cliquez dans une zone fermée pour la remplir avec la couleur active. Aucun déplacement ici.';
    } else if(t === 'move'){
      info.style.display = 'block';
      info.textContent = '✥ Glissez pour déplacer la sélection active.';
    } else {
      info.style.display = 'none';
    }
  }
  const actions = document.getElementById('selectActions');
  if(actions) actions.style.display = selectionActive ? 'flex' : 'none';
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
    await fetch("/draw?save=0", { method: "POST", body: new Uint8Array(1024) }); // clear sans galerie
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
  if (!frames.length) { setStatus('Aucune frame à exporter'); return; }
  setStatus('Encodage GIF…');

  try {
    const gifBytes = encodeGif(frames);
    const blob = new Blob([gifBytes], { type: 'image/gif' });
    const name = (window._lastName || 'animation').replace(/[^\w-]/g, '_');
    downloadBlob(blob, name + '-' + Date.now() + '.gif');
    setStatus('GIF sauvegardé (' + frames.length + ' frames)');
  } catch(e) {
    setStatus('Erreur GIF: ' + e.message);
  }
};

// Encodeur GIF inline (pas de worker, pas de lib externe)
function encodeGif(frameList) {
  const W = 128, H = 64;

  function byteArr() {
    const a = []; a.push = a.push; return a;
  }

  // Palette B&W : index 0 = blanc, index 1 = noir
  function writeByte(out, b)   { out.push(b & 0xFF); }
  function writeU16LE(out, v)  { out.push(v & 0xFF); out.push((v >> 8) & 0xFF); }
  function writeStr(out, s)    { for(let i=0;i<s.length;i++) out.push(s.charCodeAt(i)); }

  function lzwEncode(indices, minCodeSize) {
    const CLEAR = 1 << minCodeSize;
    const END   = CLEAR + 1;
    const out   = [];
    let bits    = 0, cur = 0, codeSize = minCodeSize + 1;
    let dict    = new Map();
    let nextCode = END + 1;

    function resetDict() {
      dict.clear(); nextCode = END + 1; codeSize = minCodeSize + 1;
    }

    function emit(code) {
      cur |= code << bits; bits += codeSize;
      while (bits >= 8) { out.push(cur & 0xFF); cur >>= 8; bits -= 8; }
    }

    resetDict();
    emit(CLEAR);

    let buf = '';
    for (let i = 0; i <= indices.length; i++) {
      const c = i < indices.length ? String.fromCharCode(indices[i]) : null;
      const next = c !== null ? buf + c : null;
      if (c !== null && dict.has(next)) {
        buf = next;
      } else {
        // Émettre buf
        if (buf.length === 1) {
          emit(buf.charCodeAt(0));
        } else {
          emit(dict.get(buf));
        }
        if (c !== null) {
          if (nextCode < 4096) {
            dict.set(next, nextCode++);
            if (nextCode > (1 << codeSize) && codeSize < 12) codeSize++;
          } else {
            emit(CLEAR); resetDict();
          }
          buf = c;
        }
      }
    }
    emit(END);
    if (bits > 0) out.push(cur & 0xFF);
    return out;
  }

  function writeSubBlocks(out, data) {
    let i = 0;
    while (i < data.length) {
      const chunk = Math.min(255, data.length - i);
      out.push(chunk);
      for (let j = 0; j < chunk; j++) out.push(data[i++]);
    }
    out.push(0); // block terminator
  }

  const out = [];

  // Header
  writeStr(out, 'GIF89a');
  writeU16LE(out, W);
  writeU16LE(out, H);
  // GCT flag=1, color res=1, sort=0, GCT size=0 (2 colors)
  writeByte(out, 0b10000000 | 0);
  writeByte(out, 0); // bg color index
  writeByte(out, 0); // pixel aspect

  // Global Color Table : blanc, noir
  out.push(255, 255, 255); // index 0 = blanc
  out.push(0,   0,   0);   // index 1 = noir

  // Netscape loop extension (animation infinie)
  out.push(0x21, 0xFF, 0x0B);
  writeStr(out, 'NETSCAPE2.0');
  out.push(3, 1, 0, 0, 0); // loop count 0 = infini

  for (const f of frameList) {
    const delay = Math.round((f.delay || 100) / 10); // centièmes de seconde

    // Graphic Control Extension
    out.push(0x21, 0xF9, 0x04);
    writeByte(out, 0b00000100); // disposal=1, no transparency
    writeU16LE(out, delay);
    writeByte(out, 0); // transparent index (unused)
    out.push(0);

    // Image Descriptor
    out.push(0x2C);
    writeU16LE(out, 0); writeU16LE(out, 0); // left, top
    writeU16LE(out, W); writeU16LE(out, H);
    writeByte(out, 0); // no LCT, not interlaced

    // Pixel indices : bit=1 → noir (index 1), bit=0 → blanc (index 0)
    const indices = new Array(W * H);
    for (let page = 0; page < 8; page++) {
      for (let x = 0; x < W; x++) {
        const b = f.buffer[page * W + x];
        for (let bit = 0; bit < 8; bit++) {
          indices[(page * 8 + bit) * W + x] = (b >> bit) & 1;
        }
      }
    }

    writeByte(out, 2); // LZW min code size (2 pour palette de 4 couleurs min)
    const encoded = lzwEncode(indices, 2);
    writeSubBlocks(out, encoded);
  }

  out.push(0x3B); // GIF trailer
  return new Uint8Array(out);
}

window.toggleInvert = async function () {
  try {
    saveToFrame(true);

    const src = frames[curFrame].buffer;
    const dst = new Uint8Array(1024);
    for (let i = 0; i < 1024; i++) dst[i] = src[i] ^ 0xFF;

    frames[curFrame].buffer = dst;
    oledInverted = !oledInverted;

    bufToCanvas(dst);
    clearOverlay();
    renderStrip();
    updateOledPreview(dst);
    saveHistory();

    await fetch('invert', { method: 'GET', cache: 'no-store' }).catch(() => {});
    setStatus('Invert ' + (oledInverted ? 'ON' : 'OFF'));
  } catch (e) {
    setStatus('Erreur invert: ' + (e?.message || e));
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
  rawGifFrames = cropSrcGifFrames.slice(0, GIF_MAX_FRAMES).map(fr => ({
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
let _galleryCurrentTab = 'artwork';

window.switchGalleryTab = (tab, btn) => {
  _galleryCurrentTab = tab;
  document.querySelectorAll('#panel-gallery .btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('galleryGrid').style.display       = tab === 'artwork' ? '' : 'none';
  document.getElementById('galleryGridPoetry').style.display = tab === 'poetry'  ? '' : 'none';
};

let galleryLoadToken = 0;
const seenSlots = new Set();

window.loadGallery = async function() {
  const myToken = ++galleryLoadToken;

  const gridArt = document.getElementById('galleryGrid');
  const gridPoe = document.getElementById('galleryGridPoetry');

  if (!gridArt || !gridPoe) {
    console.warn('Galerie introuvable');
    return;
  }

  gridArt.innerHTML = '<div class="gempty">Chargement...</div>';
  gridPoe.innerHTML = '<div class="gempty">Chargement...</div>';

  // Reset vu pour cette exécution
  seenSlots.clear();

  try {
    const res = await fetch('/gallery', { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);

    const items = await res.json();

    if (myToken !== galleryLoadToken) {
      console.log('loadGallery annulé (nouvel appel)', myToken, '≠', galleryLoadToken);
      return;
    }

    gridArt.innerHTML = '';
    gridPoe.innerHTML = '';

    if (!Array.isArray(items) || !items.length) {
      gridArt.innerHTML = '<div class="gempty">Aucune œuvre visuelle.</div>';
      gridPoe.innerHTML = '<div class="gempty">Aucune poésie sauvegardée.</div>';
      setStatus('Galerie vide');
      return;
    }

    let artCount = 0;
    let poeCount = 0;

    // DÉDUPLICATION PAR SLOT
    const uniqueItems = [];
    for (const item of items) {
      const slotKey = Number(item?.slot);
      if (!Number.isFinite(slotKey)) continue;
      if (seenSlots.has(slotKey)) {
        console.warn('SLOT DUPLICATA ignoré', slotKey, item);
        continue;
      }
      seenSlots.add(slotKey);
      uniqueItems.push(item);
    }

    console.log('loadGallery items originaux:', items.length, '→ uniques:', uniqueItems.length);

    const hasPoetryHint = (...values) => {
      const s = values
        .filter(v => v !== null && v !== undefined)
        .map(v => String(v).toLowerCase())
        .join(' ');
      return (
        s.includes('poème') ||
        s.includes('poeme') ||
        s.includes('pome') ||
        s.includes('poetry') ||
        s.includes('poésie') ||
        s.includes('poesie') ||
        s.includes('scroll-poetry') ||
        s.includes('poetry-scroll')
      );
    };

    const drawBluePreviewFromBuffer = (buf) => {
      if (!Array.isArray(buf) || buf.length !== 1024) return null;

      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 64;

      Object.assign(canvas.style, {
        width: '100%',
        height: 'auto',
        background: '#000',
        borderRadius: '6px',
        imageRendering: 'pixelated'
      });

      const ctx = canvas.getContext('2d');
      const id = ctx.createImageData(128, 64);

      for (let page = 0; page < 8; page++) {
        for (let x = 0; x < 128; x++) {
          const b = buf[page * 128 + x];
          for (let bit = 0; bit < 8; bit++) {
            const y = page * 8 + bit;
            const i = (y * 128 + x) * 4;
            if (b & (1 << bit)) {
              id.data[i] = 0x44;
              id.data[i + 1] = 0xaa;
              id.data[i + 2] = 0xff;
              id.data[i + 3] = 255;
            } else {
              id.data[i] = 0;
              id.data[i + 1] = 0;
              id.data[i + 2] = 0;
              id.data[i + 3] = 255;
            }
          }
        }
      }

      ctx.putImageData(id, 0, 0);
      return canvas;
    };

    const escapeHtml = (s) =>
      String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    for (const item of uniqueItems) {
      if (myToken !== galleryLoadToken) {
        console.log('loadGallery annulé en cours de boucle', myToken);
        return;
      }

      console.log('🔄 TRAITEMENT SLOT', item.slot, item?.type);

      let full = null;
      let fetchError = false;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000); // timeout plus court

        const r = await fetch(`/gallery-item?slot=${encodeURIComponent(item.slot)}`, {
          cache: 'no-store',
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (r.ok) full = await r.json();
      } catch (e) {
        console.warn('FETCH slot échoué', item.slot, e?.message || e);
        fetchError = true;
      }

const resolvedType = full?.type ?? item?.type ?? null;
const resolvedOrigin = full?.origin ?? item?.origin ?? '';
const resolvedSource = full?.source ?? item?.source ?? '';
const resolvedCategory = full?.category ?? item?.category ?? '';
const resolvedMode = full?.mode ?? item?.mode ?? '';
const resolvedName = full?.name ?? item?.name ?? full?.artworkName ?? '';
const resolvedArtist = full?.artist ?? item?.artist ?? full?.artistName ?? '';
const resolvedText = full?.text ?? item?.text ?? '';
const hasFrames = Array.isArray(full?.frames) && full.frames.length > 0;
const bufSrc = full?.oledBuffer ?? full?.data ?? item?.oledBuffer ?? item?.data ?? null;

const poetryHint = hasPoetryHint(
  resolvedOrigin,
  resolvedSource,
  resolvedCategory,
  resolvedMode,
  resolvedName,
  resolvedArtist,
  resolvedText,
  full?.artworkName,
  full?.artistName,
  item?.artworkName,
  item?.artistName
);

const isScrollPoetry =
  (
    resolvedType === 'poetry' &&
    resolvedMode === 'scroll'
  ) ||
  (
    resolvedType === 'gif' &&
    (
      resolvedOrigin === 'poetry' ||
      resolvedSource === 'poetry' ||
      resolvedCategory === 'poetry' ||
      (
        poetryHint &&
        !!resolvedText
      )
    )
  );

const isStaticPoetry =
  !isScrollPoetry &&
  (
    resolvedType === 'poetry' ||
    (
      (resolvedType === 'still' || resolvedType === 'image') &&
      (
        !!resolvedText ||
        poetryHint
      )
    )
  );

const isPoetry = isScrollPoetry || isStaticPoetry;
const isGif = !isPoetry && resolvedType === 'gif';



      console.log('CLASSIF SLOT', item.slot, {
        resolvedType,
        poetryHint,
        isStaticPoetry,
        isScrollPoetry,
        isPoetry,
        isGif,
        hasText: !!resolvedText,
        hasFrames,
        fetchError
      });

      // VERROU : un seul rendu par slot
      let appended = false;

      const wrap = document.createElement('div');
      wrap.className = 'gcard';

      // CAS SANS full (fallback)
      if (!full) {
        if (appended) {
          console.warn('SLOT', item.slot, 'déjà rendu (fallback skip)');
          continue;
        }
        console.log('📸 FALLBACK ART slot', item.slot);
        wrap.innerHTML = `
          <div class="gmeta">
            <strong>${escapeHtml(item?.name || 'Sans titre')}</strong>
            <span>${escapeHtml(item?.timestamp || 'Sans date')}</span>
            ${fetchError ? '<span style="color:var(--red);font-size:9px">Données indisponibles</span>' : ''}
          </div>
          <button class="btn send" style="font-size:10px;padding:5px 8px"
            onclick="resendFromGallery(${Number(item.slot)})">→ OLED</button>
        `;
        gridArt.appendChild(wrap);
        artCount++;
        appended = true;
        continue;
      }

      // POÉSIE PRIORITAIRE
      if (isPoetry) {
  if (appended) continue;
  console.log('📜 POÉSIE slot', item.slot);

  let previewCanvas = null;
  const bufSrc = full?.oledBuffer ?? full?.data ?? null;

  // Construire le canvas de preview
  previewCanvas = document.createElement('canvas');
  previewCanvas.width = 128;
  previewCanvas.height = 64;
  Object.assign(previewCanvas.style, {
    width: '100%', height: 'auto', background: '#000',
    borderRadius: '6px', imageRendering: 'pixelated'
  });

  const isScrollPoem = isScrollPoetry ||
    (full?.mode === 'scroll') ||
    (full?.type === 'poetry' && full?.mode === 'scroll');

if (isScrollPoem && full?.text) {
  // Reconstruire le scroll depuis le texte — différé pour ne pas bloquer le rendu
  setTimeout(() => {
    try {
      const size  = full.textSize || 2;
      const speed = full.scrollSpeed || 80;
      const fw = POETRY_FONT_W * size;
      const charsPerLine = Math.floor(128 / fw);
      const lines = poetryWrapText(full.text, charsPerLine);

      const { canvas: scrollCanvas, totalH } = poetryBuildScrollBuffer(lines, size);
      const pctx = previewCanvas.getContext('2d');

      let offset = 0;
      let lastT = 0;

      // Si une ancienne anim tourne déjà sur ce canvas, on la stoppe
      if (previewCanvas._scrollRaf) {
        cancelAnimationFrame(previewCanvas._scrollRaf);
        previewCanvas._scrollRaf = null;
      }

      function drawScrollPreview(ts) {
        // Canvas retiré du DOM => on stoppe proprement
        if (!document.body.contains(previewCanvas)) {
          if (previewCanvas._scrollRaf) {
            cancelAnimationFrame(previewCanvas._scrollRaf);
            previewCanvas._scrollRaf = null;
          }
          return;
        }

        if (ts - lastT >= speed) {
          lastT = ts;
          offset++;
          if (offset >= totalH) offset = 0;

          pctx.fillStyle = '#000';
          pctx.fillRect(0, 0, 128, 64);
          pctx.drawImage(scrollCanvas, 0, offset, 128, 64, 0, 0, 128, 64);
        }

        previewCanvas._scrollRaf = requestAnimationFrame(drawScrollPreview);
      }

      previewCanvas._scrollRaf = requestAnimationFrame(drawScrollPreview);
    } catch (e) {
      console.warn('scroll preview error slot', item.slot, e);

      // Fallback : afficher le buffer statique si disponible
      if (Array.isArray(bufSrc) && bufSrc.length === 1024) {
        const pctx = previewCanvas.getContext('2d');
        const id = pctx.createImageData(128, 64);

        for (let page = 0; page < 8; page++) {
          for (let x = 0; x < 128; x++) {
            const b = bufSrc[page * 128 + x];
            for (let bit = 0; bit < 8; bit++) {
              const y = page * 8 + bit;
              const i = (y * 128 + x) * 4;

              if (b & (1 << bit)) {
                id.data[i] = 0x44;
                id.data[i + 1] = 0xaa;
                id.data[i + 2] = 0xff;
                id.data[i + 3] = 255;
              } else {
                id.data[i + 3] = 255;
              }
            }
          }
        }

        pctx.putImageData(id, 0, 0);
      }
    }
  }, 100 * poeCount); // léger décalage pour ne pas tout lancer en même temps

} else if (Array.isArray(bufSrc) && bufSrc.length === 1024) {
  // Poésie fixe : afficher le buffer statique
  const pctx = previewCanvas.getContext('2d');
  const id = pctx.createImageData(128, 64);

  for (let page = 0; page < 8; page++) {
    for (let x = 0; x < 128; x++) {
      const b = bufSrc[page * 128 + x];
      for (let bit = 0; bit < 8; bit++) {
        const y = page * 8 + bit;
        const i = (y * 128 + x) * 4;

        if (b & (1 << bit)) {
          id.data[i] = 0x44;
          id.data[i + 1] = 0xaa;
          id.data[i + 2] = 0xff;
          id.data[i + 3] = 255;
        } else {
          id.data[i + 3] = 255;
        }
      }
    }
  }

  pctx.putImageData(id, 0, 0);

} else {
  // Pas de données : placeholder
  const pctx = previewCanvas.getContext('2d');
  pctx.fillStyle = '#000';
  pctx.fillRect(0, 0, 128, 64);
  pctx.fillStyle = '#4af';
  pctx.font = '8px monospace';
  pctx.textBaseline = 'top';
  pctx.fillText(isScrollPoem ? '↕ scroll' : '✍', 4, 28);
}

  // Construire la card
  wrap.innerHTML = `
    <div class="gmeta">
      <strong>${escapeHtml(full.artworkName || full.name || 'Poème')}</strong>
      <span style="color:var(--accent);font-size:9px">${escapeHtml(full.artistName || full.artist || 'Anonyme')}</span>
      <span>${escapeHtml(full.createdAt || full.timestamp || item.timestamp || '')}</span>
      ${isScrollPoem ? '<span style="color:var(--orange);font-size:9px">↕ scroll</span>' : ''}
    </div>
    ${resolvedText
      ? `<span style="white-space:pre-wrap;color:var(--text);font-size:10px;margin-top:4px">${escapeHtml(resolvedText.substring(0, 80))}${resolvedText.length > 80 ? '…' : ''}</span>`
      : ''
    }
    <button class="btn send" style="font-size:10px;padding:5px 8px"
      onclick="resendFromGallery(${Number(item.slot)})">→ OLED</button>
  `;

  wrap.insertBefore(previewCanvas, wrap.firstChild);
  gridPoe.appendChild(wrap);
  poeCount++;
  appended = true;
  continue;
}

      // GIF
      if (isGif) {
        if (appended) {
          console.log('SLOT', item.slot, 'déjà rendu (gif skip)');
          continue;
        }
        console.log('🎬 GIF slot', item.slot);

        wrap.innerHTML = `
          <canvas width="128" height="64" style="width:100%;height:auto;background:#000;border-radius:6px;image-rendering:pixelated"></canvas>
          <div class="gmeta">
            <strong>${escapeHtml(full.name || item.name || 'Anonyme')}</strong>
            <span>${escapeHtml(full.timestamp || item.timestamp || 'Sans date')}</span>
            <span style="color:var(--orange);font-size:9px">GIF</span>
          </div>
          <button class="btn send" style="font-size:10px;padding:5px 8px"
            onclick="resendFromGallery(${Number(item.slot)})">→ OLED</button>
        `;

        const c = wrap.querySelector('canvas');
        if (hasFrames) {
          startGifPreview(c, full.frames, full.delays);
        }

        gridArt.appendChild(wrap);
        artCount++;
        appended = true;
        continue;
      }

      // ŒUVRE STATIQUE (défaut)
      if (!appended) {
        console.log('🖼️ ART STATIQUE slot', item.slot);
        const data = full.data || full.oledBuffer;

        wrap.innerHTML = `
          <canvas width="128" height="64" style="width:100%;height:auto;background:#fff;border-radius:6px;image-rendering:pixelated"></canvas>
          <div class="gmeta">
            <strong>${escapeHtml(full.name || item.name || 'Anonyme')}</strong>
            <span>${escapeHtml(full.timestamp || item.timestamp || 'Sans date')}</span>
          </div>
          <button class="btn send" style="font-size:10px;padding:5px 8px"
            onclick="resendFromGallery(${Number(item.slot)})">→ OLED</button>
        `;

        const c = wrap.querySelector('canvas');
        if (Array.isArray(data) && data.length === 1024) {
          try {
            bufToCanvas(new Uint8Array(data), c.getContext('2d', { willReadFrequently: true }));
          } catch (e) {
            console.warn('bufToCanvas error slot', item.slot, e);
          }
        }

        gridArt.appendChild(wrap);
        artCount++;
        appended = true;
      }
    }

    if (!artCount) gridArt.innerHTML = '<div class="gempty">Aucune œuvre visuelle.</div>';
    if (!poeCount) gridPoe.innerHTML = '<div class="gempty">Aucune poésie sauvegardée.</div>';

    setStatus(`Galerie : ${artCount} œuvres, ${poeCount} poésies`);
    console.log('✅ loadGallery TERMINÉ token', myToken, 'art:', artCount, 'poe:', poeCount);
  } catch (e) {
    console.error('loadGallery error', e);
    gridArt.innerHTML = '<div class="gempty">Erreur de chargement.</div>';
    gridPoe.innerHTML = '<div class="gempty">Erreur de chargement.</div>';
    setStatus('Erreur galerie ' + (e?.message || e));
  }
};

window.resendFromGallery = async function(slot) {
  setStatus('Chargement slot ' + slot);
  try {
    const r = await fetch(`gallery-item?slot=${slot}`, { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const full = await r.json();

    // ✅ GIF normal OU poème-scroll (les deux ont type:'gif' + frames)
    if (full.type === 'gif' && Array.isArray(full.frames) && full.frames.length) {
      frames = full.frames.slice(0, GIF_MAX_FRAMES0).map((buf, i) => ({
        buffer: new Uint8Array(buf),
        delay: full.delays ? (full.delays[i] || 100) : 100
      }));
      curFrame = 0;
      rawSourceImg = null; rawGifFrames = [];
      loadFrame(); renderStrip(); updateFrameUi();
      document.getElementById('usernameInput').value = window.lastName;
      window.pendingAnimSend = true;
      document.getElementById('userModal').classList.add('active');
      const label = full.origin === 'poetry' ? 'scroll poème' : 'GIF';
      setStatus(`Prêt à renvoyer le ${label} du slot ${slot}`);
      return;
    }

    // Image fixe (poetry statique ou still)
    const data = full.data || full.oledBuffer;
    if (!Array.isArray(data) || data.length !== 1024) throw new Error('data invalide');
    pendingBuf = new Uint8Array(data);
    document.getElementById('usernameInput').value = window.lastName;
    document.getElementById('userModal').classList.add('active');
    setTimeout(() => {
      const inp = document.getElementById('usernameInput');
      inp.focus(); inp.select();
    }, 60);
    setStatus(`Prêt à renvoyer le slot ${slot}`);
  } catch(e) {
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

  frames = rawGifFrames.slice(0, GIF_MAX_FRAMES).map(fr => {
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

    for (const fr of parsed.frames.slice(0, GIF_MAX_FRAMES)) {
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
  const lines = txt.split('\n');
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

  // Afficher le bouton d'envoi
  document.getElementById('sendTxtArtBtn').style.display = 'inline-flex';
  setStatus('TXT Art importé (' + lines.length + ' lignes) — prêt à envoyer');
};

window.sendTxtArtToOled = () => {
  // Réutilise exactement le même flow que sendFrame
  window.sendFrame();
  setStatus('Ouverture envoi TXT Art…');
};


window.poetryMetrics = function () {
  const size = parseInt(document.getElementById('poetrySize').value) || 1;
  const fw = POETRY_FONT_W * size;
  const fh = POETRY_FONT_H * size;
  const charsPerLine = Math.floor(128 / fw);
  const linesPerScreen = Math.floor(64 / fh);
  const maxChars = charsPerLine * linesPerScreen;
  return { size, fw, fh, charsPerLine, linesPerScreen, maxChars };
};


const MAX_RENDER_LINES = 12;

window.poetryWrapText = function (text, charsPerLine) {
  charsPerLine = Math.max(1, parseInt(charsPerLine, 10) || 1);
  const paragraphs = String(text || '').replace(/\r/g, '').split('\n');
  const lines = [];

  for (const paragraph of paragraphs) {
    if (lines.length >= MAX_RENDER_LINES) break;
    if (!paragraph.trim()) {
      lines.push('');
      continue;
    }

    const words = paragraph.split(/\s+/);
    let cur = '';

    for (let word of words) {
      if (lines.length >= MAX_RENDER_LINES) break;
      if (!word) continue;

      while (word.length > charsPerLine) {
        if (cur) {
          lines.push(cur);
          cur = '';
          if (lines.length >= MAX_RENDER_LINES) break;
        }
        lines.push(word.slice(0, charsPerLine));
        word = word.slice(charsPerLine);
        if (lines.length >= MAX_RENDER_LINES) break;
      }

      if (lines.length >= MAX_RENDER_LINES) break;

      if (!cur) cur = word;
      else if ((cur + ' ' + word).length <= charsPerLine) cur += ' ' + word;
      else {
        lines.push(cur);
        cur = word;
      }
    }

    if (cur && lines.length < MAX_RENDER_LINES) lines.push(cur);
  }

  return lines;
};


window.poetryRenderToCanvas = function (lines, size, targetCanvas, totalH) {
  const fw = POETRY_FONT_W * size;
  const fh = POETRY_FONT_H * size;
  const w = targetCanvas.width;
  const h = targetCanvas.height;

  const pctx = targetCanvas.getContext('2d', { willReadFrequently: true });
  pctx.fillStyle = '#000';
  pctx.fillRect(0, 0, w, h);
  pctx.fillStyle = '#4af';
  pctx.imageSmoothingEnabled = false;

  const tmp = document.createElement('canvas');
  tmp.width = w;
  tmp.height = Math.max(h, lines.length * fh + 4);
  const tctx = tmp.getContext('2d', { willReadFrequently: true });
  tctx.fillStyle = '#000';
  tctx.fillRect(0, 0, tmp.width, tmp.height);
  tctx.fillStyle = '#fff';
  tctx.font = `${8 * size}px monospace`;
  tctx.textBaseline = 'top';
  tctx.imageSmoothingEnabled = false;

  lines.forEach((line, i) => {
    tctx.fillText(line, 0, i * fh);
  });

  pctx.fillStyle = '#000';
  pctx.fillRect(0, 0, w, h);
  pctx.drawImage(tmp, 0, 0, w, h, 0, 0, w, h);
};



window.poetryBuildScrollBuffer = function(lines, size) {
  const fh = POETRY_FONT_H * size;

  // Hauteur totale : 64px vides (intro) + texte + 64px vides (outro pour loop propre)
  const textH   = lines.length * fh;
  const totalH  = 64 + textH + 64;
  const clampedH = Math.min(totalH, 1024); // sécurité RAM canvas

  const tmp = document.createElement('canvas');
  tmp.width  = 128;
  tmp.height = clampedH;

  const tctx = tmp.getContext('2d', { willReadFrequently: true });
  tctx.fillStyle = '#000';
  tctx.fillRect(0, 0, 128, clampedH);
  tctx.fillStyle = '#4af';
  tctx.font = `${8 * size}px monospace`;
  tctx.textBaseline = 'top';
  tctx.imageSmoothingEnabled = false;

  // Le texte commence à y=64 (hors écran bas → entre par le bas)
  lines.forEach((line, i) => {
    tctx.fillText(line, 0, 64 + i * fh);
  });

  return { canvas: tmp, totalH: clampedH, startY: 0 };
};



window.poetrySaveToGallery = async function() {
  try {
    const input = document.getElementById('poetryInput');
    const text = input?.value.replace(/\r/g, '').trim();
    if (!text) { setStatus('écris quelque chose d\'abord'); return; }

    if (poetryScrollEnabled) {
      setStatus('Sauvegarde galerie scroll désactivée (/poetry limite 16384 octets)');
      return;
    }

    const profile = getProfile();
    const pc = document.getElementById('poetryCanvas');
    if (!pc) { setStatus('Canvas poésie introuvable'); return; }

    const buf = poetryCanvasToBuf(pc);
    if (!buf || buf.length !== 1024) { setStatus('Buffer poésie invalide'); return; }

    const payload = {
      type: 'poetry',
      artworkName: (window.lastName || profile.artistName || 'Pome').trim(),
      artistName: (profile.artistName || 'Anonyme').trim(),
      createdAt: new Date().toLocaleString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      }),
      text,
      oledBuffer: Array.from(buf)
    };

    const r = await fetch('poetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!r.ok) throw new Error('HTTP ' + r.status);
    setStatus('Poème sauvé en galerie');
    await loadGallery();
    switchGalleryTab('poetry', document.getElementById('galleryTabPoetry'));
  } catch(e) {
    console.error('poetrySaveToGallery error', e);
    setStatus('Erreur sauvegarde poème: ' + (e?.message || e));
  }
};

window.poetryUpdate = function () {
  const text = document.getElementById('poetryInput').value;
  const m = poetryMetrics();
  const lines = poetryWrapText(text, m.charsPerLine);
  const totalChars = text.replace(/\s/g, '').length;

  const counter = document.getElementById('poetryCharCounter');
  const warn = document.getElementById('poetryWarning');

  if (poetryScrollEnabled) {
    const maxScroll = m.maxChars * 4;
    counter.textContent = totalChars + ' / ' + maxScroll + ' car.';
    counter.className = 'poetry-char-counter' + (totalChars > maxScroll ? ' error' : totalChars > maxScroll * 0.8 ? ' warn' : '');
    warn.style.display = totalChars > maxScroll ? 'block' : 'none';
    if (totalChars > maxScroll) warn.textContent = 'Texte trop long même pour le scroll.';
  } else {
    counter.textContent = totalChars + ' / ' + m.maxChars + ' car.';
    const overflow = lines.length > m.linesPerScreen;
    counter.className = 'poetry-char-counter' + (overflow ? ' error' : totalChars > m.maxChars * 0.8 ? ' warn' : '');
    if (overflow) {
      warn.style.display = 'block';
      warn.innerHTML = 'Texte trop long (' + lines.length + ' lignes, max ' + m.linesPerScreen + '). '
        + '<a href="#" style="color:var(--accent)" onclick="document.getElementById(\'poetryScrollCheck\').checked=true;poetryToggleScroll();return false;">Activer le scroll ?</a>';
    } else {
      warn.style.display = 'none';
    }
  }

  poetryStopScrollPreview();
  const pc = document.getElementById('poetryCanvas');

  if (poetryScrollEnabled) {
    poetryStartScrollPreview(lines, m.size);
  } else {
    poetryRenderToCanvas(lines.slice(0, m.linesPerScreen), m.size, pc, 64);
  }
};

function poetrySafeTrim(text, max = POETRY_HARD_CHAR_LIMIT) {
  text = String(text || '').replace(/\r/g, '');
  if (text.length <= max) return { text, removed: 0 };
  return { text: text.slice(0, max), removed: text.length - max };
}

function poetryScheduleUpdate() {
  clearTimeout(poetryUpdateTimer);
  poetryUpdateTimer = setTimeout(() => {
    if (poetryBusy) return;
    poetryBusy = true;
    try { poetryUpdate(); }
    catch (e) {
      console.error('poetryUpdate failed:', e);
      setStatus('Texte trop volumineux ou format invalide');
    } finally {
      poetryBusy = false;
    }
  }, 150);
}

const poetryInput = document.getElementById('poetryInput');
poetryInput.setAttribute('maxlength', String(POETRY_HARD_CHAR_LIMIT));

poetryInput.addEventListener('paste', (e) => {
  e.preventDefault();
  const pasted = (e.clipboardData || window.clipboardData).getData('text') || '';
  const start = poetryInput.selectionStart || 0;
  const end = poetryInput.selectionEnd || 0;
  const next = poetryInput.value.slice(0, start) + pasted + poetryInput.value.slice(end);
  const trimmed = poetrySafeTrim(next);

  poetryInput.value = trimmed.text;
  const pos = Math.min(start + pasted.length, trimmed.text.length);
  poetryInput.setSelectionRange(pos, pos);

  if (trimmed.removed > 0) {
    setStatus(trimmed.removed + ' caractères supprimés du poème');
  }
  poetryScheduleUpdate();
});

poetryInput.addEventListener('input', () => {
  const trimmed = poetrySafeTrim(poetryInput.value);
  if (trimmed.removed > 0) {
    poetryInput.value = trimmed.text;
    setStatus(trimmed.removed + ' caractères supprimés du poème');
  }
  poetryScheduleUpdate();
});

window.poetryToggleScroll = function () {
  poetryScrollEnabled = document.getElementById('poetryScrollCheck').checked;
  document.getElementById('poetryScrollOpts').classList.toggle('visible', poetryScrollEnabled);
  poetryUpdate();
};

window.poetryScrollSpeedUpdate = function (v) {
  poetryScrollSpeed = parseInt(v);
  document.getElementById('poetryScrollSpeedVal').textContent = v + 'ms';
  if (poetryScrollEnabled) poetryUpdate();
};



window.poetryStartScrollPreview = function(lines, size) {
  poetryStopScrollPreview();
  const pc = document.getElementById('poetryCanvas');
  const { canvas: scrollCanvas, totalH } = poetryBuildScrollBuffer(lines, size);

  let offset = 0;
  let lastT  = 0;

  function step(ts) {
    if (ts - lastT >= poetryScrollSpeed) {
      lastT = ts;
      offset++;
      if (offset >= totalH) offset = 0; // loop propre
      const pctx = pc.getContext('2d');
      pctx.fillStyle = '#000';
      pctx.fillRect(0, 0, 128, 64);
      // Fenêtre glissante : on lit depuis offset dans le buffer de totalH px
      pctx.drawImage(scrollCanvas, 0, offset, 128, 64, 0, 0, 128, 64);
    }
    poetryScrollRafId = requestAnimationFrame(step);
  }
  poetryScrollRafId = requestAnimationFrame(step);
};


window.poetryStopScrollPreview = function () {
  if (poetryScrollRafId !== null) {
    cancelAnimationFrame(poetryScrollRafId);
    poetryScrollRafId = null;
  }
};

window.poetryCanvasToBuf = function (pc) {
  const pctx = pc.getContext('2d', { willReadFrequently: true });
  const id = pctx.getImageData(0, 0, 128, 64);
  const buf = new Uint8Array(1024);
  for (let page = 0; page < 8; page++) {
    for (let x = 0; x < 128; x++) {
      let b = 0;
      for (let bit = 0; bit < 8; bit++) {
        const y = page * 8 + bit;
        const i = (y * 128 + x) * 4;
        if (id.data[i] > 50 || id.data[i + 2] > 50) b |= (1 << bit);
      }
      buf[page * 128 + x] = b;
    }
  }
  return buf;
};

window.poetryBuildScrollFrames = function(lines, size, speed){
  const built = poetryBuildScrollBuffer(lines, size);
  const scrollCanvas = built.canvas;
  const totalH = built.totalH;

  const framesOut = [];
  const tmp = document.createElement('canvas');
  tmp.width = 128;
  tmp.height = 64;
  const tctx = tmp.getContext('2d', { willReadFrequently: true });

  const firstOffset = 0;
  const lastOffset = Math.max(0, totalH - 64);
  const step = 1;

  for (let offset = firstOffset; offset <= lastOffset; offset += step) {
    tctx.fillStyle = '#000';
    tctx.fillRect(0, 0, 128, 64);
    tctx.drawImage(scrollCanvas, 0, offset, 128, 64, 0, 0, 128, 64);

    const buf = poetryCanvasToBuf(tmp);
    if (buf && buf.length === 1024) {
      framesOut.push({
        buffer: new Uint8Array(buf),
        delay: Math.max(60, parseInt(speed || 80, 10))
      });
    }
  }

  while (framesOut.length && framesOut[0].buffer.every(v => v === 0)) {
    framesOut.shift();
  }
  while (framesOut.length && framesOut[framesOut.length - 1].buffer.every(v => v === 0)) {
    framesOut.pop();
  }

  return framesOut;
};

window.poetrySendToOled = async function() {
  try {
    const input = document.getElementById('poetryInput');
    const text = input?.value.replace(/\r/g, '').trim();
    if (!text) { setStatus('écris quelque chose d’abord'); return; }

    const m = poetryMetrics();
    const lines = poetryWrapText(text, m.charsPerLine);
    if (!Array.isArray(lines) || !lines.length) {
      setStatus('Impossible de préparer le poème');
      return;
    }

    const profile = getProfile();

    if (poetryScrollEnabled) {
      setStatus('Génération frames scroll...');
      let scrollFrames = poetryBuildScrollFrames(lines, m.size, poetryScrollSpeed);

      if (!Array.isArray(scrollFrames) || !scrollFrames.length) {
        setStatus('Aucune frame scroll générée');
        return;
      }

      scrollFrames = scrollFrames.filter(fr =>
        fr && fr.buffer && fr.buffer.length === 1024 &&
        fr.buffer.some(v => v !== 0)
      );

      if (!scrollFrames.length) {
        setStatus('Les frames scroll sont vides');
        return;
      }

      const MAX_SCROLL_FRAMES_SENT = 20;
      if (scrollFrames.length > MAX_SCROLL_FRAMES_SENT) {
        const sampled = [];
        for (let i = 0; i < MAX_SCROLL_FRAMES_SENT; i++) {
          const idx = Math.floor(i * (scrollFrames.length - 1) / (MAX_SCROLL_FRAMES_SENT - 1));
          sampled.push(scrollFrames[idx]);
        }
        scrollFrames = sampled;
      }

      const subset = scrollFrames.map(fr => ({
        buffer: new Uint8Array(fr.buffer),
        delay: Math.max(60, parseInt(fr.delay || poetryScrollSpeed || 80, 10))
      }));

      frames = subset;
      curFrame = 0;
      pendingBuf = null;

      resetSendContext();
      sendContext.mode = 'anim';
      sendContext.source = 'poetry';
      sendContext.scroll = true;
      sendContext.poetryText = text;
      sendContext.poetryFrames = subset.map(fr => ({
        buffer: new Uint8Array(fr.buffer),
        delay: fr.delay
      }));

      loadFrame();
      renderStrip();
      updateFrameUi();

      document.getElementById('usernameInput').value = getLastArtworkName(profile) || 'Pome';

      const badge = document.getElementById('modalArtistBadge');
      const artistSpan = document.getElementById('modalArtistDisplay');
      if (profile.artistName) {
        artistSpan.textContent = profile.artistName;
        badge.style.display = 'block';
      } else {
        badge.style.display = 'none';
      }

      const forSaleRow = document.getElementById('forSaleRow');
      if (profile.forSale && profile.ethAddress) {
        forSaleRow.style.display = 'flex';
        document.getElementById('modalForSale').checked = false;
      } else {
        forSaleRow.style.display = 'none';
      }

      document.getElementById('userModal').classList.add('active');
      setTimeout(() => {
        const i = document.getElementById('usernameInput');
        if (i) { i.focus(); i.select(); }
      }, 60);

      setStatus('Prêt à envoyer le scroll (' + subset.length + ' frames)');
      return;
    }

    const pc = document.getElementById('poetryCanvas');
    if (!pc) { setStatus('Canvas poésie introuvable'); return; }

    const buf = poetryCanvasToBuf(pc);
    if (!buf || buf.length !== 1024) { setStatus('Buffer poésie invalide'); return; }

    saveToFrame(true);
    frames[curFrame].buffer = new Uint8Array(buf);
    bufToCanvas(buf);
    clearOverlay();
    renderStrip();
    updateFrameUi();
    updateOledPreview(frames[curFrame].buffer);

    pendingBuf = new Uint8Array(buf);

    resetSendContext();
    sendContext.mode = 'still';
    sendContext.source = 'poetry';
    sendContext.scroll = false;
    sendContext.poetryText = text;
    sendContext.poetryBuffer = new Uint8Array(buf);

    document.getElementById('usernameInput').value = getLastArtworkName(profile) || 'Pome';

    const badge = document.getElementById('modalArtistBadge');
    const artistSpan = document.getElementById('modalArtistDisplay');
    if (profile.artistName) {
      artistSpan.textContent = profile.artistName;
      badge.style.display = 'block';
    } else {
      badge.style.display = 'none';
    }

    const forSaleRow = document.getElementById('forSaleRow');
    if (profile.forSale && profile.ethAddress) {
      forSaleRow.style.display = 'flex';
      document.getElementById('modalForSale').checked = false;
    } else {
      forSaleRow.style.display = 'none';
    }

    document.getElementById('userModal').classList.add('active');
    setTimeout(() => {
      const i = document.getElementById('usernameInput');
      if (i) { i.focus(); i.select(); }
    }, 60);

    setStatus('Poème prêt à envoyer');
  } catch (e) {
    console.error('poetrySendToOled error', e);
    setStatus('Erreur préparation poème: ' + (e?.message || e));
  }
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
checkFirstRun();

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

String sanitizeIdPart(const String& in, int maxLen = 24) {
  String out;
  out.reserve(in.length());
  for (size_t i = 0; i < in.length(); i++) {
    char c = in[i];
    if ((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9')) out += c;
    else if (c >= 'A' && c <= 'Z') out += char(c + 32);
    else if (c == ' ' || c == '-' || c == '_' || c == '.') out += '-';
  }
  while (out.indexOf("--") >= 0) out.replace("--", "-");
  while (out.startsWith("-")) out.remove(0, 1);
  while (out.endsWith("-")) out.remove(out.length() - 1);
  if (!out.length()) out = "na";
  if ((int)out.length() > maxLen) out = out.substring(0, maxLen);
  return out;
}

String compactTimestamp(const String& stamp) {
  String out;
  out.reserve(stamp.length());
  for (size_t i = 0; i < stamp.length(); i++) {
    char c = stamp[i];
    if (isDigit(c)) out += c;
  }
  if (!out.length()) out = String(millis());
  return out;
}

String makeUid(const String& type, const String& mode, const String& artist, const String& name, const String& stamp) {
  String uid = compactTimestamp(stamp);
  uid += "-";
  uid += sanitizeIdPart(type, 12);
  uid += "-";
  uid += sanitizeIdPart(mode, 12);
  uid += "-";
  uid += sanitizeIdPart(artist, 20);
  uid += "-";
  uid += sanitizeIdPart(name, 20);
  uid += "-";
  uid += String(millis());
  return uid;
}

void logGalleryMeta(const char* tag,
                    int slot,
                    const String& uid,
                    const String& type,
                    const String& mode,
                    const String& name,
                    const String& artist,
                    const String& stamp,
                    bool forSale,
                    const String& ethAddress) {
  Serial.print(F("[META] "));
  Serial.println(tag);
  Serial.print(F("  slot="));      Serial.println(slot);
  Serial.print(F("  uid="));       Serial.println(uid);
  Serial.print(F("  type="));      Serial.println(type);
  Serial.print(F("  mode="));      Serial.println(mode);
  Serial.print(F("  name="));      Serial.println(name);
  Serial.print(F("  artist="));    Serial.println(artist);
  Serial.print(F("  timestamp=")); Serial.println(stamp);
  Serial.print(F("  forSale="));   Serial.println(forSale ? F("true") : F("false"));
  Serial.print(F("  eth="));       Serial.println(ethAddress.length() ? ethAddress : F("(empty)"));
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


bool writeGalleryGifJson(int slot,
                         AnimFrame frames[],
                         int count,
                         const String& uid,
                         const String& artworkName,
                         const String& artistName,
                         const String& stamp,
                         bool forSale,
                         const String& ethAddress,
                         const String& mode) {
  if (slot < 0 || slot >= GALLERY_SIZE) return false;
  if (count <= 0) return false;

  File f = LittleFS.open(galleryJsonPath(slot), "w");
  if (!f) return false;

  f.print(F("{\"slot\":"));
  f.print(slot);

  f.print(F(",\"uid\":\""));
  f.print(jsonEscape(uid));
  f.print(F("\""));

  f.print(F(",\"type\":\"gif\""));
  f.print(F(",\"mode\":\""));
  f.print(jsonEscape(mode));
  f.print(F("\""));

  f.print(F(",\"name\":\""));
  f.print(jsonEscape(artworkName));
  f.print(F("\""));

  f.print(F(",\"artist\":\""));
  f.print(jsonEscape(artistName));
  f.print(F("\""));

  f.print(F(",\"timestamp\":\""));
  f.print(jsonEscape(stamp));
  f.print(F("\""));

  f.print(F(",\"forSale\":"));
  f.print(forSale ? F("true") : F("false"));

  f.print(F(",\"ethAddress\":\""));
  f.print(jsonEscape(ethAddress));
  f.print(F("\""));

  f.print(F(",\"width\":128,\"height\":64,\"frameCount\":"));
  f.print(count);

  f.print(F(",\"delays\":["));
  for (int k = 0; k < count; k++) {
    f.print(frames[k].delay);
    if (k < count - 1) f.print(',');
  }
  f.print(F("]"));

  f.print(F(",\"frames\":["));
  for (int k = 0; k < count; k++) {
    f.print('[');
    for (int i = 0; i < 1024; i++) {
      f.print(frames[k].buf[i]);
      if (i < 1023) f.print(',');
      if ((i & 63) == 0) yield();
    }
    f.print(']');
    if (k < count - 1) f.print(',');
  }
  f.print(F("]}"));
  f.close();

  logGalleryMeta("writeGalleryGifJson",
                 slot, uid, "gif", mode, artworkName, artistName, stamp, forSale, ethAddress);
  return true;
}

// ── Init e-ink (sécurisé anti-reboot) ────────────────────────────
void initEink() {
  Serial.println(F("[EINK] init..."));

  if (epd.Init() != 0) {
    Serial.println(F("[EINK] Init FAILED"));
    return;
  }

  delay(100);

  epd.Sleep();

  Serial.println(F("[EINK] init done"));
}




// ── Clear e-ink (comme ton Uno) ──────────────────────────────────
void clearEink() {
  Serial.println(F("[EINK] clear..."));

  if (epd.Init() != 0) {
    Serial.println(F("[EINK] Init FAILED"));
    return;
  }

  delay(100);
  epd.Clear();
  delay(200);
  epd.Sleep();

  Serial.println(F("[EINK] clear done"));
}

// ============================================================
// UTILITAIRE ORIENTATION E-INK
// Ces deux fonctions REMPLACENT les anciennes versions si elles
// étaient dispersées. Elles centralisent toute la logique
// portrait/paysage pour les fonctions ci-dessus.
// ============================================================

// Écrit un pixel dans le buffer e-ink natif (EPD_W × EPD_H, MSB-first).
// Convention : COLORED = bit à 0 (noir), UNCOLORED = bit à 1 (blanc).
// Note : cette version REMPLACE la version dupliquée dans le sketch.
// Si vous avez déjà einkSetPixelRaw() définie ailleurs, supprimez-la
// et gardez uniquement celle-ci.

uint8_t einkRenderBuffer[EINK_BUF_FULL];



static void einkSetPixelOriented(uint8_t* buf, int x, int y, uint8_t color) {
  if (!buf) return;

  // Projection selon orientation
  int px, py;
  if (!einkLandscape) {
    // Portrait : repère logique = repère physique
    px = x;
    py = y;
  } else {
    // Paysage : rotation 90° CW
    // repère logique (x,y) avec visibleW=EPD_H, visibleH=EPD_W
    // → physique : px = EPD_W-1-y, py = x
    px = EPD_W - 1 - y;
    py = x;
  }

  if (px < 0 || px >= EPD_W || py < 0 || py >= EPD_H) return;

  // Format buffer : MSB first, bit7 = pixel x=0 dans l'octet
  int byteIdx = py * WIDTH_BYTES + px / 8;
  int bitPos  = 7 - (px % 8);

  if (color == COLORED)    buf[byteIdx] &= ~(1 << bitPos);   // bit à 0 = noir
  else                     buf[byteIdx] |=  (1 << bitPos);   // bit à 1 = blanc
}

// Remplit un rectangle dans le repère logique orienté.
static void einkFillRectOriented(uint8_t* buf, int x, int y, int w, int h, uint8_t color) {
  for (int yy = 0; yy < h; yy++) {
    for (int xx = 0; xx < w; xx++) {
      einkSetPixelOriented(buf, x + xx, y + yy, color);
    }
  }
}


// ============================================================
// PIPELINE OLED — header scrollant permanent
// Variables utilisées : pendingAuthor, pendingArtistName,
//   pendingTimestamp, lastRendered, animRunning, display
// ============================================================

// Retourne l'offset de scroll courant pour le texte du header OLED.
// Avance automatiquement toutes les 180ms si le texte dépasse 128px.
int headerScrollOffset() {
  static unsigned long lastStep = 0;
  static int           offset   = 0;

  // Phase 10s : artiste | timestamp | nom de l'oeuvre
  unsigned long phase = (millis() / 10000UL) % 3UL;
  String line;
  if      (phase == 0) line = pendingArtistName;
  else if (phase == 1) line = pendingTimestamp;
  else                 line = pendingAuthor;

  int textPx = line.length() * 6;   // font 6px wide

  if (textPx <= SCREEN_WIDTH) {
    offset = 0;
    return 0;
  }

  unsigned long now = millis();
  if (now - lastStep > 180) {
    lastStep = now;
    offset++;
    int loopWidth = textPx + 24;     // gap entre deux répétitions
    if (offset >= loopWidth) offset = 0;
  }
  return offset;
}

// Dessine la barre header en haut de l'OLED (ligne 0, hauteur 8px).
// Texte en blanc sur fond noir. Scroll automatique si trop long.
// Dessine un char dans le buffer OLED (page/bit) via la police bitmap
static void oledDrawChar(int cx, int cy, char c) {
  if (c < 32 || c > 126) c = '?';
  int idx = c - 32;
  for (int col = 0; col < 5; col++) {
    uint8_t colData = pgm_read_byte(&FONT5x7[idx][col]);
    for (int row = 0; row < 7; row++) {
      if (!(colData & (1 << row))) continue;
      int px = cx + col;
      int py = cy + row;
      if (px < 0 || px >= 128 || py < 0 || py >= 64) continue;
      display.drawPixel(px, py, SSD1306_WHITE);
    }
  }
}

// Dessine une string dans le buffer OLED (ne fait PAS display.display())
static void oledDrawString(int x, int y, const String& s, int maxW = 128) {
  int cx = x;
  for (size_t i = 0; i < s.length(); i++) {
    if (cx + 5 > x + maxW) break;
    oledDrawChar(cx, y, s[i]);
    cx += 6; // 5px char + 1px espace
  }
}


void drawHeaderBar() {
  // Effacer la ligne 0 (8 premiers pixels en hauteur)
  for (int x = 0; x < 128; x++)
    for (int y = 0; y < 8; y++)
      display.drawPixel(x, y, SSD1306_BLACK);

  // Construire la ligne complète : artiste | oeuvre | timestamp
  String line = "";
  if (pendingArtistName.length()) line += pendingArtistName;
  if (pendingAuthor.length()) {
    if (line.length()) line += "  |  ";
    line += pendingAuthor;
  }
  if (pendingTimestamp.length()) {
    if (line.length()) line += "  |  ";
    line += pendingTimestamp;
  }
  if (!line.length()) return;

  // Ajouter un séparateur de boucle pour le scroll continu
  line += "    ";

  int textPx = line.length() * 6;

  static int offset = 0;
  static unsigned long lastStep = 0;
  unsigned long now = millis();

  if (textPx > 128) {
    if (now - lastStep > 150) {
      lastStep = now;
      offset++;
      if (offset >= textPx) offset = 0;
    }
    // Dessiner avec répétition pour le scroll infini
    int x = -offset;
    while (x < 128) {
      oledDrawString(x, 0, line, 128 + offset);
      x += textPx;
    }
  } else {
    offset = 0;
    oledDrawString(0, 0, line, 128);
  }
}



// Rotation 90° CCW du buffer OLED pour mode portrait physique
// src : buffer 128×64 (paysage logique)
// L'OLED reste 128×64 physique, on réorganise les pixels
static void renderBufferRotated(const uint8_t* src) {
  // Rotation 90° CCW : pixel source (sx, sy) → destination (sy, 127-sx)
  // Dans l'espace 128×64 : le résultat est compressé mais l'image est tournée
  // On remplit un buffer temporaire puis on l'affiche
  display.clearDisplay();
  for (int sy = 0; sy < 64; sy++) {
    for (int sx = 0; sx < 128; sx++) {
      int page = sy / 8, bit = sy % 8;
      if (!(src[page * 128 + sx] & (1 << bit))) continue;
      // CCW : dx = 63-sy (scaled to fit), dy = sx/2 (scaled to fit 128→64)
      // Pour garder le ratio on scale : x source [0..127] → y dest [0..63]
      //                                  y source [0..63]  → x dest [0..127]
      // Donc : dx = sy * 2, dy = 63 - sx/2  (scale pour remplir l'écran)
      int dx = sy * 2;
      int dy = 63 - sx / 2;
      if (dx >= 0 && dx < 128 && dy >= 0 && dy < 64)
        display.drawPixel(dx, dy, SSD1306_WHITE);
    }
  }
}

void renderBufferWithHeader(const uint8_t* buf) {
  if (!buf) return;
  display.clearDisplay();

  for (int page = 0; page < 8; page++) {
    for (int x = 0; x < 128; x++) {
      uint8_t b = buf[page * 128 + x];
      for (int bit = 0; bit < 8; bit++) {
        if (b & (1 << bit))
          display.drawPixel(x, page * 8 + bit, SSD1306_WHITE);
      }
    }
  }

  // Header par-dessus si des métadonnées sont disponibles
  if (pendingAuthor.length() || pendingTimestamp.length() || pendingArtistName.length()) {
    drawHeaderBar();
  }

  display.display();
}



void tickStillHeader() {
  static unsigned long lastRefresh = 0;
  if (animRunning) return;
  if (!pendingAuthor.length() && !pendingTimestamp.length() && !pendingArtistName.length()) return;
  unsigned long now = millis();
  if (now - lastRefresh > 200) {
    lastRefresh = now;
    renderBufferWithHeader(lastRendered);
  }
}


// ============================================================
// PIPELINE E-INK — header fixe (pas de scroll)
// Variables utilisées : pendingEinkAuthor, pendingEinkArtistName,
//   pendingEinkTimestamp, einkLandscape, renderCacheValid,
//   EPD_W, EPD_H, WIDTH_BYTES, EINK_BUF_FULL, EINKHEADERH,
//   SCREEN_WIDTH, SCREEN_HEIGHT, display, epd
// ============================================================

// Construit la ligne de texte du header e-ink à partir des pending.
String buildEinkHeaderLine() {
  String work   = pendingEinkAuthor.length()     ? pendingEinkAuthor     : "Sans titre";
  String artist = pendingEinkArtistName.length() ? pendingEinkArtistName : "Anonyme";
  String stamp  = pendingEinkTimestamp.length()  ? pendingEinkTimestamp  : "";

  String line = work + " | " + artist;
  if (stamp.length()) line += " | " + stamp;
  return line;
}

// Rasterise une ligne de texte dans le buffer e-ink en passant
// par l'OLED comme moteur de rendu texte 1-bit.
// x, y = position dans le repère logique (avant projection orientation).
// black = true → pixels noirs (COLORED), false → pixels blancs (UNCOLORED)
static void einkDrawTextLineToBuffer(uint8_t* buf, const String& text, int x, int y, bool black) {
  if (!buf || !text.length()) return;
  uint8_t color = black ? COLORED : UNCOLORED;
  int cx = x;
  for (size_t i = 0; i < text.length(); i++) {
    char c = text[i];
    if (c < 32 || c > 126) c = ' ';
    int idx = (uint8_t)c - 32;
    for (int col = 0; col < 5; col++) {
      uint8_t colData = pgm_read_byte(&FONT5x7[idx][col]);
      for (int row = 0; row < 7; row++) {
        if (!(colData & (1 << row))) continue;
        einkSetPixelOriented(buf, cx + col, y + row, color);
      }
    }
    cx += 6;
  }
}

static void einkSetPixelRaw(uint8_t* buf, int px, int py, uint8_t color) {
  if (!buf || px < 0 || px >= EPD_W || py < 0 || py >= EPD_H) return;
  int byteIdx = py * WIDTH_BYTES + px / 8;
  int bitPos  = 7 - (px % 8);
  if (color == COLORED) buf[byteIdx] &= ~(1 << bitPos);
  else                  buf[byteIdx] |=  (1 << bitPos);
}

static void einkDrawStringRaw(uint8_t* buf, int x, int y, const String& s, int maxW) {
  int cx = x;
  for (size_t i = 0; i < s.length() && cx + 5 < x + maxW; i++) {
    char c = s[i];
    if (c < 32 || c > 126) c = '?';
    int idx = c - 32;
    for (int col = 0; col < 5; col++) {
      uint8_t colData = pgm_read_byte(&FONT5x7[idx][col]);
      for (int row = 0; row < 7; row++) {
        if (colData & (1 << row))
          einkSetPixelRaw(buf, cx + col, y + row, COLORED);
      }
    }
    cx += 6;
  }
}

void drawEinkHeaderBar(uint8_t* buf) {
  if (!buf) return;

  // Le buffer reçu est TOUJOURS 176(W)×264(H) physique MSB-first
  // Le JS a déjà appliqué la rotation dans buildEinkStillBufferFromOledBuf()
  // On écrit le cartel en coordonnées physiques brutes

  const int W = EPD_W;   // 176
  const int H = EPD_H;   // 264
  const int HEADER_H = 16;
  const int FOOTER_H = 22;

  // ── Bande haute : timestamp ──────────────────────────────────
  for (int py = 0; py < HEADER_H; py++)
    for (int px = 0; px < W; px++)
      einkSetPixelRaw(buf, px, py, UNCOLORED);
  for (int px = 0; px < W; px++)
    einkSetPixelRaw(buf, px, HEADER_H - 1, COLORED);

  if (pendingEinkTimestamp.length()) {
    String ts = pendingEinkTimestamp.substring(0, (W - 4) / 6);
    einkDrawStringRaw(buf, 2, 4, ts, W - 4);
  }

  // ── Bande basse : artiste + œuvre ────────────────────────────
  int footerY = H - FOOTER_H;
  for (int py = footerY; py < H; py++)
    for (int px = 0; px < W; px++)
      einkSetPixelRaw(buf, px, py, UNCOLORED);
  for (int px = 0; px < W; px++)
    einkSetPixelRaw(buf, px, footerY, COLORED);

  if (pendingEinkArtistName.length()) {
    String art = pendingEinkArtistName.substring(0, (W - 4) / 6);
    einkDrawStringRaw(buf, 2, footerY + 2, art, W - 4);
  }
  if (pendingEinkAuthor.length()) {
    String oe = pendingEinkAuthor.substring(0, (W - 4) / 6);
    einkDrawStringRaw(buf, 2, footerY + 12, oe, W - 4);
  }
}

// Compose le buffer e-ink final (5808 octets) à partir du buffer OLED 1024 octets.
// Place l'image dans la zone sous le header, gère l'orientation.
// dst doit pointer sur EINK_BUF_FULL octets déjà alloués.


// Compose le buffer e-ink final (5808 octets) à partir du buffer OLED 1024 octets.
// Place l'image dans la zone sous le header, gère l'orientation.
// dst doit pointer sur EINK_BUF_FULL octets déjà alloués.
void buildEinkStillBufferFromOledBuf(const uint8_t* src1024, uint8_t* dst) {
  if (!src1024 || !dst) return;

  // 1. Blanc partout (UNCOLORED = 0xFF)
  memset(dst, 0xFF, EINK_BUF_FULL);

  // 2. Dimensions logiques selon orientation
  int visibleW = einkLandscape ? EPD_H : EPD_W;   // largeur logique
  int visibleH = einkLandscape ? EPD_W : EPD_H;   // hauteur logique

  int contentY = EINKHEADERH;
  int contentH = visibleH - EINKHEADERH;

  // 3. Scale OLED (128×64) → zone contenu en préservant le ratio
  float scaleX = (float)visibleW  / (float)SCREEN_WIDTH;
  float scaleY = (float)contentH  / (float)SCREEN_HEIGHT;
  float scale  = (scaleX < scaleY) ? scaleX : scaleY;

  int drawW   = (int)(SCREEN_WIDTH  * scale + 0.5f);
  int drawH   = (int)(SCREEN_HEIGHT * scale + 0.5f);
  int offsetX = (visibleW - drawW) / 2;
  int offsetY = contentY + (contentH - drawH) / 2;

  // 4. Copier les pixels OLED dans dst via repère orienté
  for (int dy = 0; dy < drawH; dy++) {
    for (int dx = 0; dx < drawW; dx++) {
      // Pixel source dans le buffer OLED (format page/bit)
      int sx   = dx * SCREEN_WIDTH  / drawW;
      int sy   = dy * SCREEN_HEIGHT / drawH;
      int page = sy / 8;
      int bit  = sy % 8;
      bool on  = (src1024[page * SCREEN_WIDTH + sx] & (1 << bit)) != 0;

      einkSetPixelOriented(dst, offsetX + dx, offsetY + dy, on ? COLORED : UNCOLORED);
    }
  }

  // 5. Header par-dessus (fond blanc + texte noir + séparateur)
  drawEinkHeaderBar(dst);
}



// Envoie un buffer e-ink déjà composé (EINK_BUF_FULL octets) à l'écran.
// Gère init → Display → Sleep.
void renderEinkBuffer(const uint8_t* buf) {
  if (!buf) return;

  Serial.printf("[EINK] renderEinkBuffer %d octets\n", EINK_BUF_FULL);

  if (epd.Init() != 0) {
    Serial.println(F("[EINK] Init FAILED"));
    return;
  }
  delay(100);
  epd.Display(buf);
  epd.Sleep();

  Serial.println(F("[EINK] Refresh OK"));
}

// Point d'entrée principal e-ink : compose le buffer depuis le buffer OLED
// (avec header) puis envoie à l'écran. Met renderCacheValid à true.
void renderEinkBufferWithHeader(const uint8_t* src1024) {
  if (!src1024) return;

  buildEinkStillBufferFromOledBuf(src1024, einkRenderBuffer);
  renderEinkBuffer(einkRenderBuffer);
  renderCacheValid = true;
}

// Appelé dans loop() pour rafraîchir l'e-ink si nécessaire.
// Refresh lent (15s) car l'e-ink est statique.
// src1024 = lastRendered ou buffer courant.
void tickEinkStillHeader(const uint8_t* src1024) {
  static unsigned long lastRefresh = 0;

  if (!src1024) return;

  // Pas de refresh si aucune métadonnée à afficher
  if (!pendingEinkAuthor.length() &&
      !pendingEinkTimestamp.length() &&
      !pendingEinkArtistName.length()) return;

  unsigned long now = millis();
  if (!renderCacheValid || now - lastRefresh > 15000) {
    lastRefresh = now;
    renderEinkBufferWithHeader(src1024);
  }
}

void recoverOledAfterEink() {
  Serial.println(F("OLED recover after EINK..."));
  Wire.begin(OLED_SDA, OLED_SCL);
  delay(30);
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    delay(100);
    Wire.begin(OLED_SDA, OLED_SCL);
    delay(30);
    if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
      Serial.println(F("OLED reinit FAILED"));
      return;
    }
  }
  delay(20);
  renderBufferWithHeader(lastRendered);
  Serial.println(F("OLED recovered with header"));
}


bool writeGallerySlotJson(int slot,
                          const uint8_t* buf,
                          const String& uid,
                          const String& artworkName,
                          const String& artistName,
                          const String& stamp,
                          bool forSale,
                          const String& ethAddress,
                          const String& type,
                          const String& mode) {
  if (slot < 0 || slot >= GALLERY_SIZE) return false;
  File f = LittleFS.open(galleryJsonPath(slot), "w");
  if (!f) return false;

  f.print(F("{\"slot\":"));
  f.print(slot);

  f.print(F(",\"uid\":\""));
  f.print(jsonEscape(uid));
  f.print(F("\""));

  f.print(F(",\"type\":\""));
  f.print(jsonEscape(type));
  f.print(F("\""));

  f.print(F(",\"mode\":\""));
  f.print(jsonEscape(mode));
  f.print(F("\""));

  f.print(F(",\"name\":\""));
  f.print(jsonEscape(artworkName));
  f.print(F("\""));

  f.print(F(",\"artist\":\""));
  f.print(jsonEscape(artistName));
  f.print(F("\""));

  f.print(F(",\"timestamp\":\""));
  f.print(jsonEscape(stamp));
  f.print(F("\""));

  f.print(F(",\"forSale\":"));
  f.print(forSale ? F("true") : F("false"));

  f.print(F(",\"ethAddress\":\""));
  f.print(jsonEscape(ethAddress));
  f.print(F("\""));

  f.print(F(",\"width\":128,\"height\":64,\"data\":["));
  for (int i = 0; i < 1024; i++) {
    f.print(buf[i]);
    if (i < 1023) f.print(',');
    if ((i & 63) == 0) yield();
  }
  f.print(F("]}"));
  f.close();

  logGalleryMeta("writeGallerySlotJson",
                 slot, uid, type, mode, artworkName, artistName, stamp, forSale, ethAddress);
  return true;
}


bool saveGifToGallery(AnimFrame frames[], int count, const String& author, const String& stamp) {
  String artworkName = author.length() ? author.substring(0, 20) : F("Anonyme");
  String artistName  = pendingArtistName.length() ? pendingArtistName.substring(0, 20) : artworkName;
  String ts          = stamp.length() ? stamp.substring(0, 23) : String(millis());

  String uid = pendingUid.length() ? pendingUid : makeUid("gif", "still", artistName, artworkName, ts);

  int slot = galleryIndex.head;

  logGalleryMeta("saveGifToGallery BEFORE WRITE",
                 slot, uid, "gif", "still", artworkName, artistName, ts, pendingForSale, pendingEthAddress);

  if (!writeGalleryGifJson(slot, frames, count, uid, artworkName, artistName, ts,
                           pendingForSale, pendingEthAddress, "still")) {
    return false;
  }

  galleryIndex.head = (galleryIndex.head + 1) % GALLERY_SIZE;
  if (galleryIndex.count < GALLERY_SIZE) galleryIndex.count++;
  saveGalleryIndex();

  pendingEthAddress = "";
  pendingForSale = false;
  pendingUid = "";
  pendingType = "still";
  pendingMode = "still";
  return true;
}

bool readGallerySlotMeta(int slot,
                         String& name,
                         String& artist,
                         String& timestamp,
                         String* uid = nullptr,
                         String* type = nullptr,
                         String* mode = nullptr,
                         bool* forSale = nullptr,
                         String* ethAddress = nullptr,
                         String* origin = nullptr) {
  if (slot < 0 || slot >= GALLERY_SIZE) return false;

  String path = galleryJsonPath(slot);
  if (!LittleFS.exists(path)) return false;

  File f = LittleFS.open(path, "r");
  if (!f) return false;

  String s = f.readString();
  f.close();

  auto extractString = [&](const String& key) -> String {
    String pattern = "\"" + key + "\":\"";
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
    val.replace("\\n", "\n");
    val.replace("\\r", "\r");
    val.replace("\\t", "\t");
    return val;
  };

  auto extractBool = [&](const String& key, bool fallback = false) -> bool {
    String pattern = "\"" + key + "\":";
    int p = s.indexOf(pattern);
    if (p < 0) return fallback;
    p += pattern.length();
    while (p < (int)s.length() && (s[p] == ' ' || s[p] == '\t')) p++;
    if (s.startsWith("true", p)) return true;
    if (s.startsWith("false", p)) return false;
    return fallback;
  };

  String localName = extractString("name");
  if (!localName.length()) localName = extractString("artworkName");

  String localArtist = extractString("artist");
  if (!localArtist.length()) localArtist = extractString("artistName");

  String localTimestamp = extractString("timestamp");
  if (!localTimestamp.length()) localTimestamp = extractString("createdAt");

  String localUid = extractString("uid");
  String localType = extractString("type");
  String localMode = extractString("mode");
  String localEth  = extractString("ethAddress");
  String localOrigin = extractString("origin");
  bool localForSale = extractBool("forSale", localEth.length() > 0);

  if (!localMode.length()) localMode = "still";

  name = localName;
  artist = localArtist;
  timestamp = localTimestamp;

  if (uid) *uid = localUid;
  if (type) *type = localType;
  if (mode) *mode = localMode;
  if (forSale) *forSale = localForSale;
  if (ethAddress) *ethAddress = localEth;
  if (origin) *origin = localOrigin;

  Serial.print(F("[READ META] slot=")); Serial.println(slot);
  logGalleryMeta("readGallerySlotMeta",
                 slot,
                 localUid,
                 localType,
                 localMode,
                 localName,
                 localArtist,
                 localTimestamp,
                 localForSale,
                 localEth);

  return localName.length() || localArtist.length() || localTimestamp.length() || localType.length();
}

void initAccelerometer() {
  Wire.beginTransmission(ADXL345_ADDR);
  Wire.write(ADXL345_POWER);
  Wire.write(0x08); // mesure active
  if (Wire.endTransmission() != 0) {
    Serial.println(F("[ADXL345] non détecté — vérifier câblage D1/D2"));
    return;
  }
  // Plage ±2g, résolution complète
  Wire.beginTransmission(ADXL345_ADDR);
  Wire.write(0x31); // DATA_FORMAT
  Wire.write(0x08); // full resolution, ±2g
  Wire.endTransmission();
  Serial.println(F("[ADXL345] initialisé OK"));
}

void updateAccelerometer() {
  Wire.beginTransmission(ADXL345_ADDR);
  Wire.write(ADXL345_DATA);
  if (Wire.endTransmission(false) != 0) return;

  Wire.requestFrom(ADXL345_ADDR, 6);
  if (Wire.available() < 6) return;

  int16_t rx = Wire.read() | (Wire.read() << 8);
  int16_t ry = Wire.read() | (Wire.read() << 8);
  int16_t rz = Wire.read() | (Wire.read() << 8);

  const float SCALE = 0.0039f; // ±2g, full res
  accelX = rx * SCALE;
  accelY = ry * SCALE;
  accelZ = rz * SCALE;

  // Orientation simple par rapport à la gravité
  float ax = abs(accelX), ay = abs(accelY), az = abs(accelZ);
  if (az > 0.85f && az > ax && az > ay) {
    currentOrientation = (accelZ > 0) ? "plat" : "renverse";
  } else if (ay > ax && ay > az) {
    currentOrientation = (accelY > 0) ? "portrait" : "portrait-retourne";
  } else {
    currentOrientation = (accelX > 0) ? "paysage" : "paysage-retourne";
  }
}

String getOrientation() {
  return currentOrientation;
}




// ══════════════════════════════════════════════════════════════
//  ARDUINO
// ══════════════════════════════════════════════════════════════
void setup() {
  Serial.begin(115200);
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("OLED FAIL"); while (1);
  }

  // =====================================================
  // LIVEBOX (MAISON) - IP FIXE
  // =====================================================

  const char* ssid = "Livebox-4CF0";
  const char* password = "6jhVfMstXQTAx9TWb9";

  IPAddress local_IP(192, 168, 1, 16);
  IPAddress gateway(192, 168, 1, 1);
  IPAddress subnet(255, 255, 255, 0);
  IPAddress primaryDNS(1, 1, 1, 1);
  IPAddress secondaryDNS(8, 8, 8, 8);

  WiFi.config(local_IP, gateway, subnet, primaryDNS, secondaryDNS);
  WiFi.begin(ssid, password);
  Serial.println("MODE LIVEBOX - 192.168.1.16:5058");


  // =====================================================
  // MOBILE HOTSPOT - IP AUTO (DHCP)
  // =====================================================
  /*
  const char* ssid = "AndroidF";
  const char* password = "Lincoln55";

  WiFi.begin(ssid, password);
  Serial.println("MODE MOBILE - IP auto dans Serial...");
  */
  // =====================================================

  Serial.print("Connexion ");
  Serial.print(ssid);
  Serial.print("...");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500); Serial.print("."); yield();
  }

  Serial.println("\\n✓ IP = " + WiFi.localIP().toString());
  Serial.println("Page: http://" + WiFi.localIP().toString() + ":5058");

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


  // ── e-ink SPI ────────────────────────────────────────────────────

// SPI doit être démarré AVANT epd.Init()
  SPI.begin();

  // GPIO0 = BUSY : INPUT seulement, jamais OUTPUT
  pinMode(BUSY_PIN, INPUT);
pinMode(OLED_SDA, INPUT_PULLUP);  // I2C SDA avec pullup interne
pinMode(OLED_SCL, INPUT_PULLUP);  // I2C SCL avec pullup interne

  initEink();

  // Wire pour OLED + ADXL345
    // ── I2C bus (OLED + ADXL345 partagent D1/D2) ────────────────────


// Wire pour OLED + ADXL345 - I2C sur D6/D4 (libre !)
Wire.begin(OLED_SDA, OLED_SCL);  // NOUVEAU : pins custom
if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
  Serial.println(F("OLED FAIL"));
  while(1);
}

  initAccelerometer();

  Serial.println(F("[e-ink] OK"));
  server.begin();
  Serial.println("Serveur 5058 OK");
}
bool serveLittleFSFile(WiFiClient& client, const char* path, const char* contentType) {
  Serial.printf("[LFS] open %s\n", path);
  File file = LittleFS.open(path, "r");
  if (!file) {
    Serial.println("[LFS] open failed");
    return false;
  }

  size_t size = file.size();
  Serial.printf("[LFS] size=%u\n", (unsigned)size);

  client.println("HTTP/1.1 200 OK");
  client.print("Content-Type: ");
  client.println(contentType);
  client.print("Content-Length: ");
  client.println(size);                      // ✅ FIX CRITIQUE
  client.println("Cache-Control: public, max-age=86400");
  client.println("Connection: close");
  client.println();

  uint8_t buf[512];
  while (file.available()) {
    size_t len = file.read(buf, sizeof(buf));
    client.write(buf, len);                  // ✅ OK
  }

  file.close();
  return true;
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
  // Mettre à jour lastRendered pour que tickStillHeader puisse aussi l'utiliser
  memcpy(lastRendered, animFrames[animCurFrame].buf, 1024);
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

String getQueryParam(const String& req, const String& key) {
  int q = req.indexOf('?');
  if (q < 0) return "";

  int h = req.indexOf(" HTTP/");
  if (h < 0) h = req.length();

  String qs = req.substring(q + 1, h);
  String needle = key + "=";
  int p = qs.indexOf(needle);
  if (p < 0) return "";

  int start = p + needle.length();
  int amp = qs.indexOf('&', start);
  if (amp < 0) amp = qs.length();

  return urlDecode(qs.substring(start, amp));
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

String name, artist, timestamp, uid, type, mode, ethAddress, origin;
bool forSale = false;

if (!readGallerySlotMeta(slot, name, artist, timestamp, &uid, &type, &mode, &forSale, &ethAddress, &origin)) {
  Serial.print(F("[GALLERY] meta read FAILED slot="));
  Serial.println(slot);
  continue;
}

if (!first) body += ",";
first = false;

body += "{\"slot\":";
body += String(slot);

body += ",\"uid\":\"";
body += jsonEscape(uid);
body += "\"";

body += ",\"type\":\"";
body += jsonEscape(type);
body += "\"";

body += ",\"mode\":\"";
body += jsonEscape(mode);
body += "\"";

body += ",\"name\":\"";
body += jsonEscape(name);
body += "\"";

body += ",\"artist\":\"";
body += jsonEscape(artist);
body += "\"";

body += ",\"timestamp\":\"";
body += jsonEscape(timestamp);
body += "\"";

body += ",\"forSale\":";
body += forSale ? "true" : "false";

body += ",\"ethAddress\":\"";
body += jsonEscape(ethAddress);
body += "\"";

body += "}";
validCount++;

    Serial.print(F("[GALLERY] meta OK slot="));
    Serial.print(slot);
    Serial.print(F(" name='"));
    Serial.print(name);
    Serial.print(F("' artist='"));
    Serial.print(artist);
    Serial.print(F("' timestamp='"));
    Serial.print(timestamp);
    Serial.println(F("'"));


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
  String artworkName = pendingAuthor.length() ? pendingAuthor : F("Anonyme");
  String artistName  = pendingArtistName.length() ? pendingArtistName : F("Anonyme");
  String stamp       = pendingTimestamp.length() ? pendingTimestamp : String(millis());

  artworkName = artworkName.substring(0, 20);
  artistName  = artistName.substring(0, 20);
  stamp       = stamp.substring(0, 23);

  String type = pendingType.length() ? pendingType : F("still");
  String mode = pendingMode.length() ? pendingMode : F("still");
  String uid  = pendingUid.length() ? pendingUid : makeUid(type, mode, artistName, artworkName, stamp);

  int slot = galleryIndex.head;

  logGalleryMeta("saveToGallery BEFORE WRITE",
                 slot, uid, type, mode, artworkName, artistName, stamp, pendingForSale, pendingEthAddress);

  if (!writeGallerySlotJson(slot, buf, uid, artworkName, artistName, stamp,
                            pendingForSale, pendingEthAddress, type, mode)) {
    Serial.println(F("[ERR] Gallery JSON write failed"));
    return;
  }

  galleryIndex.head = (galleryIndex.head + 1) % GALLERY_SIZE;
  if (galleryIndex.count < GALLERY_SIZE) galleryIndex.count++;

  if (!saveGalleryIndex()) {
    Serial.println(F("[ERR] Gallery index JSON save failed"));
  }

  Serial.print(F("[OK] Gallery saved slot="));
  Serial.print(slot);
  Serial.print(F(" count="));
  Serial.println(galleryIndex.count);

  pendingAuthor = "";
  pendingTimestamp = "";
  pendingArtistName = "";
  pendingEthAddress = "";
  pendingForSale = false;
  pendingUid = "";
  pendingType = "still";
  pendingMode = "still";
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

bool hasJsonKey(const String& json, const String& key) {
  String pat = "\"" + key + "\":";
  return json.indexOf(pat) >= 0;
}





// ═══════════════════════════════════════════════════════════════
//  RELAY NOTIFY DISCORD — version streaming, zéro grande String
//  Principe : on construit le JSON final par morceaux et on les
//  envoie directement via HTTPClient.POST() sur un stream.
//  Cela évite d'avoir body_entrant + finalPayload en RAM en même temps.
// ═══════════════════════════════════════════════════════════════

// Helper : extraire une valeur scalaire string depuis un JSON brut
static String espExtractStr(const String& body, const char* key) {
  String pat = String("\"") + key + "\":\"";
  int p = body.indexOf(pat);
  if (p < 0) return "";
  p += pat.length();
  int e = p;
  while (e < (int)body.length()) {
    if (body[e] == '"' && body[e-1] != '\\') break;
    e++;
  }
  return body.substring(p, e);
}

static bool espExtractBool(const String& body, const char* key) {
  String pat = String("\"") + key + "\":";
  int p = body.indexOf(pat);
  if (p < 0) return false;
  p += pat.length();
  while (p < (int)body.length() && body[p] == ' ') p++;
  return body.indexOf("true", p) == p;
}

// Escape JSON minimal (en place, petite String seulement)
static String espJsonEsc(String s) {
  s.replace("\\", "\\\\");
  s.replace("\"", "\\\"");
  s.replace("\n", "\\n");
  s.replace("\r", "\\r");
  return s;
}

// Convertir oledBufferCompact ["00","ff",...] → "[0,255,...]"
// Retourne "" si absent
static String buildOledBufferFromCompact(const String& body) {
  String key = "\"oledBufferCompact\":[";
  int cs = body.indexOf(key);
  if (cs < 0) return "[]";
  cs += key.length();
  int ce = body.indexOf(']', cs);
  if (ce <= cs) return "[]";

  String compact = body.substring(cs, ce);
  String result = "[";
  int i = 0;
  bool first = true;
  while (i < (int)compact.length()) {
    int q1 = compact.indexOf('"', i);
    if (q1 < 0) break;
    int q2 = compact.indexOf('"', q1 + 1);
    if (q2 < 0) break;
    String hex = compact.substring(q1 + 1, q2);
    uint8_t val = (uint8_t)strtoul(hex.c_str(), nullptr, 16);
    if (!first) result += ',';
    result += String(val);
    first = false;
    i = q2 + 1;
    yield();
  }
  result += "]";
  return result;
}

// Trouver le début et la fin du tableau framesCompact dans body
// Retourne {start, end} indices dans body, ou {-1,-1} si absent
static void findFramesCompact(const String& body, int& arrStart, int& arrEnd) {
  arrStart = -1; arrEnd = -1;
  String key = "\"framesCompact\":";
  int fcp = body.indexOf(key);
  if (fcp < 0) return;
  arrStart = body.indexOf('[', fcp + key.length());
  if (arrStart < 0) { arrStart = -1; return; }
  int depth = 0, pos = arrStart;
  while (pos < (int)body.length()) {
    char c = body[pos];
    if (c == '[' || c == '{') depth++;
    else if (c == ']' || c == '}') { depth--; if (depth == 0) { arrEnd = pos; return; } }
    pos++;
  }
  arrStart = -1; arrEnd = -1; // malformed
}
// ═══════════════════════════════════════════════════════════════
//  relayNotifyDiscord — version simplifiée pour l'ESP
//
//  Cette fonction n'est plus utilisée que pour les petits payloads
//  (profil, poésie fixe). Les animations/GIFs sont maintenant
//  envoyés DIRECTEMENT par le browser vers Vercel, sans passer
//  par l'ESP. Donc la limite RAM n'est plus un problème.
//
//  Conserver cette version simplifiée dans le .ino au cas où
//  le browser utiliserait encore /notify-discord pour fallback.
// ═══════════════════════════════════════════════════════════════

bool relayNotifyDiscord(String body, String& upstreamResponse, int& upstreamCode) {

  // Extraire champs scalaires (petites strings)
  auto extractStr = [&](const char* key) -> String {
    String pat = String("\"") + key + "\":\"";
    int p = body.indexOf(pat);
    if (p < 0) return "";
    p += pat.length();
    int e = p;
    while (e < (int)body.length()) {
      if (body[e] == '"' && body[e-1] != '\\') break;
      e++;
    }
    return body.substring(p, e);
  };

  auto extractBool = [&](const char* key) -> bool {
    String pat = String("\"") + key + "\":";
    int p = body.indexOf(pat);
    if (p < 0) return false;
    p += pat.length();
    return body.indexOf("true", p) == p;
  };

  auto esc = [](String s) -> String {
    s.replace("\\", "\\\\");
    s.replace("\"", "\\\"");
    s.replace("\n", "\\n");
    s.replace("\r", "\\r");
    return s;
  };

  // Convertir oledBufferCompact string hex → tableau JSON d'entiers
  // Format entrant: "oledBufferCompact":"00ff3a..." (2048 hex chars)
  // ou ancien format: "oledBufferCompact":["00","ff",...]
  String oledBufJson = "[]";
  {
    // Chercher format string (nouveau: "oledBufferCompact":"hex...")
    String strKey = "\"oledBufferCompact\":\"";
    int cs = body.indexOf(strKey);
    if (cs >= 0) {
      cs += strKey.length();
      int ce = body.indexOf('"', cs);
      if (ce > cs) {
        String hex = body.substring(cs, ce);
        if (hex.length() == 2048) {
          String out = "[";
          bool first = true;
          for (int i = 0; i < 2048; i += 2) {
            char h[3] = { hex[i], hex[i+1], 0 };
            uint8_t val = (uint8_t)strtoul(h, nullptr, 16);
            if (!first) out += ',';
            out += String(val);
            first = false;
            if ((i & 63) == 0) yield();
          }
          out += "]";
          oledBufJson = out;
        }
      }
    } else {
      // Ancien format tableau ["00","ff",...]
      String arrKey = "\"oledBufferCompact\":[";
      cs = body.indexOf(arrKey);
      if (cs >= 0) {
        cs += arrKey.length();
        int ce = body.indexOf(']', cs);
        if (ce > cs) {
          String compact = body.substring(cs, ce);
          String out = "[";
          int i = 0;
          bool first = true;
          while (i < (int)compact.length()) {
            int q1 = compact.indexOf('"', i);
            if (q1 < 0) break;
            int q2 = compact.indexOf('"', q1 + 1);
            if (q2 < 0) break;
            String hex = compact.substring(q1 + 1, q2);
            uint8_t val = (uint8_t)strtoul(hex.c_str(), nullptr, 16);
            if (!first) out += ',';
            out += String(val);
            first = false;
            i = q2 + 1;
            yield();
          }
          out += "]";
          oledBufJson = out;
        }
      }
    }
  }

  // Construire le payload final
  // NOTE: on ne reconstruit PAS framesCompact ici car les animations
  // passent directement browser→Vercel. Ce relay ne gère que les
  // petits payloads (profil, poésie fixe ~2KB max).
  String uid       = extractStr("uid");
  String type      = extractStr("type");
  String mode      = extractStr("mode");
  String name      = extractStr("name");
  String artist    = extractStr("artist");
  String timestamp = extractStr("timestamp");
  String ethAddr   = extractStr("ethAddress");
  String text      = extractStr("text");
  bool   forSale   = extractBool("forSale");

  String finalPayload = "{";
  finalPayload += "\"secret\":\"" + String(RESCOE_SYNC_SECRET) + "\"";
  finalPayload += ",\"uid\":\""        + esc(uid)       + "\"";
  finalPayload += ",\"type\":\""       + esc(type)      + "\"";
  finalPayload += ",\"mode\":\""       + esc(mode)      + "\"";
  finalPayload += ",\"name\":\""       + esc(name)      + "\"";
  finalPayload += ",\"artist\":\""     + esc(artist)    + "\"";
  finalPayload += ",\"timestamp\":\""  + esc(timestamp) + "\"";
  finalPayload += ",\"ethAddress\":\"" + esc(ethAddr)   + "\"";
finalPayload += String(",\"forSale\":") + (forSale ? "true" : "false");
  if (text.length()) finalPayload += ",\"text\":\"" + esc(text) + "\"";
  finalPayload += ",\"oledBuffer\":"   + oledBufJson;
  finalPayload += "}";


  Serial.print(F("[ESP relay] payload bytes: "));
  Serial.println(finalPayload.length());

  BearSSL::WiFiClientSecure secureClient;
  secureClient.setInsecure();
  secureClient.setBufferSizes(4096, 512);

  HTTPClient https;
  https.setReuse(false);
  https.setTimeout(20000);

  if (!https.begin(secureClient, RESCOE_SYNC_URL)) {
    upstreamResponse = "{\"ok\":false,\"error\":\"https_begin_failed\"}";
    upstreamCode = 500;
    return false;
  }

  https.addHeader("Content-Type", "application/json");
  int httpCode = https.POST(finalPayload);
  String response = https.getString();
  https.end();

  Serial.print(F("[ESP relay] HTTP: "));
  Serial.println(httpCode);
  Serial.println(response);

  upstreamCode = httpCode;
  upstreamResponse = response.length() ? response : "{\"ok\":false}";
  return httpCode >= 200 && httpCode < 300;
}


void handleNotifyDiscordRaw(WiFiClient& client, const String& requestLine) {
  int contentLength = -1;

  while (client.connected()) {
    String header = client.readStringUntil('\n');
    header.trim();
    if (!header.length()) break;

    Serial.print(F("[HDR] "));
    Serial.println(header);

    if (header.startsWith("Content-Length:")) {
      contentLength = header.substring(strlen("Content-Length:")).toInt();
    }
  }

if (contentLength <= 0 || contentLength > 65536) {
    const String responseBody = "{\"ok\":false,\"error\":\"invalid_content_length\"}";
    client.println(F("HTTP/1.1 400 Bad Request"));
    client.println(F("Content-Type: application/json"));
    client.println(F("Access-Control-Allow-Origin: *"));
    client.println(F("Connection: close"));
    client.print(F("Content-Length: "));
    client.println(responseBody.length());
    client.println();
    client.print(responseBody);
    drainAndClose(client);
    return;
  }

  String body;
  body.reserve(contentLength + 16);

  unsigned long start = millis();
while ((int)body.length() < contentLength && millis() - start < 15000) {
    while (client.available() && (int)body.length() < contentLength) {
      body += (char)client.read();
    }
    yield();
  }

  Serial.println(F("[ESP] Incoming /notify-discord"));
  Serial.print(F("[ESP] Content-Length: "));
  Serial.println(contentLength);
  Serial.print(F("[ESP] Body bytes read: "));
  Serial.println(body.length());
  Serial.print(F("[ESP] Body preview: "));
  Serial.println(body.substring(0, 200));

  if ((int)body.length() != contentLength) {
    const String responseBody = "{\"ok\":false,\"error\":\"incomplete_body\"}";
    client.println(F("HTTP/1.1 400 Bad Request"));
    client.println(F("Content-Type: application/json"));
    client.println(F("Access-Control-Allow-Origin: *"));
    client.println(F("Connection: close"));
    client.print(F("Content-Length: "));
    client.println(responseBody.length());
    client.println();
    client.print(responseBody);
    drainAndClose(client);
    return;
  }

  String upstreamResponse;
  int upstreamCode = 0;
  bool ok = relayNotifyDiscord(body, upstreamResponse, upstreamCode);

  String responseBody = upstreamResponse.length() ? upstreamResponse : String("{\"ok\":") + (ok ? "true" : "false") + "}";

  int statusCode = ok ? 200 : (upstreamCode > 0 ? upstreamCode : 502);

  client.print(F("HTTP/1.1 "));
  client.print(statusCode);
  client.println(statusCode == 200 ? F(" OK") : F(" Bad Gateway"));
  client.println(F("Content-Type: application/json"));
  client.println(F("Access-Control-Allow-Origin: *"));
  client.println(F("Connection: close"));
  client.print(F("Content-Length: "));
  client.println(responseBody.length());
  client.println();
  client.print(responseBody);

  delay(5);
  drainAndClose(client);
}



void loop() {
  tickAnim();
  tickStillHeader();

/*
  // ── Lecture accéléromètre toutes les 500ms ───────────────────────
  static unsigned long lastAccel = 0;
  if (millis() - lastAccel > 500) {
    lastAccel = millis();
    updateAccelerometer();
    Serial.printf("[ACCEL] X=%.2f Y=%.2f Z=%.2f → %s\n",
                  accelX, accelY, accelZ, currentOrientation.c_str());
  }
*/

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


if (req.startsWith("GET /logo.png")) { //apple-touch-icon
  Serial.println("[ROUTE] logo.png");
  bool ok = serveLittleFSFile(client, "/logo.png", "image/png");
  Serial.printf("[ROUTE] apple served=%d\n", ok);
  return;
}

if (req.indexOf("GET /favicon-32.png") >= 0) {
  Serial.println("[ROUTE] favicon-32.png");
  serveLittleFSFile(client, "/favicon-32.png", "image/png");
  return;
}

if (req.indexOf("GET /favicon.ico") >= 0) {
  Serial.println("[ROUTE] favicon.ico");
  serveLittleFSFile(client, "/favicon-32.png", "image/png"); // fallback
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

// APRÈS
freeAnimFrames();
memcpy(lastRendered, buf, 1024);

// Sauvegarder en galerie seulement si ?save=0 absent

if (req.indexOf("save=0") < 0) saveToGallery(lastRendered);
// Forcer re-render avec header (saveToGallery ne vide plus les pending)
renderBufferWithHeader(lastRendered);


    client.println(F("HTTP/1.1 200 OK"));
    client.println(F("Access-Control-Allow-Origin: *"));
    client.println(F("Connection: close"));
    client.println();
    drainAndClose(client);

    Serial.println(F("[DRAW] done"));
    return;
  }


// =========================
// POST /notify-discord → relay vers Vercel
// =========================

if (req.startsWith("POST /notify-discord")) {
  Serial.println(F("[ROUTE] POST /notify-discord"));
  handleNotifyDiscordRaw(client, req);
  delay(1);
  client.stop();
  return;
}


// =========================
// GET /orientation — état capteur
// =========================
if (req.startsWith("GET /orientation")) {
  while (client.connected()) {
    String line = client.readStringUntil('\n');
    line.trim();
    if (!line.length()) break;
  }

  // Lire l'accéléromètre
  updateAccelerometer();

  // Construire la réponse JSON
  String resp = "{";
  resp += "\"orientation\":\"" + currentOrientation + "\"";
  resp += ",\"landscape\":";
  resp += (currentOrientation.indexOf("paysage") >= 0) ? "true" : "false";
  resp += ",\"x\":" + String(accelX, 3);
  resp += ",\"y\":" + String(accelY, 3);
  resp += ",\"z\":" + String(accelZ, 3);
  resp += "}";

  client.println(F("HTTP/1.1 200 OK"));
  client.println(F("Content-Type: application/json"));
  client.println(F("Access-Control-Allow-Origin: *"));
  client.println(F("Cache-Control: no-store"));
  client.println(F("Connection: close"));
  client.print(F("Content-Length: "));
  client.println(resp.length());
  client.println();
  client.print(resp);
  drainAndClose(client);
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

    String name, artist, timestamp, uid, type, mode, ethAddress, origin;
    bool forSale = false;

    if (readGallerySlotMeta(slot, name, artist, timestamp,
                            &uid, &type, &mode, &forSale, &ethAddress, &origin)) {
      logGalleryMeta("sendGalleryItem summary",
                     slot, uid, type, mode, name, artist, timestamp, forSale, ethAddress);
    }

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
    String line = client.readStringUntil('\n');
    line.trim();
    if (!line.length()) break;
  }

pendingAuthor = getQueryParam(req, "n");
pendingAuthor = pendingAuthor.substring(0, 20);

pendingTimestamp = getQueryParam(req, "ts");
if (!pendingTimestamp.length()) {
  unsigned long sec = millis() / 1000;
  char tbuf[20];
  snprintf(tbuf, sizeof(tbuf), "%lus boot", sec);
  pendingTimestamp = String(tbuf);
}
pendingTimestamp = pendingTimestamp.substring(0, 23);

String artistName = getQueryParam(req, "a");
artistName = artistName.substring(0, 20);

String ethAddress = getQueryParam(req, "eth");
ethAddress = ethAddress.substring(0, 42);

pendingArtistName = artistName.length() ? artistName : pendingAuthor;
pendingEthAddress = ethAddress;
pendingForSale = pendingEthAddress.length() > 0;

// pour les envois standards via /username : œuvre fixe par défaut
pendingType = "still";
pendingMode = "still";
pendingUid = makeUid(pendingType, pendingMode, pendingArtistName, pendingAuthor, pendingTimestamp);

Serial.println(F("[ROUTE] /username"));
logGalleryMeta("pending from /username",
               -1,
               pendingUid,
               pendingType,
               pendingMode,
               pendingAuthor,
               pendingArtistName,
               pendingTimestamp,
               pendingForSale,
               pendingEthAddress);

  Serial.print(F("[USERNAME] artwork="));
  Serial.println(pendingAuthor);
  Serial.print(F("[USERNAME] artist="));
  Serial.println(pendingArtistName);
  Serial.print(F("[USERNAME] stamp="));
  Serial.println(pendingTimestamp);
  if (ethAddress.length()) {
    Serial.print(F("[USERNAME] eth="));
    Serial.println(ethAddress);
  }

  invalidateRenderCache();
  renderBufferWithHeader(lastRendered);

  client.println(F("HTTP/1.1 200 OK"));
  client.println(F("Access-Control-Allow-Origin: *"));
  client.println(F("Connection: close"));
  client.println();
  client.println(F("OK"));
  drainAndClose(client);
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


if (animRunning) renderBufferWithHeader(lastRendered);

bool saveToGalleryFlag = (req.indexOf("save=0") < 0);
if (saveToGalleryFlag) {
  saveGifToGallery(animFrames, animFrameCount, pendingAuthor, pendingTimestamp);
}


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
// POST /poetry — sauvegarde une poésie en galerie
// =========================
if (req.startsWith("POST /poetry")) {
  int contentLength = -1;

  while (client.connected()) {
    String line = client.readStringUntil('\n');
    line.trim();
    if (!line.length()) break;

    if (line.startsWith("Content-Length:")) {
      contentLength = line.substring(15).toInt();
    }
  }

  if (contentLength <= 0 || contentLength > 24576) {
    client.println(F("HTTP/1.1 400 Bad Request"));
    client.println(F("Access-Control-Allow-Origin: *"));
    client.println(F("Connection: close"));
    client.println();
    drainAndClose(client);
    return;
  }

  String body = "";
  unsigned long deadline = millis() + 5000;

  while ((int)body.length() < contentLength && millis() < deadline) {
    while (client.available() && (int)body.length() < contentLength) {
      body += (char)client.read();
    }
    yield();
  }

  if ((int)body.length() != contentLength) {
    client.println(F("HTTP/1.1 400 Bad Request"));
    client.println(F("Access-Control-Allow-Origin: *"));
    client.println(F("Connection: close"));
    client.println();
    drainAndClose(client);
    return;
  }

  auto hasJsonKeyLocal = [&](const String& json, const String& key) -> bool {
    String pat = "\"" + key + "\":";
    return json.indexOf(pat) >= 0;
  };

  auto extractJsonString = [&](const String& key) -> String {
    String pattern = "\"" + key + "\":\"";
    int p = body.indexOf(pattern);
    if (p < 0) return "";
    p += pattern.length();

    int e = p;
    while (e < (int)body.length()) {
      if (body[e] == '"' && (e == p || body[e - 1] != '\\')) break;
      e++;
    }

    String val = body.substring(p, e);
    val.replace("\\\"", "\"");
    val.replace("\\\\", "\\");
    val.replace("\\n", "\n");
    val.replace("\\r", "\r");
    val.replace("\\t", "\t");
    return val;
  };

  String artistName  = extractJsonString("artistName");
  String artworkName = extractJsonString("artworkName");
  String createdAt   = extractJsonString("createdAt");
  String type        = extractJsonString("type");
  String mode        = extractJsonString("mode");
  String uid         = extractJsonString("uid");
  String ethAddress  = extractJsonString("ethAddress");
  String origin      = extractJsonString("origin");

  if (!artistName.length())  artistName = "Anonyme";
  if (!artworkName.length()) artworkName = "Poeme";
  if (!createdAt.length())   createdAt   = String(millis());
  if (!type.length())        type        = "poetry";
  if (!mode.length())        mode        = "still";
  if (!origin.length())      origin      = "poetry";

  bool forSale = false;
  if (hasJsonKeyLocal(body, "forSale")) {
    forSale = (body.indexOf("\"forSale\":true") >= 0);
  } else {
    forSale = (ethAddress.length() > 0);
  }

  if (!uid.length()) {
    uid = makeUid(type, mode, artistName, artworkName, createdAt);
  }

  String normalized = body;

  if (!hasJsonKeyLocal(normalized, "uid")) {
    normalized.remove(normalized.length() - 1);
    normalized += ",\"uid\":\"" + jsonEscape(uid) + "\"}";
  }

  if (!hasJsonKeyLocal(normalized, "type")) {
    normalized.remove(normalized.length() - 1);
    normalized += ",\"type\":\"" + jsonEscape(type) + "\"}";
  }

  if (!hasJsonKeyLocal(normalized, "mode")) {
    normalized.remove(normalized.length() - 1);
    normalized += ",\"mode\":\"" + jsonEscape(mode) + "\"}";
  }

  if (!hasJsonKeyLocal(normalized, "forSale")) {
    normalized.remove(normalized.length() - 1);
    normalized += String(",\"forSale\":") + (forSale ? "true" : "false") + "}";
  }

  if (!hasJsonKeyLocal(normalized, "ethAddress")) {
    normalized.remove(normalized.length() - 1);
    normalized += ",\"ethAddress\":\"" + jsonEscape(ethAddress) + "\"}";
  }

  if (!hasJsonKeyLocal(normalized, "origin")) {
    normalized.remove(normalized.length() - 1);
    normalized += ",\"origin\":\"" + jsonEscape(origin) + "\"}";
  }

  Serial.println(F("[ROUTE] /poetry"));
  logGalleryMeta("incoming poetry",
                 galleryIndex.head,
                 uid,
                 type,
                 mode,
                 artworkName,
                 artistName,
                 createdAt,
                 forSale,
                 ethAddress);

  int slot = galleryIndex.head;
  String path = galleryJsonPath(slot);

  File f = LittleFS.open(path, "w");
  bool ok = false;
  size_t written = 0;

  if (f) {
    const int chunk = 128;
    for (int i = 0; i < (int)normalized.length(); i += chunk) {
      written += f.print(normalized.substring(i, min(i + chunk, (int)normalized.length())));
      yield();
    }
    f.close();
    ok = (written > 0);
  }

  if (ok) {
    Serial.println(F("[POETRY] saved normalized JSON"));

    logGalleryMeta("poetry saved",
                   slot,
                   uid,
                   type,
                   mode,
                   artworkName,
                   artistName,
                   createdAt,
                   forSale,
                   ethAddress);

    pendingAuthor     = artworkName.substring(0, 20);
    pendingArtistName = artistName.substring(0, 20);
    pendingTimestamp  = createdAt.substring(0, 23);
    pendingUid        = "";
    pendingType       = "still";
    pendingMode       = "still";
    pendingEthAddress = "";
    pendingForSale    = false;

    galleryIndex.head = (galleryIndex.head + 1) % GALLERY_SIZE;
    if (galleryIndex.count < GALLERY_SIZE) galleryIndex.count++;
    saveGalleryIndex();

    Serial.print(F("[POETRY] saved slot="));
    Serial.println(slot);
  }

  client.println(ok ? F("HTTP/1.1 200 OK") : F("HTTP/1.1 500 Internal Server Error"));
  client.println(F("Access-Control-Allow-Origin: *"));
  client.println(F("Connection: close"));
  client.println();
  client.println(ok ? F("OK") : F("ERR"));
  drainAndClose(client);
  return;
}


// =========================
// POST /E-ink — affichage sur ecran e-ink
// =========================
if (req.startsWith("GET /eink-username?")) {
  // Vider les headers HTTP
  while (client.connected()) {
    String line = client.readStringUntil('\n');
    line.trim();
    if (!line.length()) break;
  }

  // Extraire les paramètres
  pendingEinkAuthor      = urlDecode(getQueryParam(req, "n")).substring(0, 20);
  pendingEinkTimestamp   = urlDecode(getQueryParam(req, "ts")).substring(0, 23);
  pendingEinkArtistName  = urlDecode(getQueryParam(req, "a")).substring(0, 20);
  pendingEinkEthAddress  = urlDecode(getQueryParam(req, "eth")).substring(0, 42);
  pendingEinkForSale     = pendingEinkEthAddress.length() > 0;

  // Orientation
  String orient  = getQueryParam(req, "orient");
  einkLandscape  = (orient == "landscape");
  Serial.printf("EINK orient: %s | author: %s | artist: %s | ts: %s\n",
    einkLandscape ? "landscape" : "portrait",
    pendingEinkAuthor.c_str(),
    pendingEinkArtistName.c_str(),
    pendingEinkTimestamp.c_str()
  );

  // Timestamp fallback si vide
  if (!pendingEinkTimestamp.length()) {
    unsigned long sec = millis() / 1000;
    char tbuf[20];
    snprintf(tbuf, sizeof(tbuf), "%lus boot", sec);
    pendingEinkTimestamp = String(tbuf);
  }

  // Réponse HTTP
  client.println(F("HTTP/1.1 200 OK"));
  client.println(F("Access-Control-Allow-Origin: *"));
  client.println(F("Connection: close"));
  client.println();
  client.println(F("OK"));
  drainAndClose(client);
  return;
}




// =========================
// POST /E-ink — dessin sur ecran e-ink
// =========================
// Dans server.handleClient() — remplace le bloc POST /eink-draw
// ── POST /eink-draw ─────────────────────────────────────────────
if (req.startsWith("POST /eink-draw")) {
  int contentLength = -1;

  while (client.connected()) {
    String line = client.readStringUntil('\n');
    line.trim();
    if (!line.length()) break;
    if (line.startsWith("Content-Length:"))
      contentLength = line.substring(15).toInt();
  }

  Serial.printf("[EINK] /eink-draw Content-Length=%d (attendu %d)\n",
                contentLength, EINK_BUF_FULL);

  if (contentLength != EINK_BUF_FULL) {
    client.println(F("HTTP/1.1 400 Bad Request"));
    client.println(F("Access-Control-Allow-Origin: *"));
    client.println(F("Connection: close"));
    client.println();
    client.printf("ERR: attendu %d octets, recu %d\n", EINK_BUF_FULL, contentLength);
    drainAndClose(client);
    return;
  }

  uint8_t* buf = (uint8_t*)malloc(EINK_BUF_FULL);
  if (!buf) {
    client.println(F("HTTP/1.1 500 Internal Server Error"));
    client.println(F("Access-Control-Allow-Origin: *"));
    client.println(F("Connection: close"));
    client.println();
    client.println(F("ERR: malloc"));
    drainAndClose(client);
    return;
  }

  int total = 0;
  unsigned long deadline = millis() + 10000;
  while (total < EINK_BUF_FULL && millis() < deadline) {
    while (client.available() && total < EINK_BUF_FULL)
      buf[total++] = client.read();
    yield();
  }

  Serial.printf("[EINK] body lu = %d / %d\n", total, EINK_BUF_FULL);

  if (total != EINK_BUF_FULL) {
    free(buf);
    client.println(F("HTTP/1.1 400 Bad Request"));
    client.println(F("Access-Control-Allow-Origin: *"));
    client.println(F("Connection: close"));
    client.println();
    client.println(F("ERR: body incomplet"));
    drainAndClose(client);
    return;
  }

  // ── Ajouter le header bar dans le buffer e-ink reçu ──────────
  // Le buffer JS est déjà au bon format (MSB, 5808 octets)
  // On surcharge la zone header avec drawEinkHeaderBar()
  if (pendingEinkAuthor.length() || pendingEinkArtistName.length() || pendingEinkTimestamp.length()) {
    drawEinkHeaderBar(buf);
  }

  // Répondre vite au navigateur AVANT le refresh e-ink (lent ~2s)
  client.println(F("HTTP/1.1 200 OK"));
  client.println(F("Access-Control-Allow-Origin: *"));
  client.println(F("Connection: close"));
  client.println();
  client.println(F("OK"));
  drainAndClose(client);

  // Refresh e-ink (bloquant ~2s)
  renderEinkBuffer(buf);
  free(buf);
  recoverOledAfterEink();
  return;
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
