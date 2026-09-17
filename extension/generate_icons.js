/**
 * generate_icons.js
 * Run with: node generate_icons.js
 * Generates PNG icons for the Chrome extension using canvas (no external deps).
 */

const { createCanvas } = require("canvas");
const fs = require("fs");
const path = require("path");

const sizes = [16, 32, 48, 128];
const outDir = path.join(__dirname, "icons");

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

sizes.forEach((size) => {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");

  // Background
  const radius = size * 0.18;
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(size - radius, 0);
  ctx.quadraticCurveTo(size, 0, size, radius);
  ctx.lineTo(size, size - radius);
  ctx.quadraticCurveTo(size, size, size - radius, size);
  ctx.lineTo(radius, size);
  ctx.quadraticCurveTo(0, size, 0, size - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.fillStyle = "#0D1117";
  ctx.fill();

  // Shield shape
  const cx = size / 2;
  const sy = size * 0.1;
  const sh = size * 0.75;

  ctx.beginPath();
  ctx.moveTo(cx, sy);
  ctx.lineTo(size * 0.82, size * 0.22);
  ctx.lineTo(size * 0.82, size * 0.52);
  ctx.quadraticCurveTo(size * 0.82, size * 0.82, cx, sy + sh);
  ctx.quadraticCurveTo(size * 0.18, size * 0.82, size * 0.18, size * 0.52);
  ctx.lineTo(size * 0.18, size * 0.22);
  ctx.closePath();
  ctx.fillStyle = "#00FF7F";
  ctx.fill();

  // Inner shield (dark)
  ctx.beginPath();
  ctx.moveTo(cx, sy + size * 0.08);
  ctx.lineTo(size * 0.76, size * 0.27);
  ctx.lineTo(size * 0.76, size * 0.5);
  ctx.quadraticCurveTo(size * 0.76, size * 0.73, cx, sy + sh - size * 0.06);
  ctx.quadraticCurveTo(size * 0.24, size * 0.73, size * 0.24, size * 0.5);
  ctx.lineTo(size * 0.24, size * 0.27);
  ctx.closePath();
  ctx.fillStyle = "#0D1117";
  ctx.fill();

  // F letter
  if (size >= 32) {
    ctx.fillStyle = "#00FF7F";
    ctx.font = `bold ${Math.round(size * 0.38)}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("F", cx, size * 0.5);
  }

  const buf = canvas.toBuffer("image/png");
  fs.writeFileSync(path.join(outDir, `icon${size}.png`), buf);
  console.log(`Generated icon${size}.png`);
});

console.log("All icons generated!");
