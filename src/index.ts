import * as assert from 'assert';
import * as pm2 from 'pm2';

import { Handler, Options, RequestPacket, ResponsePacket } from './types';

export { Handler, Options } from './types';

const handlers: { [key: string]: Handler } = {};
const myName = process.env.name;
const myPmId = Number(process.env.pm_id);
let myBus: any;
const globalResponseListeners: Record<string, any> = {};

process.on('message', async ({ topic, data: { targetInstanceId, data, requestId } }: RequestPacket): Promise<void> => {
    if (typeof handlers[topic] === 'function' && process.send) {
      const response: ResponsePacket<any> = {
        type: `process:${targetInstanceId}`,
        data: { instanceId: myPmId, message: await handlers[topic](data), requestId },
      };

      process.send(response);
    }
  }
);

/**
 * Connects to pm2.
 */
export const connect = function connect(): Promise<void> {
  return new Promise((approve, reject): void =>
    pm2.connect(false, (err): void => {
      if (err) return reject(err);

      pm2.launchBus((err, bus): void => {
        if (err) return reject(err);

        myBus = bus;

        myBus.on(
          `process:${myPmId}`,
          ({
            data: { instanceId, message, requestId },
          }: ResponsePacket<any>): void => {
            const responseListener = globalResponseListeners[requestId];
            responseListener?.(instanceId, message);
          }
        );

        approve();
      });
    })
  );
};

/**
 * Determines whether there is a connection with pm2.
 */
export const isConnected = function isConnected(): boolean {
  return !!myBus;
};

/**
 * Disconnects from pm2.
 */
export const disconnect = function disconnect(): Promise<void> {
  return new Promise((approve, reject): void =>
    // @ts-ignore: Pass cb to pm2.disconnect
    pm2.disconnect((err): void => {
      if (err) return reject(err);

      myBus = null;

      approve();
    })
  );
};

/**
 * Random guid.
 */
const uuidv4 = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

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
  return new Promise<T[]>((resolve, reject): void => {
    assert.ok(isConnected(), 'not connected');

    const timer = setTimeout((): void => reject(new Error(`${topic} timed out`)), timeout);

    const done = function done(err: Error | null, messages: T[]): void {
      clearTimeout(timer);

      if (err) reject(err);
      else resolve(messages);
    };

    new Promise<T[]>((resolve, reject): void => {
      pm2.list((err, processes): void => {
        if (err) return reject(err);

        const messages: T[] = [];
        const resolvers: Promise<void>[] = [];

        const resolverBusTargets: number[] = [];
        const resolverSelf = async (): Promise<void> => {messages.push(await handlers[topic](data))};

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

        if (resolverBusTargets.length) {
          resolvers.push(new Promise((resolve, reject): void => {
              const pendingBusTargets = new Set(resolverBusTargets);
              const requestId = uuidv4();

              const processRequestResponses = (
                instanceId: number,
                message: any
              ) => {
                if (pendingBusTargets.delete(instanceId)) {
                  messages.push(message);
                  if (!pendingBusTargets.size) {
                    globalResponseListeners[requestId] = null;
                    resolve();
                  }
                }
              };

              globalResponseListeners[requestId] = processRequestResponses;
              const request: RequestPacket = {
                topic,
                data: { targetInstanceId: myPmId, data, requestId },
              };

              resolverBusTargets.forEach((pmId): void => {
                pm2.sendDataToProcessId(pmId, request, (err: Error): void => err && reject(err));
              });
            })
          );
        }

        Promise.all(resolvers)
          .then((): void => resolve(messages))
          .catch(reject);
      });
    })
      .then((messages): void => done(null, messages))
      .catch((err): void => done(err, []));
  });
};

/**
 * Attaches a handler for the given topic.
 */
export const onMessage = function onMessage(topic: string, handler: Handler): void {
  handlers[topic] = handler;
};

export default { connect, isConnected, disconnect, getMessages, onMessage };
