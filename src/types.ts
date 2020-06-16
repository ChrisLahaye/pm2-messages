import { ProcessDescription } from 'pm2';

export type Handler = (data?: any) => any;

export interface Options {
  /**
   * Filter function to select the processes managed by PM2 from which messages need to be requested.
   * Defaults to processes with same name as the active process.
   */
  filter?: (process: ProcessDescription) => boolean;

  /**
   * Indicates whether messages need to be requested from the active process when it is not managed by PM2.
   * Defaults to false.
   */
  includeSelfIfUnmanaged?: boolean;

  /**
   * Timeout in milliseconds (ms).
   * Defaults to 1000 ms.
   */
  timeout?: number;
}

export interface RequestPacket { topic: string; data: { targetInstanceId: number; data?: any } };

export interface ResponsePacket<T> { type: string; data: { instanceId: number; message: T } };
