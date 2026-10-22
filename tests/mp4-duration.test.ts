import { describe, expect, it } from "vitest";
import { mp4Duration } from "@/lib/services/videos";

function mp4(scale: number, dur: number) {
  const ftyp = Buffer.alloc(16); ftyp.writeUInt32BE(16, 0); ftyp.write("ftypisom", 4, "latin1");
  const mvhd = Buffer.alloc(40); mvhd.writeUInt32BE(40, 0); mvhd.write("mvhd", 4, "latin1"); mvhd[8] = 0;
  mvhd.writeUInt32BE(scale, 20); mvhd.writeUInt32BE(dur, 24);
  return Buffer.concat([ftyp, Buffer.from([0, 0, 0, 8]), Buffer.from("moov", "latin1"), mvhd]);
}
describe("mp4Duration (ffmpeg-less fallback)", () => {
  it("reads mvhd duration", () => expect(mp4Duration(mp4(1000, 12_500))).toBe(12.5));
  it("rejects non-MP4 data", () => expect(mp4Duration(Buffer.from("not a video at all"))).toBeNull());
});
