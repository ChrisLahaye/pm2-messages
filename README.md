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
await pm2mes.connect();

const metricsArr = await pm2mes.getMessages('get_prom_register');

await pm2mes.disconnect();
```

3. Aggregate the metrics

```js
const metrics = prom.AggregatorRegistry.aggregate(metricsArr).metrics();
```

## API
### Connection
Use the `connect` and `disconnect` methods to connect and disconnect from pm2, respectively. Use `isConnected` to determine whether there is a connection with pm2.

- You must call `connect()` before using `getMessages`.
- You must call `disconnect()` after having called `connect()` when you would like the process to gracefully exit.

The following example demonstrates how to properly use `connect` and `disconnect` once, instead of calling them around every `getMessages` call. 

Note that the latter will cause issues when concurrent requests are happening, i.e. when two processes in a cluster are using `getMessages` at the same time. Calling `disconnect()` in one process will wrongly affect the connections by other processes, resulting in an error when trying to use the connection (see issue [#5](https://github.com/ChrisLahaye/pm2-messages/issues/5)).

```js
const pm2mes = require('pm2-messages');

const gracefulShutdown = async function gracefulShutdown() {
  try {
    if (pm2mes.isConnected()) await pm2mes.disconnect();

    process.exit();
  } catch (err) {
    console.error(err);

    process.exit(1);
  }
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

(async () => {
  await pm2mes.connect();

  // Your code here, e.g. init server
})().catch(async (err) => {
  console.error(err);

  await gracefulShutdown();
});
```

### Message handlers
Message handlers return the requested message for a specific topic. Handlers may be asynchronous, i.e. return a promise. Requests may carry additional data, available as first argument.

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
- *includeSelfIfUnmanaged*: Indicates whether messages need to be requested from the active process when it is not managed by pm2 (see issue [#4](https://github.com/ChrisLahaye/pm2-messages/issues/4)). Defaults to false.
- *timeout*: Timeout in milliseconds (ms). Default to 1000 ms.
