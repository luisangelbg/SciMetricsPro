/* SciMetricsPro — minimal ZIP writer (stored entries, UTF-8 names, CRC-32). Used for the spreadsheet files and for the
   package of results. Zip.build([{ name, data: Uint8Array | ArrayBuffer | Blob | string }]) → Promise<Blob>.
   APPNOTE.TXT (PKWARE .ZIP File Format Specification) sections 4.3.7, 4.3.12 and 4.3.16. */
'use strict';

const Zip = {
  _crc: null,
  crc32(bytes) {
    if (!Zip._crc) {
      Zip._crc = new Uint32Array(256);
      for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; Zip._crc[n] = c >>> 0; }
    }
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = Zip._crc[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  },

  async bytes(data) {
    if (data instanceof Uint8Array) return data;
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    if (typeof Blob !== 'undefined' && data instanceof Blob) return new Uint8Array(await data.arrayBuffer());
    return new TextEncoder().encode(String(data == null ? '' : data));
  },

  async build(files, type) {
    const ready = [];
    for (const f of files) ready.push({ name: f.name, data: await Zip.bytes(f.data) });
    return Zip.buildSync(ready, type);
  },

  /* the same without waiting: data must be Uint8Array, ArrayBuffer or string */
  buildSync(files, type) {
    const enc = new TextEncoder();
    const parts = [], central = [];
    let offset = 0;
    const now = new Date();
    const time = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xFFFF;
    const date = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xFFFF;
    for (const f of files) {
      const data = f.data instanceof Uint8Array ? f.data : f.data instanceof ArrayBuffer ? new Uint8Array(f.data) : enc.encode(String(f.data == null ? '' : f.data));
      const name = enc.encode(f.name);
      const crc = Zip.crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, time, true); lh.setUint16(12, date, true); lh.setUint32(14, crc, true);
      lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      parts.push(new Uint8Array(lh.buffer), name, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
      ch.setUint16(12, time, true); ch.setUint16(14, date, true); ch.setUint32(16, crc, true);
      ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true);
      ch.setUint16(30, 0, true); ch.setUint16(32, 0, true); ch.setUint16(34, 0, true); ch.setUint16(36, 0, true); ch.setUint32(38, 0, true); ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + data.length;
    }
    const cdSize = central.reduce((s, p) => s + p.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(4, 0, true); end.setUint16(6, 0, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true); end.setUint32(16, offset, true); end.setUint16(20, 0, true);
    return new Blob(parts.concat(central, [new Uint8Array(end.buffer)]), { type: type || 'application/zip' });
  },

  /* entries of a stored ZIP (for the tests): [{ name, data: Uint8Array }] */
  read(bytes) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let e = bytes.length - 22;
    while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
    const count = dv.getUint16(e + 10, true);
    let p = dv.getUint32(e + 16, true);
    const out = [], dec = new TextDecoder();
    for (let i = 0; i < count; i++) {
      const size = dv.getUint32(p + 24, true), nameLen = dv.getUint16(p + 28, true), extra = dv.getUint16(p + 30, true), comment = dv.getUint16(p + 32, true);
      const local = dv.getUint32(p + 42, true);
      const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
      const lNameLen = dv.getUint16(local + 26, true), lExtra = dv.getUint16(local + 28, true);
      const start = local + 30 + lNameLen + lExtra;
      out.push({ name, data: bytes.subarray(start, start + size), crc: dv.getUint32(p + 16, true) });
      p += 46 + nameLen + extra + comment;
    }
    return out;
  },
};

window.Zip = Zip;
