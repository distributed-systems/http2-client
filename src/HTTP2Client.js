import http2 from 'http2';
import HTTP2ClientSession from './HTTP2ClientSession.js';
import HTTP2Request from './HTTP2Request.js';
import logd from 'logd';
import { setTimeout } from 'timers/promises';


const log = logd.module('HTTP2Client');



// valid http2 methods
const methods = [
    'delete',
    'get',
    'head',
    'options',
    'patch',
    'post',
    'put',
];




class HTTP2Client {

    constructor({
        sessionIdleTimeout = 60 * 1000,
        requestsPerSessionPerSecond = 10000,
        maxConcurrentRequests = 100,
    } = {}) {

        // rate limiting options
        this.requestsPerSessionPerSecond = requestsPerSessionPerSecond;
        this.maxConcurrentRequests = maxConcurrentRequests;

        // maintain a set of sessions to the specific hosts
        // in order to make effective use of http2
        this.sessions = new Map();

        // terminate idle connections after x seconds
        this.sessionIdleTimeout = sessionIdleTimeout;

        // static headers that are sent with each request
        this.staticHeaders = new Map();
    }




    header(key, value) {
        log.debug(`Adding header ${key}: ${value}`);
        this.staticHeaders.set(key, value);
    }



    /**
     * set the certificate to use for all requests that have not set already one
     *
     * @param      {string}  certificate  The certificate
     * @return     {Object}  this
     */
    ca(certificate) {
        log.debug(`Setting the certificate to ${certificate}`);
        this.certificate = certificate;
        return this;
    }





    /**
     * set the host to add to all requests starting without http in the url
     *
     * @param      {string}  host    host
     */
    host(hostname) {
        log.debug(`Setting the host to ${hostname}`);
        this.hostname = hostname;
        return this;
    }




    /**
    * create a http2 session that can be used to send requests or
    * return an existing one
    *
    * @private
    * @param {string} origin            the server url to connect to. the origin 
    *                                   of the ES URL object
    * @param {buffer} [CACertificate]   ca certificate to use in order to be able 
    *                                   to open a trusted connection 
    */
    async getSession(origin, CACertificate) {

        // create a new session to the origin
        if (!this.sessions.has(origin)) {
            this.createSession(origin);
        }

        const session = this.sessions.get(origin);

        // connect to the session, if its connected already
        // it will resolve immediately
        await session.connect(origin, CACertificate);

        log.debug(`Retruning session for ${origin}`);
        return session;
    }




    /**
     * end all sessions
     *
     * @return     {Promise}  undefined
     */
    async end() {
        for (const promise of this.sessions.values()) {
            const session = await promise;
            await session.end();
        }

        this.sessions.clear();
    }



    async createStream(origin, headers, ca, reconnectRetries = 0) {
        const session = await this.createSession(origin, ca);

        try {
            return session.request(headers);
        } catch (err) {
            if (err.reconnect && reconnectRetries < 5) {
                const timeoutTime = (reconnectRetries + 1) * 100;

                log.debug(`[Client ${origin}] Stream creation failed. Reconnecting in ${timeoutTime}ms`);

                await setTimeout(timeoutTime);
                return this.createStream(origin, headers, ca, reconnectRetries + 1);
            } else {
                throw err;
            }
        }
    }


    async createSession(origin, ca) {
        if (!this.sessions.has(origin)) {
            log.debug(`[Client ${origin}] Creating a new session`);

            this.sessions.set(origin, (async() => {
                const localOrigin = origin;
                const localCa = ca;

                const session = http2.connect(localOrigin, {
                    ca: localCa || this.certificate,
                });

                const http2Session = new HTTP2ClientSession(session, {
                    requestsPerSessionPerSecond: this.requestsPerSessionPerSecond,
                    maxConcurrentRequests: this.maxConcurrentRequests,
                });

                http2Session.once('close', () => {
                    this.sessions.delete(localOrigin);
                });

                http2Session.once('error', () => {
                    this.sessions.delete(localOrigin);
                });

                await new Promise((resolve, reject) => {
                    session.once('connect', () => {
                        log.debug(`[Client ${localOrigin}] Connected`);
                        resolve();
                    });

                    session.once('error', (err) => {
                        reject(err);
                    });
                });

                return http2Session;
            })());
        }

        const session = this.sessions.get(origin);

        origin = null;
        ca = null;

        return session;
    }
}






// write functions to the constructor that will
// be used to create new requests
methods.forEach((method) => {

    /**
    * create a http request for a specific method
    *
    * @param {string} requestURL    the url for the request
    *
    * @returns {HTTP2Request}
    */
    HTTP2Client.prototype[method] = function(requestURL) {
        const createStream = async(origin, headers, ca) => {
            return this.createStream(origin, headers, ca);
        }

        const request = new HTTP2Request({
            createStream,
            hostname: this.hostname,
            staticHeaders: this.staticHeaders,
        });

        request.once('error', (err) => {
            log.warn(`[Client Request] Error: ${err.message}`, err);
        });

        return request[method](requestURL);
    }
});




export default HTTP2Client;