


export default class RequestRateLimiter {


    constructor(maxConcurrentRequests = 1) {
        this.maxConcurrentRequests = maxConcurrentRequests;
        this.openRequests = 0;
        this.queue = [];
    }


    release() {
        this.openRequests--;

        if (this.queue.length > 0) {
            const nextRequest = this.queue.shift();
            this.openRequests++;
            nextRequest();
        }
    }


    async throttle() {
        if (this.openRequests < this.maxConcurrentRequests) {
            this.openRequests++;
        } else {
            return new Promise((resolve) => {
                this.queue.push(resolve);
            });
        }
    }
}