import section from '../es-modules/distributed-systems/section-tests/x/index.js';
import HTTP2Client from '../src/HTTP2Client.js';
import HTTP2Server from '../es-modules/distributed-systems/http2-server/x/src/HTTP2Server.js'
import assert from 'assert';



section.continue('HTTP2 Errors', (section) => {
    section.test('GoAway', async () => {
        const server = new HTTP2Server({
            secure: false
        });


        server.getRouter().get('/test-1', (request) => {
            request.response().status(200).send();
        });


        await server.load();
        await server.listen(8000);

        const client = new HTTP2Client();
        await client.get('http://l.dns.porn:8000/test-1?key=value').send();

        for (const session of server.activeSessions.values()) {
            session.goaway();
        }
        
        const promise = client.get('http://l.dns.porn:8000/test-1?key=value').send();
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


        server.getRouter().get('/test-:id', (request) => {
            request.response().status(200).send();
        });


        await server.load();
        await server.listen(8000);

        const client = new HTTP2Client();
        const promises = [];

        for (let i = 0; i < 10701; i++) {
            promises.push(client.get(`http://l.dns.porn:8000/test-${i}`).send());
        }

        const results = await Promise.all(promises);
    
        assert(results.every(res => res.status(200)));

        await server.close();
    });
});