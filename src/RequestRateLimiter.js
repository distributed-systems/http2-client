import logd from 'logd';


const log = logd.module('RequestRateLimiter');


export default class RequestRateLimiter {


    constructor(maxConcurrentRequests = 1) {
        this.maxConcurrentRequests = maxConcurrentRequests;
        this.openRequests = 0;
        this.queue = [];
    }


    release() {
        this.openRequests--;

        if (this.queue.length > 0) {
            log.debug(`Releasing request at position 0 of ${this.queue.length}`);
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
                log.debug(`Queueing request at position ${this.queue.length}`);
                this.queue.push(resolve);
            });
        }
    }
}