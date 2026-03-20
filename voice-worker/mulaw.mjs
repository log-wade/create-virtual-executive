/**
 * G.711 μ-law (8-bit) → signed 16-bit little-endian PCM mono @ 8 kHz.
 * Algorithm matches common telephony decoders (bias 0x84 / 132).
 * @param {Buffer} ulaw
 * @returns {Buffer}
 */
export function decodeMulawToPcm16le(ulaw) {
  const out = Buffer.alloc(ulaw.length * 2);
  for (let i = 0; i < ulaw.length; i++) {
    const s = decodeMuLawSample(ulaw[i]);
    out.writeInt16LE(s, i * 2);
  }
  return out;
}

/**
 * @param {number} byte
 * @returns {number}
 */
function decodeMuLawSample(byte) {
  let u = (~byte) & 0xff;
  const sign = u & 0x80 ? -1 : 1;
  u &= 0x7f;
  const exponent = u >> 4;
  const mantissa = u & 0x0f;
  let magnitude = (mantissa << 4) + 8;
  magnitude <<= exponent;
  magnitude -= 132;
  return sign * magnitude;
}
