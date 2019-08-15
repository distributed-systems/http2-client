import { HTTP2IncomingMessage } from '../es-modules/distributed-systems/http2-lib/x/index.js'


export default class HTTP2Response extends HTTP2IncomingMessage {

    

    /**
    * get the status code
    */
    status(...expect) {
        const status = this.getHeader(':status');

        if (expect.length === 0) return status;
        else return expect.includes(status);
    }
}