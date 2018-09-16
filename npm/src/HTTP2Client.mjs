import http2 from 'http2';
import HTTP2Session from './HTTP2Session.mjs';
import HTTP2Request from './HTTP2Request.mjs';




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
        sessionIdleTimeout = 30,
    } = {}) {

        // maintain a set of sessions to the specific hosts
        // in order to make effective use of http2
        this.sessions = new Map();

        // terminate idle connections after x seconds
        this.sessionIdleTimeout = sessionIdleTimeout;
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
        for (const session of this.sessions.values()) {
            await session.end();
        }
    }





    /**
    * create a new http2 session to the specified origin
    *
    * @private 
    */
    createSession(origin) {
        const session = new HTTP2Session({
            sessionIdleTimeout: this.sessionIdleTimeout,
        });


        // make sure to remove sessions that are not available anymore
        session.on('end', () => {
            this.sessions.delete(origin);
        });


        // publish
        this.sessions.set(origin, session);
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
        const request = new HTTP2Request({
            client: this,
            certificate: this.certificate,
            hostname: this.hostname,
        });


        return request[method](requestURL);
    }
});




export default HTTP2Client;