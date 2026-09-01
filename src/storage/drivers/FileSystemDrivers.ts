/**
 * Memory and Node FileSystem Drivers with real SHA-256 cryptographic hashing.
 */

import { IFileSystemDriver } from '../DatabaseDriver';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export class MemoryFileSystemDriver implements IFileSystemDriver {
  private files = new Map<string, string>();

  public async appendFile(filePath: string, content: string | Uint8Array): Promise<void> {
    const existing = this.files.get(filePath) || '';
    const toAppend = typeof content === 'string' ? content : Buffer.from(content).toString('utf-8');
    this.files.set(filePath, existing + toAppend);
  }

  public async readFile(filePath: string): Promise<string> {
    const data = this.files.get(filePath);
    if (data === undefined) throw new Error(`File not found: ${filePath}`);
    return data;
  }

  public async readFileBytes(filePath: string): Promise<Uint8Array> {
    const text = await this.readFile(filePath);
    return new TextEncoder().encode(text);
  }

  public async exists(filePath: string): Promise<boolean> {
    return this.files.has(filePath);
  }

  public async mkdir(_dirPath: string): Promise<void> {
    // Memory store handles path implicitly
  }

  public async computeSha256(filePath: string): Promise<string> {
    const content = await this.readFile(filePath);
    return crypto.createHash('sha256').update(content, 'utf-8').digest('hex');
  }
}

export class NodeFileSystemDriver implements IFileSystemDriver {
  public async appendFile(filePath: string, content: string | Uint8Array): Promise<void> {
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    if (typeof content === 'string') {
      await fs.promises.appendFile(filePath, content, 'utf-8');
    } else {
      await fs.promises.appendFile(filePath, Buffer.from(content));
    }
  }

  public async readFile(filePath: string): Promise<string> {
    return fs.promises.readFile(filePath, 'utf-8');
  }

  public async readFileBytes(filePath: string): Promise<Uint8Array> {
    const buf = await fs.promises.readFile(filePath);
    return new Uint8Array(buf);
  }

  public async exists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  public async mkdir(dirPath: string): Promise<void> {
    await fs.promises.mkdir(dirPath, { recursive: true });
  }

  public async computeSha256(filePath: string): Promise<string> {
    const buffer = await fs.promises.readFile(filePath);
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }
}
