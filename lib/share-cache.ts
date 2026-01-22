const shareCekMap = new Map<string, Uint8Array>();

export function setCekForShare(shareId: string, cek: Uint8Array) {
  shareCekMap.set(shareId, cek);
}

export function getCekForShare(shareId: string): Uint8Array | undefined {
  return shareCekMap.get(shareId);
}

export function clearCekForShare(shareId: string) {
  shareCekMap.delete(shareId);
}

export function clearAllCeks() {
  shareCekMap.clear();
}
