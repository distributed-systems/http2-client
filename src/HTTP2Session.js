'use strict';


import http2 from 'http2';
import EventEmitter from 'events';



const statusMap = new Map([
    ['creating', 100],
    ['loading', 200],
    ['ready', 300],
    ['closing', 400],
    ['closed', 500],
    ['failed', 600],
]);




export default class HTTP2Session extends EventEmitter {

    constructor({
        sessionIdleTimeout = 30,
    } = {}) {
        super();

        // terminate connection after x seconds idling
        this.sessionIdleTimeout = sessionIdleTimeout;

        // initialize with the correct status
        this.currentStatus = 0;
        this.setStatus('ready');
    }



    /**
    * open the connection to the server
    *
    * @param {string} origin            the server url to connect to. the origin 
    *                                   of the ES URL object
    * @param {buffer} [CACertificate]   ca certificate to use in order to be able 
    *                                   to open a trusted connection 
    */
    async connect(origin, CACertificate) {
        if (this.connectPromise) return await this.connectPromise;
        else {
            if (this.currentStatus !== statusMap.get('ready')) {
                throw new Error(`Cannot connect a connection that has the status '${this.currentStatusName}'!`);
            }

            // the promise is used to convert the connection
            // and error event to the async work flow. the promise
            // will onl resolve or reject once ignoring multiple 
            // invocations of the callback
            let resolve, reject;
            this.connectPromise = new Promise((res, rej) => {
                resolve = res;
                reject = rej;
            });


            this.http2client = http2.connect(origin, {
                ca: CACertificate
            });


            // wait until we've connected to the server
            this.http2client.on('connect', () => {
                resolve();
            });

            // or failed to connect
            this.http2client.on('error', (err) => {
                err.message = `Failed to connect to '${origin}': ${err.message}`;

                reject(err);
                this.end(err);
            });

            // end the session as soon the http2 one does
            this.http2client.on('close', () => {
                this.end();
            });


            // make sure the session kills itself when its idling too longs
            this.http2client.setTimeout(this.sessionIdleTimeout*1000, () => {
                this.end();
            });


            return await this.connectPromise;
        }
    }




    /**
    * ends the client, closes the connection to the server
    */
    end(err) {
        if (!this.ended) {
            this.ended = true;

            this.setStatus('closing');
            this.emit('end', err);

            // try to close the connection, since it may have failed
            // or been closed already we're not checking for any errors
            try {
                this.http2client.close();
            } catch (e) {}

            this.setStatus(err ? 'failed' : 'closed');
        }
    }




    /**
    * checks if currently a request can be sent using this 
    * connection
    */
    isAvailable() {
        return this.currentStatus <= statusMap.get('ready');
    }




    /**
    * send a request using this session
    *
    * @param {object} headers - http headers
    */
    request(headers) {
        if (this.isAvailable()) {
            return this.http2client.request(headers);
        } else throw new Error(`Cannot send request on a connection with the status '${this.currentStatusName}'!`);
    }



    /**
    * set the current status of the connection
    *
    * @private
    * @param {string} statusName    the name of the status to set
    */
    setStatus(statusName) {
        if (this.currentStatus < statusMap.get(statusName)) {
            this.currentStatusName = statusName;
            this.currentStatus = statusMap.get(statusName);
        } else throw new Error(`Cannot set the status '${statusName}' with a lower value '${statusMap.get(statusName)}' than the current status '${this.currentStatusName}' and its value '${this.currentStatus}'!`);
    }
}