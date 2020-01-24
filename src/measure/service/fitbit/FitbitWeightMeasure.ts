import {FitbitService} from './FitbitService';
import {FitbitWeightQueryResult, FitbitWeightTrendQueryResult} from './types';
import {FitbitServiceMeasure} from './FitbitServiceMeasure';
import {FitbitSummaryLogMeasure} from './FitbitSummaryLogMeasure';
import {DailyWeightTrendEntry, WeightIntraDayLogEntry} from './realm/schema';
import {
  makeFitbitWeightTrendApiUrl,
  makeFitbitWeightLogApiUrl,
  FITBIT_DATE_FORMAT,
} from './api';
import {FitbitRangeMeasure} from './FitbitRangeMeasure';
import {DateTimeHelper} from '../../../time';
import {parse, getDay} from 'date-fns';

export class FitbitWeightMeasure extends FitbitServiceMeasure {
  key: string = 'weight';

  private trendMeasure: FitbitWeightTrendMeasure;
  private logMeasure: FitbitWeightLogMeasure;

  constructor(service: FitbitService) {
    super(service);
    this.trendMeasure = new FitbitWeightTrendMeasure(service);
    this.logMeasure = new FitbitWeightLogMeasure(service);
  }

  async cacheServerData(
    endDate: number,
  ): Promise<{success: boolean; skipped?: boolean}> {
    const trendResult = await this.trendMeasure.cacheServerData(endDate);
    const logResult = await this.logMeasure.cacheServerData(endDate);

    return {
      success: trendResult.success === true && logResult.success === true,
      skipped: trendResult.skipped === true || logResult.skipped === true,
    };
  }

  protected async fetchAndCacheFitbitData(
    startDate: number,
    endDate: number,
  ): Promise<void> {
    return;
  }

  async fetchData(startDate: Date, endDate: Date): Promise<any> {
    const trendData = await this.trendMeasure.fetchData(startDate, endDate)
    const logData = await this.trendMeasure.fetchData(startDate, endDate)
    return {
      trend: trendData,
      logData: logData
    }
  }
}

class FitbitWeightTrendMeasure extends FitbitSummaryLogMeasure<
  FitbitWeightTrendQueryResult,
  DailyWeightTrendEntry
> {
  key: string = 'weight_trend';

  protected realmEntryClassType: any = DailyWeightTrendEntry;
  protected resourcePropertyKey: string = 'body-weight';

  protected makeQueryUrl(startDate: number, endDate: number): string {
    return makeFitbitWeightTrendApiUrl(startDate, endDate);
  }

  protected getQueryResultEntryValue(queryResultEntry: any) {
    return Number.parseFloat(queryResultEntry.value);
  }
}

class FitbitWeightLogMeasure extends FitbitRangeMeasure<
  FitbitWeightQueryResult
> {
  key: string = 'weight_log';

  protected resourcePropertyKey: string = 'weight';
  protected maxQueryRangeLength: number = 32;

  protected makeQueryUrl(startDate: number, endDate: number): string {
    return makeFitbitWeightLogApiUrl(startDate, endDate);
  }

  protected handleQueryResultEntry(realm: Realm, entry: any, now: Date) {
    if (entry.weight != null) {
      const numberedDate = DateTimeHelper.fromFormattedString(entry.date);
      const date = parse(entry.date, FITBIT_DATE_FORMAT, now);

      const timeSplit = entry.time.split(':')
      const hour = Number.parseInt(timeSplit[0])
      const minute = Number.parseInt(timeSplit[1])
      const second = Number.parseInt(timeSplit[2])

      realm.create(
        WeightIntraDayLogEntry,
        {
          id: entry.date + "T" + entry.time,
          value: entry.weight,
          source: entry.source,
          numberedDate,
          secondsOfDay: hour * 3600 + minute * 60 + second,
          year: DateTimeHelper.getYear(numberedDate),
          month: DateTimeHelper.getMonth(numberedDate),
          dayOfWeek: getDay(date),
        },
        true,
      );
    }
  }

  fetchData(startDate: Date, endDate: Date): Promise<any> {
    const filtered = this.service.realm
      .objects<WeightIntraDayLogEntry>(WeightIntraDayLogEntry)
      .filtered(
        'numberedDate >= ' +
          DateTimeHelper.toNumberedDateFromDate(startDate) +
          ' AND numberedDate <= ' +
          DateTimeHelper.toNumberedDateFromDate(endDate),
      );
    return filtered.snapshot().map(v => v.toJson()) as any;
  }
}
