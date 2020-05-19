import { ProcessDescription } from 'pm2';

export type Handler = (data?: any) => any;

export interface Options {
  /**
   * Function to select the processes managed by pm2 from which messages need to be requested.
   * Defaults to processes with same name as the active process.
   */
  filter?: (process: ProcessDescription) => boolean;

  /**
   * Timeout in milliseconds (ms).
   * Defaults to 1000 ms.
   */
  timeout?: number;
}

export interface RequestPacket { topic: string; data: { targetInstanceId: number; data?: any } };

export interface ResponsePacket<T> { type: string; data: T };
