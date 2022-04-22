import logd from 'logd';
import EventEmitter from 'events';
import { HTTP2Stream } from '@distributed-systems/http2-lib'
import LeakyBucket from 'leaky-bucket';
import RequestRateLimiter from './RequestRateLimiter.js';


const log = logd.module('HTTP2ClientSession');



export default class HTTP2ClientSession extends EventEmitter {

    constructor(session, {
        timeout = 60 * 1000,
        requestsPerSessionPerSecond,
        maxConcurrentRequests,
    } = {}) {
        super();

        // maximum of concurrent requests
        if (maxConcurrentRequests) {
            log.debug(`Setting max concurrent requests to ${maxConcurrentRequests}`);
            this.requestRateLimiter = new RequestRateLimiter(maxConcurrentRequests);
        }

        // rate limiting
        if (requestsPerSessionPerSecond) {
            log.debug(`Setting requests per session per second to ${requestsPerSessionPerSecond}`);
            this.bucket = new LeakyBucket({
                capacity: requestsPerSessionPerSecond,
                interval: 1,
                timeout: 3600,
            });
        }

        this.session = session;

        // close the session after 60 seonds of idle time
        this.session.setTimeout(timeout);

        this.session.once('timeout', () => {
            this.end();
        });

        this.session.once('close', () => {
            this._handleDestroyedSession();
        });
        
        this.session.once('error', (err) => {
            this._handleDestroyedSession(err);
        });
        
        this.session.once('goaway', () => {
            log.debug(`[Client session: ${this.session.id}] The session has ended due to a goaway frame`);
            this._handleDestroyedSession();
        });
    }


    /**
     * Handle sessions that are destroyed
     * 
     * @param {Error} err 
     */
    _handleDestroyedSession(err) {
        log.debug(`[Client session:${this.session.id}] _handleDestroyedSession() method was called`);
        
        if (err) {
            log.error(`Session error: ${err.message}`, err);
            this.emit('error', err);
        }

        this.emit('close');
        this._end(err);
    }


    /**
     * clean up events in preparation for the session termination
     */
    _end(err) {
        // make sure no events are handled anymore
        this.session.removeAllListeners();

        // tell the outside that the stream has ended
        this.emit('end', err);

        // remove all event handlers
        this.removeAllListeners();

        // remove all references
        this.session = null;
    }


    /**
     * create a stream
     * 
     * @param {*} headers 
     */
    async request(headers) {
        const signature = `${headers[':method']} ${headers[':path']}`;

        log.debug(`[Client session:${this.session.id}] ${signature}: Creating a new stream`);

        // rate limiting
        if (this.bucket) {
            log.debug(`[Client session:${this.session.id}] ${signature}: waiting for request rate limiter`);
            await this.bucket.throttle();
            log.debug(`[Client session:${this.session.id}] ${signature}: continuing after rate limiting`);
        }

        // check if we can create a new stream
        if (this.requestRateLimiter ) {
            log.debug(`[Client session:${this.session.id}] ${signature}: waiting for concurrent request rate limiter`);
            await this.requestRateLimiter.throttle();
            log.debug(`[Client session:${this.session.id}] ${signature}: continuing after concurrent request rate limiting`);
        }

        const stream = this.session.request(headers);

        log.debug(`[Client session:${this.session.id}, stream:${stream.id}] ${signature}: stream created, waiting for ready event`);


        await new Promise((resolve, reject) => {

            // the ready event is not fired. maybe because the stream is already ready
            // this may be a workaround but it may also not help detecting invalid streams
            // or make the application hang. no good!
            if (Number.isInteger(stream.id)) {
                log.debug(`[Client session:${this.session.id}, stream:${stream.id}] ${signature}: stream has an id and is thus ready`);
                return resolve();
            }

            stream.once('ready', () => {
                log.debug(`[Client session:${this.session.id}, stream:${stream.id}] ${signature}: stream is ready`);
                stream.removeAllListeners();
                resolve();
            });

            stream.once('error', (err) => {
                if (err.code === 'NGHTTP2_STREAM_CLOSED' ||
                    err.code === 'NGHTTP2_REFUSED_STREAM'||
                    err.code === 'NGHTTP2_ENHANCE_YOUR_CALM'||
                    err.code === 'NGHTTP2_CANCEL') {
                    log.debug(`[Client session:${this.session.id}, stream:${stream.id}] ${signature}: remote end refused to create stream: ${err.message}`);
                    
                    err.reconnect = true;
                    
                    // kill the session
                    this.end();
                }

                reject(err);
            });
        });

        const http2Stream = new HTTP2Stream(stream, `Client: ${headers[':method']} ${headers[':path']}`);

        // release the request slot
        if (this.requestRateLimiter) {
            http2Stream.once('end', () => {
                this.requestRateLimiter.release();
            });
        }
        
        // kill the session if the remote end think there is going on too much
        http2Stream.once('enhance_your_calm', () => {
            log.debug(`[Client session:${this.session.id}, stream:${http2Stream.getStream().id}]${signature}: The remote end has said to enhance your calm`);
            this.end();
        });

        log.debug(`[Client session:${this.session.id}, stream:${stream.id}] ${signature}: Created a new stream`);

        return http2Stream;
    }


    /**
     * actively close the session
     */
    end() {
        log.debug(`[Client session:${this.session.id}] end() method was called`);
        this.session.close();
    }
}