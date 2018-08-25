# HTTP 2 Client

a simple http client with very basic functionality.


### API

```javascript
import HTTP2Client from 'es-modules/ds/http2-client'

const client = new HTTP2Client();

const request = client.get(url);

const response = await request.json().expect().send();
```