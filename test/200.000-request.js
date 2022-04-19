import section from 'section-tests';
import HTTP2Client from '../src/HTTP2Client.js';
import HTTP2Server from '@distributed-systems/http2-server';
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
            
            server = new HTTP2Server({ key, certificate });

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

            await client.end();
        });



        section.test('Execute 500 GET Requests', async () => {
            section.setTimeout(10000);
            const alphabets = 'abcdefghijklmnopqrstuvwxyz';
            const str = Array(2000).fill(0).map(() => alphabets[Math.floor(Math.random() * alphabets.length)]).join('');

            // register the route
            server.getRouter().get('/test-1000', (request) => {
                request.response().status(200).send(str);
            });


            const client = new HTTP2Client();
            let executedRequests = 0;

            await Promise.all(Array(500).fill(0).map(async () => {
                const request = client.get('https://l.dns.porn:8000/test-1000');
                request.ca(certificate);
                const response = await request.send();
                assert.equal(response.status(), 200);
                executedRequests++;
            }));

            assert.equal(executedRequests, 500);
            await client.end();
        });



        section.test('GET Request client timeout', async () => {

            // register the route
            server.getRouter().get('/test-timeout', async(request) => {
                await new Promise((resolve) => {
                    setTimeout(() => {
                        resolve();
                    }, 1000);
                });
            });


            const client = new HTTP2Client();
            const request = client.get('https://l.dns.porn:8000/test-timeout');
            request.ca(certificate);
            request.timeout(500);
            const err = await request.send().catch(err => err);


            assert(err);
            assert(err.message);
            assert(err.message.includes('timed out'));
            await client.end();
        });



        section.test('GET Request response timeout', async () => {

            // register the route
            server.getRouter().get('/test-timeout-2', async(request) => {
                await new Promise((resolve) => {
                    setTimeout(() => {
                        resolve();
                    }, 1000);
                });
            });


            const client = new HTTP2Client();
            const err = await client.get('https://l.dns.porn:8000/test-timeout-2')
                .ca(certificate)
                .responseTimeout(500)
                .send().catch(err => err);


            assert(err);
            assert(err.message);
            assert(err.message.includes('timed out'));
            await client.end();
        });




        section.destroy(async () => {
            await server.close();
        });
    });
});