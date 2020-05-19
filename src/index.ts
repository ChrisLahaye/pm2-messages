import * as assert from 'assert';
import * as pm2 from 'pm2';

import { Handler, Options, RequestPacket, ResponsePacket } from './types';

export { Handler, Options } from './types';

/**
 * Attached message handles.
 */
const handlers: { [key: string]: Handler } = {};

/**
 * The pid of the current process for the pm2 God daemon process.
 */
const myPmId = Number(process.env.pm_id);

/**
 * The name of the current process given in the original start command.
 */
const myName = process.env.name;

/**
 * Handles a request packet.
 */
process.on('message', async ({ topic, data: { targetInstanceId, data } }: RequestPacket): Promise<void> => {
  if (typeof handlers[topic] === 'function' && process.send) {
    const response: ResponsePacket<any> = {
      type: `process:${targetInstanceId}`,
      data: await handlers[topic](data),
    };

    process.send(response);
  }
});

/**
 * Requests messages from processes managed by pm2.
 */
export const getMessages = function getMessages<T = any>(
  topic: string,
  data?: any,
  {
    filter = (process): boolean => process.name === myName,
    timeout = 1000,
  }: Options = {}
): Promise<T[]> {
  assert.equal(typeof handlers[topic], 'function', `Handler for ${topic} not attached or not a function`);

  return new Promise<T[]>((resolve, reject): void => {
    const timer = setTimeout((): void => reject(new Error(`${topic} timed out`)), timeout);
    const done = function done(err: Error | null, messages: T[]): void {
      clearTimeout(timer);

      if (err) reject(err);
      else resolve(messages);
    };

    pm2.connect(false, (err): void => {
      if (err) return done(err, []);

      new Promise<T[]>((resolve, reject): void => {
        pm2.list((err, processes): void => {
          if (err) return reject(err);

          const targets: number[] = [];
          const messages: T[] = [];
          const promises: Promise<void>[] = [];

          for (const process of processes) {
            if (!filter(process)) continue;

            if (process.pm_id === myPmId) {
              promises.push(
                Promise.resolve()
                  .then((): T | Promise<T> => handlers[topic](data))
                  .then((message): void => { messages.push(message) })
              );
            } else if (typeof process.pm_id === 'number') {
              targets.push(process.pm_id);
            }
          }

          if (targets.length) {
            promises.push(new Promise((resolve, reject): void => {
              pm2.launchBus((err, bus): void => {
                if (err) return reject(err);

                let pending = targets.length;

                bus.on(`process:${myPmId}`, ({ data }: ResponsePacket<T>): void => {
                  messages.push(data);
                  pending -= 1;

                  if (!pending) resolve();
                });

                const request: RequestPacket = { topic, data: { targetInstanceId: myPmId, data } };

                targets.forEach((pmId): void => {
                  pm2.sendDataToProcessId(pmId, request, (err: Error): void => err && reject(err));
                });
              });
            }));
          }

          Promise.all(promises)
            .then((): void => resolve(messages))
            .catch(reject);
        });
      })
        .then((messages): void => done(null, messages))
        .catch((err): void => done(err, []))
        .finally((): void => pm2.disconnect());
    });
  });
};

/**
 * Attaches a message handler for the given topic.
 */
export const onMessage = function onMessage(topic: string, handler: Handler): void {
  handlers[topic] = handler;
};

export default { getMessages, onMessage };
