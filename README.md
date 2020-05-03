# PM2 messages
This package provides a communication interface to retrieve messages of processes managed by pm2. It can be used to aggregate Prometheus metrics such that the aggregated registry represents cluster metrics.

## Installation
Install the package with:

```sh
npm install pm2-messages --save
```

or

```sh
yarn add pm2-messages
```

## Quick start
1. Attach a message handler

```js
const pm2mes = require('pm2-messages');
const prom = require('prom-client');

pm2mes.onMessage('get_prom_register', () => prom.register.getMetricsAsJSON());
```

2. Collect all messages

```js
const metricsArr = await pm2mes.getMessages('get_prom_register');
```

3. Aggregate the metrics

```js
const metrics = prom.AggregatorRegistry.aggregate(metricsArr).metrics();
```

## API
### Message handlers
Message handlers return the requested data for a specific topic. Handlers may be asynchronous, i.e. return a promise. Requests may carry additional data, available as first argument.

```js
pm2mes.onMessage('get_something', async (data) => {
  if (data.val === myVal) return doSomethingAsync();
});
```

### Collecting messages
Messages can be collected using the `getMessages` function. The first argument is required and denotes the topic, the second argument is optional and contains additional request data, and the third argument is optional and contains configuration options.

```js
const somethingArr = await pm2mes.getMessages(
  'get_something',
  { val: 'value' },
  { filter: (process) => process.name === 'my process', timeout: 100 }
);
```

### Configuration
- *filter*: Filter function to select the processes managed by pm2 from which messages need to be requested. Defaults to processes with same name as the active process, i.e. `(process): boolean => process.name === process.env.name`.
- *timeout*: Timeout in milliseconds (ms). Default to 1000 ms.
