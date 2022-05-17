import section from 'section-tests';
import HTTP2Client from '../src/HTTP2Client.js';
import HTTP2Server from '@distributed-systems/http2-server';
import assert from 'assert';


section('HTTP2Request', (section) => {
    section.test('Execute a GET Request', async () => {
        const server = new HTTP2Server({ secure: false });
        await server.load();
        await server.listen(8000);

        // register the route
        server.getRouter().get('/test-1', (request) => {
            request.response().status(200).send('yeah!');
        });


        const client = new HTTP2Client();
        const request = client.get('http://l.dns.porn:8000/test-1');
        const response = await request.send();
        const data = await response.getData();

        assert(data);
        assert.equal(typeof data, 'string');
        assert.equal(data, 'yeah!');

        await client.end();
        await server.close();
    });



    section.test('Execute 500 GET Requests', async () => {
        section.setTimeout(10000);

        const server = new HTTP2Server({ secure: false });
        await server.load();
        await server.listen(8000);

        const alphabets = 'abcdefghijklmnopqrstuvwxyz';
        const str = Array(2000).fill(0).map(() => alphabets[Math.floor(Math.random() * alphabets.length)]).join('');

        // register the route
        server.getRouter().get('/test-1000', (request) => {
            request.response().status(200).send(str);
        });


        const client = new HTTP2Client({
            maxConcurrentRequests: null,
            maxConcurrentConnections: null
        });

        let executedRequests = 0;

        await Promise.all(Array(500).fill(0).map(async () => {
            const request = client.get('http://l.dns.porn:8000/test-1000');
            const response = await request.send();
            await response.getData();
            assert.equal(response.status(), 200);
            executedRequests++;
        }));

        assert.equal(executedRequests, 500);
        await client.end();
        await server.close();
    });



    section.test('GET Request client timeout', async () => {
        const server = new HTTP2Server({ secure: false });
        await server.load();
        await server.listen(8000);

        // register the route
        server.getRouter().get('/test-timeout', async(request) => {
            await new Promise((resolve) => {
                setTimeout(() => {
                    resolve();
                }, 1000);
            });
        });


        const client = new HTTP2Client();
        const request = client.get('http://l.dns.porn:8000/test-timeout');
        request.timeout(500);
        const err = await request.send().catch(err => err);


        assert(err);
        assert(err.message);
        assert(err.message.includes('timed out'));
        await client.end();
        await server.close();
    });



    section.test('GET Request response timeout', async () => {
        const server = new HTTP2Server({ secure: false });
        await server.load();
        await server.listen(8000);

        // register the route
        server.getRouter().get('/test-timeout-2', async(request) => {
            await new Promise((resolve) => {
                setTimeout(() => {
                    resolve();
                }, 1000);
            });
        });


        const client = new HTTP2Client();
        const err = await client.get('http://l.dns.porn:8000/test-timeout-2')
            .responseTimeout(500)
            .send().catch(err => err);


        assert(err);
        assert(err.message);
        assert(err.message.includes('timed out'));
        await client.end();
        await server.close();
        });
});
