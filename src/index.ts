import * as assert from 'assert';
import * as pm2 from 'pm2';

import { Handler, Options, RequestPacket, ResponsePacket } from './types';

export { Handler, Options } from './types';

const handlers: { [key: string]: Handler } = {};
const myPmId = Number(process.env.pm_id);
const myName = process.env.name;

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
    includeSelfIfUnmanaged = false,
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

          const messages: T[] = [];
          const resolvers: Promise<void>[] = [];

          const resolverBusTargets: number[] = [];
          const resolverSelf = async (): Promise<void> => { messages.push(await handlers[topic](data)); };

          if (includeSelfIfUnmanaged && Number.isNaN(myPmId)) resolvers.push(resolverSelf());

          for (const process of processes) {
            if (filter(process)) {
              if (process.pm_id === myPmId) {
                resolvers.push(resolverSelf());
              } else if (typeof process.pm_id === 'number') {
                resolverBusTargets.push(process.pm_id);
              }
            }
          }

          console.info(resolvers.length, resolverBusTargets.length);

          if (resolverBusTargets.length) {
            resolvers.push(new Promise((resolve, reject): void => {
              pm2.launchBus((err, bus): void => {
                if (err) return reject(err);

                let pending = resolverBusTargets.length;

                bus.on(`process:${myPmId}`, ({ data }: ResponsePacket<T>): void => {
                  messages.push(data);
                  pending -= 1;

                  if (!pending) resolve();
                });

                const request: RequestPacket = { topic, data: { targetInstanceId: myPmId, data } };

                resolverBusTargets.forEach((pmId): void => {
                  pm2.sendDataToProcessId(pmId, request, (err: Error): void => err && reject(err));
                });
              });
            }));
          }

          Promise.all(resolvers)
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
 * Attaches a handler for the given topic.
 */
export const onMessage = function onMessage(topic: string, handler: Handler): void {
  handlers[topic] = handler;
};

export default { getMessages, onMessage };
