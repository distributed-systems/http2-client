import logd from 'logd';
import EventEmitter from 'events';
import { HTTP2Stream } from '@distributed-systems/http2-lib'


const log = logd.module('HTTP2ClientSession');



export default class HTTP2ClientSession extends EventEmitter {

    constructor(session, {
        timeout = 60* 1000
    } = {}) {
        super();

        this.session = session;

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
            log.warn(`Session is going away ...`);
        });
    }


    /**
     * Handle sessions that are destroyed
     * 
     * @param {Error} err 
     */
    _handleDestroyedSession(err) {
        if (err) {
            log.error(`Session error: ${err,message}`, err);
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
    request(headers) {
        const stream = this.session.request(headers);
        return new HTTP2Stream(stream);
    }


    /**
     * actively close the session
     */
    end() {
        this.session.close();
    }
}