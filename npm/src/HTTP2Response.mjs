import { HTTP2IncomingMessage } from '@distributed-systems/http2-lib/index.mjs'


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