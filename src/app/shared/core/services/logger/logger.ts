import { Service } from '@angular/core';
import { LogLevel } from '../../models/log.model';
import { environment } from '../../../../../environments/environment';

@Service()
export class Logger {
  private level: LogLevel = environment.LOGGER.LogLevel;

  log(message: string, ...optionalParams: any[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.log(this.formatMessage('LOG', message), ...optionalParams);
    }
  }

  debug(message: string, ...optionalParams: any[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(this.formatMessage('DEBUG', message), ...optionalParams);
    }
  }

  info(message: string, ...optionalParams: any[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(this.formatMessage('INFO', message), ...optionalParams);
    }
  }

  warn(message: string, ...optionalParams: any[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage('WARN', message), ...optionalParams);
    }
  }

  error(message: string, ...optionalParams: any[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatMessage('ERROR', message), ...optionalParams);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.level && this.level !== LogLevel.OFF;
  }

  private formatMessage(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}] ${message}`;
  }
}
