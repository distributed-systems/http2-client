import http2 from 'http2';
import { HTTP2OutgoingMessage } from '@distributed-systems/http2-lib/index.mjs'
import HTTP2Response from './HTTP2Response.mjs';



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




class HTTP2Request extends HTTP2OutgoingMessage {


    constructor({
        client,
        hostname,
        certificate
    }) {
        super();

        if (certificate) this.ca(certificate);
        if (hostname) this.hostname = hostname;

        this.client = client;
        this.query = new URLSearchParams();
        this.expectedStatusCodes = new Set();
    }


    /**
    * set the method to use for this request
    *
    * @param {string} methodName - set the request methods
    */
    method(methodName) {
        this.methodName = methodName;
        return this;
    }



    /**
    * set the requests url
    *
    * @param {string} URL - the url for the request
    */
    url(url) {
        if (!url.startsWith('http://') && !url.startsWith('https://') && this.hostname) {
            url = `${this.hostname}${url}`;
        }

        this.requestURL = new URL(url);
        return this;
    }



    /**
    * set a ca certificate
    *
    * @param {buffer} certificate - a ca certificate to trust
    *
    * @returns {object} this
    */
    ca(certificate) {
        this.caCertificate = certificate;

        return this;
    }





    /**
    * shorthand method for setting the accept header
    * 
    * @param {string} value - the value for the accept header values
    *
    * @returns {object} this
    */
    accept(value) {
        this.setHeader('accept', value);

        return this;
    }



    /**
    * shorthand method for setting the content type of the request
    *
    * @param {string} contentType - the content type the request body has
    *
    * @returns {object} this
    */
    contentType(contentType) {
        this.setHeader('content-type', contentType);

        return this;
    }


    /**
    * send json data to the server
    *
    * @param {*} jsonData - either a buffer, a string or any js type
    *   that can be serializedvalues
    *
    * @returns {object} this
    */
    json(jsonData) {
        if (Buffer.isBuffer(jsonData)) {
            this.outgoingData = jsonData;
        } else if (typeof jsonData === 'string') {
            this.outgoingData = new Buffer.from(jsonData);
        } else {
            try {
                jsonData = JSON.stringify(jsonData);
            } catch (err) {
                throw new Error(`Failed to encode json data: ${err.message}`);
            }

            this.outgoingData = new Buffer.from(jsonData);
        }

        this.contentType('application/json');

        return this;
    }




    /**
    * send the request headers, get a valid http session in the process
    */
    async sendHeaders() {
        if (typeof this.methodName !== 'string') throw new Error(`Cannot send request, the method was not set!`);

        const headers = this.getHeaderObject();

        // get the query string
        const query = this.query.toString();

        // set method & path http2 header
        headers[':path'] = this.requestURL.pathname + (query ? '?'+query : '');
        headers[':method'] = this.methodName;


        // load a valid http session
        const session = await this.loadSession();
        this._stream = session.request(headers);
        return this;
    }










    /**
    * get a http session for creating a request stream
    */
    async loadSession() {
        if (typeof this.requestURL !== 'object') throw new Error(`Cannot send request, the URL was not set!`);

        // get a connection the request a can be sent on
        const session = await this.client.getSession(this.requestURL.origin, this.caCertificate);

        // remove the reference to the client, its not going to be
        // used anymore
        this.client = null;

        return session;
    }



    /**
    * returns the http2 stream so that any stream can piped to it
    * control is given to the stream and the request class will not
    * do anything anymore and fail if the user tries to do so.
    * 
    */
    async stream() {

        
    }



    
    /**
    * set multiple query parameters
    *
    * @param {(array|object)} parameters - either an array containing array 
    *   with key & values or an object containing keys & values
    *
    * @returns {object} this
    */
    setQuery(parameters) {
        if (Array.isArray(parameters)) {
            for (const [key, value] of parameters) {
                this.setQueryParameter(key, value);
            }
        } else if (parameters !== null && typeof parameters === 'object') {
            Object.keys(parameters).forEach((key) => {
                this.setQueryParameter(key, parameters[key]);
            });
        } else throw new Error(`Cannot set query parameters, expected an object or an array, got '${typeof parameters}'!`);

        return this;
    }



    /**
    * set one query parameter
    *
    * @param {string} key - the name of the parameter
    * @param {string} value - the value of the parameter
    *
    * @returns {object} this
    */
    setQueryParameter(key, value) {
        this.query.set(key, value);
        return this;
    }



    /**
    * define which status codes are a valid response
    */
    expect(...statusCodes) {
        statusCodes.forEach(code => this.expectedStatusCodes.add(code));
        return this;
    }





    /**
    * send the request to the server
    *
    * @param {(string|buffer)} [data]    data that should be sent to the server 
    */
    async send(data) {
        this.setData(data);
        this.prepareData();
        

        // send headers
        await this.sendHeaders();

        // wait for the response before we're returning a thing
        return new Promise((resolve) => {

            // wait for the actual response
            this._stream.on('response', (headers) => {
                
                // create our custom response stream
                const response = new HTTP2Response({
                    stream: this._stream,
                    headers: headers
                });

                resolve(response);
            });

            // send & end
            this._stream.end(this.getData());
        });
    }
}





// apply shorthand methods to the prototype of the constructor
methods.forEach((method) => {
    HTTP2Request.prototype[method] = function(url) {
        this.url(url);
        this.method(method);

        return this;
    }
});




export default HTTP2Request;