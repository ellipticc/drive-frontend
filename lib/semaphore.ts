export class Semaphore {
    private tasks: (() => void)[] = [];
    private count: number;

    constructor(count: number) {
        this.count = count;
    }

    async acquire(): Promise<void> {
        if (this.count > 0) {
            this.count--;
            return;
        }

        return new Promise<void>((resolve) => {
            this.tasks.push(() => {
                resolve();
            });
        });
    }

    release(): void {
        if (this.tasks.length > 0) {
            const nextTask = this.tasks.shift();
            nextTask!();
        } else {
            this.count++;
        }
    }
}
