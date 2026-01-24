/**
 * LexoRank implementation for stable ordering.
 */
import { LexoRank as LibLexoRank } from 'lexorank';

export class LexoRank {
    static between(prev: string | null, next: string | null): string {
        try {
            if (!prev && !next) {
                return LibLexoRank.middle().toString();
            }
            if (!prev) {
                return LibLexoRank.parse(next!).genPrev().toString();
            }
            if (!next) {
                return LibLexoRank.parse(prev!).genNext().toString();
            }
            return LibLexoRank.parse(prev!).between(LibLexoRank.parse(next!)).toString();
        } catch (e) {
            console.error('[LexoRank] Error generating rank between:', { prev, next }, e);
            return LibLexoRank.middle().toString();
        }
    }

    static initial(): string {
        return this.between(null, null);
    }
}
