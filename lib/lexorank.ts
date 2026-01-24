/**
 * LexoRank implementation for stable ordering.
 */
export class LexoRank {
    private static readonly ALPHA = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

    static between(prev: string | null, next: string | null): string {
        const p = prev || '0';
        const n = next || '{'; // '{' is after 'z' in ASCII

        let rank = '';
        let i = 0;

        while (true) {
            const pChar = p[i] || '0';
            const nChar = n[i] || '{';

            const pIdx = this.ALPHA.indexOf(pChar);
            const nIdx = this.ALPHA.indexOf(nChar);

            if (nIdx - pIdx > 1) {
                const midIdx = Math.floor((pIdx + nIdx) / 2);
                rank += this.ALPHA[midIdx];
                break;
            } else {
                rank += pChar;
                if (pIdx !== nIdx) {
                    // If they differ and there's no space between them, we MUST move to next digit
                    // But if p is empty at this point, we just append mid of ALPHA to rank
                    if (!p[i + 1]) {
                        rank += this.ALPHA[Math.floor(this.ALPHA.length / 2)];
                        break;
                    }
                }
            }
            i++;
            if (i > 100) break; // Safety
        }
        return rank;
    }

    static initial(): string {
        return this.between(null, null);
    }
}
