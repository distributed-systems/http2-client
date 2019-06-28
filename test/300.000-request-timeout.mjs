import section from '../es-modules/distributed-systems/section-tests/x/index.mjs';
import HTTP2Client from '../src/HTTP2Client.mjs';
import HTTP2Server from '../es-modules/distributed-systems/http2-server/x/src/HTTP2Server.mjs'
import assert from 'assert';


section('HTTP2Request', (section) => {
    section('Basics', (section) => {
        let server;
        let certificate;

        section.setup(async () => {
            server = new HTTP2Server({
                secure: false
            });

            await server.load();
            await server.listen(8000);
        });



        section.test('Execute a GET Request', async () => {

            // register the route
            server.getRouter().get('/test-1', () => {});


            const client = new HTTP2Client();
            const err = await client.get('http://l.dns.porn:8000/test-1')
                .timeout(500)
                .send().catch(err => err);

            assert(err);
            assert(err.message);
            assert(err.message.includes('timed out'));
        });



        section.destroy(async () => {
            await server.close();
        });
    });
});