// Declaration minimale pour javascript-opentimestamps ^0.4.5 (0 types officiels).
// Surface typée : seulement ce que src/lib/opentimestamps.ts consomme.

declare module 'javascript-opentimestamps' {
  export class DetachedTimestampFile {
    static fromHash(op: unknown, hash: Buffer | Uint8Array): DetachedTimestampFile
    static fromBytes(op: unknown, bytes: Buffer | Uint8Array): DetachedTimestampFile
    static deserialize(bytes: Buffer | Uint8Array): DetachedTimestampFile
    serializeToBytes(): Uint8Array
    fileDigest(): Uint8Array
    timestamp: unknown
  }

  export namespace Ops {
    class Op {}
    class OpSHA256 extends Op {}
    class OpSHA1 extends Op {}
    class OpRIPEMD160 extends Op {}
  }

  export interface VerifyResult {
    bitcoin?: { height: number; timestamp: number }
    litecoin?: { height: number; timestamp: number }
    ethereum?: { height: number; timestamp: number }
  }

  export function stamp(file: DetachedTimestampFile): Promise<void>
  export function verify(
    proofFile: DetachedTimestampFile,
    originalFile: DetachedTimestampFile,
    options?: Record<string, unknown>
  ): Promise<VerifyResult>
  export function upgrade(file: DetachedTimestampFile): Promise<boolean>

  const _default: {
    DetachedTimestampFile: typeof DetachedTimestampFile
    Ops: typeof Ops
    stamp: typeof stamp
    verify: typeof verify
    upgrade: typeof upgrade
  }
  export default _default
}
