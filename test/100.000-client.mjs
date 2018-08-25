'use strict';

import section from 'section-tests';
import HTTP2Client from '../src/HTTP2Client.mjs';
import assert from 'assert';


section('HTTP2Client', (section) => {
    section('Basics', (section) => {
        section.test('Instantiate Client', async () => {
            new HTTP2Client();
        });


        section.test('Create a GET Request', async () => {
            const client = new HTTP2Client();
            client.get('https:/l.dns.porn:8000/test');
        });
    });
});