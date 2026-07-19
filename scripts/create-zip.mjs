import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { deflateRawSync } from "node:zlib";

const ZIP_LOCAL_FILE_HEADER = 0x04034b50;
const ZIP_CENTRAL_DIRECTORY_HEADER = 0x02014b50;
const ZIP_END_OF_CENTRAL_DIRECTORY = 0x06054b50;

const crcTable = new Uint32Array(256);
for (let tableIndex = 0; tableIndex < crcTable.length; tableIndex += 1) {
  let value = tableIndex;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  crcTable[tableIndex] = value >>> 0;
}

function crc32(content) {
  let value = 0xffffffff;
  for (const byte of content) {
    value = (value >>> 8) ^ crcTable[(value ^ byte) & 0xff];
  }
  return (value ^ 0xffffffff) >>> 0;
}

function createLocalHeader(fileName, content, payload, checksum, compressionMethod) {
  const header = Buffer.alloc(30);
  header.writeUInt32LE(ZIP_LOCAL_FILE_HEADER, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0x0800, 6);
  header.writeUInt16LE(compressionMethod, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(0x0021, 12);
  header.writeUInt32LE(checksum, 14);
  header.writeUInt32LE(payload.length, 18);
  header.writeUInt32LE(content.length, 22);
  header.writeUInt16LE(fileName.length, 26);
  header.writeUInt16LE(0, 28);
  return header;
}

function createCentralHeader(fileName, content, payload, checksum, localOffset, compressionMethod) {
  const header = Buffer.alloc(46);
  header.writeUInt32LE(ZIP_CENTRAL_DIRECTORY_HEADER, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(0x0800, 8);
  header.writeUInt16LE(compressionMethod, 10);
  header.writeUInt16LE(0, 12);
  header.writeUInt16LE(0x0021, 14);
  header.writeUInt32LE(checksum, 16);
  header.writeUInt32LE(payload.length, 20);
  header.writeUInt32LE(content.length, 24);
  header.writeUInt16LE(fileName.length, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt16LE(0, 36);
  header.writeUInt32LE(0, 38);
  header.writeUInt32LE(localOffset, 42);
  return header;
}

export async function createZip(outputPath, entries) {
  const orderedEntries = [...entries].sort((left, right) => left.name.localeCompare(right.name));
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;

  for (const entry of orderedEntries) {
    const fileName = Buffer.from(entry.name.replaceAll(path.sep, "/"), "utf8");
    const content = Buffer.from(entry.content);
    const compressed = deflateRawSync(content, { level: 9 });
    const compressionMethod = compressed.length < content.length ? 8 : 0;
    const payload = compressionMethod === 8 ? compressed : content;
    const checksum = crc32(content);
    const localHeader = createLocalHeader(fileName, content, payload, checksum, compressionMethod);
    const centralHeader = createCentralHeader(
      fileName,
      content,
      payload,
      checksum,
      localOffset,
      compressionMethod,
    );

    localParts.push(localHeader, fileName, payload);
    centralParts.push(centralHeader, fileName);
    localOffset += localHeader.length + fileName.length + payload.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(ZIP_END_OF_CENTRAL_DIRECTORY, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(orderedEntries.length, 8);
  end.writeUInt16LE(orderedEntries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localOffset, 16);
  end.writeUInt16LE(0, 20);

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, Buffer.concat([...localParts, centralDirectory, end]));
}
