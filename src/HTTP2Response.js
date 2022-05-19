import { HTTP2IncomingMessage } from '@distributed-systems/http2-lib';


export default class HTTP2Response extends HTTP2IncomingMessage {

    

    /**
    * get the status code
    */
    status(...expect) {
        const status = this.getHeader(':status');

        if (expect.length === 0) return status;
        else return expect.includes(status);
    }



    hasCookie(name) {
        if (this.hasHeader('set-cookie')) {
            const cookies = this.getHeader('set-cookie');
            const cookie = cookies.split(',').find(c => c.trim().startsWith(`${name}=`));

            return !!cookie;
        }
        return false;
    }



    getCookie(name) {
        if (this.hasCookie(name)) {
            const cookies = this.getHeader('set-cookie');
            const cookie = cookies.split(',').find(c => c.trim().startsWith(`${name}=`));
            return this.extractCookie(cookie);
        }
    }


    extractCookie(cookieString) {
        const options = {};
        const cookieParts = /^(?<name>[^=]+)=(?<value>[^;]+)(?:;(?<options>.*))?$/.exec(cookieString);
        
        if (!cookieParts) {
            return null;
        }


        if (cookieParts.groups.options && cookieParts.groups.options.trim().length > 0) {
            const optionsArray = cookieParts.groups.options.split(';');
            for (const option of optionsArray) {
                const optionArray = option.split('=');
                const key = optionArray[0].trim();
                let value = optionArray[1].trim();

                if (/^[1-9][0-9.]*$/.test(value)) {
                    value = parseFloat(value);
                }
                options[key] = value;
            }
        }

        
        return {
            value: cookieParts.groups.value.trim(),
            name: cookieParts.groups.name.trim(),
            options,
        }
    }


    getCookies() {
        const cookies = [];

        if (this.hasHeader('set-cookie')) {
            const cookieString = this.getHeader('set-cookie');
            const cookieArray = cookieString.split(',');

            for (const cookie of cookieArray) {
                cookies.push(this.extractCookie(cookie));
            }
        }
        
        return cookies;
    }
}