# PM2 messages
This library provides a communication interface to retrieve messages of sibling instances in a PM2 cluster. It can be used to aggregate Prometheus metrics such that the aggregated registry represents the cluster metrics.

### Installation
Install the package with:

```sh
npm install pm2-messages --save
```

or

```sh
yarn add pm2-messages
```

### Usage
Attach the message handler:

```js
const pm2mes = require('pm2-messages');
const prom = require('prom-client');

pm2mes.onMessage('get_prom_register', (packet) => prom.register.getMetricsAsJSON());
```

Collect all messages:

```js
const metricsArr = await pm2mes.getMessages('get_prom_register');
```

Aggregate the metrics:

```js
const metrics = prom.AggregatorRegistry.aggregate(metricsArr).metrics();
```
