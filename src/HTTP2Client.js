import http2 from 'http2';
import HTTP2ClientSession from './HTTP2ClientSession.js';
import HTTP2Request from './HTTP2Request.js';
import HTTP2Response from './HTTP2Response.js';



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
        sessionIdleTimeout = 600,
    } = {}) {

        // maintain a set of sessions to the specific hosts
        // in order to make effective use of http2
        this.sessions = new Map();

        // terminate idle connections after x seconds
        this.sessionIdleTimeout = sessionIdleTimeout;

        // static headers that are sent with each request
        this.staticHeaders = new Map();
    }




    header(key, value) {
        this.staticHeaders.set(key, value);
    }



    /**
     * set the certificate to use for all requests that have not set already one
     *
     * @param      {string}  certificate  The certificate
     * @return     {Object}  this
     */
    ca(certificate) {
        this.certificate = certificate;
        return this;
    }





    /**
     * set the host to add to all requests starting without http in the url
     *
     * @param      {string}  host    host
     */
    host(hostname) {
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



    async createStream(origin, headers, ca) {
        const session = await this.createSession(origin, ca);
        return session.request(headers);
    }


    async createSession(origin, ca) {
        if (!this.sessions.has(origin)) {
            this.sessions.set(origin, (async() => {
                const session = http2.connect(origin, {
                    ca: ca || this.certificate,
                });

                const http2Session = new HTTP2ClientSession(session);

                http2Session.once('close', () => {
                    this.sessions.delete(origin);
                });

                http2Session.once('error', () => {
                    this.sessions.delete(origin);
                });

                await new Promise((resolve) => {
                    session.once('connect', () => {
                        resolve();
                    });
                });

                return http2Session;
            })());
        }

        return this.sessions.get(origin);
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


        return request[method](requestURL);
    }
});




export default HTTP2Client;