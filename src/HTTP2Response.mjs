'use strict';


import HTTP2IncomingMessage from '../es-modules/distributed-systems/http2-lib/x/src/HTTP2IncomingMessage.mjs'


export default class HTTP2Response extends HTTP2IncomingMessage {

    

    /**
    * get the status code
    */
    status(...expect) {
        const status = this.headers.get(':status');

        if (expect.length === 0) return status;
        else return expect.includes(status);
    }
}