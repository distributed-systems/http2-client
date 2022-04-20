import section from 'section-tests';
import HTTP2Client from '../src/HTTP2Client.js';
import HTTP2Server from '@distributed-systems/http2-server'
import assert from 'assert';



section.continue('Rate-Limiting', (section) => {

    section.test('Concurrent Requests', async () => {
        const server = new HTTP2Server({
            secure: false
        });

        server.getRouter().get('/test-concurrency', (request) => {
            request.response().status(200).send('there you go');
        });


        await server.load();
        await server.listen(8000);

        const client = new HTTP2Client({
            requestsPerSessionPerSecond: null,
            maxConcurrentRequests: 1,
        });

        const response = await client.get('http://l.dns.porn:8000/test-concurrency').send();
        await response.getData();
        assert.equal(response.status(), 200);

        const response2 = await client.get('http://l.dns.porn:8000/test-concurrency').send();
        await response2.getData();
        assert.equal(response2.status(), 200);


        await client.end();
        await server.close();
    });
});