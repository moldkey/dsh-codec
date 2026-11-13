/**
 * 编解码：摩斯编码 — 编码转换
 */

export const name = "dsh-codec-morse-encode";
export const inject = ["tools"];

const NL = String.fromCharCode(10);
const SITE = "https://deepseekbase.com/zh/tools/";
const TEXT_OUTPUT = {
  schema: { type: "object", additionalProperties: false, properties: { text: { type: "string" } }, required: ["text"] },
  render: (_args, value) => [{ type: "text", text: (value && value.text) || "" }],
};

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const MORSE = { a: ".-", b: "-...", c: "-.-.", d: "-..", e: ".", f: "..-.", g: "--.", h: "....", i: "..", j: ".---", k: "-.-", l: ".-..", m: "--", n: "-.", o: "---", p: ".--.", q: "--.-", r: ".-.", s: "...", t: "-", u: "..-", v: "...-", w: ".--", x: "-..-", y: "-.--", z: "--..", "0": "-----", "1": ".----", "2": "..---", "3": "...--", "4": "....-", "5": ".....", "6": "-....", "7": "--...", "8": "---..", "9": "----." };
const MORSE_R = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));

function b64enc(s) { return btoa(unescape(encodeURIComponent(s))); }
function b64dec(s) { return decodeURIComponent(escape(atob(s))); }
function b64urlenc(s) { return b64enc(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function b64urldec(s) { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return b64dec(s); }
function hexOf(s) { return Array.from(new TextEncoder().encode(s)).map((x) => x.toString(16).padStart(2, "0")).join(""); }
function fromHex(s) { const a = s.replace(/\s+/g, ""); const b = []; for (let i = 0; i < a.length; i += 2) b.push(parseInt(a.slice(i, i + 2), 16)); return new TextDecoder().decode(new Uint8Array(b)); }
function base32enc(s) { const bytes = new TextEncoder().encode(s); let bits = 0, val = 0, out = ""; for (const b of bytes) { val = (val << 8) | b; bits += 8; while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; } } if (bits > 0) out += B32[(val << (5 - bits)) & 31]; while (out.length % 8) out += "="; return out; }
function base32dec(s) { s = s.toUpperCase().replace(/=+$/, ""); let bits = 0, val = 0; const out = []; for (const c of s) { const i = B32.indexOf(c); if (i < 0) throw new Error("非法 Base32"); val = (val << 5) | i; bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; } } return new TextDecoder().decode(new Uint8Array(out)); }
function base58enc(s) { const bytes = new TextEncoder().encode(s); let n = BigInt("0x" + Buffer.from(bytes).toString("hex")); let out = ""; while (n > 0n) { out = B58[Number(n % 58n)] + out; n /= 58n; } for (const b of bytes) { if (b === 0) out = "1" + out; else break; } return out || "1"; }
function base58dec(s) { let n = 0n; for (const c of s) { const i = B58.indexOf(c); if (i < 0) throw new Error("非法 Base58"); n = n * 58n + BigInt(i); } let hex = n.toString(16); if (hex.length % 2) hex = "0" + hex; let zeros = 0; for (const c of s) { if (c === "1") zeros++; else break; } return new TextDecoder().decode(new Uint8Array([...Array(zeros).fill(0), ...(hex ? hex.match(/.{2}/g).map((x) => parseInt(x, 16)) : [])])); }
function rot(s, k) { return s.replace(/[a-zA-Z]/g, (c) => { const base = c <= "Z" ? 65 : 97; return String.fromCharCode((c.charCodeAt(0) - base + k + 26) % 26 + base); }); }
function crc32(s) { let c, crc = 0xFFFFFFFF; const bytes = new TextEncoder().encode(s); for (const b of bytes) { crc ^= b; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1)); } return ((crc ^ 0xFFFFFFFF) >>> 0).toString(16).padStart(8, "0"); }
async function hash(algo, s) { const buf = await crypto.subtle.digest(algo, new TextEncoder().encode(s)); return Array.from(new Uint8Array(buf)).map((x) => x.toString(16).padStart(2, "0")).join(""); }

const OPS = {
  base64_encode: (t) => b64enc(t),
  base64_decode: (t) => b64dec(t),
  base64url_encode: (t) => b64urlenc(t),
  base64url_decode: (t) => b64urldec(t),
  url_encode: (t) => encodeURIComponent(t),
  url_decode: (t) => decodeURIComponent(t),
  uri_encode: (t) => encodeURI(t),
  uri_decode: (t) => decodeURI(t),
  html_encode: (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"),
  html_decode: (t) => String(t).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&"),
  js_escape: (t) => JSON.stringify(String(t)).slice(1, -1),
  js_unescape: (t) => { try { return JSON.parse('"' + String(t).replace(/"/g, '\\"') + '"'); } catch (e) { return "反转义失败"; } },
  unicode_encode: (t) => Array.from(String(t)).map((c) => "\\u" + c.codePointAt(0).toString(16).padStart(4, "0")).join(""),
  unicode_decode: (t) => String(t).replace(/\\u([0-9a-fA-F]{4})/g, (m, h) => String.fromCharCode(parseInt(h, 16))),
  hex_encode: (t) => hexOf(t),
  hex_decode: (t) => fromHex(t),
  binary_encode: (t) => Array.from(new TextEncoder().encode(t)).map((b) => b.toString(2).padStart(8, "0")).join(" "),
  binary_decode: (t) => new TextDecoder().decode(new Uint8Array(t.replace(/\s+/g, "").match(/.{1,8}/g).map((x) => parseInt(x, 2)))),
  octal_encode: (t) => Array.from(new TextEncoder().encode(t)).map((b) => b.toString(8)).join(" "),
  octal_decode: (t) => new TextDecoder().decode(new Uint8Array(t.split(/\s+/).filter(Boolean).map((x) => parseInt(x, 8)))),
  decimal_encode: (t) => Array.from(new TextEncoder().encode(t)).map((b) => b).join(" "),
  decimal_decode: (t) => new TextDecoder().decode(new Uint8Array(t.split(/[\s,]+/).filter(Boolean).map(Number))),
  rot13: (t) => rot(t, 13),
  caesar: (t, a) => rot(t, Number(a) || 0),
  atbash: (t) => rot(t, 0).replace(/./g, (c) => { if (c >= "a" && c <= "z") return String.fromCharCode(219 - c.charCodeAt(0)); if (c >= "A" && c <= "Z") return String.fromCharCode(155 - c.charCodeAt(0)); return c; }),
  morse_encode: (t) => String(t).toLowerCase().split("").map((c) => c === " " ? "/" : (MORSE[c] || c)).join(" "),
  morse_decode: (t) => String(t).trim().split(/\s+/).map((x) => x === "/" ? " " : (MORSE_R[x] || x)).join(""),
  base32_encode: (t) => base32enc(t),
  base32_decode: (t) => base32dec(t),
  base58_encode: (t) => base58enc(t),
  base58_decode: (t) => base58dec(t),
  sha1: (t) => hash("SHA-1", t),
  sha256: (t) => hash("SHA-256", t),
  sha512: (t) => hash("SHA-512", t),
  crc32: (t) => crc32(t),
  jwt_decode: (t) => {
    const parts = String(t).trim().split(".");
    if (parts.length < 2) throw new Error("不是 JWT");
    const head = JSON.parse(b64urldec(parts[0])), body = JSON.parse(b64urldec(parts[1]));
    return "header: " + JSON.stringify(head) + NL + "payload: " + JSON.stringify(body, null, 2);
  },
  sql_escape: (t) => String(t).replace(/'/g, "''"),
  csv_escape: (t) => '"' + String(t).replace(/"/g, '""') + '"',
  qp_encode: (t) => Array.from(new TextEncoder().encode(t)).map((b) => (b >= 33 && b <= 126 && b !== 61 ? String.fromCharCode(b) : "=" + b.toString(16).toUpperCase().padStart(2, "0"))).join(""),
  qp_decode: (t) => new TextDecoder().decode(new Uint8Array(String(t).replace(/=\r?\n/g, "").split(/(=[0-9A-F]{2})/).filter(Boolean).map((x) => x.startsWith("=") ? parseInt(x.slice(1), 16) : Array.from(new TextEncoder().encode(x))).flat())),
  url_params_encode: (t) => new URLSearchParams(Object.entries(JSON.parse(t))).toString(),
  url_params_decode: (t) => JSON.stringify(Object.fromEntries(new URLSearchParams(t)), null, 2),
  json_compact: (t) => JSON.stringify(JSON.parse(t)),
  html_entity_all: (t) => Array.from(String(t)).map((c) => "&#" + c.codePointAt(0) + ";").join(""),
  strip_html: (t) => String(t).replace(/<[^>]*>/g, ""),
  normalize_space: (t) => String(t).replace(/\s+/g, " ").trim(),
  reverse: (t) => Array.from(String(t)).reverse().join(""),
  length_bytes: (t) => "字符: " + Array.from(String(t)).length + NL + "字节: " + new TextEncoder().encode(t).length,
  b64_detect: (t) => { const s = String(t).trim(); if (!/^[A-Za-z0-9+/=_-]+$/.test(s)) return "不像 Base64"; try { const v = b64dec(s.replace(/-/g,"+").replace(/_/g,"/")); return /^[\x09\x0a\x0d\x20-\x7e\u4e00-\u9fa5]*$/.test(v) ? "像 Base64（可解码）" : "可能不是文本 Base64"; } catch (e) { return "不像 Base64"; } },
  entropy: (t) => { const bytes = new TextEncoder().encode(t); const m = {}; for (const b of bytes) m[b] = (m[b]||0)+1; let h = 0; for (const k of Object.keys(m)) { const p = m[k]/bytes.length; h -= p*Math.log2(p); } return "熵: " + (Math.round(h*1000)/1000) + " bits/byte（0–8，越高越随机）"; },
};

export function apply(ctx, config) {
  void config;
  ctx.tools.register({
    name: "codec_morse_encode",
    description: "摩斯编码",
    parameters: {
      text: { "type": "string", required: true, "description": "输入" },
    },
    output: TEXT_OUTPUT,
    async execute(args) {
      const t = args && args.text != null ? String(args.text) : "";
      const a = args && args.a != null ? String(args.a) : "";
      try {
        const fn = OPS["morse_encode"];
        if (!fn) throw new Error("未知操作");
        const v = await fn(t, a);
        return { text: ["编解码：摩斯编码", "=".repeat(52), String(v), "", "更多工具：" + SITE].join(NL) };
      } catch (e) {
        return { text: "处理失败: " + String((e && e.message) || e) };
      }
    },
  });
}