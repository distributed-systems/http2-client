import http2 from 'http2';
import HTTP2Response from './HTTP2Response.js';
import { HTTP2OutgoingMessage } from '@distributed-systems/http2-lib';
import logd from 'logd';


const log = logd.module('HTTP2Request');


const { NGHTTP2_CANCEL } = http2.constants;

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
        createStream,
        hostname,
        staticHeaders,
    }) {
        super();

        // get requests are repetadly send if they fail
        this._retryCount = 5;

        this.createStream = createStream;

        if (hostname) this.hostname = hostname;

        this._query = new URLSearchParams();
        this.expectedStatusCodes = new Set();

        // set statis headers
        if (staticHeaders) {
            for (const [key, value] of staticHeaders.entries()) {
                this.setHeader(key, value);
            }
        }
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
        
        if (this.requestURL.searchParams) {
            this.setQuery(this.requestURL.searchParams);
        }

        return this;
    }


    /**
     * set the ca for the request
     * 
     * @param {string} ca 
     */
    ca(ca) {
        this._ca = ca;
        return this;
    }


    /**
     * time it may take until the response is starting to get back.
     *
     * @param      {number}  msecs   The msecs
     */
    responseTimeout(msecs) {
        this._responsetimeoutTime = msecs;
        return this;
    }




    /**
     * time the entire request may take. the request will be aborted after this timeout
     *
     * @param      {number}  msecs   The msecs
     */
    timeout(msecs) {
        this._timeoutTime = msecs;
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
     * abort the request & response
     */
    abort(code) {
        const stream = this.getStream();

        if (stream) {
            stream.end(code);
        }

        return this;
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
     * alias for setQuery
     */
    query(parameters) {
        return this.setQuery(parameters);
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
        if (parameters instanceof URLSearchParams) {
            for (const [key, value] of parameters.entries()) {
                this.setQueryParameter(key, value);
            }
        } else if (Array.isArray(parameters)) {
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
        this._query.set(key, value);
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
    * send the request headers, get a valid http session in the process
    */
     async sendHeaders() {
        if (typeof this.methodName !== 'string') throw new Error(`Cannot send request, the http method was not set!`);

        const headers = this.getHeaderObject();

        // get the query string
        const query = this._query.toString();

        // set method & path http2 header
        headers[':path'] = this.requestURL.pathname + (query ? '?'+query : '');
        headers[':method'] = this.methodName.toUpperCase();


        // create stream, send headers
        const http2Stream = await this.createStream(this.requestURL.origin, headers, this._ca);
        this.setStream(http2Stream);

        // we just need to create a stream once
        this.createStream = null;

        return this;
    }





    getErrorSignature(err) {
        return `${this.methodName.toUpperCase()} request to '${this.requestURL}' errored: ${err.message}`;
    }



    setCookie(name, value) {
        if (this.hasHeader('cookie')) {
            this.setHeader('cookie', `${this.getHeader('cookie')}; ${name}=${value}`);
        } else {
            this.setHeader('Cookie', `${name}=${value}`);
        }
        return this;
    }


    setCookies(cookies) {
        if (Array.isArray(cookies)) {
            cookies.forEach(cookie => this.setCookie(cookie.name, cookie.value));
        }
    }




    /**
    * send the request to the server
    *
    * @param {(string|buffer)} [data]    data that should be sent to the server 
    */
    async send(data) {
        this.setData(data);
        this.prepareData();

        // send headers, creates a new stream
        await this.sendHeaders();

        // wait for the response before we're returning a thing
        return new Promise((resolve, reject) => {
            const stream = this.getStream();

            this.once('error', (err) => {
                err.message = this.getErrorSignature(err);
                reject(err)
            });


            if (this._timeoutTime) {
                let timeoutTimer = setTimeout(() => {
                    this.abort(NGHTTP2_CANCEL);
                    reject(new Error(`The ${this.methodName.toUpperCase()} request to '${this.requestURL}' timed out after ${this._timeoutTime}ms!`));
                }, this._timeoutTime);

                stream.once('end', () => {
                    clearTimeout(timeoutTimer);
                });
            }


            if (this._responsetimeoutTime) {
                let responseTimeoutTimer = setTimeout(() => {
                    this.abort(NGHTTP2_CANCEL);
                    reject(new Error(`The ${this.methodName.toUpperCase()} request to '${this.requestURL}' timed out after ${this._responsetimeoutTime}ms!`));
                }, this._responsetimeoutTime);

                stream.once('response', () => {
                    clearTimeout(responseTimeoutTimer);
                });
            }


            // wait for the response
            stream.once('response', (headers) => {
                log.debug(`Received response for '${this.methodName.toUpperCase()} ${this.requestURL}'`);
                (async () => {

                    // create our custom response stream
                    const response = new HTTP2Response(stream, headers);

                    response.once('error', (err) => {
                        log.warn(`[Client Response ${this.methodName.toUpperCase()} ${this.requestURL}] Error: ${err.message}`, err);
                    });

                    if (this.expectedStatusCodes.size) {
                        if (!this.expectedStatusCodes.has(response.status())) {
                            const statusCodesMessage = this.expectedStatusCodes.size === 1 ? 
                                `${this.expectedStatusCodes.values().next().value}` : 
                                `one of ${[...this.expectedStatusCodes.values()].join(', ')}`;

                            let additionalData = '';
                            if (response.status() >= 400 && response.status() < 600) {
                                const data = await response.getData();
                                if (typeof data === 'string') {
                                    additionalData = ` (${data.substr(0, 1000)})`;
                                }
                                if (typeof data === 'object') {
                                    additionalData = ` (${JSON.stringify(data)})`;
                                }
                            }

                            throw new Error(`The response for the ${this.methodName.toUpperCase()} request to '${this.requestURL}' returned the status ${response.status()}, expected the status to be ${statusCodesMessage}${additionalData}!`);
                        }
                    }

                    return response;
                })().catch(reject).then(resolve);
            });

            // send & end
            log.debug(`Sending data to '${this.requestURL}'`);
            this.getRawStream().end(this.getData());
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