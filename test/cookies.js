import section from 'section-tests';
import HTTP2Client from '../src/HTTP2Client.js';
import HTTP2Server from '@distributed-systems/http2-server';
import assert from 'assert';
import path from 'path';;




section('Cookie', (section) => {
    section('Response', (section) => {
        section.test('hasCookie()', async () => {
            const server = new HTTP2Server({ secure: false });

            await server.load();
            await server.listen(8482);

            // register the route
            server.getRouter().get('/cookie', (request) => {
                request.response()
                    .setCookie('test', 'test', {
                        maxAge: 1000,
                    })
                    .status(200)
                    .send('yeah!');
            });


            const client = new HTTP2Client();
            const request = client.get('http://l.dns.porn:8482/cookie');
            const response = await request.send();
            const data = await response.getData();

            assert(data);
            assert.equal(typeof data, 'string');
            assert.equal(data, 'yeah!');

            assert(response.hasCookie('test'));

            await server.close();
            await client.end();
        });

        section.test('getCookie()', async () => {
            const server = new HTTP2Server({ secure: false });

            await server.load();
            await server.listen(8482);

            // register the route
            server.getRouter().get('/cookie', (request) => {
                request.response()
                    .setCookie('test', 'value', {
                        maxAge: 1000,
                    })
                    .status(200)
                    .send('yeah!');
            });


            const client = new HTTP2Client();
            const request = client.get('http://l.dns.porn:8482/cookie');
            const response = await request.send();
            const data = await response.getData();

            assert(data);
            assert.equal(typeof data, 'string');
            assert.equal(data, 'yeah!');

            assert(response.hasCookie('test'));
            const cookie = response.getCookie('test');
            assert.equal(cookie.name, 'test');
            assert.equal(cookie.value, 'value');
            assert.equal(cookie.options.maxAge, 1000);

            await server.close();
            await client.end();
        });



        section.test('getCookies()', async () => {
            const server = new HTTP2Server({ secure: false });

            await server.load();
            await server.listen(8482);

            // register the route
            server.getRouter().get('/cookie', (request) => {
                request.response()
                    .setCookie('test', 'value', {
                        maxAge: 1000,
                    })
                    .setCookie('test-1', 'value-1', {
                        maxAge: 1001,
                    })
                    .status(200)
                    .send('yeah!');
            });


            const client = new HTTP2Client();
            const request = client.get('http://l.dns.porn:8482/cookie');
            const response = await request.send();
            const data = await response.getData();

            assert(data);
            assert.equal(typeof data, 'string');
            assert.equal(data, 'yeah!');

            const cookies = response.getCookies('test');
            assert.equal(cookies.length, 2);
            
            assert.equal(cookies[0].name, 'test');
            assert.equal(cookies[0].value, 'value');
            assert.equal(cookies[0].options.maxAge, 1000);

            assert.equal(cookies[1].name, 'test-1');
            assert.equal(cookies[1].value, 'value-1');
            assert.equal(cookies[1].options.maxAge, 1001);

            await server.close();
            await client.end();
        });
    });

    section('Request', (section) => {
        section.test('setCookie()', async () => {
            const server = new HTTP2Server({ secure: false });

            await server.load();
            await server.listen(8482);

            // register the route
            server.getRouter().get('/cookie', (request) => {
                assert.equal(request.hasCookie('key'), true);
                assert.equal(request.getCookie('key'), 'value');

                assert.equal(request.hasCookie('key-1'), true);
                assert.equal(request.getCookie('key-1'), 'value-1');
                request.response().status(200).send();
            });


            const client = new HTTP2Client();
            await client.get('http://l.dns.porn:8482/cookie')
                .setCookie('key', 'value')
                .setCookie('key-1', 'value-1')
                .expect(200)
                .send();

            await server.close();
            await client.end();
        });
    });
});
