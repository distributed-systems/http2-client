import section from 'section-tests';
import HTTP2Client from '../src/HTTP2Client.js';
import HTTP2Server from '@distributed-systems/http2-server'
import assert from 'assert';




section.continue('HTTP2 Errors', (section) => {

    section.test('GoAway', async () => {
        const server = new HTTP2Server({
            secure: false
        });


        server.getRouter().get('/test-1', (request) => {
            request.response().status(200).send('there you go');
        });


        await server.load();
        await server.listen(8000);

        const client = new HTTP2Client();
        const response = await client.get('http://l.dns.porn:8000/test-1?key=first').send();
        await response.getData();
        assert.equal(response.status(), 200);

        for (const session of server.activeSessions.values()) {
            session.session.goaway();
        }
        
        const promise = client.get('http://l.dns.porn:8000/test-1?key=second').send();
        let errored = false;

        await promise.catch((err) => {
            errored = true;
        });

        assert.equal(errored, true);
        await server.close();
    });




    section.test('Enhance your calm', async () => {
        section.setTimeout(10000);

        const server = new HTTP2Server({
            secure: false
        });


        server.getRouter().get('/test/:id', (request) => {
            request.response().status(200).send('not so fast mate!');
        });


        await server.load();
        await server.listen(8000);

        const client = new HTTP2Client({
            maxConcurrentRequests: null,
            maxConcurrentConnections: null
        });

        await Promise.all(Array(15000).fill(0).map(async (e, i) => {
            const response = await client.get(`http://l.dns.porn:8000/test/${i}`).send();
            await response.getData();
            assert.equal(response.status(), 200);
        }));

        await server.close();
    });
});