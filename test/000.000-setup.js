import section, { SpecReporter } from 'section-tests';
import logd from 'logd';
import ConsoleTransport from 'logd-console-transport';

logd.transport(new ConsoleTransport());

section.use(new SpecReporter());