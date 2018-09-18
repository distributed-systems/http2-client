'use strict';

import section from 'section-tests';
import HTTP2Client from '../src/HTTP2Client.mjs';
import HTTP2Server from '../es-modules/distributed-systems/http2-server/x/src/HTTP2Server.mjs'
import assert from 'assert';
import path from 'path';
import fs from 'fs';
import {promisify} from 'util';

const readFile = promisify(fs.readFile); 


section('HTTP2Request', (section) => {
    section('Basics', (section) => {
        let server;
        let certificate;

        section.setup(async () => {
            const localFileName = new URL(import.meta.url).pathname;
            const key = await readFile(path.join(localFileName, '../data/l.dns.porn-privkey.pem'));
            certificate = await readFile(path.join(localFileName, '../data/l.dns.porn-cert.pem'));
            
            server = new HTTP2Server({key, certificate,});

            await server.load();
            await server.listen(8000);
        });



        section.test('Execute a GET Request', async () => {

            // register the route
            server.getRouter().get('/test-1', (request) => {
                request.response().status(200).send('yeah!');
            });


            const client = new HTTP2Client();
            const request = client.get('https://l.dns.porn:8000/test-1');
            request.ca(certificate);
            const response = await request.send();
            const data = await response.getData();

            assert(data);
            assert.equal(typeof data, 'string');
            assert.equal(data, 'yeah!');
        });



        section.destroy(async () => {
            await server.close();
        });
    });
});