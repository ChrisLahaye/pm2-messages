import * as assert from 'assert';
import * as pm2 from 'pm2';

interface Packet { topic: string; data: any }

const handlers: { [key: string]: (packet: Packet) => any } = {};
const instanceId = Number(process.env.pm_id);
const instanceName = process.env.name;

/**
 * Message listener
 */
process.on('message', async (packet: Packet): Promise<void> => {
  if (typeof handlers[packet.topic] === 'function' && process.send) {
    const data = await handlers[packet.topic](packet);

    process.send({ type: `process:${packet.data.targetInstanceId}`, data });
  }
});

/**
 * Retrieves messages from sibling instances.
 */
export const getMessages = async function getMessages(topic: string, timeout: number = 1000): Promise<any[]> {
  const promise = new Promise(async (resolve: (messages: any[]) => void, reject): Promise<void> => {
    assert.equal(typeof handlers[topic], 'function');

    const packet = { topic, data: { targetInstanceId: instanceId } };
    const request = {
      pending: 0,
      responses: [await handlers[topic](packet)],
      timeout: setTimeout((): void => reject(new Error(`${topic} timed out`)), timeout),
    };

    const done = function done(err?: Error): void {
      clearTimeout(request.timeout);

      if (err) reject(err);
      else resolve(request.responses);
    };

    pm2.connect(false, (err): void => {
      if (err) return done(err);

      pm2.list((err, processes): void => {
        if (err) return done(err);

        const instances = processes.filter((process: any): boolean =>
          process.name === instanceName && process.pm_id !== instanceId);

        if (instances.length) request.pending += instances.length;
        else return done();

        const listener = new Promise((resolve, reject): void => {
          pm2.launchBus((err, bus): void => {
            if (err) return reject(err);

            bus.on(`process:${instanceId}`, (packet: any): void => {
              request.responses.push(packet.data);
              request.pending -= 1;

              if (!request.pending) resolve();
            });
          });
        });

        instances.forEach((instance): void => {
          if (typeof instance.pm_id === 'number') {
            pm2.sendDataToProcessId(instance.pm_id, packet, (err: Error): void => err && done(err));
          }
        });

        listener.then((): void => done(), done);
      });
    });
  });

  try {
    return promise;
  } finally {
    pm2.disconnect();
  }
};

/**
 * Adds a message handler.
 */
export const onMessage = function onMessage(topic: string, handler: (packet: Packet) => void): void {
  handlers[topic] = handler;
};

export default { getMessages, onMessage };
