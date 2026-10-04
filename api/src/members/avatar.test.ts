import { describe, expect, it } from 'vitest';
import { detectImageType } from './avatar.js';

const bytes = (...b: number[]) =>
  Buffer.concat([Buffer.from(b), Buffer.alloc(16)]);
const riff = (kind: string) =>
  Buffer.concat([
    Buffer.from('RIFF'),
    Buffer.from([0, 0, 0, 0]),
    Buffer.from(kind),
  ]);

describe('detectImageType', () => {
  it('JPEG / PNG / WebP theo magic bytes', () => {
    expect(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('jpg');
    expect(
      detectImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)),
    ).toBe('png');
    expect(detectImageType(riff('WEBPVP8 '))).toBe('webp');
  });

  it('GIF, SVG, PDF, rỗng → null', () => {
    expect(detectImageType(Buffer.from('GIF89a......'))).toBeNull();
    expect(
      detectImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')),
    ).toBeNull();
    expect(detectImageType(Buffer.from('%PDF-1.7'))).toBeNull();
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
  });

  it('RIFF nhưng không phải WEBP (vd. WAV) → null', () => {
    expect(detectImageType(riff('WAVEfmt '))).toBeNull();
  });

  it('chỉ có phần đầu của chữ ký (bị cắt) → null', () => {
    expect(detectImageType(Buffer.from([0xff, 0xd8]))).toBeNull();
    expect(detectImageType(Buffer.from([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
    expect(detectImageType(Buffer.from('RIFF\0\0\0\0WEB'))).toBeNull();
  });

  it('chữ ký không nằm ở đầu file → null', () => {
    expect(detectImageType(Buffer.from([0x00, 0xff, 0xd8, 0xff]))).toBeNull();
  });
});
