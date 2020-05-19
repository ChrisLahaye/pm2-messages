import { ProcessDescription } from 'pm2';

/**
 * Handles a message request by returning the requested message.
 */
export type MessageHandler = (data?: any) => any;

/**
 * Options for the `getMessages` function.
 */
export interface GetMessagesOptions {
  /**
   * Filter function to select the processes managed by pm2 from which messages need to be requested.
   * Defaults to processes with same name as the active process.
   */
  filter?: (process: ProcessDescription) => boolean;

  /**
   * Timeout in milliseconds (ms).
   * Defaults to 1000 ms.
   */
  timeout?: number;
}

/**
 * Packet used to request messages. Sent to processes managed by pm2, using the pm2 bus.
 */
export interface RequestPacket { topic: string; data: { targetInstanceId: number; data?: any } };

/**
 * Packet used to reply the requested message. Sent to the requesting process managed by pm2, using the Node.js IPC channel.
 */
export interface ResponsePacket<T> { type: string; data: T };
